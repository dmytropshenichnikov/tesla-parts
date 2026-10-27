import html

import requests
from models import Order, Product, Settings
from sqlmodel import Session
from database import engine
from services import part_numbers
from services.pricing import get_exchange_rate

def _get_setting_value(session: Session, key: str) -> str | None:
    setting = session.get(Settings, key)
    return setting.value if setting else None

def send_plain_message(text: str) -> bool:
    """Надіслати довільний текст у чат власника. True якщо відправлено."""
    try:
        with Session(engine) as session:
            bot_token = _get_setting_value(session, "telegram_bot_token")
            chat_id = _get_setting_value(session, "telegram_chat_id")
        if not bot_token or not chat_id or "YOUR_" in bot_token:
            print("Telegram credentials not set, skipping message")
            return False
        url = "https://api.telegram.org/bot%s/sendMessage" % bot_token
        requests.post(
            url,
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=15,
        )
        return True
    except Exception as e:
        print("Failed to send telegram message: %s" % e)
        return False


def notify_admin_new_client(client_email: str) -> None:
    """Сповіщення власнику в Telegram про нового зареєстрованого клієнта."""
    try:
        send_plain_message(
            "<b>Новий клієнт зареєструвався</b> | %s" % client_email
        )
    except Exception as e:
        print("admin tg notify failed: %s" % e)


def _resolve_item_code(session: Session, item) -> str:
    """Артикул позиції: збережений у кошику -> з БД -> з початку назви.

    Повертає порожній рядок, якщо артикула нізвідки не взяти (щоб у повідомленні
    не було «N/A» — у такому випадку друкується лише назва).
    """
    value = (item.product_detail_number or "").strip()
    if value:
        return value
    if item.product_id:
        product = session.get(Product, item.product_id)
        if product and (product.detail_number or "").strip():
            return product.detail_number.strip()
    return part_numbers.extract_from_name(item.product_name) or ""


def build_order_message(order: Order, rate: float, session: Session) -> str:
    """HTML-текст сповіщення про замовлення (виокремлено для тестів)."""
    created = order.created_at.strftime("%d.%m.%Y %H:%M") if order.created_at else ""
    message = f"<b>Нове замовлення #{order.id}</b>\n"
    if created:
        message += f"<b>Створено</b>: {created}\n"
    total_usd = order.totalUSD or 0
    legacy_mode = total_usd <= 0
    if legacy_mode:
        legacy_total = 0.0
        for item in order.items:
            price = item.price_at_purchase or 0
            legacy_total += (price / rate if rate else price) * item.quantity
        total_usd = round(legacy_total, 2)
    total_uah = round(total_usd * rate, 2) if rate else total_usd
    message += f"<b>Покупець</b>: {order.customer_first_name} {order.customer_last_name}\n"
    message += f"<b>Телефон</b>: {order.customer_phone}\n"
    message += f"<b>Доставка</b>: {order.delivery_city}, {order.delivery_branch}\n"
    message += f"<b>Сума</b>: {total_usd:.2f} USD ({total_uah:.2f} UAH)\n"

    # Знижка окремим виділеним рядком: бачимо одразу, навіть якщо це
    # персональна знижка клієнта без промокоду.
    discount = float(order.discount_usd or 0)
    if discount >= 0.1:
        discount_uah = round(discount * rate, 2) if rate else discount
        if order.promocode:
            reason = f", за кодом <code>{html.escape(order.promocode)}</code>"
        else:
            reason = ", персональна знижка клієнта"
        message += (
            f"<b><u>Знижка</u></b>: <b>-{discount:.2f} USD "
            f"(-{discount_uah:.2f} UAH)</b>{reason}\n"
        )

    message += f"<b>Оплата</b>: {order.payment_method}\n"
    if order.note:
        message += f"<b>Коментар</b>: {order.note}\n"
    message += "<b>Товари</b>:\n"

    for item in order.items:
        usd_price = item.price_at_purchase or 0
        if legacy_mode:
            usd_price = usd_price / rate if rate else usd_price
        uah_price = round(usd_price * rate, 2) if rate else usd_price

        # Без «N/A»: код дістаємо з кошика/БД/назви, а якщо його нема —
        # просто назва. Якщо назва вже починається з артикула, не дублюємо.
        code = _resolve_item_code(session, item)
        product_name = item.product_name or ""
        if code and product_name.lower().startswith(code.lower()):
            prefix = ""
        else:
            prefix = f"<b>{html.escape(code)}</b> " if code else ""
        safe_name = html.escape(product_name)

        if item.quantity > 1:
            item_total_usd = usd_price * item.quantity
            item_total_uah = uah_price * item.quantity
            price_str = f"{item_total_usd:.2f} USD ({item_total_uah:.2f} UAH)"
        else:
            price_str = f"{usd_price:.2f} USD ({uah_price:.2f} UAH)"

        message += (
            f"- {prefix}{safe_name} <b>{item.quantity} шт.</b> "
            f"(<b>{price_str}</b>)\n"
        )

    return message


def send_telegram_notification(order: Order):
    with Session(engine) as session:
        bot_token = _get_setting_value(session, "telegram_bot_token")
        chat_id = _get_setting_value(session, "telegram_chat_id")
        rate = get_exchange_rate(session)

        if not bot_token or not chat_id or "YOUR_" in bot_token:
            print("Telegram credentials not set, skipping notification")
            return

        # order з якогось запиту може бути detached — перечитуємо зі своєї
        # сесії, щоб items точно підвантажились. Якщо перечитати не вийшло
        # (наприклад, схема БД ще не оновлена) — будуємо з переданого об'єкта,
        # аби сповіщення відправилось, а не загубилось.
        try:
            fresh = session.get(Order, order.id)
        except Exception as exc:  # noqa: BLE001
            print(f"telegram: не вдалося перечитати замовлення: {exc}")
            fresh = None
        if fresh is not None:
            order = fresh

        message = build_order_message(order, rate, session)

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print(f"Failed to send telegram notification: {e}")
