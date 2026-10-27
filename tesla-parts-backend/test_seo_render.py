import json
import re

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

import main
from database import get_session
from main import app
from models import (
    Category,
    Page,
    Product,
    ProductSubcategoryLink,
    Schematic,
    SchematicHotspot,
    StaticPageSEO,
    Subcategory,
)
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
                slug="vazhil-perednii-livyi",
                name='Важіль "передній" лівий',
                category="Model 3",
                priceUAH=1250.0,
                image="https://img/p1.jpg",
                description="Опис",
                inStock=True,
            )
        )
        session.add(
            Product(
                id="prod-2",
                slug="pivvis-zadnia-1044331-00-c",
                name="1044331-00-C - Піввісь задня",
                category="Model 3",
                subcategory_id=371,
                detail_number="1044331-00-C",
                cross_number="104433200C, 5163001",
                priceUAH=4800.0,
                image="https://img/p2.jpg",
                description="Б/в\nоригінал",
                inStock=False,
            )
        )
        session.add(
            Product(id="prod-3", slug="bolt", name="Болт", category="Model 3", priceUAH=50.0, image="", description="", inStock=True)
        )
        session.add(ProductSubcategoryLink(product_id="prod-3", subcategory_id=371))
        session.add(SchematicHotspot(schematic_id=77, number=2, x=0, y=0, name="Тяга", part_number="1188", product_id="prod-2"))
        session.add(SchematicHotspot(schematic_id=77, number=1, x=0, y=0, name="Втулка"))
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
    assert category.title == "Запчастини Tesla Model 3 — купити з доставкою по Україні | Tesla Parts Center"
    assert category.canonical == "https://teslapartscenter.com.ua/category/model-3"

    sub = seo_render.resolve(session, "/category/model-3/sub/371")
    assert sub.title == "Задній привід Tesla Model 3 — запчастини | Tesla Parts Center"
    assert sub.description.startswith("Задній привід для Tesla Model 3: нові запчастини")
    assert sub.canonical.endswith("/category/model-3/sub/371")


def test_category_meta_from_admin_wins(session):
    seo = seo_render.resolve(session, "/category/model-y-juniper")
    assert (seo.title, seo.description) == ("Свій title", "Свій опис")


def test_product(session):
    seo = seo_render.resolve(session, "/product/vazhil-perednii-livyi")
    assert seo.title == 'Важіль "передній" лівий'
    assert seo.description == 'Важіль "передній" лівий. Ціна 1250 грн, в наявності. Доставка по Україні.'
    assert seo.canonical == "https://teslapartscenter.com.ua/product/vazhil-perednii-livyi"
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
    page = seo_render.render(INDEX_HTML, seo_render.resolve(session, "/product/vazhil-perednii-livyi"))
    assert "<title>Важіль &quot;передній&quot; лівий</title>" in page
    assert page.count("og:title") == 1
    assert page.count("og:description") == 1
    assert page.count("og:url") == 1
    assert 'property="og:site_name"' in page
    assert '<link data-rh="true" rel="canonical" href="https://teslapartscenter.com.ua/product/vazhil-perednii-livyi" />' in page
    assert 'content="Важіль &quot;передній&quot; лівий. Ціна 1250 грн, в наявності. Доставка по Україні."' in page


def test_prerender_endpoint(client):
    response = client.get("/prerender/product/vazhil-perednii-livyi?model=Model%203")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert 'rel="canonical" href="https://teslapartscenter.com.ua/product/vazhil-perednii-livyi"' in response.text


