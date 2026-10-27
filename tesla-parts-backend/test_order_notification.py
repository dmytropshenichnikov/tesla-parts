"""Сповіщення замовлення в Telegram: артикул без «N/A» та виділена знижка."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from database import get_session
from main import app
from models import Order, OrderItem, Product, PromoCode
from services import part_numbers
from services.telegram import build_order_message

engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)

RATE = 42.0


@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


def _order(session: Session, items: list[dict], total: float, promocode=None, discount=None) -> Order:
    order = Order(
        customer_first_name="Сергій",
        customer_last_name="Дишкант",
        customer_phone="097 352 75 04",
        delivery_city="Кривий Ріг",
        delivery_branch="Відділення №8",
        payment_method="Накладений платіж",
        totalUSD=total,
        promocode=promocode,
        discount_usd=discount,
    )
    session.add(order)
    session.commit()
    session.refresh(order)
    for payload in items:
        session.add(OrderItem(order_id=order.id, **payload))
    session.commit()
    session.refresh(order)
    return order


def test_extract_from_name():
    assert part_numbers.extract_from_name("118841100F - Кулак поворотний задній лівий") == "118841100F"
    assert part_numbers.extract_from_name("1044331-00-C - Піввісь задня") == "1044331-00-C"
    assert part_numbers.extract_from_name("AA01500001 - Масло ZF") == "AA01500001"
    assert part_numbers.extract_from_name("108950700D Обмежувач дверки") == "108950700D"
    # не вгадуємо, коли це не артикул
    assert part_numbers.extract_from_name("Model 3 - Стабілізатор") is None
    assert part_numbers.extract_from_name("Комплект для заміни сайлентблоків") is None
    assert part_numbers.extract_from_name("2017-2023 - Підкрильник") is None
    assert part_numbers.extract_from_name("2 - рулони плівки") is None
    assert part_numbers.extract_from_name("") is None


def test_message_takes_code_from_stored_field(session):
    order = _order(
        session,
        [{
            "product_id": "prod-x",
            "product_name": "Кулак поворотний задній лівий",
            "product_detail_number": "118841100F",
            "quantity": 1,
            "price_at_purchase": 163.0,
        }],
        total=163.0,
    )
    message = build_order_message(order, RATE, session)
    assert "<b>118841100F</b> Кулак поворотний" in message
    assert "N/A" not in message


def test_message_takes_code_from_product_in_db(session):
    # товар додали в кошик, коли артикула ще не було, потім адмін його заповнив
    session.add(Product(id="prod-db", name="Кулак поворотний правий", detail_number="118841600F",
                        category="Model 3", priceUAH=6800.0, image="", description="", inStock=True))
    session.commit()
    order = _order(
        session,
        [{
            "product_id": "prod-db",
            "product_name": "Кулак поворотний правий",
            "product_detail_number": None,
            "quantity": 1,
            "price_at_purchase": 163.0,
        }],
        total=163.0,
    )
    message = build_order_message(order, RATE, session)
    assert "<b>118841600F</b> Кулак поворотний" in message
    assert "N/A" not in message


def test_message_takes_code_from_name_without_duplicates(session):
    order = _order(
        session,
        [{
            "product_id": "prod-unknown",
            "product_name": "149915100A - Захист переднього підрамника Tesla Model 3, Y",
            "product_detail_number": None,
            "quantity": 1,
            "price_at_purchase": 50.0,
        }],
        total=50.0,
    )
    message = build_order_message(order, RATE, session)
    # назва вже починається з артикула — не друкуємо його вдруге
    assert "149915100A" in message
    assert message.count("149915100A") == 1
    assert "N/A" not in message


def test_message_without_code_has_no_na(session):
    order = _order(
        session,
        [{
            "product_id": None,
            "product_name": "Комплект для заміни сайлентблоків",
            "product_detail_number": None,
            "quantity": 1,
            "price_at_purchase": 30.0,
        }],
        total=30.0,
    )
    message = build_order_message(order, RATE, session)
    assert "N/A" not in message
    assert "- Комплект для заміни сайлентблоків <b>1 шт.</b>" in message


def test_message_shows_highlighted_discount_with_code(session):
    order = _order(session, [{"product_name": "Товар", "quantity": 1, "price_at_purchase": 100.0}],
                   total=90.0, promocode="SAVE10", discount=10.0)
    message = build_order_message(order, RATE, session)
    assert "<b><u>Знижка</u></b>: <b>-10.00 USD (-420.00 UAH)</b>, за кодом <code>SAVE10</code>" in message
    # сума у повідомленні — вже зі знижкою
    assert "<b>Сума</b>: 90.00 USD (3780.00 UAH)" in message


def test_message_shows_personal_discount_without_code(session):
    order = _order(session, [{"product_name": "Товар", "quantity": 1, "price_at_purchase": 100.0}],
                   total=85.0, discount=15.0)
    message = build_order_message(order, RATE, session)
    assert "-15.00 USD (-630.00 UAH)</b>, персональна знижка клієнта" in message
    assert "SAVE" not in message


def test_message_has_no_discount_line_when_discount_missing(session):
    order = _order(session, [{"product_name": "Товар", "quantity": 1, "price_at_purchase": 100.0}],
                   total=100.0)
    message = build_order_message(order, RATE, session)
    assert "Знижка" not in message


# ---------------- через API: артикул підхоплюється, знижка зберігається ----------------

@pytest.fixture(name="client")
def client_fixture(session, monkeypatch):
    def override():
        yield session

    # ендпоінт додає фонову задачу відправки в Telegram — у тестах вимикаємо
    import routers.orders as orders_router

    monkeypatch.setattr(orders_router, "send_telegram_notification", lambda order: None)
    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def _order_payload(items, total, promocode=None):
    return {
        "items": items,
        "totalUSD": total,
        "customer": {"firstName": "Сергій", "lastName": "Дишкант", "phone": "0973527504"},
        "delivery": {"city": "Кривий Ріг", "branch": "Відділення №8 ()"},
        "paymentMethod": "Накладений платіж",
        **({"promocode": promocode} if promocode else {}),
    }


def test_create_order_saves_promo_discount_and_code(session, client):
    session.add(PromoCode(code="SAVE10", discount_type="percent", discount_value=10,
                          scope="everyone", is_active=True))
    session.add(Product(id="prod-api", name="118841100F - Кулак поворотний", detail_number="118841100F",
                        category="Model 3", priceUAH=4200.0, priceUSD=100.0,
                        image="", description="", inStock=True))
    session.commit()

    response = client.post("/orders/", json=_order_payload(
        items=[{
            "id": "prod-api",
            "name": "118841100F - Кулак поворотний",
            "category": "Model 3",
            "priceUAH": 4200.0,
            "priceUSD": 100.0,
            "image": "",
            "description": "",
            "inStock": True,
            "quantity": 1,
        }],
        total=90.0,
        promocode="save10",
    ))
    assert response.status_code == 200

    order = session.get(Order, response.json()["id"])
    assert order.promocode == "SAVE10"
    assert order.discount_usd == 10.0
    # артикул позиції підхоплено з товару, хоча в кошику його не було
    assert order.items[0].product_detail_number == "118841100F"


def test_create_order_without_promo_has_no_discount(session, client):
    response = client.post("/orders/", json=_order_payload(
        items=[{
            "id": "prod-no-promo",
            "name": "Стабілізатор",
            "category": "Model 3",
            "priceUAH": 4200.0,
            "priceUSD": 100.0,
            "image": "",
            "description": "",
            "inStock": True,
            "quantity": 1,
        }],
        total=100.0,
    ))
    assert response.status_code == 200
    order = session.get(Order, response.json()["id"])
    assert order.promocode is None
    assert order.discount_usd is None
    # артикула в назві немає — у полі теж порожньо, але не «N/A»
    assert order.items[0].product_detail_number is None
