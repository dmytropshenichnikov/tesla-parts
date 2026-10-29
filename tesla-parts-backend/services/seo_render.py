"""Серверні title/description/canonical для сторінок магазину.

Шаблони збігаються з fallback-ами SeoHead у tesla-parts-shop: Google отримує
те саме, що React потім ставить у браузері.
"""
import dataclasses
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

from services import part_numbers
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
# Понад цю кількість товарів посів не вбудовуємо — HTML був би завеликим,
# у такому разі фронт, як і раніше, завантажить дані сам.
MAX_SEED_PRODUCTS = 300

MAX_LINKS = 300
# H1 головної — той самий у shop utils/seoTemplates.ts (HOME_H1)
HOME_H1 = "Запчастини для Tesla"

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
    # Додаткові теги в <head>: <link rel=preload> для LCP-картинки, інлайн-JS
    # з даними, які React має мати вже при першому рендері (щоб не було CLS).
    head_extra: list = field(default_factory=list)


def slugify(value: str) -> str:
    # як utils/slugify.ts у магазині
    return re.sub(r"\s+", "-", (value or "").lower().strip())


def _first(*values: Optional[str]) -> Optional[str]:
    for value in values:
        if value and value.strip():
            return value.strip()
    return None


KEEP_UPPER = {"АВС"}


def sentence_case(value: str) -> str:
    # як sentenceCase у utils/seoTemplates.ts: «ЗАДНІЙ ПРИВІД» -> «Задній привід»
    if value != value.upper():
        return value
    words = [w.upper() if w.upper() in KEEP_UPPER else w for w in value.lower().split(" ")]
    text = " ".join(words)
    return text[:1].upper() + text[1:]


def _is_model(name: str) -> bool:
    return re.match(r"model\s", name.strip(), re.I) is not None


def category_meta(name: str) -> tuple:
    if _is_model(name):
        return (
            f"Запчастини Tesla {name} — купити з доставкою по Україні | {SITE_NAME}",
            f"Запчастини для Tesla {name}: нові деталі з номерами, ціни й наявність, підбір за схемами. Доставка по Україні.",
        )
    return (
        f"{name} для Tesla — купити з доставкою по Україні | {SITE_NAME}",
        f"{name} для Tesla: нові товари, ціни й наявність. Доставка по Україні.",
    )


def subcategory_meta(name: str, category_name: str) -> tuple:
    sub = sentence_case(name)
    if not _is_model(category_name):
        return (
            f"{sub} для Tesla | {SITE_NAME}",
            f"{sub} для Tesla: нові товари, ціни й наявність. Доставка по Україні.",
        )
    return (
        f"{sub} Tesla {category_name} — запчастини | {SITE_NAME}",
        f"{sub} для Tesla {category_name}: нові запчастини з номерами деталей, ціни й наявність. Доставка по Україні.",
    )


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


API_ORIGIN = "https://api.teslapartscenter.com.ua"


def _media(url: str) -> str:
    """Фото з api.* -> свій домен: nginx шлюзу проксіює /static/ у бекенд."""
    if url.startswith(API_ORIGIN + "/static/"):
        return url[len(API_ORIGIN) :]
    return url


def _home_hero_card(category: Category, position: int) -> str:
    """Плитка моделі — рівно та сама розмітка, що й у Hero.tsx (компонент магазину).

    Однакова геометрія = React після старту перемальовує ті самі блоки,
    тому контент не «стрибає» (CLS), а Google/LCP бачить картинки одразу в HTML.
    """
    href = f"/category/{slugify(category.name)}"
    image = category.image or ""
    priority = (
        ' fetchpriority="high" loading="eager" decoding="async"'
        if position < 2
        else ' loading="lazy" decoding="async"'
    )
    card = (
        f'<a href="{_e(href)}" class="group relative h-64 md:h-96 rounded-2xl overflow-hidden '
        'cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-300 ease-out '
        'active:scale-[0.98]" style="WebkitTapHighlightColor:transparent">'
        '<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 '
        'group-hover:via-black/25 transition-all duration-300 z-10"></div>'
    )
    if image:
        # 480w-варіант (генерується поряд з оригіналом): картка ~400 px завширшки,
        # тому 900-піксельний файл — це +50 КБ на картку і повільніший LCP.
        image = _media(image)
        srcset = ""
        # Варіанти існують лише для локальних файлів (/static/...). Для зовнішніх
        # сховищ (Cloudinary) srcset не додаємо, інакше картинка 404.
        if image.lower().endswith(".webp") and image.startswith("/static/"):
            small = image[:-5] + "-480.webp"
            srcset = f' srcset="{_e(small)} 480w, {_e(image)} 900w" sizes="(min-width: 1024px) 33vw, 100vw"'
        card += (
            f'<img src="{_e(image)}"{srcset} alt="{_e(category.name)}" width="800" height="500"{priority} '
            'class="absolute inset-0 w-full h-full object-cover transform transition-transform '
            'duration-500 ease-out">'
        )
    else:
        card += '<div class="absolute inset-0 bg-white"></div>'
    card += (
        '<div class="absolute bottom-0 left-0 p-6 z-20 text-white w-full">'
        f'<h2 class="text-xl md:text-2xl font-bold mb-1">{_e(category.name)}</h2>'
        '<div class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider '
        'text-gray-200 group-hover:text-white transition-colors">'
        '<span>Переглянути каталог</span>'
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" '
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        'stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path>'
        '<path d="m12 5 7 7-7 7"></path></svg>'
        "</div></div></a>"
    )
    return card


