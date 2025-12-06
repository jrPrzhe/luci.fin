#!/usr/bin/env python3
"""
Скрипт для отправки еженедельных сводок по целям
Можно запускать по расписанию (cron) или через Railway Scheduler
"""
import sys
import os
import asyncio
import traceback
import json
from decimal import Decimal
from datetime import datetime, timezone, timedelta

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

try:
    log("[DEBUG] Importing modules...")
    from app.core.database import SessionLocal
    from app.core.config import settings
    from app.models.user import User
    from app.models.goal import Goal, GoalStatus
    from app.ai.assistant import AIAssistant
    import httpx
    log("[DEBUG] Import successful!")
except ImportError as e:
    log(f"[ERROR] Failed to import: {e}")
    log(f"[ERROR] Traceback: {traceback.format_exc()}")
    sys.exit(1)


async def generate_goal_summary_message(user: User, goals: list, db) -> str:
    """Генерирует AI-сообщение с поддержкой и наставничеством для целей пользователя"""
    assistant = AIAssistant()
    
    user_name = user.first_name or user.username or "друг"
    
    # Формируем данные о целях для промпта
    goals_summary = []
    total_progress = 0
    total_target = 0
    active_count = 0
    completed_count = 0
    
    for goal in goals:
        current = float(goal.current_amount)
        target = float(goal.target_amount)
        progress_pct = goal.progress_percentage or 0
        
        goals_summary.append({
            "name": goal.name,
            "current": current,
            "target": target,
            "progress": progress_pct,
            "currency": goal.currency,
            "status": goal.status.value
        })
        
        if goal.status == GoalStatus.ACTIVE:
            active_count += 1
            total_progress += current
            total_target += target
        elif goal.status == GoalStatus.COMPLETED:
            completed_count += 1
    
    # Формируем промпт для AI
    goals_text = ""
    for i, goal in enumerate(goals_summary, 1):
        status_emoji = {
            "active": "🟢",
            "completed": "✅",
            "failed": "❌",
            "paused": "⏸️"
        }
        emoji = status_emoji.get(goal["status"], "📌")
        goals_text += f"{i}. {emoji} {goal['name']}: {goal['progress']}% ({int(round(goal['current'])):,} / {int(round(goal['target'])):,} {goal['currency']})\n"
    
    prompt = f"""Ты - ИИ Финансовый ассистент, который помогает пользователям достигать финансовых целей.

Пользователь: {user_name}
Активных целей: {active_count}
Завершенных целей: {completed_count}
Всего целей: {len(goals)}

Статус целей:
{goals_text}

Твоя задача:
1. Дать краткую сводку по прогрессу целей (1-2 предложения)
2. Поддержать и мотивировать пользователя
3. Дать практический совет по достижению целей (1-2 предложения)
4. Быть тёплым, поддерживающим и наставническим

Стиль: дружелюбный, поддерживающий, мотивирующий, как финансовый наставник.
Ответ должен быть на русском языке, кратким (3-5 предложений), без эмодзи в начале (они будут добавлены отдельно).
Ответ должен быть только текстом сообщения, без дополнительных пояснений."""

    if not assistant.client:
        # Fallback сообщение
        if active_count > 0:
            avg_progress = sum(g["progress"] for g in goals_summary if g["status"] == "active") / active_count if active_count > 0 else 0
            if avg_progress >= 75:
                message = f"Отличный прогресс! Ты уже на {int(avg_progress)}% пути к своим целям. Продолжай в том же духе, ты почти у цели!"
            elif avg_progress >= 50:
                message = f"Хороший прогресс! Ты уже прошёл больше половины пути ({int(avg_progress)}%). Не останавливайся, каждый шаг приближает тебя к цели!"
            elif avg_progress >= 25:
                message = f"Ты на правильном пути! Прогресс {int(avg_progress)}% - это хорошее начало. Продолжай двигаться к своим целям!"
            else:
                message = f"Ты только начинаешь свой путь к целям ({int(avg_progress)}% прогресса). Каждый день - это новый шаг. Верь в себя!"
        else:
            message = f"У тебя нет активных целей на данный момент. Создай новую цель, чтобы начать свой путь к финансовой свободе!"
        
        return message
    
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            assistant.client.generate_content,
            prompt
        )
        
        message = response.text if hasattr(response, 'text') else str(response)
        # Очищаем сообщение от лишних символов
        message = message.strip().strip('"').strip("'")
        
        return message
        
    except Exception as e:
        log(f"[WARNING] AI message generation failed: {e}, using fallback")
        # Fallback
        if active_count > 0:
            avg_progress = sum(g["progress"] for g in goals_summary if g["status"] == "active") / active_count if active_count > 0 else 0
            message = f"Твой прогресс по целям: {int(avg_progress)}%. Продолжай двигаться к своим целям, каждый шаг важен!"
        else:
            message = "У тебя нет активных целей. Создай новую цель, чтобы начать свой путь!"
        
        return message


