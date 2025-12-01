"""Premium subscription service"""
from fastapi import HTTPException, status
from app.models.user import User
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)


def check_premium_status(user: User, db: Session = None) -> bool:
    """Check if user has premium subscription"""
    try:
        # Проверяем, есть ли атрибут is_premium
        if not hasattr(user, 'is_premium'):
            logger.warning(f"User {user.id} does not have is_premium attribute")
            # Пытаемся загрузить из БД, если передан db session
            if db is not None:
                try:
                    result = db.execute(text("SELECT is_premium FROM users WHERE id = :user_id"), {"user_id": user.id})
                    row = result.first()
                    if row is not None:
                        is_premium_value = row[0] if row[0] is not None else False
                        user.is_premium = is_premium_value
                        logger.debug(f"Loaded is_premium from DB for user {user.id}: {is_premium_value}")
                        return bool(is_premium_value)
                except Exception as e:
                    logger.warning(f"Failed to load is_premium from DB for user {user.id}: {e}")
            return False
        
        is_premium = getattr(user, 'is_premium', None)
        # Если None, пытаемся загрузить из БД
        if is_premium is None and db is not None:
            try:
                result = db.execute(text("SELECT is_premium FROM users WHERE id = :user_id"), {"user_id": user.id})
                row = result.first()
                if row is not None:
                    is_premium = row[0] if row[0] is not None else False
                    user.is_premium = is_premium
                    logger.debug(f"Loaded is_premium from DB for user {user.id}: {is_premium}")
            except Exception as e:
                logger.warning(f"Failed to load is_premium from DB for user {user.id}: {e}")
                is_premium = False
        
        # Явно проверяем на True, чтобы избежать проблем с None
        result = is_premium is True
        logger.debug(f"Premium status check for user {user.id}: is_premium={is_premium}, result={result}")
        return result
    except Exception as e:
        logger.warning(f"Error checking premium status for user {user.id}: {e}")
        return False


def require_premium(user: User, db: Session = None) -> None:
    """Require premium subscription or raise exception"""
    is_premium = check_premium_status(user, db)
    logger.info(f"Premium check for user {user.id}: is_premium={is_premium}")
    
    if not is_premium:
        logger.warning(f"User {user.id} attempted to access premium feature without subscription")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Эта функция доступна только для премиум пользователей. Пожалуйста, оформите подписку."
        )


