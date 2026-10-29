import re

from fastapi import FastAPI, Response, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from starlette.exceptions import HTTPException as StarletteHTTPException
import mimetypes

# Контейнер не має /etc/mime.types, тому .webp віддавався як
# application/octet-stream і картинка категорії не показувалась у браузері.
for _ext, _type in (
    (".webp", "image/webp"),
    (".avif", "image/avif"),
    (".heic", "image/heic"),
    (".heif", "image/heif"),
    (".jpeg", "image/jpeg"),
    (".jpg", "image/jpeg"),
    (".svg", "image/svg+xml"),
):
    mimetypes.add_type(_type, _ext)

from sqlmodel import Session, select
from typing import List
from database import create_db_and_tables, engine, get_session
from routers import products, orders, categories, settings, pages, auth, feeds, reviews, customers, promocodes, email_campaigns, analytics, schematics, vin, garage, prerender
from contextlib import asynccontextmanager
import os
from models import Product, Category, Subcategory, Page, StaticPageSEO, Schematic
from services.seo_render import slugify
from services.image_uploader import make_thumbnail, make_variant, make_width_variants
from urllib.parse import quote
from schemas import StaticPageSEORead, StaticPageSEOUpdate
from dependencies import get_current_admin

DEFAULT_STATIC_SEO = {
    "home": {
        "meta_title": "Tesla Parts Center | Магазин запчастин для Tesla",
        "meta_description": "Купуйте оригінальні та перевірені запчастини для Tesla з доставкою по Україні."
    },
    "about": {
        "meta_title": "Про Tesla Parts Center",
        "meta_description": "Дізнайтеся більше про команду Tesla Parts Center та наш підхід до сервісу."
    },
    "delivery": {
        "meta_title": "Доставка та оплата | Tesla Parts Center",
        "meta_description": "Інформація про варіанти доставки та оплати у Tesla Parts Center."
    },
    "returns": {
        "meta_title": "Повернення та гарантія | Tesla Parts Center",
        "meta_description": "Правила повернення товарів та гарантійні умови інтернет-магазину Tesla Parts Center."
    },
    "faq": {
        "meta_title": "Часті питання | Tesla Parts Center",
        "meta_description": "Відповіді на популярні питання клієнтів Tesla Parts Center."
    },
    "contacts": {
        "meta_title": "Контакти Tesla Parts Center",
        "meta_description": "Зв’яжіться з нами для консультації або замовлення запчастин."
    },
}

def ensure_static_seo_records():
    with Session(engine) as session:
        for slug, defaults in DEFAULT_STATIC_SEO.items():
            existing = session.exec(
                select(StaticPageSEO).where(StaticPageSEO.slug == slug)
            ).first()
            if not existing:
                session.add(
                    StaticPageSEO(
                        slug=slug,
                        meta_title=defaults.get("meta_title"),
                        meta_description=defaults.get("meta_description"),
                    )
                )
        session.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    ensure_static_seo_records()
    yield

app = FastAPI(lifespan=lifespan)

class VariantStaticFiles(StaticFiles):
    """Статика + підстраховка для зменшених варіантів фото.

    Сайт просить <uuid>-480.webp / -160.webp (srcset у плитках моделей). Нові
    завантаження генерують їх одразу, але для старих файлів або після переносу
    на інший сервер варіанта може не бути — тоді створюємо його на першому
    запиті, щоб картинка не віддала 404.
    """

    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            is_sm = path.endswith("-sm.webp")
            if exc.status_code != 404 or not (
                is_sm or re.search(r"-\d+\.webp$", path)
            ):
                raise
            match = None if is_sm else re.search(r"-(\d+)\.webp$", path)
            base = re.sub(r"-(?:sm|\d+)(?=\.webp$)", "", path)
            if not match:
                raise
            # Оригінал може бути .webp, .png або .jpg (скріншоти відгуків — PNG).
            original = next(
                (cand for cand in (Path("static") / base,) if cand.exists()),
                None,
            )
            if original is None:
                stem = (Path("static") / base).with_suffix("")
                original = next(
                    (p for ext in (".webp", ".png", ".jpg", ".jpeg")
                     if (p := stem.with_suffix(ext)).exists()),
                    None,
                )
            if original is None:
                raise
            if is_sm:
                # Мініатюра для карток («-sm.webp») — 480 px, як у завантажувачі.
                make_thumbnail(original)
            else:
                # Генеруємо саме ту ширину, яку просить srcset (480/720/1000/160/...).
                make_variant(original, int(match.group(1)))
            return await super().get_response(path, scope)


app.mount("/static", VariantStaticFiles(directory="static"), name="static")

# CORS Configuration
# Add your production frontend URLs here
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://teslapartscenter.com.ua",
    "https://www.teslapartscenter.com.ua",
    "https://admin.teslapartscenter.com.ua",
]

# Add frontend URL from environment variable if set
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)
    # Also add with trailing slash
    origins.append(frontend_url.rstrip("/"))

