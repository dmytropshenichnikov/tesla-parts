from datetime import datetime, timedelta
from typing import Optional
import os
from jose import JWTError, jwt
from passlib.context import CryptContext

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-jwt-key") # Use a strong, random key in production
ALGORITHM = "HS256"

# Адмінка — робочий інструмент, у якому власник працює годинами. Короткий
# токен (30 хв) постійно просив повторного входу й міг вибити зі сторінки
# посеред роботи, тому живемо 30 днів.
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 днів
REFRESH_TOKEN_EXPIRE_DAYS = 60  # з запасом, щоб оновлення працювало й після 30 днів

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
