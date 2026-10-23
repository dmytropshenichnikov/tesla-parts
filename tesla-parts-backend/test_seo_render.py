import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from database import get_session
from main import app
from models import Category, Page, Product, Schematic, StaticPageSEO, Subcategory
from services import seo_render

INDEX_HTML = """<!doctype html>
<html lang="uk">
  <head>
    <title>Tesla Parts Center</title>
    <meta property="og:site_name" content="Tesla Parts Center" />
    <meta property="og:title" content="Tesla Parts Center" />
    <meta
      property="og:description"
      content="Купуйте оригінальні та перевірені запчастини для Tesla з доставкою по Україні."
    />
    <meta property="og:url" content="https://teslapartscenter.com.ua" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>"""

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)


@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        model3 = Category(id=2, name="Model 3", image="https://img/cat.jpg")
        session.add(model3)
        session.add(Subcategory(id=371, name="ЗАДНІЙ ПРИВІД", category_id=2))
        session.add(Category(id=9, name="Model Y Juniper", meta_title="Свій title", meta_description="Свій опис"))
        session.add(
            Product(
                id="prod-1",
                name='Важіль "передній" лівий',
                category="Model 3",
                priceUAH=1250.0,
                image="https://img/p1.jpg",
                description="Опис",
                inStock=True,
            )
        )
        session.add(Page(slug="delivery", title="Доставка та оплата", content="<p>Нова пошта по всій Україні</p>"))
        session.add(StaticPageSEO(slug="home", meta_title="Головна з адмінки"))
        session.add(
            Schematic(id=77, title="Передній стабілізатор", model="Model Y", generation="Стандартна",
                      section="ПІДВІСКА", subsystem="СТАБІЛІЗАТОР", image_url="https://img/s.png")
        )
        session.commit()
        yield session


@pytest.fixture(name="client")
def client_fixture(session, monkeypatch):
    def override():
        yield session

    app.dependency_overrides[get_session] = override
    monkeypatch.setattr(seo_render, "load_index_html", lambda: INDEX_HTML)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_home_uses_admin_meta(session):
    seo = seo_render.resolve(session, "")
    assert seo.title == "Головна з адмінки"
    assert seo.description.startswith("Популярні запчастини Tesla")
    assert seo.canonical == "https://teslapartscenter.com.ua/"


def test_category_and_subcategory_fallbacks(session):
    category = seo_render.resolve(session, "/category/model-3")
    assert category.title == "Model 3 | Tesla Parts Center"
    assert category.canonical == "https://teslapartscenter.com.ua/category/model-3"

    sub = seo_render.resolve(session, "/category/model-3/sub/371")
    assert sub.title == "ЗАДНІЙ ПРИВІД | Tesla Parts Center"
    assert sub.description == "Запчастини підкатегорії ЗАДНІЙ ПРИВІД в категорії Model 3."
    assert sub.canonical.endswith("/category/model-3/sub/371")


def test_category_meta_from_admin_wins(session):
    seo = seo_render.resolve(session, "/category/model-y-juniper")
    assert (seo.title, seo.description) == ("Свій title", "Свій опис")


def test_product(session):
    seo = seo_render.resolve(session, "/product/prod-1")
    assert seo.title == 'Важіль "передній" лівий'
    assert seo.description == 'Купити Важіль "передній" лівий за ціною 1250 грн'
    assert seo.canonical == "https://teslapartscenter.com.ua/product/prod-1"
    assert seo.og_type == "product"


def test_info_schematic_reviews(session):
    info = seo_render.resolve(session, "/info/delivery")
    assert info.title == "Доставка та оплата | Tesla Parts Center"
    assert info.description == "Нова пошта по всій Україні"

    scheme = seo_render.resolve(session, "/schemes/77")
    assert scheme.title.startswith("Передній стабілізатор — схема Tesla Model Y")
    assert scheme.canonical.endswith("/schemes/77")

    assert seo_render.resolve(session, "/reviews").canonical.endswith("/reviews")


def test_unknown_entities_resolve_to_none(session):
    for path in ("/product/nope", "/category/nope", "/category/model-3/sub/999", "/schemes/1", "/model-3"):
        assert seo_render.resolve(session, path) is None


def test_render_replaces_head_without_duplicates(session):
    page = seo_render.render(INDEX_HTML, seo_render.resolve(session, "/product/prod-1"))
    assert "<title>Важіль &quot;передній&quot; лівий</title>" in page
    assert page.count("og:title") == 1
    assert page.count("og:description") == 1
    assert page.count("og:url") == 1
    assert 'property="og:site_name"' in page
    assert '<link data-rh="true" rel="canonical" href="https://teslapartscenter.com.ua/product/prod-1" />' in page
    assert 'content="Купити Важіль &quot;передній&quot; лівий за ціною 1250 грн"' in page


def test_prerender_endpoint(client):
    response = client.get("/prerender/product/prod-1?model=Model%203")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert 'rel="canonical" href="https://teslapartscenter.com.ua/product/prod-1"' in response.text


def test_prerender_falls_back_when_shop_unavailable(client, monkeypatch):
    def broken():
        raise ConnectionError("shop down")

    monkeypatch.setattr(seo_render, "load_index_html", broken)
    assert client.get("/prerender/").status_code == 502
