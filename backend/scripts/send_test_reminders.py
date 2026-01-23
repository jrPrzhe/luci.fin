"""
Скрипт для отправки тестовых ежедневных напоминаний только для указанных пользователей
"""
import sys
import os
import asyncio
import traceback
from pathlib import Path

# Добавляем путь к backend в PYTHONPATH
script_dir = Path(__file__).parent
backend_dir = script_dir.parent
sys.path.insert(0, str(backend_dir))

# Тестовые пользователи (по username, email или telegram_username)
# Можно указать username, email или telegram_username (с @ или без)
TEST_USERS = [
    "mike",
    "ceo_arendix", 
    "mila_gorshova",
    "przhrdsk",  # Telegram username
    "gormisko",  # Telegram username
]

def log(message):
    """Безопасное логирование"""
    try:
        safe_message = str(message).encode('utf-8', errors='replace').decode('utf-8')
        print(safe_message, flush=True)
        sys.stdout.flush()
    except:
        print(f"[LOG ERROR] {message}", flush=True)
        sys.stdout.flush()

try:
    from app.api.v1.gamification_notifications import send_daily_reminder_telegram, send_daily_reminder_vk
    from app.core.database import SessionLocal
    from app.models.user import User
    log("[DEBUG] Imports successful!")
except ImportError as e:
    log(f"[ERROR] Failed to import: {e}")
    log(f"[ERROR] Traceback: {traceback.format_exc()}")
    sys.exit(1)

async def send_test_reminders():
    """Отправить тестовые напоминания только для указанных пользователей"""
    db = SessionLocal()
    try:
        log("=" * 50)
        log("[START] Starting test reminders script...")
        log(f"[INFO] Test users: {', '.join(TEST_USERS)}")
        log("=" * 50)
        
        # Находим пользователей по username, email или telegram_username
        found_users = []
        all_users = db.query(User).filter(User.is_active == True).all()
        
        for user in all_users:
            username_lower = (user.username or "").lower()
            email_lower = (user.email or "").lower()
            first_name_lower = (user.first_name or "").lower()
            telegram_username_lower = (user.telegram_username or "").lower().lstrip('@')
            
            for test_user in TEST_USERS:
                test_user_lower = test_user.lower().lstrip('@')
                
                # Проверяем точное совпадение username
                if username_lower == test_user_lower:
                    if user not in found_users:
                        found_users.append(user)
                        log(f"[DEBUG] Found user {user.id} by username match: {user.username}")
                        break
                # Проверяем точное совпадение telegram_username
                elif telegram_username_lower == test_user_lower:
                    if user not in found_users:
                        found_users.append(user)
                        log(f"[DEBUG] Found user {user.id} by telegram_username match: {user.telegram_username}")
                        break
                # Проверяем частичное совпадение в username, email, telegram_username или имени
                elif (test_user_lower in username_lower or 
                      test_user_lower in email_lower or 
                      test_user_lower in telegram_username_lower or
                      test_user_lower in first_name_lower):
                    if user not in found_users:
                        found_users.append(user)
                        log(f"[DEBUG] Found user {user.id} by partial match")
                        break
        
        users = found_users
        
        if not users:
            log("[ERROR] No users found! Please check usernames/emails.")
            return 0
        
        log(f"[INFO] Found {len(users)} users:")
        for user in users:
            log(f"  - ID: {user.id}, Username: {user.username}, Email: {user.email}, Name: {user.first_name}")
        
        sent_count = 0
        
        for user in users:
            try:
                log(f"\n[INFO] Processing user {user.id} ({user.username or user.email})...")
                
                # Проверяем, есть ли у пользователя Telegram или VK
                has_telegram = bool(user.telegram_id)
                has_vk = bool(user.vk_id)
                
                if not has_telegram and not has_vk:
                    log(f"[WARNING] User {user.id} has no telegram_id or vk_id, skipping")
                    continue
                
                # Отправляем в Telegram, если есть
                if has_telegram:
                    log(f"[INFO] Sending Telegram reminder to user {user.id}...")
                    success = await send_daily_reminder_telegram(user, db)
                    if success:
                        sent_count += 1
                        log(f"[SUCCESS] Telegram reminder sent to user {user.id}")
                    else:
                        log(f"[WARNING] Failed to send Telegram reminder to user {user.id}")
                
                # Отправляем в VK, если есть
                if has_vk:
                    log(f"[INFO] Sending VK reminder to user {user.id}...")
                    success = await send_daily_reminder_vk(user, db)
                    if success:
                        sent_count += 1
                        log(f"[SUCCESS] VK reminder sent to user {user.id}")
                    else:
                        log(f"[WARNING] Failed to send VK reminder to user {user.id}")
                        
            except Exception as e:
                log(f"[ERROR] Error sending reminder to user {user.id}: {e}")
                log(f"[ERROR] Traceback: {traceback.format_exc()}")
                continue
        
        log("\n" + "=" * 50)
        log(f"[SUCCESS] Test reminders sent to {sent_count} users")
        log("=" * 50)
        return sent_count
        
    except Exception as e:
        log(f"[ERROR] Fatal error: {e}")
        log(f"[ERROR] Traceback: {traceback.format_exc()}")
        return 0
    finally:
        db.close()
        log("[INFO] Database connection closed")

if __name__ == "__main__":
    try:
        sent_count = asyncio.run(send_test_reminders())
        sys.exit(0 if sent_count > 0 else 1)
    except KeyboardInterrupt:
        log("\n[INFO] Interrupted by user")
        sys.exit(1)
    except Exception as e:
        log(f"[ERROR] Unexpected error: {e}")
        log(f"[ERROR] Traceback: {traceback.format_exc()}")
        sys.exit(1)