def test_old_product_id_redirects_to_slug(client):
    response = client.get("/prerender/product/prod-1?model=Model%203", follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == "/product/vazhil-perednii-livyi"


def test_prerender_falls_back_when_shop_unavailable(client, monkeypatch):
    def broken():
        raise ConnectionError("shop down")

    monkeypatch.setattr(seo_render, "load_index_html", broken)
    assert client.get("/prerender/").status_code == 502


def _json_ld(page):
    blocks = re.findall(r'<script data-rh="true" type="application/ld\+json">(.*?)</script>', page, re.S)
    return [json.loads(b) for b in blocks]


def test_product_title_gets_alternate_number(session):
    assert seo_render.resolve(session, "/product/pivvis-zadnia-1044331-00-c").title == "1044331-00-C 104433100C - Піввісь задня"
    assert seo_render.resolve(session, "/product/vazhil-perednii-livyi").title == 'Важіль "передній" лівий'


def test_product_description_gets_alternate_numbers(session):
    seo = seo_render.resolve(session, "/product/pivvis-zadnia-1044331-00-c")
    assert seo.description == "1044331-00-C - Піввісь задня. Ціна 4800 грн, під замовлення. Доставка по Україні. 104433100C, 1044332-00-C"
    assert seo_render.resolve(session, "/product/vazhil-perednii-livyi").description.endswith("Доставка по Україні.")


def test_product_json_ld_mpn(session):
    data = _json_ld(seo_render.render(INDEX_HTML, seo_render.resolve(session, "/product/pivvis-zadnia-1044331-00-c")))[0]
    assert data["sku"] == "1044331-00-C"
    assert data["mpn"] == "1044331-00-C"
    data = _json_ld(seo_render.render(INDEX_HTML, seo_render.resolve(session, "/product/vazhil-perednii-livyi")))[0]
    assert "mpn" not in data


def test_product_json_ld(session):
    page = seo_render.render(INDEX_HTML, seo_render.resolve(session, "/product/vazhil-perednii-livyi"))
    data = _json_ld(page)[0]
    assert data["@type"] == "Product"
    assert data["name"] == 'Важіль "передній" лівий'
    assert data["offers"]["price"] == 1250.0
    assert data["offers"]["priceCurrency"] == "UAH"
    assert data["offers"]["availability"] == "https://schema.org/InStock"
    assert data["offers"]["url"] == "https://teslapartscenter.com.ua/product/vazhil-perednii-livyi"
    assert data["offers"]["itemCondition"] == "https://schema.org/NewCondition"


def test_product_page_preloads_main_image(session):
    """Фото товару (LCP) має стартувати разом із HTML, а не після бандла."""
    page = seo_render.render(INDEX_HTML, seo_render.resolve(session, "/product/pivvis-zadnia-1044331-00-c"))
    assert '<link rel="preload" as="image" href="https://img/p2.jpg" fetchpriority="high">' in page


def test_category_page_preloads_first_images(session):
    page = seo_render.render(INDEX_HTML, seo_render.resolve(session, "/category/model-3"))
    preloads = re.findall(r'<link rel="preload" as="image" href="([^"]+)"', page)
    assert preloads and len(preloads) <= 2
    assert "https://img/p1.jpg" in preloads


def test_product_json_ld_breadcrumbs(session):
    blocks = _json_ld(seo_render.render(INDEX_HTML, seo_render.resolve(session, "/product/pivvis-zadnia-1044331-00-c")))
    breadcrumbs = blocks[1]
    assert breadcrumbs["@type"] == "BreadcrumbList"
    names = [item["name"] for item in breadcrumbs["itemListElement"]]
    assert names == ["Головна", "Model 3", "ЗАДНІЙ ПРИВІД", "Піввісь задня"]
    urls = [item["item"] for item in breadcrumbs["itemListElement"]]
    assert urls[-1] == "https://teslapartscenter.com.ua/product/pivvis-zadnia-1044331-00-c"


def test_json_ld_cannot_close_script_tag(session):
    product = session.get(Product, "prod-1")
    product.description = "</script><script>alert(1)</script>"
    session.add(product)
    session.commit()
    page = seo_render.render(INDEX_HTML, seo_render.resolve(session, "/product/vazhil-perednii-livyi"))
    assert "</script><script>alert(1)" not in page
    assert _json_ld(page)[0]["description"] == "</script><script>alert(1)</script>"


def test_json_ld_only_on_products(session):
    page = seo_render.render(INDEX_HTML, seo_render.resolve(session, "/category/model-3"))
    assert _json_ld(page) == []


def _root(session, path):
    page = seo_render.render(INDEX_HTML, seo_render.resolve(session, path))
    return re.search(r'<div id="root">(.*)</div>\s*</body>', page, re.S).group(1)


def test_product_body(session):
    body = _root(session, "/product/pivvis-zadnia-1044331-00-c")
    assert '<a href="/category/model-3">Model 3</a> / <a href="/category/model-3/sub/371">ЗАДНІЙ ПРИВІД</a>' in body
    assert "<h1>Піввісь задня</h1>" in body
    assert "<p><strong>4800 грн</strong> · Під замовлення</p>" in body
    assert "<p>Артикул: 1044331-00-C / 104433100C</p>" in body
    assert "<p>Крос-номери: 104433200C / 1044332-00-C, 5163001</p>" in body
    assert "<p>Б/в</p><p>оригінал</p>" in body


def test_category_body_lists_subcategories_and_own_products(session):
    body = _root(session, "/category/model-3")
    assert "<h1>Model 3</h1>" in body
    assert '<a href="/category/model-3/sub/371">ЗАДНІЙ ПРИВІД</a>' in body
    assert 'href="/product/vazhil-perednii-livyi"' in body
    assert 'href="/product/pivvis-zadnia-1044331-00-c"' not in body


def test_subcategory_body_lists_direct_and_linked_products(session):
    body = _root(session, "/category/model-3/sub/371")
    assert '<p><a href="/category/model-3">Model 3</a></p><h1>ЗАДНІЙ ПРИВІД</h1>' in body
    assert 'href="/product/pivvis-zadnia-1044331-00-c"' in body
    assert 'href="/product/bolt"' in body
    assert 'href="/product/vazhil-perednii-livyi"' not in body


def test_schematic_and_home_body(session):
    body = _root(session, "/schemes/77")
    assert "<h1>Передній стабілізатор • Model Y Стандартна</h1>" in body
    assert body.index("1. Втулка") < body.index("2. Тяга (1188)")
    assert '<a href="/product/pivvis-zadnia-1044331-00-c">2. Тяга (1188)</a>' in body

    home = _root(session, "/")
    assert 'href="/category/model-3"' in home
    assert home.startswith(
        '<div class="mb-12"><h1 class="text-3xl md:text-4xl font-bold text-center mb-2 '
        'text-tesla-dark">Запчастини для Tesla</h1>'
    )
    assert home.count("<h1") == 1
    # плитки моделей: сервер віддає їх одразу, у тому ж порядку, що й GET /categories/
    assert home.count("<h2") == 2
    assert home.index('href="/category/model-3"') < home.index('href="/category/model-y-juniper"')


def test_home_preloads_lcp_image_and_seeds_react(session):
    """Головна: LCP-картинка прелоудиться з HTML, а React стартує з тих самих даних."""
    page = seo_render.render(INDEX_HTML, seo_render.resolve(session, "/"))
    assert '<link rel="preload" as="image" href="https://img/cat.jpg" fetchpriority="high">' in page
    assert "window.__HOME_CATEGORIES__=" in page
    payload = re.search(r"window\.__HOME_CATEGORIES__=(\[.*?\]);</script>", page, re.S).group(1)
    assert json.loads(payload) == [
        {"id": 2, "name": "Model 3", "image": "https://img/cat.jpg"},
        {"id": 9, "name": "Model Y Juniper", "image": ""},
    ]
    # inline-дані не можуть закрити <script>
    assert "</script>" not in payload


def test_body_is_escaped(session):
    assert "<h1>Важіль &quot;передній&quot; лівий</h1>" in _root(session, "/product/vazhil-perednii-livyi")


@pytest.mark.parametrize(
    "path",
    ["/prerender/product/deleted", "/prerender/category/model-3/sub/999", "/prerender/schemes/1", "/prerender/no-such-page/x"],
)
def test_missing_pages_return_404_without_canonical(client, path):
    response = client.get(path)
    assert response.status_code == 404
    assert 'rel="canonical"' not in response.text
    assert '<div id="root">' in response.text


def test_legacy_category_urls_redirect(client):
    response = client.get("/prerender/model-3", follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == "/category/model-3"

    response = client.get("/prerender/model-y-juniper", follow_redirects=False)
    assert response.headers["location"] == "/category/model-y-juniper"


def test_legacy_redirect_encodes_cyrillic(session, client):
    session.add(Category(id=11, name="Аксесуари"))
    session.commit()
    response = client.get("/prerender/%D0%B0%D0%BA%D1%81%D0%B5%D1%81%D1%83%D0%B0%D1%80%D0%B8", follow_redirects=False)
    assert response.status_code == 301
    assert response.headers["location"] == "/category/%D0%B0%D0%BA%D1%81%D0%B5%D1%81%D1%83%D0%B0%D1%80%D0%B8"


@pytest.mark.parametrize("path", ["/prerender/search?q=bolt", "/prerender/checkout", "/prerender/profile"])
def test_spa_routes_stay_200(client, path):
    assert client.get(path).status_code == 200


def test_schemes_catalog_canonical_drops_filters(client):
    response = client.get("/prerender/schemes?model=Model%20Y&generation=x")
    assert response.status_code == 200
    assert 'rel="canonical" href="https://teslapartscenter.com.ua/schemes"' in response.text


def test_html_always_revalidated_but_bfcache_compatible(client):
    # middleware main.py: no-cache + must-revalidate — контент завжди свіжий,
    # але без `no-store`, бо Chrome через нього вимикає back/forward cache
    # (аудит Lighthouse bf-cache).
    for path in ("/prerender/product/vazhil-perednii-livyi", "/prerender/product/deleted"):
        header = client.get(path).headers["cache-control"]
        assert "no-cache" in header
        assert "must-revalidate" in header
        assert "no-store" not in header


def test_sitemap_has_schemes_and_shop_slugs(session, client, monkeypatch):
    session.add(Category(id=11, name="Аксесуари"))
    session.commit()
    monkeypatch.setattr(main, "engine", engine)
    xml = client.get("/sitemap.xml").text
    assert "<loc>https://teslapartscenter.com.ua/schemes</loc>" in xml
    assert "<loc>https://teslapartscenter.com.ua/schemes/77</loc>" in xml
    assert "<loc>https://teslapartscenter.com.ua/category/model-y-juniper</loc>" in xml
    assert "/category/%D0%B0%D0%BA%D1%81%D0%B5%D1%81%D1%83%D0%B0%D1%80%D0%B8</loc>" in xml
    assert "<loc>https://teslapartscenter.com.ua/category/model-3/sub/371</loc>" in xml
    assert "<loc>https://teslapartscenter.com.ua/product/vazhil-perednii-livyi</loc>" in xml
    assert "<loc>https://teslapartscenter.com.ua/product/prod-1</loc>" not in xml


def test_category_seo_text_paragraphs_only_on_category(session):
    category = session.get(Category, 2)
    category.seo_text = "Перший абзац.\n\nДругий <абзац>."
    session.add(category)
    session.commit()
    body = _root(session, "/category/model-3")
    assert "<p>Перший абзац.</p><p>Другий &lt;абзац&gt;.</p>" in body
    assert "Перший абзац" not in _root(session, "/category/model-3/sub/371")


def test_subcategory_ignores_category_meta(session):
    session.add(Subcategory(id=500, name="ФАРИ", category_id=9))
    session.commit()
    seo = seo_render.resolve(session, "/category/model-y-juniper/sub/500")
    assert seo.title == "Фари Tesla Model Y Juniper — запчастини | Tesla Parts Center"


def test_sentence_case_and_accessories_templates():
    assert seo_render.sentence_case("ВНУТРІШНЄ ОЗДОБЛЕННЯ СТІЙОК АВС") == "Внутрішнє оздоблення стійок АВС"
    assert seo_render.sentence_case("Вже нормальна назва") == "Вже нормальна назва"
    title, _ = seo_render.category_meta("Аксесуари")
    assert title == "Аксесуари для Tesla — купити з доставкою по Україні | Tesla Parts Center"
    title, _ = seo_render.subcategory_meta("КИЛИМКИ", "Аксесуари")
    assert title == "Килимки для Tesla | Tesla Parts Center"
