from datetime import datetime, timedelta, timezone
from jose import jwt
import bcrypt
from app.core.config import settings

def hash_password(pw: str) -> str:
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pw.encode('utf-8'), salt)
    return hashed_password.decode('utf-8')

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALG)
