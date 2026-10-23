"""Серверні title/description/canonical для сторінок магазину.

Шаблони збігаються з fallback-ами SeoHead у tesla-parts-shop: Google отримує
те саме, що React потім ставить у браузері.
"""
import html
import json
import os
import re
import time
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

import requests
from sqlmodel import Session, or_, select

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

SITE_URL = "https://teslapartscenter.com.ua"
SITE_NAME = "Tesla Parts Center"
DEFAULT_TITLE = SITE_NAME
DEFAULT_DESCRIPTION = "Tesla Parts Center пропонує запчастини та аксесуари для вашого електромобіля."

# у магазині лише нові товари (як у SeoHead)
ITEM_CONDITION = "https://schema.org/NewCondition"

SHOP_INDEX_URL = os.getenv("SHOP_INDEX_URL", "http://shop:80/index.html")
INDEX_TTL_SECONDS = 5
MAX_LINKS = 300

STATIC_TITLES = {
    "about": "Про нас",
    "delivery": "Доставка та оплата",
    "returns": "Повернення",
    "faq": "Часті питання",
    "contacts": "Контакти",
}


@dataclass
class PageSeo:
    title: str = DEFAULT_TITLE
    description: str = DEFAULT_DESCRIPTION
    canonical: str = SITE_URL + "/"
    image: Optional[str] = None
    og_type: str = "website"
    json_ld: list = field(default_factory=list)
    body: str = ""


def slugify(value: str) -> str:
    # як utils/slugify.ts у магазині
    return re.sub(r"\s+", "-", (value or "").lower().strip())


def _first(*values: Optional[str]) -> Optional[str]:
    for value in values:
        if value and value.strip():
            return value.strip()
    return None


def _e(value) -> str:
    return html.escape(str(value or ""), quote=True)


def _links(items) -> str:
    rows = [f'<li><a href="{_e(href)}">{_e(text)}</a></li>' for href, text in list(items)[:MAX_LINKS]]
    return f"<ul>{''.join(rows)}</ul>" if rows else ""


def _static_seo(session: Session, slug: str) -> Optional[StaticPageSEO]:
    return session.exec(select(StaticPageSEO).where(StaticPageSEO.slug == slug)).first()


def _category_by_slug(session: Session, slug: str) -> Optional[Category]:
    for category in session.exec(select(Category)).all():
        if slugify(category.name) == slug:
            return category
    return None


def _home(session: Session) -> PageSeo:
    seo = _static_seo(session, "home")
    return PageSeo(
        title=_first(seo and seo.meta_title, "Tesla Parts Center | Магазин запчастин для Tesla"),
        description=_first(
            seo and seo.meta_description,
            "Популярні запчастини Tesla з гарантією якості та швидкою доставкою по Україні.",
        ),
        canonical=SITE_URL + "/",
        body=_links(
            (f"/category/{slugify(c.name)}", c.name)
            for c in session.exec(select(Category).order_by(Category.sort_order.desc())).all()
        ),
    )


def _category(session: Session, slug: str, sub_id: Optional[int]) -> Optional[PageSeo]:
    category = _category_by_slug(session, slug)
    if not category:
        return None
    canonical = f"{SITE_URL}/category/{slug}"
    breadcrumb = ""
    if sub_id is None:
        heading = category.name
        description = f"Категорія {category.name}: підберіть запчастини для вашої Tesla."
        children = session.exec(
            select(Subcategory)
            .where(Subcategory.category_id == category.id, Subcategory.parent_id == None)  # noqa: E711
            .order_by(Subcategory.sort_order)
        ).all()
        # як у products.read_products: у самій категорії — лише товари без підкатегорії
        products = session.exec(
            select(Product)
            .where(Product.category.contains(category.name), Product.subcategory_id == None)  # noqa: E711
            .where(~Product.linked_subcategories.any())
            .order_by(Product.sort_order)
        ).all()
    else:
        sub = session.get(Subcategory, sub_id)
        if not sub or sub.category_id != category.id:
            return None
        heading = sub.name
        description = f"Запчастини підкатегорії {sub.name} в категорії {category.name}."
        canonical += f"/sub/{sub_id}"
        children = session.exec(
            select(Subcategory).where(Subcategory.parent_id == sub.id).order_by(Subcategory.sort_order)
        ).all()
        products = session.exec(
            select(Product)
            .where(
                or_(
                    Product.subcategory_id == sub.id,
                    Product.linked_subcategories.any(ProductSubcategoryLink.subcategory_id == sub.id),
                )
            )
            .order_by(Product.sort_order)
        ).all()
        breadcrumb = f'<p><a href="/category/{_e(slug)}">{_e(category.name)}</a></p>'
    body = (
        breadcrumb
        + f"<h1>{_e(heading)}</h1>"
        + _links((f"/category/{slug}/sub/{c.id}", c.name) for c in children)
        + _links((f"/product/{p.id}", p.name) for p in products)
    )
    if sub_id is None and category.seo_text:
        # як у магазині: абзаци через порожній рядок
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", category.seo_text) if p.strip()]
        body += "".join(f"<p>{_e(p)}</p>" for p in paragraphs)
    return PageSeo(
        title=_first(category.meta_title, f"{heading} | {SITE_NAME}"),
        description=_first(category.meta_description, description),
        canonical=canonical,
        image=category.image,
        body=body,
    )


