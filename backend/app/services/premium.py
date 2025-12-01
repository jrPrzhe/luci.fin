"""Premium subscription service"""
from fastapi import HTTPException, status
from app.models.user import User
import logging

logger = logging.getLogger(__name__)


def check_premium_status(user: User) -> bool:
    """Check if user has premium subscription"""
    try:
        # Проверяем, есть ли атрибут is_premium
        # Используем hasattr для проверки наличия атрибута, затем getattr для получения значения
        if not hasattr(user, 'is_premium'):
            logger.warning(f"User {user.id} does not have is_premium attribute")
            return False
        
        is_premium = getattr(user, 'is_premium', None)
        # Если None или False, считаем что премиум нет
        # Явно проверяем на True, чтобы избежать проблем с None
        result = is_premium is True
        logger.debug(f"Premium status check for user {user.id}: is_premium={is_premium}, result={result}")
        return result
    except Exception as e:
        logger.warning(f"Error checking premium status for user {user.id}: {e}")
        return False


def require_premium(user: User) -> None:
    """Require premium subscription or raise exception"""
    is_premium = check_premium_status(user)
    logger.info(f"Premium check for user {user.id}: is_premium={is_premium}")
    
    if not is_premium:
        logger.warning(f"User {user.id} attempted to access premium feature without subscription")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Эта функция доступна только для премиум пользователей. Пожалуйста, оформите подписку."
        )