def _home(session: Session) -> PageSeo:
    seo = _static_seo(session, "home")
    # Порядок і склад — як у GET /categories/ (sort_order desc, id), щоб дані,
    # які підвантажить React, збіглися з тим, що вже намальовано сервером.
    categories = session.exec(
        select(Category).order_by(Category.sort_order.desc(), Category.id)
    ).all()
    cards = "".join(_home_hero_card(c, i) for i, c in enumerate(categories))
    hero = (
        '<div class="mb-12">'
        f'<h1 class="text-3xl md:text-4xl font-bold text-center mb-2 text-tesla-dark">{HOME_H1}</h1>'
        '<p class="text-center text-lg text-gray-500 mb-8 font-manrope">Оберіть модель вашого Tesla</p>'
        f'<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">{cards}</div>'
        "</div>"
    )

    head_extra = []
    # Прелоуд перших плиток: LCP-картинки стартують разом із HTML, а не після JS.
    for c in categories[:2]:
        if c.image:
            media = _media(c.image)
            if media.lower().endswith(".webp") and media.startswith("/static/"):
                small = media[:-5] + "-480.webp"
                head_extra.append(
                    f'<link rel="preload" as="image" href="{_e(small)}" '
                    f'imagesrcset="{_e(small)} 480w, {_e(media)} 900w" '
                    'imagesizes="(min-width: 1024px) 33vw, 100vw" fetchpriority="high">'
                )
            else:
                head_extra.append(
                    f'<link rel="preload" as="image" href="{_e(media)}" fetchpriority="high">'
                )
    # React має ті самі категорії при ПЕРШОМУ рендері (useState(() => window.__...)),
    # інакше плитки зникнуть біжучим запитом і сторінка знову стрибне.
    payload = json.dumps(
        [{"id": c.id, "name": c.name, "image": c.image or ""} for c in categories],
        ensure_ascii=False,
    ).replace("<", "\\u003c")
    head_extra.append(f"<script>window.__HOME_CATEGORIES__={payload};</script>")

    return PageSeo(
        title=_first(seo and seo.meta_title, "Tesla Parts Center | Магазин запчастин для Tesla"),
        description=_first(
            seo and seo.meta_description,
            "Популярні запчастини Tesla з гарантією якості та швидкою доставкою по Україні.",
        ),
        canonical=SITE_URL + "/",
        body=hero,
        head_extra=head_extra,
    )


def _product_path(product: Product) -> str:
    """Людиночитаний шлях товару; fallback на старий id, якщо slug ще немає."""
    return f"/product/{product.slug or product.id}"