def _price(value: float) -> str:
    return f"{value:g}"


def _product(session: Session, product_id: str) -> Optional[PageSeo]:
    product = session.get(Product, product_id)
    if not product:
        return None
    return PageSeo(
        title=_first(product.meta_title, product.name),
        description=_first(
            product.meta_description,
            f"Купити {product.name} за ціною {_price(product.priceUAH)} грн",
        ),
        canonical=f"{SITE_URL}/product/{product.id}",
        image=product.image,
        og_type="product",
        json_ld=[_product_json_ld(product)],
        body=_product_body(product),
    )


def _clean_title(product: Product) -> str:
    # як cleanTitle у ProductPage.tsx: без артикула на початку назви
    name = product.name or ""
    number = product.detail_number or ""
    if number and name.lower().startswith(number.lower()):
        name = re.sub(r"^[\s\-–—:]+", "", name[len(number):])
    return name.strip() or product.name


def _product_body(product: Product) -> str:
    parts = []
    sub = product.subcategory
    if sub and sub.category:
        cat_slug = slugify(sub.category.name)
        parts.append(
            f'<p><a href="/category/{_e(cat_slug)}">{_e(sub.category.name)}</a> / '
            f'<a href="/category/{_e(cat_slug)}/sub/{sub.id}">{_e(sub.name)}</a></p>'
        )
    parts.append(f"<h1>{_e(_clean_title(product))}</h1>")
    stock = "В наявності" if product.inStock else "Під замовлення"
    parts.append(f"<p>{_price(product.priceUAH)} грн · {stock}</p>")
    if product.detail_number:
        parts.append(f"<p>Артикул: {_e(product.detail_number)}</p>")
    if product.description:
        parts.append("<p>" + _e(product.description).replace("\n", "<br>") + "</p>")
    return "".join(parts)


def _product_json_ld(product: Product) -> dict:
    url = f"{SITE_URL}/product/{product.id}"
    return {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": _first(product.meta_title, product.name),
        "image": [product.image] if product.image else [],
        "description": _first(product.meta_description, product.description, product.name),
        "sku": product.detail_number or product.id,
        "brand": {"@type": "Brand", "name": "Tesla"},
        "offers": {
            "@type": "Offer",
            "url": url,
            "priceCurrency": "UAH",
            "price": round(product.priceUAH, 2),
            "priceValidUntil": (date.today() + timedelta(days=365)).isoformat(),
            "availability": "https://schema.org/InStock" if product.inStock else "https://schema.org/OutOfStock",
            "itemCondition": ITEM_CONDITION,
        },
    }


def _info(session: Session, slug: str) -> Optional[PageSeo]:
    page = session.exec(select(Page).where(Page.slug == slug, Page.is_published == True)).first()  # noqa: E712
    if not page and slug not in STATIC_TITLES:
        return None
    seo = _static_seo(session, slug)
    title = (page and page.title) or STATIC_TITLES.get(slug) or SITE_NAME
    text = re.sub(r"<[^>]+>", " ", page.content).strip() if page else ""
    if not text:
        fallback_description = "Tesla Parts Center — інтернет-магазин запчастин для Tesla."
    elif len(text) > 160:
        fallback_description = text[:157].rstrip() + "..."
    else:
        fallback_description = text
    return PageSeo(
        title=_first(seo and seo.meta_title, f"{title} | {SITE_NAME}"),
        description=_first(seo and seo.meta_description, fallback_description),
        canonical=f"{SITE_URL}/info/{slug}",
        # контент сторінок з адмінки — так само, як його виводить StaticPage
        body=f"<h1>{_e(title)}</h1>" + (page.content.replace("\n", "<br>") if page else ""),
    )


def _reviews() -> PageSeo:
    return PageSeo(
        title="Відгуки клієнтів | Tesla Parts Center",
        description="Що про нас кажуть клієнти. Переглядайте скріншоти відгуків про запчастини Tesla від нашого магазину.",
        canonical=f"{SITE_URL}/reviews",
        body="<h1>Відгуки клієнтів</h1>",
    )


def _schematic(session: Session, schematic_id: int) -> Optional[PageSeo]:
    schematic = session.get(Schematic, schematic_id)
    if not schematic:
        return None
    car = f"Tesla {schematic.model} {schematic.generation}".strip()
    return PageSeo(
        title=f"{schematic.title} — схема {car} | {SITE_NAME}",
        description=f"Схема «{schematic.title}» для {car}: номери деталей і запчастини з цієї схеми.",
        canonical=f"{SITE_URL}/schemes/{schematic.id}",
        image=schematic.image_url,
        body=_schematic_body(session, schematic),
    )


