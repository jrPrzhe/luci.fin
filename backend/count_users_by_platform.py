#!/usr/bin/env python3
"""
Скрипт для подсчёта пользователей по платформам (VK и Telegram)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal
from app.models.user import User
from sqlalchemy import and_, or_
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def count_users_by_platform():
    """Подсчёт пользователей по платформам"""
    logger.info("=" * 60)
    logger.info("Подсчёт пользователей по платформам")
    logger.info("=" * 60)
    
    db = SessionLocal()
    try:
        # Всего пользователей
        total_users = db.query(User).count()
        logger.info(f"\nВсего пользователей: {total_users}")
        
        # Пользователи с Telegram
        telegram_users = db.query(User).filter(
            User.telegram_id.isnot(None)
        ).count()
        logger.info(f"\nПользователей в Telegram: {telegram_users}")
        
        # Пользователи с VK
        vk_users = db.query(User).filter(
            User.vk_id.isnot(None)
        ).count()
        logger.info(f"Пользователей в VK: {vk_users}")
        
        # Пользователи с обеими платформами (связанные аккаунты)
        both_platforms = db.query(User).filter(
            and_(
                User.telegram_id.isnot(None),
                User.vk_id.isnot(None)
            )
        ).count()
        logger.info(f"\nПользователей с обеими платформами (связанные): {both_platforms}")
        
        # Только Telegram (без VK)
        only_telegram = db.query(User).filter(
            and_(
                User.telegram_id.isnot(None),
                User.vk_id.is_(None)
            )
        ).count()
        logger.info(f"Только Telegram (без VK): {only_telegram}")
        
        # Только VK (без Telegram)
        only_vk = db.query(User).filter(
            and_(
                User.vk_id.isnot(None),
                User.telegram_id.is_(None)
            )
        ).count()
        logger.info(f"Только VK (без Telegram): {only_vk}")
        
        # Пользователи без платформ (только email/пароль)
        no_platform = db.query(User).filter(
            and_(
                User.telegram_id.is_(None),
                User.vk_id.is_(None)
            )
        ).count()
        logger.info(f"\nПользователей без платформ (только email): {no_platform}")
        
        # Проверка: сумма должна быть равна total_users
        calculated_total = only_telegram + only_vk + both_platforms + no_platform
        logger.info(f"\nПроверка: {only_telegram} + {only_vk} + {both_platforms} + {no_platform} = {calculated_total}")
        if calculated_total == total_users:
            logger.info("✅ Сумма совпадает с общим количеством пользователей")
        else:
            logger.warning(f"⚠️  Несоответствие: ожидалось {total_users}, получили {calculated_total}")
        
        logger.info("\n" + "=" * 60)
        logger.info("ИТОГО:")
        logger.info("=" * 60)
        logger.info(f"Telegram: {telegram_users} пользователей")
        logger.info(f"VK: {vk_users} пользователей")
        logger.info("=" * 60)
        
        return {
            "total": total_users,
            "telegram": telegram_users,
            "vk": vk_users,
            "only_telegram": only_telegram,
            "only_vk": only_vk,
            "both": both_platforms,
            "no_platform": no_platform
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка при подсчёте пользователей: {type(e).__name__}: {str(e)}", exc_info=True)
        return None
    finally:
        db.close()


if __name__ == "__main__":
    result = count_users_by_platform()
    if result:
        sys.exit(0)
    else:
        sys.exit(1)


