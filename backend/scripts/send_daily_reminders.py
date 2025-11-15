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
# Исправляем кодировку для Windows
def log(message):
    try:
        # Пытаемся использовать UTF-8
        if sys.stdout.encoding and 'utf' not in sys.stdout.encoding.lower():
            # Если кодировка не UTF-8, заменяем эмодзи на текст
            message = message.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        print(message, flush=True)
        sys.stdout.flush()
    except (UnicodeEncodeError, UnicodeDecodeError):
        # Если все равно ошибка, убираем эмодзи
        safe_message = message.encode('ascii', errors='ignore').decode('ascii')
        print(safe_message, flush=True)
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
        log("[START] Starting daily reminders script...")
        log("=" * 50)
        
        # Проверяем переменные окружения
        # Пытаемся загрузить из .env файла если есть
        try:
            from decouple import config
            db_url = config('DATABASE_URL', default='')
            telegram_token = config('TELEGRAM_BOT_TOKEN', default='')
        except:
            # Если decouple не работает, используем os.environ
            db_url = os.environ.get('DATABASE_URL', '')
            telegram_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
        
        log(f"[DEBUG] DATABASE_URL: {'set' if db_url else 'NOT SET'}")
        log(f"[DEBUG] TELEGRAM_BOT_TOKEN: {'set' if telegram_token else 'NOT SET'}")
        
        # Проверяем через settings (который уже загрузил .env)
        from app.core.config import settings
        if settings.DATABASE_URL:
            log(f"[DEBUG] DATABASE_URL from settings: set (length: {len(settings.DATABASE_URL)})")
        if settings.TELEGRAM_BOT_TOKEN:
            log(f"[DEBUG] TELEGRAM_BOT_TOKEN from settings: set")
        
        # Не прерываем выполнение, если переменные не в os.environ
        # settings уже загрузил их из .env
        
        log("[INFO] Calling send_daily_reminders_to_all_users...")
        sent_count = await send_daily_reminders_to_all_users()
        
        log("=" * 50)
        log(f"[SUCCESS] Daily reminders sent to {sent_count} users")
        log("=" * 50)
        
    except Exception as e:
        log(f"[ERROR] Exception in main: {e}")
        log(f"[ERROR] Traceback: {traceback.format_exc()}")
        sys.exit(1)


if __name__ == "__main__":
    # Исправляем кодировку для Windows
    import sys
    import io
    
    # Устанавливаем UTF-8 для stdout и stderr
    if sys.platform == 'win32':
        try:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
        except AttributeError:
            # Если уже TextIOWrapper, пропускаем
            pass
    
    # Принудительно выводим в stderr тоже (на случай если stdout не работает)
    def log_all(msg):
        try:
            print(msg, flush=True, file=sys.stdout)
            print(msg, flush=True, file=sys.stderr)
            sys.stdout.flush()
            sys.stderr.flush()
        except (UnicodeEncodeError, UnicodeDecodeError):
            # Если ошибка кодировки, убираем проблемные символы
            safe_msg = msg.encode('ascii', errors='ignore').decode('ascii')
            print(safe_msg, flush=True, file=sys.stdout)
            print(safe_msg, flush=True, file=sys.stderr)
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

