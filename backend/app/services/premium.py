"""Premium subscription service"""
from fastapi import HTTPException, status
from app.models.user import User
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
import httpx
from app.core.config import settings

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


def send_premium_notification(user: User) -> bool:
    """Send premium activation notification to user via Telegram (synchronous version)"""
    if not user.telegram_id:
        logger.info(f"User {user.id} does not have telegram_id, skipping premium notification")
        return False
    
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not configured, cannot send premium notification")
        return False
    
    # Get user language (default to Russian)
    user_language = getattr(user, 'language', 'ru') or 'ru'
    
    # Premium features list based on language
    if user_language == 'en':
        premium_features = [
            "📊 Detailed financial reports with charts",
            "📈 Data visualization and trends",
            "📄 Export reports to PDF and Excel",
            "💬 Automatic report delivery via bot",
            "🎯 Advanced analytics and insights",
            "📱 Priority support"
        ]
        message = f"""⭐ <b>Congratulations! You now have Premium!</b>

🎉 You've got access to premium features!

<b>Available premium features:</b>
{chr(10).join(premium_features)}

🚀 Start using all the app features right now!

If you have any questions, contact support."""
    else:
        # Russian (default)
        premium_features = [
            "📊 Детальные финансовые отчеты с графиками",
            "📈 Визуализация данных и трендов",
            "📄 Экспорт отчетов в PDF и Excel",
            "💬 Автоматическая отправка отчетов через бота",
            "🎯 Расширенная аналитика и инсайты",
            "📱 Приоритетная поддержка"
        ]
        message = f"""⭐ <b>Поздравляем! У вас теперь Премиум!</b>

🎉 Вы получили доступ к премиум функциям!

<b>Доступные платные функции:</b>
{chr(10).join(premium_features)}

🚀 Начните использовать все возможности приложения прямо сейчас!

Если у вас есть вопросы, обращайтесь в поддержку."""
    
    try:
        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": user.telegram_id,
            "text": message,
            "parse_mode": "HTML"
        }
        
        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, json=payload)
            if response.status_code == 200:
                logger.info(f"Premium notification sent to user {user.id} (telegram_id: {user.telegram_id}, language: {user_language})")
                return True
            else:
                logger.error(f"Failed to send premium notification: {response.status_code}, {response.text}")
                return False
    except Exception as e:
        logger.error(f"Error sending premium notification: {e}", exc_info=True)
        return False