@app.middleware("http")
async def always_fresh_api(request: Request, call_next):
    """API завжди свіжий: без цього браузер міг віддати старі дані з кешу
    (напр. старі картинки розділів у схемах) навіть після правки на сервері.
    Статику (картинки) не чіпаємо — її кешувати корисно."""
    response = await call_next(request)
    if not request.url.path.startswith("/static"):
        # Раніше було `no-store` — Chrome через це вимикав back/forward cache
        # (аудит bf-cache: «Pages with cache-control:no-store cannot enter
        # bfcache»). `no-cache, must-revalidate` зберігає гарантію свіжості
        # (браузер зобов'язаний перепитувати в сервера), але дозволяє bfcache.
        response.headers["Cache-Control"] = "no-cache, max-age=0, must-revalidate"
        response.headers["Pragma"] = "no-cache"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(orders.router)
app.include_router(categories.router)
app.include_router(settings.router)
app.include_router(pages.router)
app.include_router(auth.router) # Include auth router
app.include_router(feeds.router) # Include feeds router
app.include_router(reviews.router) # Include reviews router
app.include_router(customers.router)
app.include_router(promocodes.router)
app.include_router(email_campaigns.router)
app.include_router(analytics.router)
app.include_router(schematics.router)
app.include_router(vin.router)
app.include_router(garage.router)
app.include_router(prerender.router)

@app.get("/")
def read_root():
    return {"message": "Tesla Parts API is running"}

def _slugify(value: str) -> str:
    # той самий slug, що в магазині (utils/slugify.ts), у URL-кодуванні
    return quote(slugify(value))

@app.get("/sitemap.xml", response_class=Response)
@app.head("/sitemap.xml", response_class=Response)
def get_sitemap():
    base_url = "https://teslapartscenter.com.ua"
    with Session(engine) as session:
        products = session.exec(select(Product)).all()
        categories = session.exec(select(Category)).all()
        subcategories = session.exec(select(Subcategory)).all()
        pages = session.exec(select(Page).where(Page.is_published == True)).all()
        schematics = session.exec(select(Schematic)).all()

    category_map = {c.id: _slugify(c.name) for c in categories if c.id and c.name}

    # lastmod — чесна дата останньої зміни контенту (найновіший товар). Google
    # використовує її як підказку для переобходу, зокрема головної сторінки.
    last_content = max((p.created_at for p in products if p.created_at), default=None)
    lastmod = f"<lastmod>{last_content.date().isoformat()}</lastmod>" if last_content else ""

    xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>']
    xml_parts.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    
    # 1. Homepage & Reviews
    xml_parts.append(f'<url><loc>{base_url}/</loc>{lastmod}<changefreq>daily</changefreq><priority>1.0</priority></url>')
    xml_parts.append(f'<url><loc>{base_url}/reviews</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>')

    # 2. Informational pages
    for page in pages:
        if page.slug:
            xml_parts.append(f'<url><loc>{base_url}/info/{page.slug}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>')

    # 3. Categories with correct /category/ prefix
    for category in categories:
        if category.name:
            cat_slug = _slugify(category.name)
            xml_parts.append(f'<url><loc>{base_url}/category/{cat_slug}</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>')

    # 4. Subcategories
    for sub in subcategories:
        cat_slug = category_map.get(sub.category_id)
        if cat_slug and sub.id:
            xml_parts.append(f'<url><loc>{base_url}/category/{cat_slug}/sub/{sub.id}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>')

    # 5. Products (людиночитані slug-URL)
    for product in products:
        if product.id:
            product_path = product.slug or product.id
            xml_parts.append(f'<url><loc>{base_url}/product/{product_path}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>')

    # 6. Schemes
    xml_parts.append(f'<url><loc>{base_url}/schemes</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>')
    for schematic in schematics:
        xml_parts.append(f'<url><loc>{base_url}/schemes/{schematic.id}</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>')

    xml_parts.append("</urlset>")

    return Response(content="".join(xml_parts), media_type="application/xml")

@app.get("/seo/static", response_model=List[StaticPageSEORead])
def get_static_seo_records(session: Session = Depends(get_session)):
    return session.exec(select(StaticPageSEO)).all()

@app.get("/seo/static/{slug}", response_model=StaticPageSEORead)
def get_static_seo_record(slug: str, session: Session = Depends(get_session)):
    record = session.exec(
        select(StaticPageSEO).where(StaticPageSEO.slug == slug)
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="SEO record not found")
    return record

@app.put(
    "/seo/static/{slug}",
    response_model=StaticPageSEORead,
    dependencies=[Depends(get_current_admin)],
)
def update_static_seo_record(
    slug: str,
    payload: StaticPageSEOUpdate,
    session: Session = Depends(get_session),
):
    record = session.exec(
        select(StaticPageSEO).where(StaticPageSEO.slug == slug)
    ).first()
    if not record:
        record = StaticPageSEO(slug=slug)
        session.add(record)
        session.commit()
        session.refresh(record)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    session.add(record)
    session.commit()
    session.refresh(record)
    return record
