#!/usr/bin/env python3
"""
Скрипт для отправки ежедневных напоминаний о заданиях
Можно запускать по расписанию (cron) или через Railway Scheduler
"""
import sys
import os
import asyncio
import traceback

# Add parent directory to path
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
sys.path.insert(0, backend_dir)

# Устанавливаем PYTHONPATH для импортов
os.environ.setdefault('PYTHONPATH', backend_dir)

print(f"[DEBUG] Script directory: {script_dir}")
print(f"[DEBUG] Backend directory: {backend_dir}")
print(f"[DEBUG] PYTHONPATH: {os.environ.get('PYTHONPATH', 'not set')}")
print(f"[DEBUG] Python path: {sys.path}")

try:
    print("[DEBUG] Importing send_daily_reminders_to_all_users...")
    from app.api.v1.gamification_notifications import send_daily_reminders_to_all_users
    print("[DEBUG] Import successful!")
except ImportError as e:
    print(f"[ERROR] Failed to import: {e}")
    print(f"[ERROR] Traceback: {traceback.format_exc()}")
    sys.exit(1)

async def main():
    """Основная функция"""
    try:
        print("=" * 50)
        print("🚀 Starting daily reminders script...")
        print("=" * 50)
        
        # Проверяем переменные окружения
        db_url = os.environ.get('DATABASE_URL', '')
        telegram_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
        
        print(f"[DEBUG] DATABASE_URL: {'set' if db_url else 'NOT SET'}")
        print(f"[DEBUG] TELEGRAM_BOT_TOKEN: {'set' if telegram_token else 'NOT SET'}")
        
        if not db_url:
            print("[ERROR] DATABASE_URL is not set!")
            return
        
        print("[INFO] Calling send_daily_reminders_to_all_users...")
        sent_count = await send_daily_reminders_to_all_users()
        
        print("=" * 50)
        print(f"✅ Daily reminders sent to {sent_count} users")
        print("=" * 50)
        
    except Exception as e:
        print(f"[ERROR] Exception in main: {e}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"[ERROR] Fatal error: {e}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        sys.exit(1)

