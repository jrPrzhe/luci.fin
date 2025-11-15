"""
Функции для отправки ежедневных напоминаний о заданиях через боты
"""
import logging
import httpx
import traceback
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from typing import List
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.user import User
from app.models.gamification import UserGamificationProfile, UserDailyQuest, QuestStatus
from app.api.v1.gamification import get_or_create_profile, generate_daily_quests
from app.api.v1.ai import GamificationMessageRequest, generate_gamification_message

logger = logging.getLogger(__name__)


async def send_daily_reminder_telegram(user: User, db: Session) -> bool:
    """Отправить ежедневное напоминание в Telegram"""
    if not user.telegram_id or not settings.TELEGRAM_BOT_TOKEN:
        return False
    
    try:
        # Получаем профиль геймификации
        profile = get_or_create_profile(user.id, db)
        
        # Генерируем квесты на сегодня, если их нет
        generate_daily_quests(profile, db, user)
        
        # Получаем квесты на сегодня
        today = datetime.now(timezone.utc).date()
        quests = db.query(UserDailyQuest).filter(
            UserDailyQuest.profile_id == profile.id,
            UserDailyQuest.quest_date == today,
            UserDailyQuest.status == QuestStatus.PENDING
        ).all()
        
        # Получаем сообщение от Люси
        try:
            lucy_message_response = await generate_gamification_message(
                request={"event": "daily_greeting", "user_data": None},
                current_user=user,
                db=db
            )
            lucy_message = lucy_message_response.message if hasattr(lucy_message_response, 'message') else ""
        except:
            lucy_message = f"Доброе утро, {user.first_name or 'друг'}! Люся ждёт тебя. ❤️"
        
        # Формируем сообщение
        message_parts = [
            lucy_message,
            "",
            f"🔥 Страйк: {profile.streak_days} дней подряд",
            f"⭐ Уровень: {profile.level}",
            f"❤️ Сердце: {profile.heart_level}/100",
            "",
            "🎯 Ежедневные задания:"
        ]
        
        if quests:
            for i, quest in enumerate(quests[:3], 1):  # Показываем до 3 квестов
                icon = "💸" if quest.quest_type.value == "record_expense" else \
                       "💰" if quest.quest_type.value == "record_income" else \
                       "📊" if quest.quest_type.value == "review_transactions" else \
                       "💳" if quest.quest_type.value == "check_balance" else "📋"
                message_parts.append(f"{i}. {icon} {quest.title} (+{quest.xp_reward} XP)")
        else:
            message_parts.append("На сегодня заданий нет. Отдыхай! 😊")
        
        message_parts.append("")
        message_parts.append("Выполняй задания, чтобы получить XP и поднять уровень! 🚀")
        
        message = "\n".join(message_parts)
        
        # Отправляем в Telegram
        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": user.telegram_id,
            "text": message,
            "parse_mode": "HTML"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                logger.info(f"Daily reminder sent to Telegram user {user.id}")
                return True
            else:
                logger.error(f"Failed to send Telegram reminder: {response.status_code}")
                return False
                
    except Exception as e:
        logger.error(f"Error sending Telegram daily reminder: {e}", exc_info=True)
        return False


