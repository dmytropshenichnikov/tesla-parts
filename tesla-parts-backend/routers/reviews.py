import re
import time
from typing import List

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlmodel import Session, select
from database import get_session
from models import Review
from schemas import ReviewRead, ReviewReorderRequest
from services.image_uploader import image_uploader
from dependencies import get_current_admin

router = APIRouter(prefix="/reviews", tags=["reviews"])

# --- Рейтинг продавця на АвтоПро -----------------------------------------
# У АвтоПро немає публічного API, а сторінка продавця віддає цифри лише
# браузеру (ботів ріже 403). Тому тягнемо HTML із сервера під Chrome-UA,
# кешуємо на 6 годин і завжди маємо резервні значення: картка товару не
# повинна чекати на чужий сайт і не повинна ламатися, якщо він змінить
# розмітку.
AVTOPRO_SELLER_URL = "https://avto.pro/seller/tesla-parts-center/"
AVTOPRO_TTL_SECONDS = 6 * 60 * 60
AVTOPRO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "uk,ru;q=0.9,en;q=0.8",
}
# Стан профілю на 20.11.2026 — показуємо, якщо АвтоПро недоступний.
AVTOPRO_FALLBACK = {"rating": 5.0, "reviews": 114, "year_reviews": 50}
_avtopro_cache = {"data": None, "at": 0.0}


def _fetch_avtopro_summary() -> dict:
    response = requests.get(
        AVTOPRO_SELLER_URL, headers=AVTOPRO_HEADERS, timeout=5
    )
    response.raise_for_status()
    html = response.text
    rating = re.search(r'"Rating":(\d+(?:\.\d+)?)', html)
    reviews = re.search(r'"ReviewsCount":(\d+)', html)
    if not rating or not reviews:
        raise ValueError("AvtoPro markup changed: rating not found")
    year = re.search(r'"YearCommentCount":(\d+)', html)
    # На АвтоПро Rating — відсотки (100 = 5.0).
    return {
        "rating": round(float(rating.group(1)) / 20, 1),
        "reviews": int(reviews.group(1)),
        "year_reviews": int(year.group(1)) if year else None,
    }


@router.get("/avtopro")
def read_avtopro_summary() -> dict:
    now = time.time()
    cached = _avtopro_cache["data"]
    if cached and now - _avtopro_cache["at"] < AVTOPRO_TTL_SECONDS:
        return {**cached, "url": AVTOPRO_SELLER_URL, "stale": False}
    try:
        data = _fetch_avtopro_summary()
        _avtopro_cache.update(data=data, at=now)
        return {**data, "url": AVTOPRO_SELLER_URL, "stale": False}
    except Exception:
        return {
            **(cached or AVTOPRO_FALLBACK),
            "url": AVTOPRO_SELLER_URL,
            "stale": True,
        }

@router.get("/", response_model=List[ReviewRead])
def read_reviews(
    offset: int = 0,
    limit: int = Query(default=100, le=100),
    session: Session = Depends(get_session)
):
    reviews = session.exec(select(Review).order_by(Review.sort_order.asc(), Review.created_at.desc()).offset(offset).limit(limit)).all()
    return reviews

@router.post("/", response_model=ReviewRead, dependencies=[Depends(get_current_admin)])
async def create_review(
    file: UploadFile = File(...),
    sort_order: int = Form(0),
    session: Session = Depends(get_session)
):
    url = await image_uploader.upload_image(file, folder="tesla-parts/reviews")
    if not url:
        raise HTTPException(status_code=400, detail="Could not upload image")
    
    db_review = Review(image_url=url, sort_order=sort_order)
    session.add(db_review)
    session.commit()
    session.refresh(db_review)
    return db_review

@router.delete("/{review_id}", dependencies=[Depends(get_current_admin)])
def delete_review(review_id: int, session: Session = Depends(get_session)):
    review = session.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    session.delete(review)
    session.commit()
    return {"ok": True}

@router.post("/reorder", dependencies=[Depends(get_current_admin)])
def reorder_reviews(
    request: ReviewReorderRequest,
    session: Session = Depends(get_session)
):
    reviews = session.exec(
        select(Review).where(Review.id.in_(request.review_ids))
    ).all()
    
    review_map = {r.id: r for r in reviews}
    
    for index, review_id in enumerate(request.review_ids):
        if review_id in review_map:
            review_map[review_id].sort_order = index
            session.add(review_map[review_id])
            
    session.commit()
    return {"message": "Successfully reordered"}
