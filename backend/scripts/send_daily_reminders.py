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

# Принудительно выводим в stdout с flush для Railway
def log(message):
    print(message, flush=True)
    sys.stdout.flush()

log(f"[DEBUG] Script directory: {script_dir}")
log(f"[DEBUG] Backend directory: {backend_dir}")
log(f"[DEBUG] PYTHONPATH: {os.environ.get('PYTHONPATH', 'not set')}")
log(f"[DEBUG] Python path: {sys.path}")
log(f"[DEBUG] Current working directory: {os.getcwd()}")
log(f"[DEBUG] Files in current dir: {os.listdir('.')}")

try:
    log("[DEBUG] Importing send_daily_reminders_to_all_users...")
    from app.api.v1.gamification_notifications import send_daily_reminders_to_all_users
    log("[DEBUG] Import successful!")
except ImportError as e:
    log(f"[ERROR] Failed to import: {e}")
    log(f"[ERROR] Traceback: {traceback.format_exc()}")
    sys.exit(1)

async def main():
    """Основная функция"""
    try:
        log("=" * 50)
        log("🚀 Starting daily reminders script...")
        log("=" * 50)
        
        # Проверяем переменные окружения
        db_url = os.environ.get('DATABASE_URL', '')
        telegram_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
        
        log(f"[DEBUG] DATABASE_URL: {'set' if db_url else 'NOT SET'}")
        log(f"[DEBUG] TELEGRAM_BOT_TOKEN: {'set' if telegram_token else 'NOT SET'}")
        
        if not db_url:
            log("[ERROR] DATABASE_URL is not set!")
            return
        
        log("[INFO] Calling send_daily_reminders_to_all_users...")
        sent_count = await send_daily_reminders_to_all_users()
        
        log("=" * 50)
        log(f"✅ Daily reminders sent to {sent_count} users")
        log("=" * 50)
        
    except Exception as e:
        log(f"[ERROR] Exception in main: {e}")
        log(f"[ERROR] Traceback: {traceback.format_exc()}")
        sys.exit(1)


if __name__ == "__main__":
    # Принудительно выводим в stderr тоже (на случай если stdout не работает)
    import sys
    def log_all(msg):
        print(msg, flush=True, file=sys.stdout)
        print(msg, flush=True, file=sys.stderr)
        sys.stdout.flush()
        sys.stderr.flush()
    
    try:
        log_all("[START] Script execution started")
        log_all(f"[START] Python version: {sys.version}")
        log_all(f"[START] Script path: {__file__}")
        log_all(f"[START] Working directory: {os.getcwd()}")
        log_all(f"[START] Python executable: {sys.executable}")
        
        asyncio.run(main())
        log_all("[END] Script execution completed successfully")
    except KeyboardInterrupt:
        log_all("[INFO] Script interrupted by user")
        sys.exit(0)
    except Exception as e:
        log_all(f"[ERROR] Fatal error: {e}")
        log_all(f"[ERROR] Traceback: {traceback.format_exc()}")
        sys.exit(1)