async def send_daily_reminder_vk(user: User, db: Session) -> bool:
    """Отправить ежедневное напоминание в VK"""
    if not user.vk_id or not settings.VK_BOT_TOKEN:
        return False
    
    try:
        # Получаем профиль геймификации
        profile = get_or_create_profile(user.id, db)
        
        # Генерируем квесты на сегодня, если их нет
        generate_daily_quests(profile, db, user)
        
        # Получаем квесты на сегодня
        today = datetime.now(timezone.utc).date()
        quests = db.query(UserDailyQuest).filter(
            UserDailyQuest.profile_id == profile.id,
            UserDailyQuest.quest_date == today,
            UserDailyQuest.status == QuestStatus.PENDING
        ).all()
        
        # Получаем сообщение от Люси
        try:
            from app.api.v1.ai import GamificationMessageRequest
            request_obj = GamificationMessageRequest(event="daily_greeting", user_data=None)
            lucy_message_response = await generate_gamification_message(
                request=request_obj,
                current_user=user,
                db=db
            )
            lucy_message = lucy_message_response.message if hasattr(lucy_message_response, 'message') else ""
        except Exception as e:
            logger.warning(f"Could not get Lucy message: {e}")
            lucy_message = f"Доброе утро, {user.first_name or 'друг'}! Люся ждёт тебя. ❤️"
        
        # Формируем сообщение
        message_parts = [
            lucy_message,
            "",
            f"🔥 Страйк: {profile.streak_days} дней подряд",
            f"⭐ Уровень: {profile.level}",
            f"❤️ Сердце: {profile.heart_level}/100",
            "",
            "🎯 Ежедневные задания:"
        ]
        
        if quests:
            for i, quest in enumerate(quests[:3], 1):
                icon = "💸" if quest.quest_type.value == "record_expense" else \
                       "💰" if quest.quest_type.value == "record_income" else \
                       "📊" if quest.quest_type.value == "review_transactions" else \
                       "💳" if quest.quest_type.value == "check_balance" else "📋"
                message_parts.append(f"{i}. {icon} {quest.title} (+{quest.xp_reward} XP)")
        else:
            message_parts.append("На сегодня заданий нет. Отдыхай! 😊")
        
        message_parts.append("")
        message_parts.append("Выполняй задания, чтобы получить XP и поднять уровень! 🚀")
        
        message = "\n".join(message_parts)
        
        # Отправляем в VK через VK API
        if not settings.VK_BOT_TOKEN:
            logger.warning("VK_BOT_TOKEN not configured, skipping VK reminder")
            return False
            
        try:
            # VK API для отправки сообщений
            vk_api_url = "https://api.vk.com/method/messages.send"
            params = {
                "access_token": settings.VK_BOT_TOKEN,
                "user_id": user.vk_id,
                "message": message,
                "random_id": int(datetime.now(timezone.utc).timestamp() * 1000),
                "v": "5.131"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(vk_api_url, params=params)
                if response.status_code == 200:
                    result = response.json()
                    if result.get("response"):
                        logger.info(f"Daily reminder sent to VK user {user.id}")
                        return True
                    else:
                        logger.error(f"VK API error: {result.get('error')}")
                        return False
                else:
                    logger.error(f"Failed to send VK reminder: {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Error sending VK reminder: {e}", exc_info=True)
            return False
        
    except Exception as e:
        logger.error(f"Error sending VK daily reminder: {e}", exc_info=True)
        return False


async def send_daily_reminders_to_all_users():
    """Отправить ежедневные напоминания всем пользователям с активными ботами"""
    print("[INFO] Starting send_daily_reminders_to_all_users...")
    db = SessionLocal()
    try:
        print("[INFO] Querying users with Telegram or VK IDs...")
        # Получаем всех пользователей с Telegram или VK
        users = db.query(User).filter(
            User.is_active == True,
            (User.telegram_id.isnot(None)) | (User.vk_id.isnot(None))
        ).all()
        
        print(f"[INFO] Found {len(users)} users with Telegram or VK IDs")
        logger.info(f"Sending daily reminders to {len(users)} users")
        
        if len(users) == 0:
            print("[WARNING] No users found with Telegram or VK IDs")
            return 0
        
        sent_count = 0
        for i, user in enumerate(users, 1):
            try:
                print(f"[INFO] Processing user {i}/{len(users)}: ID={user.id}, Telegram={bool(user.telegram_id)}, VK={bool(user.vk_id)}")
                
                if user.telegram_id:
                    print(f"[INFO] Sending Telegram reminder to user {user.id}...")
                    success = await send_daily_reminder_telegram(user, db)
                    if success:
                        sent_count += 1
                        print(f"[SUCCESS] Telegram reminder sent to user {user.id}")
                    else:
                        print(f"[WARNING] Failed to send Telegram reminder to user {user.id}")
                
                if user.vk_id:
                    print(f"[INFO] Sending VK reminder to user {user.id}...")
                    success = await send_daily_reminder_vk(user, db)
                    if success:
                        sent_count += 1
                        print(f"[SUCCESS] VK reminder sent to user {user.id}")
                    else:
                        print(f"[WARNING] Failed to send VK reminder to user {user.id}")
            except Exception as e:
                print(f"[ERROR] Error sending reminder to user {user.id}: {e}")
                logger.error(f"Error sending reminder to user {user.id}: {e}", exc_info=True)
                continue
        
        print(f"[INFO] Daily reminders sent to {sent_count} out of {len(users)} users")
        logger.info(f"Daily reminders sent to {sent_count} users")
        return sent_count
        
    except Exception as e:
        print(f"[ERROR] Fatal error in send_daily_reminders_to_all_users: {e}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        logger.error(f"Error in send_daily_reminders_to_all_users: {e}", exc_info=True)
        return 0
    finally:
        db.close()
        print("[INFO] Database connection closed")

