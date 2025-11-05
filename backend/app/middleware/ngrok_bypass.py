"""
Middleware to bypass ngrok browser warning page
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class NgrokBypassMiddleware(BaseHTTPMiddleware):
    """Add headers to bypass ngrok browser warning"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Bypass ngrok browser warning page
        response.headers["ngrok-skip-browser-warning"] = "true"
        return response

