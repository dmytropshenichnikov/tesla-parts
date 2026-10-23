import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from auth import create_access_token, get_password_hash
from database import get_session
from main import app
from models import Category, User

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)


@pytest.fixture(name="client")
def client_fixture():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(User(username="admin", hashed_password=get_password_hash("x")))
        session.add(Category(id=2, name="Model 3", meta_title="Свій title"))
        session.commit()

        def override():
            yield session

        app.dependency_overrides[get_session] = override
        yield TestClient(app)
        app.dependency_overrides.clear()


def auth():
    return {"Authorization": f"Bearer {create_access_token({'sub': 'admin'})}"}


def test_update_sets_seo_text(client):
    response = client.put("/categories/2", data={"name": "Model 3", "seo_text": "Текст про Model 3"}, headers=auth())
    assert response.status_code == 200
    assert response.json()["seo_text"] == "Текст про Model 3"
    listed = client.get("/categories/").json()
    assert listed[0]["seo_text"] == "Текст про Model 3"


def test_update_without_seo_text_keeps_it(client):
    client.put("/categories/2", data={"name": "Model 3", "seo_text": "Текст"}, headers=auth())
    # так адмінка змінює порядок сортування — без seo_text у формі
    response = client.put("/categories/2", data={"name": "Model 3", "sort_order": "5"}, headers=auth())
    assert response.json()["seo_text"] == "Текст"
    assert response.json()["meta_title"] == "Свій title"

