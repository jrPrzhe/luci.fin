"""Premium subscription service"""
from fastapi import HTTPException, status
from app.models.user import User
import logging

logger = logging.getLogger(__name__)


def check_premium_status(user: User) -> bool:
    """Check if user has premium subscription"""
    try:
        # Проверяем, есть ли атрибут is_premium
        is_premium = getattr(user, 'is_premium', None)
        # Если None, считаем что премиум нет
        return bool(is_premium)
    except Exception as e:
        logger.warning(f"Error checking premium status for user {user.id}: {e}")
        return False


def require_premium(user: User) -> None:
    """Require premium subscription or raise exception"""
    if not check_premium_status(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Эта функция доступна только для премиум пользователей. Пожалуйста, оформите подписку."
        )


