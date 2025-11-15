#!/usr/bin/env python3
"""
Скрипт для отправки ежедневных напоминаний о заданиях
Можно запускать по расписанию (cron) или через Railway Scheduler
"""
import sys
import os
import asyncio

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.api.v1.gamification_notifications import send_daily_reminders_to_all_users


async def main():
    """Основная функция"""
    print("🚀 Sending daily reminders to all users...")
    sent_count = await send_daily_reminders_to_all_users()
    print(f"✅ Daily reminders sent to {sent_count} users")


if __name__ == "__main__":
    asyncio.run(main())