def _schematic_body(session: Session, schematic: Schematic) -> str:
    hotspots = session.exec(
        select(SchematicHotspot)
        .where(SchematicHotspot.schematic_id == schematic.id)
        .order_by(SchematicHotspot.number)
    ).all()
    items = []
    for spot in hotspots[:MAX_LINKS]:
        label = f"{spot.number}. {spot.name}" + (f" ({spot.part_number})" if spot.part_number else "")
        if spot.product_id:
            items.append(f'<li><a href="/product/{_e(spot.product_id)}">{_e(label)}</a></li>')
        else:
            items.append(f"<li>{_e(label)}</li>")
    heading = f"<h1>{_e(schematic.title)} • {_e(schematic.model)} {_e(schematic.generation)}</h1>"
    return heading + (f"<ul>{''.join(items)}</ul>" if items else "")


# маршрути магазину без власних SEO-даних — віддаємо як є, з кодом 200
SPA_ROUTES = {
    "/search",
    "/garage",
    "/checkout",
    "/success",
    "/login",
    "/register",
    "/verify",
    "/profile",
    "/forgot-password",
    "/reset-password",
}


def _schemes_catalog() -> PageSeo:
    return PageSeo(
        title=f"Схеми запчастин Tesla | {SITE_NAME}",
        description="Каталог схем запчастин Tesla Model 3, Model Y, Model S і Model X з номерами деталей.",
        canonical=f"{SITE_URL}/schemes",
    )


def legacy_redirect(session: Session, path: str) -> Optional[str]:
    """Старі адреси /model-3, /аксесуари тощо -> /category/<slug>."""
    match = re.fullmatch(r"/([^/]+)", "/" + path.strip("/"))
    if match and _category_by_slug(session, match.group(1)):
        return f"/category/{match.group(1)}"
    return None


def resolve(session: Session, path: str) -> Optional[PageSeo]:
    """SEO сторінки за шляхом без query; None — якщо сторінки не існує."""
    path = "/" + path.strip("/")
    if path == "/":
        return _home(session)
    if path == "/reviews":
        return _reviews()
    if path == "/schemes":
        return _schemes_catalog()
    if path in SPA_ROUTES:
        return PageSeo(canonical=SITE_URL + path)
    match = re.fullmatch(r"/category/([^/]+)(?:/sub/(\d+))?", path)
    if match:
        return _category(session, match.group(1), int(match.group(2)) if match.group(2) else None)
    match = re.fullmatch(r"/product/([^/]+)", path)
    if match:
        return _product(session, match.group(1))
    match = re.fullmatch(r"/info/([^/]+)", path)
    if match:
        return _info(session, match.group(1))
    match = re.fullmatch(r"/schemes/(\d+)", path)
    if match:
        return _schematic(session, int(match.group(1)))
    return None


_index_cache = {"html": None, "at": 0.0}


def load_index_html() -> str:
    now = time.monotonic()
    if _index_cache["html"] is None or now - _index_cache["at"] > INDEX_TTL_SECONDS:
        response = requests.get(SHOP_INDEX_URL, timeout=3)
        response.raise_for_status()
        _index_cache.update(html=response.text, at=now)
    return _index_cache["html"]


_OG_TAG = re.compile(r'\s*<meta\s+property="og:(title|description|image|type|url)"[^>]*/>', re.S)


def _head_tags(seo: PageSeo) -> str:
    # data-rh: react-helmet-async замінить ці теги своїми, без дублів
    tags = [
        f'<meta data-rh="true" name="description" content="{_e(seo.description)}" />',
        f'<meta data-rh="true" property="og:title" content="{_e(seo.title)}" />',
        f'<meta data-rh="true" property="og:description" content="{_e(seo.description)}" />',
        f'<meta data-rh="true" property="og:type" content="{seo.og_type}" />',
    ]
    if seo.canonical:
        tags.append(f'<link data-rh="true" rel="canonical" href="{_e(seo.canonical)}" />')
        tags.append(f'<meta data-rh="true" property="og:url" content="{_e(seo.canonical)}" />')
    if seo.image:
        tags.append(f'<meta data-rh="true" property="og:image" content="{_e(seo.image)}" />')
    for data in seo.json_ld:
        payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
        tags.append(f'<script data-rh="true" type="application/ld+json">{payload}</script>')
    return "\n    ".join(tags)


def render(index_html: str, seo: PageSeo) -> str:
    page = _OG_TAG.sub("", index_html)
    page = re.sub(
        r"<title>.*?</title>",
        lambda _: f"<title>{html.escape(seo.title)}</title>",
        page,
        count=1,
        flags=re.S,
    )
    page = page.replace("</head>", f"    {_head_tags(seo)}\n  </head>", 1)
    # createRoot у index.tsx замінює вміст #root своєю розміткою
    return page.replace('<div id="root"></div>', f'<div id="root">{seo.body}</div>', 1)
