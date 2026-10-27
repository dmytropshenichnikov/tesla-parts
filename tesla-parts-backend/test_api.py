import pytest
from fastapi.testclient import TestClient
from main import app
from models import Product, Order, OrderItem, Settings, User
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool
from database import get_session
from auth import create_access_token, get_password_hash

# У dev-БД лежать справжні реквізити бота — без цього кожен запуск тестів
# відправляв у чат власника тестове замовлення.
import routers.orders as orders_router

orders_router.send_telegram_notification = lambda order: None

# Use in-memory DB for tests
sqlite_url = "sqlite:///:memory:"
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False}, poolclass=StaticPool)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session_override():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_session_override

client = TestClient(app)

@pytest.fixture(name="session")
def session_fixture():
    create_db_and_tables()
    with Session(engine) as session:
        admin_user = User(
            username="admin",
            hashed_password=get_password_hash("adminpassword")
        )
        session.add(admin_user)
        session.commit()
        yield session
    SQLModel.metadata.drop_all(engine)

def get_admin_headers():
    token = create_access_token({"sub": "admin"})
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Tesla Parts API is running"}

def test_create_product(session: Session):
    product_data = {
        "id": "test-1",
        "name": "Test Product",
        "category": "Test",
        "priceUAH": "400.0",
        "priceUSD": "10.0",
        "image": "http://example.com/image.png",
        "description": "Test Description",
        "inStock": "true",
        "cross_number": "",
        "detail_number": "123",
    }
    headers = {"Authorization": get_admin_headers()["Authorization"]}
    response = client.post("/products/", data=product_data, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Product"

def test_create_order(session: Session):
    # First create a product
    product_data = {
        "id": "test-1",
        "name": "Test Product",
        "category": "Test",
        "priceUAH": "100.0",
        "priceUSD": "0.0",
        "image": "http://example.com/image.png",
        "description": "Test Description",
        "inStock": "true",
        "cross_number": "",
        "detail_number": "123",
    }
    headers = {"Authorization": get_admin_headers()["Authorization"]}
    response = client.post("/products/", data=product_data, headers=headers)
    product_id = response.json()["id"]

    order_data = {
        "items": [{
            "id": product_id,
            "name": "Test Product",
            "category": "Test",
            "priceUAH": 400.0,
            "priceUSD": 10.0,
            "image": "...",
            "description": "...",
            "inStock": True,
            "quantity": 2,
            "cross_number": ""
        }],
        "totalUSD": 20.0,
        "customer": {"firstName": "John", "lastName": "Doe", "phone": "1234567890"},
        "delivery": {"city": "Kyiv", "branch": "1"},
        "paymentMethod": "card"
    }
    response = client.post("/orders/", json=order_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "created"
    assert "id" in data

def test_create_product_with_image(session: Session):
    pass

def test_get_social_links(session: Session):
    # First, create some settings
    instagram_setting = Settings(key="instagram_link", value="https://instagram.com/test")
    telegram_setting = Settings(key="telegram_link", value="https://t.me/test")
    session.add(instagram_setting)
    session.add(telegram_setting)
    session.commit()

    response = client.get("/settings/social-links")
    assert response.status_code == 200
    data = response.json()
    assert data["instagram"] == "https://instagram.com/test"
    assert data["telegram"] == "https://t.me/test"

def test_update_social_links(session: Session):
    # Test without auth
    response = client.post("/settings/social-links", json={"instagram": "new_insta", "telegram": "new_tele"})
    assert response.status_code == 401

    # Test with auth
    response = client.post("/settings/social-links", json={"instagram": "new_insta", "telegram": "new_tele"}, headers=get_admin_headers())
    assert response.status_code == 200
    assert response.json() == {"message": "Social links updated successfully"}

    # Verify the changes
    response = client.get("/settings/social-links")
    data = response.json()
    assert data["instagram"] == "new_insta"
    assert data["telegram"] == "new_tele"
