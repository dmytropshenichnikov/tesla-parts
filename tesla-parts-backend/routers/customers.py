from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlmodel import Session, select
from datetime import datetime, timedelta
import secrets
from models import Customer, Order
from sqlalchemy.orm import selectinload
from database import get_session
from schemas import (
    CustomerRegisterRequest,
    CustomerVerifyRequest,
    CustomerLoginRequest,
    CustomerProfileUpdate,
    CustomerProfileRead,
    CustomerForgotPasswordRequest,
    CustomerResetPasswordRequest,
    AdminDiscountUpdateRequest,
    OrderRead
)
from services.crypto import encrypt_value, decrypt_value, get_email_hash
from services.email import (send_verification_email, send_reset_password_email,
    send_welcome_email, notify_admin_new_client as notify_admin_email)
from services.telegram import notify_admin_new_client as notify_admin_tg
from auth import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from dependencies import get_current_customer, get_current_admin
import hashlib

router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("/", dependencies=[Depends(get_current_admin)])
async def get_all_customers(session: Session = Depends(get_session)):
    customers = session.exec(select(Customer).order_by(Customer.id.desc())).all()
    result = []
    for c in customers:
        result.append({
            "id": c.id,
            "email": decrypt_value(c.encrypted_email) if c.encrypted_email else None,
            "first_name": decrypt_value(c.encrypted_first_name) if c.encrypted_first_name else None,
            "last_name": decrypt_value(c.encrypted_last_name) if c.encrypted_last_name else None,
            "phone": decrypt_value(c.encrypted_phone) if c.encrypted_phone else None,
            "discount_type": c.discount_type,
            "discount_value": c.discount_value,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return result

@router.post("/register")
async def register_customer(request: CustomerRegisterRequest, session: Session = Depends(get_session)):
    email_hash = get_email_hash(request.email)
    existing = session.exec(select(Customer).where(Customer.email_hash == email_hash)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    verification_token = secrets.token_urlsafe(32)
    
    new_customer = Customer(
        email_hash=email_hash,
        encrypted_email=encrypt_value(request.email),
        verification_token=verification_token,
        token_expires_at=datetime.utcnow() + timedelta(hours=24),
        is_verified=False
    )
    session.add(new_customer)
    session.commit()

    send_verification_email(request.email, verification_token)

    try:
        notify_admin_tg(request.email)
    except Exception as e:
        print("admin tg notify failed: %s" % e)
    try:
        notify_admin_email(request.email)
    except Exception as e:
        print("admin email notify failed: %s" % e)
    
    return {"message": "Verification email sent", "token": verification_token} # Returning token for testing purposes

@router.post("/verify")
async def verify_customer(request: CustomerVerifyRequest, session: Session = Depends(get_session)):
    if request.password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
        
    customer = session.exec(select(Customer).where(Customer.verification_token == request.verification_token)).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Invalid token")
        
    if not customer.token_expires_at or customer.token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")
        
    customer.is_verified = True
    customer.hashed_password = get_password_hash(request.password)
    customer.verification_token = None
    customer.token_expires_at = None
    if not customer.discount_type and not customer.discount_value:
        customer.discount_type = "percent"
        customer.discount_value = 3
    session.add(customer)
    session.commit()
    try:
        c_email = decrypt_value(customer.encrypted_email) if customer.encrypted_email else None
    except Exception:
        c_email = None
    try:
        c_name = decrypt_value(customer.encrypted_first_name) if customer.encrypted_first_name else None
    except Exception:
        c_name = None
    if c_email:
        try:
            send_welcome_email(c_email, c_name)
        except Exception as e:
            print("welcome email failed: %s" % e)
    return {"message": "Account verified successfully"}

@router.post("/login")
async def login_customer(request: CustomerLoginRequest, response: Response, session: Session = Depends(get_session)):
    email_hash = get_email_hash(request.email)
    customer = session.exec(select(Customer).where(Customer.email_hash == email_hash)).first()
    
    if not customer or not customer.hashed_password or not verify_password(request.password, customer.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    if not customer.is_verified:
        raise HTTPException(status_code=401, detail="Account not verified")
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": request.email, "role": "customer"}, expires_delta=access_token_expires
    )
    
    response.set_cookie(
        key="customerToken",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout_customer(response: Response):
    response.delete_cookie("customerToken")
    return {"message": "Logged out successfully"}

@router.post("/forgot-password")
async def forgot_password(request: CustomerForgotPasswordRequest, session: Session = Depends(get_session)):
    email_hash = get_email_hash(request.email)
    customer = session.exec(select(Customer).where(Customer.email_hash == email_hash)).first()
    
    if not customer:
        return {"message": "If an account exists, a reset link has been sent"}
        
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    customer.reset_token_hash = token_hash
    customer.reset_token_expires = datetime.utcnow() + timedelta(minutes=15)
    session.add(customer)
    session.commit()
    
    send_reset_password_email(request.email, raw_token)
    
    return {"message": "If an account exists, a reset link has been sent", "token": raw_token} # Returning token for testing

@router.post("/reset-password")
async def reset_password(request: CustomerResetPasswordRequest, session: Session = Depends(get_session)):
    token_hash = hashlib.sha256(request.token.encode()).hexdigest()
    customer = session.exec(select(Customer).where(
        (Customer.reset_token_hash == token_hash)
    )).first()
    
    if not customer or not customer.reset_token_expires or customer.reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
        
    customer.hashed_password = get_password_hash(request.new_password)
    customer.reset_token_hash = None
    customer.reset_token_expires = None
    session.add(customer)
    session.commit()
    return {"message": "Password reset successfully"}

@router.get("/me", response_model=CustomerProfileRead)
async def get_customer_profile(customer: Customer = Depends(get_current_customer)):
    return CustomerProfileRead(
        email=decrypt_value(customer.encrypted_email),
        first_name=decrypt_value(customer.encrypted_first_name),
        last_name=decrypt_value(customer.encrypted_last_name),
        phone=decrypt_value(customer.encrypted_phone),
        default_address=decrypt_value(customer.encrypted_default_address),
        discount_type=customer.discount_type,
        discount_value=customer.discount_value,
        cart_data=customer.cart_data
    )

from typing import List

@router.get("/me/orders", response_model=List[OrderRead])
async def get_customer_orders(
    customer: Customer = Depends(get_current_customer),
    session: Session = Depends(get_session)
):
    orders = session.exec(
        select(Order)
        .where(Order.customer_id == customer.id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    ).all()
    return orders

@router.put("/profile", response_model=CustomerProfileRead)
async def update_customer_profile(
    request: CustomerProfileUpdate, 
    customer: Customer = Depends(get_current_customer),
    session: Session = Depends(get_session)
):
    if request.first_name is not None:
        customer.encrypted_first_name = encrypt_value(request.first_name)
    if request.last_name is not None:
        customer.encrypted_last_name = encrypt_value(request.last_name)
    if request.phone is not None:
        customer.encrypted_phone = encrypt_value(request.phone)
    if request.default_address is not None:
        customer.encrypted_default_address = encrypt_value(request.default_address)
    if request.cart_data is not None:
        customer.cart_data = request.cart_data
        
    session.add(customer)
    session.commit()
    session.refresh(customer)
    
    return CustomerProfileRead(
        email=decrypt_value(customer.encrypted_email),
        first_name=decrypt_value(customer.encrypted_first_name),
        last_name=decrypt_value(customer.encrypted_last_name),
        phone=decrypt_value(customer.encrypted_phone),
        default_address=decrypt_value(customer.encrypted_default_address),
        discount_type=customer.discount_type,
        discount_value=customer.discount_value,
        cart_data=customer.cart_data
    )

@router.get("/{customer_id}", dependencies=[Depends(get_current_admin)])
async def get_customer(customer_id: int, session: Session = Depends(get_session)):
    c = session.exec(select(Customer).where(Customer.id == customer_id)).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {
        "id": c.id,
        "email": decrypt_value(c.encrypted_email) if c.encrypted_email else None,
        "first_name": decrypt_value(c.encrypted_first_name) if c.encrypted_first_name else None,
        "last_name": decrypt_value(c.encrypted_last_name) if c.encrypted_last_name else None,
        "phone": decrypt_value(c.encrypted_phone) if c.encrypted_phone else None,
        "discount_type": c.discount_type,
        "discount_value": c.discount_value,
        "is_verified": c.is_verified
    }

@router.get("/{customer_id}/orders", dependencies=[Depends(get_current_admin)], response_model=List[OrderRead])
async def get_customer_orders_admin(customer_id: int, session: Session = Depends(get_session)):
    orders = session.exec(
        select(Order)
        .where(Order.customer_id == customer_id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    ).all()
    return orders

@router.put("/{customer_id}/discount")
async def set_customer_discount(
    customer_id: int,
    request: AdminDiscountUpdateRequest,
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin)
):
    customer = session.exec(select(Customer).where(Customer.id == customer_id)).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    customer.discount_type = request.discount_type
    customer.discount_value = request.discount_value
    session.add(customer)
    session.commit()
    return {"message": "Discount updated"}
