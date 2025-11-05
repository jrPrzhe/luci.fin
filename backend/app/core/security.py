from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    
    # Убеждаемся, что 'sub' (subject) является строкой, как требует JWT стандарт
    if 'sub' in to_encode:
        to_encode['sub'] = str(to_encode['sub'])
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token"""
    to_encode = data.copy()
    
    # Убеждаемся, что 'sub' (subject) является строкой, как требует JWT стандарт
    if 'sub' in to_encode:
        to_encode['sub'] = str(to_encode['sub'])
    
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decode a JWT token"""
    import logging
    logger = logging.getLogger(__name__)
    
    if not token:
        logger.warning("decode_token: empty token provided")
        return None
    
    try:
        logger.info(f"Decoding token, length: {len(token)}, preview: {token[:50]}...")
        logger.info(f"Using SECRET_KEY: length={len(settings.SECRET_KEY) if settings.SECRET_KEY else 0}, preview={settings.SECRET_KEY[:20] if settings.SECRET_KEY else 'None'}..., ALGORITHM={settings.ALGORITHM}")
        
        # Проверяем формат JWT (должно быть 3 части)
        if '.' not in token:
            logger.error("Token does not contain '.' - not a valid JWT format")
            return None
        
        parts = token.split('.')
        if len(parts) != 3:
            logger.error(f"Token has {len(parts)} parts instead of 3 - invalid JWT format")
            return None
        
        logger.info(f"Token format OK: {len(parts)} parts, part lengths: {[len(p) for p in parts]}")
        
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        logger.info(f"Token decoded successfully, payload keys: {list(payload.keys())}")
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {type(e).__name__}: {str(e)}")
        logger.error(f"Token length: {len(token)}, SECRET_KEY length: {len(settings.SECRET_KEY) if settings.SECRET_KEY else 0}")
        logger.error(f"Token full value (first 200 chars): {token[:200]}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error decoding token: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return None


def generate_2fa_code() -> str:
    """Generate a 6-digit 2FA code"""
    import random
    return f"{random.randint(100000, 999999)}"


def generate_api_key() -> str:
    """Generate a secure API key"""
    import secrets
    return secrets.token_urlsafe(32)