async def send_goal_summary_telegram(user: User, goals: list, db) -> bool:
    """Отправить еженедельную сводку по целям в Telegram"""
    if not user.telegram_id or not settings.TELEGRAM_BOT_TOKEN:
        return False
    
    # Проверяем, включены ли уведомления для Telegram
    if not getattr(user, 'telegram_notifications_enabled', True):
        log(f"[INFO] Telegram notifications disabled for user {user.id}, skipping")
        return False
    
    # Валидация telegram_id
    try:
        telegram_id = str(user.telegram_id).strip()
        if not telegram_id or not telegram_id.isdigit():
            log(f"[ERROR] Invalid telegram_id for user {user.id}: '{user.telegram_id}'")
            return False
    except Exception as e:
        log(f"[ERROR] Error validating telegram_id for user {user.id}: {e}")
        return False
    
    try:
        # Генерируем AI-сообщение
        ai_message = await generate_goal_summary_message(user, goals, db)
        
        # Формируем сводку по целям
        user_name = user.first_name or "друг"
        
        message_parts = [
            f"🎯 <b>Еженедельная сводка по целям</b>",
            f"Привет, {user_name}! 👋",
            "",
        ]
        
        # Статистика по целям
        active_goals = [g for g in goals if g.status == GoalStatus.ACTIVE]
        completed_goals = [g for g in goals if g.status == GoalStatus.COMPLETED]
        
        if active_goals:
            message_parts.append(f"<b>📊 Активные цели ({len(active_goals)}):</b>")
            for goal in active_goals[:5]:  # Показываем до 5 целей
                current = float(goal.current_amount)
                target = float(goal.target_amount)
                progress = goal.progress_percentage or 0
                remaining = target - current
                
                # Прогресс-бар (20 символов)
                progress_bar_length = 20
                filled = int(progress / 100 * progress_bar_length)
                progress_bar = "█" * filled + "░" * (progress_bar_length - filled)
                
                message_parts.append(
                    f"• <b>{goal.name}</b>\n"
                    f"  {int(round(current)):,} / {int(round(target)):,} {goal.currency} ({progress}%)\n"
                    f"  <code>{progress_bar}</code>\n"
                    f"  Осталось: {int(round(remaining)):,} {goal.currency}"
                )
            
            if len(active_goals) > 5:
                message_parts.append(f"\n... и ещё {len(active_goals) - 5} целей")
        else:
            message_parts.append("📌 У тебя нет активных целей на данный момент.")
        
        if completed_goals:
            message_parts.append(f"\n✅ <b>Завершённые цели ({len(completed_goals)}):</b>")
            for goal in completed_goals[:3]:  # Показываем до 3 завершённых
                message_parts.append(f"• {goal.name} ✅")
        
        message_parts.append("")
        message_parts.append("💬 <b>От ИИ Финансового ассистента:</b>")
        message_parts.append(ai_message)
        message_parts.append("")
        message_parts.append("💡 <i>Продолжай двигаться к своим целям! Каждый шаг важен. 🚀</i>")
        
        message = "\n".join(message_parts)
        
        # Формируем inline keyboard с кнопкой для мини-апп
        keyboard = []
        frontend_url = settings.FRONTEND_URL or ""
        
        # Проверяем, что URL валидный для web_app
        use_web_app = False
        if frontend_url:
            frontend_url = frontend_url.rstrip('/')
            if frontend_url.startswith("https://"):
                use_web_app = True
            elif frontend_url.startswith("http://localhost") and settings.DEBUG:
                use_web_app = True
        
        if use_web_app:
            keyboard.append([{
                "text": "📱 Открыть цели в приложении",
                "web_app": {"url": f"{frontend_url}/goals"}
            }])
        
        reply_markup = {
            "inline_keyboard": keyboard
        } if keyboard else None
        
        # Отправляем сообщение
        async with httpx.AsyncClient(timeout=10.0) as client:
            base_url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"
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
                    log(f"[SUCCESS] Goal summary sent to Telegram user {user.id}")
                    return True
                else:
                    error_description = result.get('description', 'Unknown error')
                    error_code = result.get('error_code', 'N/A')
                    log(f"[ERROR] Failed to send Telegram goal summary: {error_code} - {error_description}")
                    return False
            else:
                log(f"[ERROR] Failed to send Telegram goal summary: HTTP {response.status_code}")
                log(f"[ERROR] Response: {response_text}")
                return False
                
    except Exception as e:
        log(f"[ERROR] Error sending Telegram goal summary: {e}")
        log(f"[ERROR] Traceback: {traceback.format_exc()}")
        return False


