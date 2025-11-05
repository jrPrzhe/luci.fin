import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Логируем только запросы к /api/v1/auth/me
        if "/api/v1/auth/me" in str(request.url):
            auth_header = request.headers.get("authorization")
            logger.info(
                f"Request to /auth/me - Method: {request.method}, "
                f"Authorization header present: {bool(auth_header)}, "
                f"Authorization header length: {len(auth_header) if auth_header else 0}, "
                f"Authorization header value: {auth_header[:100] + '...' if auth_header and len(auth_header) > 100 else auth_header}"
            )
            
            # Проверяем формат Bearer токена
            if auth_header:
                if auth_header.startswith("Bearer "):
                    token_part = auth_header[7:]  # Убираем "Bearer "
                    logger.info(f"Token extracted from Bearer: length={len(token_part)}, preview={token_part[:50]}...")
                    # Проверяем JWT формат (должно быть 3 части через точку)
                    if '.' in token_part:
                        parts = token_part.split('.')
                        logger.info(f"JWT parts count: {len(parts)} (should be 3)")
                else:
                    logger.warning(f"Authorization header does not start with 'Bearer ': {auth_header[:50]}")
        
        response = await call_next(request)
        return response

