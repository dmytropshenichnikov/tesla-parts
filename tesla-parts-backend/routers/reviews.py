from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlmodel import Session, select
from database import get_session
from models import Review
from schemas import ReviewRead, ReviewReorderRequest
from services.image_uploader import image_uploader
from dependencies import get_current_admin

router = APIRouter(prefix="/reviews", tags=["reviews"])

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
