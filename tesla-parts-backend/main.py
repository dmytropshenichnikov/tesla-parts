from fastapi import FastAPI, Response, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from typing import List
from database import create_db_and_tables, engine, get_session
from routers import products, orders, categories, settings, pages, auth, feeds, reviews, customers, promocodes, email_campaigns, analytics
from contextlib import asynccontextmanager
import os
from models import Product, Category, StaticPageSEO
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

app.mount("/static", StaticFiles(directory="static"), name="static")

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

@app.get("/")
def read_root():
    return {"message": "Tesla Parts API is running"}

def _slugify(value: str) -> str:
    return (
        value.lower()
        .strip()
        .replace(" ", "-")
        .replace("/", "-")
    )

@app.get("/sitemap.xml", response_class=Response)
def get_sitemap():
    base_url = "https://teslapartscenter.com.ua"
    with Session(engine) as session:
        products = session.exec(select(Product)).all()
        categories = session.exec(select(Category)).all()

    xml_parts = ['<?xml version="1.0" encoding="UTF-8"?>']
    xml_parts.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    xml_parts.append(f'<url><loc>{base_url}/</loc><changefreq>daily</changefreq></url>')

    for category in categories:
        slug = _slugify(category.name) if category.name else f"category/{category.id}"
        xml_parts.append(f'<url><loc>{base_url}/{slug}</loc><changefreq>weekly</changefreq></url>')

    for product in products:
        xml_parts.append(f'<url><loc>{base_url}/product/{product.id}</loc><changefreq>weekly</changefreq></url>')

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
