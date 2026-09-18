from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from models import PromoCode, Customer, CustomerPromoCodeLink
from database import get_session
from schemas import PromoCodeCreate, PromoCodeRead, PromoCodeValidateRequest, PromoCodeValidateResponse
from dependencies import get_current_admin, get_optional_customer
from typing import List

router = APIRouter(prefix="/promocodes", tags=["promocodes"])

@router.post("/", response_model=PromoCodeRead, status_code=201)
async def create_promocode(
    request: PromoCodeCreate, 
    session: Session = Depends(get_session),
    admin = Depends(get_current_admin)
):
    promocode = PromoCode(
        code=request.code,
        discount_type=request.discount_type,
        discount_value=request.discount_value,
        scope=request.scope,
        is_active=request.is_active
    )
    session.add(promocode)
    session.commit()
    session.refresh(promocode)
    
    if request.scope == "selected" and request.customer_ids:
        for cid in request.customer_ids:
            link = CustomerPromoCodeLink(customer_id=cid, promocode_id=promocode.id)
            session.add(link)
        session.commit()
        session.refresh(promocode)
        
    cids = [c.id for c in promocode.customers]
    
    return PromoCodeRead(
        id=promocode.id,
        code=promocode.code,
        discount_type=promocode.discount_type,
        discount_value=promocode.discount_value,
        scope=promocode.scope,
        is_active=promocode.is_active,
        created_at=promocode.created_at,
        customer_ids=cids
    )

@router.post("/validate", response_model=PromoCodeValidateResponse)
async def validate_promocode(
    request: PromoCodeValidateRequest,
    session: Session = Depends(get_session),
    customer: Customer = Depends(get_optional_customer)
):
    # Код шукаємо без урахування регістру та пробілів: «service5» = «SERVICE5»
    code = (request.code or "").strip().upper()
    promocode = session.exec(select(PromoCode).where(func.upper(PromoCode.code) == code)).first()

    if not promocode:
        raise HTTPException(status_code=404, detail="Промокод не знайдено")
    if not promocode.is_active:
        raise HTTPException(
            status_code=404,
            detail="Промокод вимкнено. Увімкніть його в адмінці: Промокоди → статус",
        )

    if promocode.scope == "selected":
        if not customer:
            raise HTTPException(status_code=401, detail="Для цього промокоду потрібно увійти в акаунт")
        link = session.exec(select(CustomerPromoCodeLink).where(
            (CustomerPromoCodeLink.promocode_id == promocode.id) & 
            (CustomerPromoCodeLink.customer_id == customer.id)
        )).first()
        
        if not link:
            raise HTTPException(status_code=400, detail="Цей промокод не діє для вашого акаунта")
            
    return PromoCodeValidateResponse(
        valid=True,
        discount_type=promocode.discount_type,
        discount_value=promocode.discount_value,
        message=f"Промокод {promocode.code} застосовано!"
    )

@router.get("/", response_model=List[PromoCodeRead])
async def get_promocodes(
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin)
):
    promocodes = session.exec(select(PromoCode)).all()
    result = []
    for pc in promocodes:
        cids = [c.id for c in pc.customers]
        result.append(PromoCodeRead(
            id=pc.id,
            code=pc.code,
            discount_type=pc.discount_type,
            discount_value=pc.discount_value,
            scope=pc.scope,
            is_active=pc.is_active,
            created_at=pc.created_at,
            customer_ids=cids
        ))
    return result

@router.put("/{id}", response_model=PromoCodeRead)
async def update_promocode(
    id: int,
    request: PromoCodeCreate,
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin)
):
    promocode = session.get(PromoCode, id)
    if not promocode:
        raise HTTPException(status_code=404, detail="Promocode not found")
        
    promocode.code = request.code
    promocode.discount_type = request.discount_type
    promocode.discount_value = request.discount_value
    promocode.scope = request.scope
    promocode.is_active = request.is_active
    
    session.add(promocode)
    
    existing_links = session.exec(select(CustomerPromoCodeLink).where(CustomerPromoCodeLink.promocode_id == id)).all()
    for link in existing_links:
        session.delete(link)
        
    if request.scope == "selected" and request.customer_ids:
        for cid in request.customer_ids:
            link = CustomerPromoCodeLink(customer_id=cid, promocode_id=id)
            session.add(link)
            
    session.commit()
    session.refresh(promocode)
    
    cids = [c.id for c in promocode.customers]
    
    return PromoCodeRead(
        id=promocode.id,
        code=promocode.code,
        discount_type=promocode.discount_type,
        discount_value=promocode.discount_value,
        scope=promocode.scope,
        is_active=promocode.is_active,
        created_at=promocode.created_at,
        customer_ids=cids
    )

@router.delete("/{id}", status_code=204)
async def delete_promocode(
    id: int,
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin)
):
    promocode = session.get(PromoCode, id)
    if not promocode:
        raise HTTPException(status_code=404, detail="Promocode not found")
        
    existing_links = session.exec(select(CustomerPromoCodeLink).where(CustomerPromoCodeLink.promocode_id == id)).all()
    for link in existing_links:
        session.delete(link)
        
    session.delete(promocode)
    session.commit()
    return None
