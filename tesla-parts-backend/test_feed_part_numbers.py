import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from database import get_session
from main import app
from models import Product
from routers import feeds

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)


@pytest.fixture(name="client")
def client_fixture(monkeypatch):
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Product(id="prod-1", name="161086600A - Панель передня", category="Model 3",
                            detail_number="161086600A", priceUAH=4554.0, image="", description="", inStock=True))
        session.add(Product(id="prod-2", name="AA01500001 - Масло ZF", category="Model 3",
                            detail_number="AA01500001", priceUAH=900.0, image="", description="", inStock=True))
        session.commit()

        def override():
            yield session

        app.dependency_overrides[get_session] = override
        monkeypatch.setattr(feeds, "get_exchange_rate", lambda s: 42.0)
        yield TestClient(app)
        app.dependency_overrides.clear()


def test_google_feed_title_gets_hyphen_variant(client):
    xml = client.get("/feed/google-merchant.xml").text
    assert "<g:title>161086600A 1610866-00-A - Панель передня</g:title>" in xml
    assert "<g:title>AA01500001 - Масло ZF</g:title>" in xml
    assert "<g:id>prod-1</g:id>" in xml
