import time
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session, select

from database import get_session
from dependencies import get_current_admin
from models import Product, ProductReview
from schemas import (
    ProductReviewCreate,
    ProductReviewPublicCreate,
    ProductReviewRead,
    ProductReviewUpdate,
)

router = APIRouter(prefix="/product-reviews", tags=["product-reviews"])

# Обмеження на відгуки з сайту: без нього форма стає безкоштовним майданчиком
# для спаму. Тримаємо лічильник у пам'яті - для одного процесу цього досить.
SUBMIT_WINDOW_SECONDS = 10 * 60
SUBMIT_LIMIT = 5
_SUBMIT_LOG: dict[str, list[float]] = defaultdict(list)


def _clamp_rating(value: int) -> int:
    """Оцінка завжди 1-5, навіть якщо клієнт надішле щось інше."""
    return max(1, min(5, int(value)))


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _too_many_submissions(ip: str) -> bool:
    now = time.time()
    recent = [at for at in _SUBMIT_LOG[ip] if now - at < SUBMIT_WINDOW_SECONDS]
    _SUBMIT_LOG[ip] = recent
    if len(recent) >= SUBMIT_LIMIT:
        return True
    recent.append(now)
    return False


@router.get("/", response_model=list[ProductReviewRead])
def read_product_reviews(
    product_id: str = Query(min_length=1),
    limit: int = Query(default=50, le=100),
    session: Session = Depends(get_session),
):
    """Опубліковані відгуки на товар. Ручний порядок - першим, далі найновіші."""
    return session.exec(
        select(ProductReview)
        .where(ProductReview.product_id == product_id)
        .where(ProductReview.is_published == True)  # noqa: E712
        .order_by(ProductReview.sort_order.asc(), ProductReview.created_at.desc())
        .limit(limit)
    ).all()


@router.get(
    "/all",
    response_model=list[ProductReviewRead],
    dependencies=[Depends(get_current_admin)],
)
def read_all_product_reviews(
    product_id: str = Query(min_length=1),
    session: Session = Depends(get_session),
):
    """Усі відгуки товару для адмінки, разом із прихованими."""
    return session.exec(
        select(ProductReview)
        .where(ProductReview.product_id == product_id)
        .order_by(ProductReview.created_at.desc())
    ).all()


@router.post("/public", response_model=ProductReviewRead, status_code=201)
def create_public_product_review(
    payload: ProductReviewPublicCreate,
    request: Request,
    session: Session = Depends(get_session),
):
    """Відгук покупця з картки товару.

    Публікується не одразу: спершу його бачить адмін. Так на сайті не
    з'являється спам і лайка, а покупець бачить чесну обіцянку «після
    перевірки».
    """
    # Пастка для ботів: поле приховане, людина його не заповнює.
    if (payload.website or "").strip():
        raise HTTPException(status_code=400, detail="Spam detected")

    author = (payload.author or "").strip()
    text = (payload.text or "").strip()
    if len(author) < 2:
        raise HTTPException(status_code=400, detail="Вкажіть імʼя")
    if len(text) < 10:
        raise HTTPException(status_code=400, detail="Відгук закороткий")
    if len(text) > 1500:
        raise HTTPException(status_code=400, detail="Відгук задовгий")

    product = session.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if _too_many_submissions(_client_ip(request)):
        raise HTTPException(
            status_code=429, detail="Забагато відгуків. Спробуйте пізніше."
        )

    review = ProductReview(
        product_id=payload.product_id,
        author=author[:80],
        rating=_clamp_rating(payload.rating),
        text=text,
        is_published=False,
    )
    session.add(review)
    session.commit()
    session.refresh(review)
    return review


@router.post(
    "/",
    response_model=ProductReviewRead,
    dependencies=[Depends(get_current_admin)],
)
def create_product_review(
    payload: ProductReviewCreate,
    session: Session = Depends(get_session),
):
    author = (payload.author or "").strip()
    text = (payload.text or "").strip()
    if not payload.product_id or not author or not text:
        raise HTTPException(
            status_code=400, detail="product_id, author and text are required"
        )

    review = ProductReview(
        product_id=payload.product_id,
        author=author,
        rating=_clamp_rating(payload.rating),
        text=text,
        sort_order=payload.sort_order or 0,
        is_published=payload.is_published,
    )
    if payload.created_at:
        review.created_at = payload.created_at
    session.add(review)
    session.commit()
    session.refresh(review)
    return review


@router.put(
    "/{review_id}",
    response_model=ProductReviewRead,
    dependencies=[Depends(get_current_admin)],
)
def update_product_review(
    review_id: int,
    payload: ProductReviewUpdate,
    session: Session = Depends(get_session),
):
    review = session.get(ProductReview, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if payload.author is not None:
        review.author = payload.author.strip()
    if payload.rating is not None:
        review.rating = _clamp_rating(payload.rating)
    if payload.text is not None:
        review.text = payload.text.strip()
    if payload.sort_order is not None:
        review.sort_order = payload.sort_order
    if payload.is_published is not None:
        review.is_published = payload.is_published
    if payload.created_at is not None:
        review.created_at = payload.created_at

    session.add(review)
    session.commit()
    session.refresh(review)
    return review


@router.delete(
    "/{review_id}",
    dependencies=[Depends(get_current_admin)],
)
def delete_product_review(
    review_id: int,
    session: Session = Depends(get_session),
):
    review = session.get(ProductReview, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    session.delete(review)
    session.commit()
    return {"ok": True}