def _category(session: Session, slug: str, sub_id: Optional[int]) -> Optional[PageSeo]:
    category = _category_by_slug(session, slug)
    if not category:
        return None
    canonical = f"{SITE_URL}/category/{slug}"
    breadcrumb = ""
    if sub_id is None:
        heading = category.name
        title, description = category_meta(category.name)
        title = _first(category.meta_title, title)
        description = _first(category.meta_description, description)
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
        title, description = subcategory_meta(sub.name, category.name)
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
        + _links((_product_path(p), p.name) for p in products)
    )
    if sub_id is None and category.seo_text:
        # як у магазині: абзаци через порожній рядок
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", category.seo_text) if p.strip()]
        body += "".join(f"<p>{_e(p)}</p>" for p in paragraphs)

    # Перші дві картинки (плитки підкатегорій або картки товарів) стартують
    # разом із HTML — вони ж і є LCP на сторінці категорії.
    head_extra = []
    for item in list(children) + list(products):
        if not item.image:
            continue
        head_extra.append(
            f'<link rel="preload" as="image" href="{_e(item.image)}" fetchpriority="high">'
        )
        if len(head_extra) >= 2:
            break

    # Посів даних у HTML: React при ПЕРШОМУ рендері одразу має плитки підкатегорій
    # і товари. Без нього після першого фарбування вміст з'являвся з фази
    # завантаження (крутілка/скелет) і сторінка стрибала — Lighthouse CLS 0.45
    # на сторінках підкатегорій. Якщо дані вже в HTML — фронт не робить повторних
    # запитів, тож вміст більше ніколи не змінюється.
    if len(products) <= MAX_SEED_PRODUCTS:
        try:
            from routers.categories import (  # noqa: WPS433 — ліниво, щоб не було циклу
                _serialize_subcategory_tree_no_products,
                _sort_subcategories,
            )

            all_subs = session.exec(
                select(Subcategory)
                .where(Subcategory.category_id == category.id)
                .order_by(Subcategory.sort_order.desc(), Subcategory.id)
            ).all()
            roots = _sort_subcategories([x for x in all_subs if x.parent_id is None])
            category_payload = category.model_dump()
            category_payload.pop("seo_text", None)
            category_payload["subcategories"] = [
                _serialize_subcategory_tree_no_products(root, all_subs).model_dump()
                for root in roots
            ]
            seed = {
                # шлях без домену — саме так його порівнює фронт (location.pathname)
                "path": canonical.removeprefix(SITE_URL),
                "category": category_payload,
                "products": [item.model_dump(exclude={"created_at"}) for item in products],
            }
            if sub_id:
                # Блок «Схема цього вузла» завантажувався після фарбування і
                # зсував товари вниз (залишковий CLS ~0.25) — вбудовуємо в HTML.
                from routers.schematics import get_schematics_for_subcategory  # noqa: WPS433

                seed["subcategoryId"] = sub_id
                seed["schemes"] = get_schematics_for_subcategory(sub_id, session).get(
                    "schematics", []
                )
            payload = json.dumps(seed, ensure_ascii=False, default=str).replace("<", "\\u003c")
            head_extra.append(f"<script>window.__CATEGORY_PAGE__={payload};</script>")
        except Exception as exc:  # noqa: BLE001 — поіт не має ламати рендеринг SEO
            print(f"category seed skipped: {exc}")

    return PageSeo(
        title=title,
        description=description,
        canonical=canonical,
        image=category.image,
        body=body,
        head_extra=head_extra,
    )


def _price(value: float) -> str:
    return f"{value:g}"


def _product(session: Session, identifier: str) -> Optional[PageSeo]:
    product = session.exec(
        select(Product).where(
            or_(Product.slug == identifier, Product.id == identifier)
        )
    ).first()
    if not product:
        return None
    # Старий id-URL не віддаємо як 200: legacy_redirect зробить 301 на slug.
    if product.slug and identifier != product.slug:
        return None
    return PageSeo(
        title=part_numbers.insert_alternates(_first(product.meta_title, product.name), product.detail_number),
        description=part_numbers.with_alternates(
            _first(
                product.meta_description,
                # як fallbackDescription у ProductPage.tsx
                f"{product.name}. Ціна {_price(product.priceUAH)} грн, "
                f"{'в наявності' if product.inStock else 'під замовлення'}. Доставка по Україні.",
            ),
            product.detail_number,
            product.cross_number,
        ),
        canonical=f"{SITE_URL}{_product_path(product)}",
        image=product.image,
        og_type="product",
        json_ld=[_product_json_ld(product)] + _product_breadcrumb_json_ld(product),
        body=_product_body(product),
        # Головне фото товару — LCP сторінки: завантажується одразу з HTML,
        # не чекаючи бандл і відповіді API.
        head_extra=(
            [f'<link rel="preload" as="image" href="{_e(product.image)}" fetchpriority="high">']
            if product.image
            else []
        ),
    )


def _clean_title(product: Product) -> str:
    # як cleanTitle у ProductPage.tsx: без артикула на початку назви
    from services.product_slug import clean_title

    return clean_title(product.name, product.detail_number) or (product.name or "")


def _product_breadcrumbs(product: Product) -> list:
    items = [("Головна", "/")]
    sub = product.subcategory
    if sub and sub.category:
        cat_slug = slugify(sub.category.name)
        items.append((sub.category.name, f"/category/{cat_slug}"))
        items.append((sub.name, f"/category/{cat_slug}/sub/{sub.id}"))
    items.append((_clean_title(product), _product_path(product)))
    return items