async def send_weekly_goal_summaries_to_all_users():
    """Отправить еженедельные сводки по целям всем пользователям с активными целями и включенными уведомлениями"""
    import sys
    def log(msg):
        print(msg, flush=True)
        sys.stdout.flush()
    
    log("[INFO] Starting send_weekly_goal_summaries_to_all_users...")
    db = SessionLocal()
    try:
        log("[INFO] Querying users with active goals and enabled notifications...")
        
        # Получаем всех пользователей с Telegram ID, активными целями и включенными уведомлениями
        users = db.query(User).filter(
            User.is_active == True,
            User.telegram_id.isnot(None)
        ).all()
        
        log(f"[INFO] Found {len(users)} users with Telegram IDs")
        
        if len(users) == 0:
            log("[WARNING] No users found with Telegram IDs")
            return 0
        
        sent_count = 0
        skipped_no_goals_count = 0
        skipped_notifications_count = 0
        
        for i, user in enumerate(users, 1):
            try:
                # Проверяем настройки уведомлений
                if not getattr(user, 'telegram_notifications_enabled', True):
                    log(f"[INFO] Telegram notifications disabled for user {user.id}, skipping")
                    skipped_notifications_count += 1
                    continue
                
                # Получаем активные цели пользователя
                goals = db.query(Goal).filter(
                    Goal.user_id == user.id,
                    Goal.status.in_([GoalStatus.ACTIVE, GoalStatus.COMPLETED])
                ).all()
                
                if not goals:
                    skipped_no_goals_count += 1
                    continue
                
                log(f"[INFO] Processing user {i}/{len(users)}: ID={user.id}, Goals={len(goals)}")
                
                # Отправляем сводку
                success = await send_goal_summary_telegram(user, goals, db)
                if success:
                    sent_count += 1
                    log(f"[SUCCESS] Goal summary sent to user {user.id}")
                else:
                    log(f"[WARNING] Failed to send goal summary to user {user.id}")
                    
            except Exception as e:
                log(f"[ERROR] Error processing user {user.id}: {e}")
                log(f"[ERROR] Traceback: {traceback.format_exc()}")
                continue
        
        log(f"[INFO] Goal summaries sent to {sent_count} out of {len(users)} users")
        log(f"[INFO] Skipped {skipped_no_goals_count} users (no active goals)")
        log(f"[INFO] Skipped {skipped_notifications_count} users (notifications disabled)")
        return sent_count
        
    except Exception as e:
        log(f"[ERROR] Fatal error in send_weekly_goal_summaries_to_all_users: {e}")
        log(f"[ERROR] Traceback: {traceback.format_exc()}")
        return 0
    finally:
        db.close()
        log("[INFO] Database connection closed")


async def main():
    """Основная функция"""
    try:
        log("=" * 50)
        log("[START] Starting weekly goal summaries script...")
        log("=" * 50)
        
        # Проверяем переменные окружения
        try:
            from decouple import config
            db_url = config('DATABASE_URL', default='')
            telegram_token = config('TELEGRAM_BOT_TOKEN', default='')
        except:
            db_url = os.environ.get('DATABASE_URL', '')
            telegram_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
        
        log(f"[DEBUG] DATABASE_URL: {'set' if db_url else 'NOT SET'}")
        log(f"[DEBUG] TELEGRAM_BOT_TOKEN: {'set' if telegram_token else 'NOT SET'}")
        
        # Проверяем через settings
        from app.core.config import settings
        if settings.DATABASE_URL:
            log(f"[DEBUG] DATABASE_URL from settings: set (length: {len(settings.DATABASE_URL)})")
        if settings.TELEGRAM_BOT_TOKEN:
            log(f"[DEBUG] TELEGRAM_BOT_TOKEN from settings: set")
        
        log("[INFO] Calling send_weekly_goal_summaries_to_all_users...")
        sent_count = await send_weekly_goal_summaries_to_all_users()
        
        log("=" * 50)
        log(f"[SUCCESS] Weekly goal summaries sent to {sent_count} users")
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
            pass
    
    # Принудительно выводим в stderr тоже
    def log_all(msg):
        try:
            print(msg, flush=True, file=sys.stdout)
            print(msg, flush=True, file=sys.stderr)
            sys.stdout.flush()
            sys.stderr.flush()
        except (UnicodeEncodeError, UnicodeDecodeError):
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





