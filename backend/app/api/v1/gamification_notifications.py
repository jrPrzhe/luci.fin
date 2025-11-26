"""
Функции для отправки ежедневных напоминаний о заданиях через боты
"""
import logging
import httpx
import traceback
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from typing import List
import pytz
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
    
    # Проверяем, включены ли уведомления для Telegram
    if not getattr(user, 'telegram_notifications_enabled', True):
        logger.info(f"Telegram notifications disabled for user {user.id}, skipping")
        return False
    
    # Валидация telegram_id - должен быть числом или строкой с числом
    try:
        telegram_id = str(user.telegram_id).strip()
        if not telegram_id or not telegram_id.isdigit():
            logger.error(f"Invalid telegram_id for user {user.id}: '{user.telegram_id}'")
            return False
    except Exception as e:
        logger.error(f"Error validating telegram_id for user {user.id}: {e}")
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
        
        # Формируем красивое HTML сообщение с форматированием
        user_name = user.first_name or "друг"
        
        # Заголовок с жирным именем Люси
        message_parts = [
            f"💬 <b>Люся</b> желает доброго дня, {user_name}! ✨",
            "",
        ]
        
        # Статистика с жирными значениями
        message_parts.extend([
            "<b>📊 Твоя статистика:</b>",
            f"🔥 <b>Страйк:</b> {profile.streak_days} дней подряд",
            f"⭐ <b>Уровень:</b> {profile.level}",
            f"❤️ <b>Сердце Люси:</b> {profile.heart_level}/100",
            "",
        ])
        
        # Основное сообщение от Люси
        message_parts.append(f"💝 {lucy_message}")
        message_parts.append("")
        
        # Задания
        if quests:
            message_parts.append(f"🎯 <b>Ежедневные задания на сегодня:</b>")
            for i, quest in enumerate(quests[:3], 1):  # Показываем до 3 квестов
                icon = "💸" if quest.quest_type.value == "record_expense" else \
                       "💰" if quest.quest_type.value == "record_income" else \
                       "📊" if quest.quest_type.value == "review_transactions" else \
                       "💳" if quest.quest_type.value == "check_balance" else "📋"
                message_parts.append(f"{i}. {icon} {quest.title} <b>(+{quest.xp_reward} XP)</b>")
        else:
            message_parts.append("🎉 На сегодня заданий нет. Отдыхай! 😊")
        
        message_parts.append("")
        message_parts.append("💡 <i>Выполняй задания, чтобы получить XP и поднять уровень!</i> 🚀")
        
        message = "\n".join(message_parts)
        
        # Формируем inline keyboard с кнопкой для мини-апп
        keyboard = []
        frontend_url = settings.FRONTEND_URL or ""
        
        # Проверяем, что URL валидный для web_app
        # Telegram требует HTTPS для web_app кнопок в продакшене
        # В dev режиме localhost разрешен, но в продакшене только HTTPS
        use_web_app = False
        if frontend_url:
            # Убираем trailing slash если есть
            frontend_url = frontend_url.rstrip('/')
            
            if frontend_url.startswith("https://"):
                # HTTPS URL - валиден для продакшена
                use_web_app = True
            elif frontend_url.startswith("http://localhost") and settings.DEBUG:
                # В dev режиме localhost разрешен только если DEBUG=True
                use_web_app = True
            else:
                # Не валидный URL для web_app - пропускаем кнопку
                logger.warning(f"Frontend URL is not valid for web_app: {frontend_url} (must be HTTPS in production or localhost in DEBUG mode), skipping web_app button")
        
        # Добавляем кнопку для открытия мини-апп только если URL валидный
        if use_web_app:
            keyboard.append([{
                "text": "📱 Открыть приложение",
                "web_app": {"url": frontend_url}
            }])
        
        reply_markup = {
            "inline_keyboard": keyboard
        } if keyboard else None
        
        # Проверяем, есть ли уже отправленное сообщение для редактирования
        old_message_id = profile.daily_reminder_message_id
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            base_url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"
            
            # Если есть старое сообщение, пытаемся его отредактировать
            if old_message_id:
                try:
                    edit_url = f"{base_url}/editMessageText"
                    edit_payload = {
                        "chat_id": telegram_id,
                        "message_id": old_message_id,
                        "text": message,
                        "parse_mode": "HTML",
                        "reply_markup": reply_markup
                    }
                    
                    edit_response = await client.post(edit_url, json=edit_payload)
                    edit_response_text = edit_response.text
                    if edit_response.status_code == 200:
                        result = edit_response.json()
                        if result.get("ok"):
                            logger.info(f"Daily reminder edited for Telegram user {user.id}, message_id: {old_message_id}")
                            db.commit()
                            return True
                        else:
                            # Сообщение не найдено или удалено, отправляем новое
                            error_description = result.get('description', 'Unknown error')
                            logger.warning(f"Could not edit message {old_message_id}: {error_description}, sending new one")
                            profile.daily_reminder_message_id = None
                            db.commit()
                    else:
                        # Ошибка редактирования, отправляем новое сообщение
                        logger.warning(f"Failed to edit message {old_message_id}: HTTP {edit_response.status_code}, response: {edit_response_text}, sending new one")
                        profile.daily_reminder_message_id = None
                        db.commit()
                except Exception as e:
                    logger.warning(f"Error editing message {old_message_id}: {e}, sending new one")
                    profile.daily_reminder_message_id = None
                    db.commit()
            
            # Отправляем новое сообщение (если редактирование не удалось или сообщения нет)
            send_url = f"{base_url}/sendMessage"
            send_payload = {
                "chat_id": telegram_id,
                "text": message,
                "parse_mode": "HTML"
            }
            if reply_markup:
                send_payload["reply_markup"] = reply_markup
            
            response = await client.post(send_url, json=send_payload)
            response_text = response.text
            if response.status_code == 200:
                result = response.json()
                if result.get("ok"):
                    # Сохраняем ID нового сообщения
                    new_message_id = result.get("result", {}).get("message_id")
                    if new_message_id:
                        profile.daily_reminder_message_id = new_message_id
                        db.commit()
                    logger.info(f"Daily reminder sent to Telegram user {user.id}, message_id: {new_message_id}")
                    return True
                else:
                    error_description = result.get('description', 'Unknown error')
                    error_code = result.get('error_code', 'N/A')
                    logger.error(f"Failed to send Telegram reminder: {error_code} - {error_description}")
                    logger.error(f"Response: {response_text}")
                    logger.error(f"Payload: chat_id={telegram_id}, message_length={len(message)}")
                    return False
            else:
                logger.error(f"Failed to send Telegram reminder: HTTP {response.status_code}")
                logger.error(f"Response: {response_text}")
                logger.error(f"Payload: chat_id={telegram_id}, message_length={len(message)}")
                return False
                
    except Exception as e:
        logger.error(f"Error sending Telegram daily reminder: {e}", exc_info=True)
        return False


