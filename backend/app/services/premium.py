"""Premium subscription service"""
from fastapi import HTTPException, status
from app.models.user import User


def check_premium_status(user: User) -> bool:
    """Check if user has premium subscription"""
    return user.is_premium


def require_premium(user: User) -> None:
    """Require premium subscription or raise exception"""
    if not check_premium_status(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Эта функция доступна только для премиум пользователей. Пожалуйста, оформите подписку."
        )

