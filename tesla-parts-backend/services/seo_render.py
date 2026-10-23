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
from sqlmodel import Session, select

from models import Category, Page, Product, Schematic, StaticPageSEO, Subcategory

SITE_URL = "https://teslapartscenter.com.ua"
SITE_NAME = "Tesla Parts Center"
DEFAULT_TITLE = SITE_NAME
DEFAULT_DESCRIPTION = "Tesla Parts Center пропонує запчастини та аксесуари для вашого електромобіля."

# як у SeoHead магазину
ITEM_CONDITION = "https://schema.org/UsedCondition"

SHOP_INDEX_URL = os.getenv("SHOP_INDEX_URL", "http://shop:80/index.html")
INDEX_TTL_SECONDS = 60

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


def slugify(value: str) -> str:
    # як utils/slugify.ts у магазині
    return re.sub(r"\s+", "-", (value or "").lower().strip())


def _first(*values: Optional[str]) -> Optional[str]:
    for value in values:
        if value and value.strip():
            return value.strip()
    return None


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
    )


def _category(session: Session, slug: str, sub_id: Optional[int]) -> Optional[PageSeo]:
    category = _category_by_slug(session, slug)
    if not category:
        return None
    canonical = f"{SITE_URL}/category/{slug}"
    if sub_id is None:
        heading = category.name
        description = f"Категорія {category.name}: підберіть запчастини для вашої Tesla."
    else:
        sub = session.get(Subcategory, sub_id)
        if not sub or sub.category_id != category.id:
            return None
        heading = sub.name
        description = f"Запчастини підкатегорії {sub.name} в категорії {category.name}."
        canonical += f"/sub/{sub_id}"
    return PageSeo(
        title=_first(category.meta_title, f"{heading} | {SITE_NAME}"),
        description=_first(category.meta_description, description),
        canonical=canonical,
        image=category.image,
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
    )


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
    )


def _reviews() -> PageSeo:
    return PageSeo(
        title="Відгуки клієнтів | Tesla Parts Center",
        description="Що про нас кажуть клієнти. Переглядайте скріншоти відгуків про запчастини Tesla від нашого магазину.",
        canonical=f"{SITE_URL}/reviews",
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
    )


def resolve(session: Session, path: str) -> Optional[PageSeo]:
    """SEO сторінки за шляхом без query; None — якщо сторінки не існує."""
    path = "/" + path.strip("/")
    if path == "/":
        return _home(session)
    if path == "/reviews":
        return _reviews()
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
    esc = lambda value: html.escape(value, quote=True)  # noqa: E731
    tags = [
        f'<meta data-rh="true" name="description" content="{esc(seo.description)}" />',
        f'<link data-rh="true" rel="canonical" href="{esc(seo.canonical)}" />',
        f'<meta data-rh="true" property="og:title" content="{esc(seo.title)}" />',
        f'<meta data-rh="true" property="og:description" content="{esc(seo.description)}" />',
        f'<meta data-rh="true" property="og:type" content="{seo.og_type}" />',
        f'<meta data-rh="true" property="og:url" content="{esc(seo.canonical)}" />',
    ]
    if seo.image:
        tags.append(f'<meta data-rh="true" property="og:image" content="{esc(seo.image)}" />')
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
    return page.replace("</head>", f"    {_head_tags(seo)}\n  </head>", 1)