async def send_daily_reminder_vk(user: User, db: Session) -> bool:
    """Отправить ежедневное напоминание в VK"""
    if not user.vk_id or not settings.VK_BOT_TOKEN:
        return False
    
    # Проверяем, включены ли уведомления для VK
    if not getattr(user, 'vk_notifications_enabled', True):
        logger.info(f"VK notifications disabled for user {user.id}, skipping")
        return False
    
    # Валидация vk_id - должен быть числом или строкой с числом
    try:
        vk_id = str(user.vk_id).strip()
        if not vk_id or not vk_id.isdigit():
            logger.error(f"Invalid vk_id for user {user.id}: '{user.vk_id}'")
            return False
        vk_id_int = int(vk_id)
    except (ValueError, AttributeError) as e:
        logger.error(f"Error validating vk_id for user {user.id}: {e}")
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
        
        # Формируем красивое сообщение для VK (без HTML, так как VK не поддерживает HTML)
        user_name = user.first_name or "друг"
        
        # Заголовок
        message_parts = [
            f"💬 Люся желает доброго дня, {user_name}! ✨",
            "",
        ]
        
        # Статистика
        message_parts.extend([
            "📊 Твоя статистика:",
            f"🔥 Страйк: {profile.streak_days} дней подряд",
            f"⭐ Уровень: {profile.level}",
            f"❤️ Сердце Люси: {profile.heart_level}/100",
            "",
        ])
        
        # Основное сообщение от Люси
        message_parts.append(f"💝 {lucy_message}")
        message_parts.append("")
        
        # Задания
        if quests:
            message_parts.append("🎯 Ежедневные задания на сегодня:")
            for i, quest in enumerate(quests[:3], 1):  # Показываем до 3 квестов
                icon = "💸" if quest.quest_type.value == "record_expense" else \
                       "💰" if quest.quest_type.value == "record_income" else \
                       "📊" if quest.quest_type.value == "review_transactions" else \
                       "💳" if quest.quest_type.value == "check_balance" else "📋"
                message_parts.append(f"{i}. {icon} {quest.title} (+{quest.xp_reward} XP)")
        else:
            message_parts.append("🎉 На сегодня заданий нет. Отдыхай! 😊")
        
        message_parts.append("")
        message_parts.append("💡 Выполняй задания, чтобы получить XP и поднять уровень! 🚀")
        
        message = "\n".join(message_parts)
        
        # Отправляем в VK через VK API
        if not settings.VK_BOT_TOKEN:
            logger.warning("VK_BOT_TOKEN not configured, skipping VK reminder")
            return False
        
        # Проверяем, есть ли уже отправленное сообщение для редактирования
        old_message_id = profile.daily_reminder_message_id
        
        try:
            # VK API для отправки сообщений
            vk_api_url = "https://api.vk.com/method/messages.send"
            
            # Проверяем, что токен установлен
            if not settings.VK_BOT_TOKEN or not settings.VK_BOT_TOKEN.strip():
                logger.error(f"VK_BOT_TOKEN is empty or not set for user {user.id}")
                return False
            
            # Генерируем random_id (должен быть уникальным для каждого сообщения)
            random_id = random.randint(1, 2147483647)
            
            # VK API требует передачу токена в query параметрах или в form-data
            # Используем form-data для совместимости
            payload = {
                "access_token": settings.VK_BOT_TOKEN.strip(),
                "user_id": vk_id_int,
                "message": message,
                "random_id": random_id,
                "v": "5.131"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                # VK API требует POST запрос с form-data (не JSON!)
                response = await client.post(vk_api_url, data=payload)
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # Проверяем на ошибки VK API
                    if "error" in result:
                        error = result["error"]
                        error_code = error.get("error_code", "unknown")
                        error_msg = error.get("error_msg", "Unknown error")
                        
                        # Ошибка 901 - пользователь не разрешил отправку сообщений
                        # Это не критическая ошибка, просто пользователь не настроил бота
                        if error_code == 901:
                            logger.info(f"VK user {user.id} (vk_id: {vk_id_int}) has not allowed messages from bot. This is expected if user hasn't started conversation with bot.")
                            # Не логируем как ошибку, это нормальная ситуация
                            return False
                        
                        # Другие ошибки логируем как ошибки
                        logger.error(f"VK API error {error_code}: {error_msg}")
                        logger.error(f"VK API response: {result}")
                        logger.error(f"VK user_id: {vk_id_int}, message_length: {len(message)}")
                        
                        # Если сообщение не найдено (например, удалено), отправляем новое
                        if error_code in [1, 6, 7, 9, 10]:  # Различные ошибки доступа/не найдено
                            old_message_id = None
                            profile.daily_reminder_message_id = None
                            db.commit()
                        
                        return False
                    
                    # Успешная отправка
                    if "response" in result:
                        # Сохраняем ID нового сообщения
                        new_message_id = result.get("response")
                        if new_message_id:
                            profile.daily_reminder_message_id = new_message_id
                            db.commit()
                        logger.info(f"Daily reminder sent to VK user {user.id}, message_id: {new_message_id}")
                        return True
                    else:
                        logger.error(f"Unexpected VK API response: {result}")
                        return False
                else:
                    logger.error(f"Failed to send VK reminder: HTTP {response.status_code}")
                    logger.error(f"VK API response: {response.text}")
                    logger.error(f"VK user_id: {vk_id_int}, message_length: {len(message)}")
                    return False
        except Exception as e:
            logger.error(f"Error sending VK reminder: {e}", exc_info=True)
            return False
        
    except Exception as e:
        logger.error(f"Error sending VK daily reminder: {e}", exc_info=True)
        return False


def is_time_for_reminder(user: User) -> bool:
    """Проверяет, наступило ли время для отправки напоминания (9:00 по местному времени пользователя)"""
    try:
        # Получаем часовой пояс пользователя (по умолчанию UTC)
        user_timezone_str = getattr(user, 'timezone', 'UTC') or 'UTC'
        
        # Пытаемся получить объект часового пояса
        try:
            user_tz = pytz.timezone(user_timezone_str)
        except pytz.exceptions.UnknownTimeZoneError:
            logger.warning(f"Unknown timezone '{user_timezone_str}' for user {user.id}, using UTC")
            user_tz = pytz.UTC
        
        # Получаем текущее время в часовом поясе пользователя
        now_utc = datetime.now(timezone.utc)
        now_user_tz = now_utc.astimezone(user_tz)
        
        # Проверяем, что сейчас 9:00 (с допуском в 1 час для запуска скрипта)
        current_hour = now_user_tz.hour
        current_minute = now_user_tz.minute
        
        # Отправляем если время между 9:00 и 9:59
        if current_hour == 9:
            return True
        
        logger.debug(f"User {user.id} timezone {user_timezone_str}: current time {now_user_tz.strftime('%H:%M')}, not 9:00 yet")
        return False
        
    except Exception as e:
        logger.error(f"Error checking time for user {user.id}: {e}", exc_info=True)
        # В случае ошибки не отправляем (безопаснее)
        return False


async def send_daily_reminders_to_all_users():
    """Отправить ежедневные напоминания всем пользователям с активными ботами в 9:00 по их местному времени"""
    # Используем sys.stdout для гарантированного вывода
    import sys
    def log(msg):
        print(msg, flush=True)
        sys.stdout.flush()
        logger.info(msg)
    
    log("[INFO] Starting send_daily_reminders_to_all_users...")
    db = SessionLocal()
    try:
        log("[INFO] Querying users with Telegram or VK IDs...")
        # Получаем всех пользователей с Telegram или VK
        users = db.query(User).filter(
            User.is_active == True,
            (User.telegram_id.isnot(None)) | (User.vk_id.isnot(None))
        ).all()
        
        log(f"[INFO] Found {len(users)} users with Telegram or VK IDs")
        logger.info(f"Checking {len(users)} users for daily reminders")
        
        if len(users) == 0:
            log("[WARNING] No users found with Telegram or VK IDs")
            return 0
        
        sent_count = 0
        skipped_timezone_count = 0
        skipped_settings_count = 0
        
        for i, user in enumerate(users, 1):
            try:
                # Проверяем, наступило ли время для отправки (9:00 по местному времени)
                if not is_time_for_reminder(user):
                    skipped_timezone_count += 1
                    continue
                
                log(f"[INFO] Processing user {i}/{len(users)}: ID={user.id}, Telegram={bool(user.telegram_id)}, VK={bool(user.vk_id)}, Timezone={getattr(user, 'timezone', 'UTC')}")
                
                if user.telegram_id:
                    # Проверяем настройки уведомлений
                    if not getattr(user, 'telegram_notifications_enabled', True):
                        log(f"[INFO] Telegram notifications disabled for user {user.id}, skipping")
                        skipped_settings_count += 1
                    else:
                        log(f"[INFO] Sending Telegram reminder to user {user.id}...")
                        success = await send_daily_reminder_telegram(user, db)
                        if success:
                            sent_count += 1
                            log(f"[SUCCESS] Telegram reminder sent to user {user.id}")
                        else:
                            log(f"[WARNING] Failed to send Telegram reminder to user {user.id}")
                
                if user.vk_id:
                    # Проверяем настройки уведомлений
                    if not getattr(user, 'vk_notifications_enabled', True):
                        log(f"[INFO] VK notifications disabled for user {user.id}, skipping")
                        skipped_settings_count += 1
                    else:
                        log(f"[INFO] Sending VK reminder to user {user.id}...")
                        success = await send_daily_reminder_vk(user, db)
                        if success:
                            sent_count += 1
                            log(f"[SUCCESS] VK reminder sent to user {user.id}")
                        else:
                            log(f"[WARNING] Failed to send VK reminder to user {user.id}")
            except Exception as e:
                log(f"[ERROR] Error sending reminder to user {user.id}: {e}")
                logger.error(f"Error sending reminder to user {user.id}: {e}", exc_info=True)
                continue
        
        log(f"[INFO] Daily reminders sent to {sent_count} out of {len(users)} users")
        log(f"[INFO] Skipped {skipped_timezone_count} users (not 9:00 in their timezone)")
        log(f"[INFO] Skipped {skipped_settings_count} users (notifications disabled)")
        logger.info(f"Daily reminders sent to {sent_count} users")
        return sent_count
        
    except Exception as e:
        log(f"[ERROR] Fatal error in send_daily_reminders_to_all_users: {e}")
        log(f"[ERROR] Traceback: {traceback.format_exc()}")
        logger.error(f"Error in send_daily_reminders_to_all_users: {e}", exc_info=True)
        return 0
    finally:
        db.close()
        log("[INFO] Database connection closed")

