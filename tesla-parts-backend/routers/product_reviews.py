from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from database import get_session
from dependencies import get_current_admin
from models import ProductReview
from schemas import ProductReviewCreate, ProductReviewRead, ProductReviewUpdate

router = APIRouter(prefix="/product-reviews", tags=["product-reviews"])


def _clamp_rating(value: int) -> int:
    """Оцінка завжди 1–5, навіть якщо адмінка надішле щось інше."""
    return max(1, min(5, int(value)))


@router.get("/", response_model=List[ProductReviewRead])
def read_product_reviews(
    product_id: str = Query(min_length=1),
    limit: int = Query(default=50, le=100),
    session: Session = Depends(get_session),
):
    """Відгуки на один товар. Ручний порядок — першим, далі найновіші."""
    return session.exec(
        select(ProductReview)
        .where(ProductReview.product_id == product_id)
        .order_by(ProductReview.sort_order.asc(), ProductReview.created_at.desc())
        .limit(limit)
    ).all()


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
    )
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