def _product_body(product: Product) -> str:
    # Повноцінний серверний HTML товару: Google бачить його без виконання JS.
    parts = ['<nav aria-label="breadcrumbs">']
    crumbs = []
    for text, href in _product_breadcrumbs(product):
        crumbs.append(f'<a href="{_e(href)}">{_e(text)}</a>')
    parts.append(" / ".join(crumbs) + "</nav>")
    parts.append(f"<h1>{_e(_clean_title(product))}</h1>")
    if product.image:
        parts.append(
            f'<p><img src="{_e(product.image)}" alt="{_e(_clean_title(product))}" '
            f'width="480" height="480" loading="eager"></p>'
        )
    stock = "В наявності" if product.inStock else "Під замовлення"
    parts.append(f"<p><strong>{_price(product.priceUAH)} грн</strong> · {stock}</p>")
    if part_numbers.split_numbers(product.detail_number):
        parts.append(f"<p>Артикул: {_e(part_numbers.display(product.detail_number))}</p>")
    if part_numbers.split_numbers(product.cross_number):
        parts.append(f"<p>Крос-номери: {_e(part_numbers.display(product.cross_number))}</p>")
    if product.description:
        paragraphs = [p.strip() for p in re.split(r"\n+", product.description) if p.strip()]
        parts.extend(f"<p>{_e(p)}</p>" for p in paragraphs)
    return "".join(parts)


def _product_json_ld(product: Product) -> dict:
    url = f"{SITE_URL}{_product_path(product)}"
    data = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": part_numbers.insert_alternates(_first(product.meta_title, product.name), product.detail_number),
        "image": [product.image] if product.image else [],
        "description": _first(product.meta_description, product.description, product.name),
        "sku": product.detail_number or product.id,
        "brand": {"@type": "Brand", "name": "Tesla"},
        "url": url,
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
    mpn = part_numbers.hyphenated(product.detail_number)
    if mpn:
        data["mpn"] = mpn
    return data


def _product_breadcrumb_json_ld(product: Product) -> list:
    items = []
    for position, (text, href) in enumerate(_product_breadcrumbs(product), start=1):
        items.append({
            "@type": "ListItem",
            "position": position,
            "name": text,
            "item": f"{SITE_URL}{href}",
        })
    if not items:
        return []
    return [{
        "@context": "https://schema.org/",
        "@type": "BreadcrumbList",
        "itemListElement": items,
    }]


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
    product_ids = [spot.product_id for spot in hotspots if spot.product_id]
    products_by_id = {}
    if product_ids:
        for product in session.exec(select(Product).where(Product.id.in_(product_ids))).all():
            products_by_id[product.id] = product
    items = []
    for spot in hotspots[:MAX_LINKS]:
        label = f"{spot.number}. {spot.name}" + (f" ({spot.part_number})" if spot.part_number else "")
        product = products_by_id.get(spot.product_id) if spot.product_id else None
        if product:
            items.append(f'<li><a href="{_e(_product_path(product))}">{_e(label)}</a></li>')
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
    """Старі адреси -> нові.

    - /product/prod-xxxx (старий id) -> /product/<slug> (301, щоб Google
      переніс вагу на нову людиночитану адресу);
    - /model-3, /аксесуари тощо -> /category/<slug>.
    """
    match = re.fullmatch(r"/product/([^/]+)", "/" + path.strip("/"))
    if match:
        product = session.exec(
            select(Product).where(
                or_(Product.slug == match.group(1), Product.id == match.group(1))
            )
        ).first()
        if product and product.slug and product.slug != match.group(1):
            return _product_path(product)
        return None

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
    # head_extra першим: прелоуд LCP-картинки має стартувати до CSS/JS.
    tags = list(seo.head_extra) + [
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
        tags.append(f'<meta data-rh="true" property="og:image:alt" content="{_e(seo.title)}" />')
    tags.append(f'<meta data-rh="true" name="twitter:card" content="summary_large_image" />')
    tags.append(f'<meta data-rh="true" name="twitter:title" content="{_e(seo.title)}" />')
    tags.append(f'<meta data-rh="true" name="twitter:description" content="{_e(seo.description)}" />')
    if seo.image:
        tags.append(f'<meta data-rh="true" name="twitter:image" content="{_e(seo.image)}" />')
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
    # head_extra — одразу після <head>: preload LCP-картинки має бути знайдено
    # до інлайн-CSS і скриптів, інакше браузер виявляє його на 10-20 мс пізніше.
    preloads = [t for t in seo.head_extra if t.startswith("<link")]
    scripts = [t for t in seo.head_extra if not t.startswith("<link")]
    if preloads:
        page = page.replace("<head>", "<head>\n    " + "\n    ".join(preloads), 1)
    # _head_tags сам додає head_extra — тут він не потрібен, інакше теги дублюються
    base_seo = dataclasses.replace(seo, head_extra=[])
    extra = scripts + [t for t in _head_tags(base_seo).split("\n    ") if t.strip()]
    page = page.replace("</head>", "    " + "\n    ".join(extra) + "\n  </head>", 1)
    # createRoot у index.tsx замінює вміст #root своєю розміткою
    return page.replace('<div id="root"></div>', f'<div id="root">{seo.body}</div>', 1)
