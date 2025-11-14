#!/usr/bin/env python3
"""
Диагностический скрипт для проверки проблем с авторизацией после переключения на внешнюю БД
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal, engine
from app.core.config import settings
from app.models.user import User
from app.core.security import verify_password, get_password_hash
from sqlalchemy import text
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_database_connection():
    """Проверка подключения к БД"""
    logger.info("=" * 60)
    logger.info("1. Проверка подключения к БД")
    logger.info("=" * 60)
    
    try:
        # Проверяем подключение
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            logger.info(f"✅ Подключение к БД установлено")
            logger.info(f"   PostgreSQL версия: {version[:50]}...")
            
            # Проверяем кодировку БД
            result = conn.execute(text("SHOW client_encoding"))
            encoding = result.fetchone()[0]
            logger.info(f"   Кодировка клиента: {encoding}")
            
            result = conn.execute(text("SHOW server_encoding"))
            server_encoding = result.fetchone()[0]
            logger.info(f"   Кодировка сервера: {server_encoding}")
            
    except Exception as e:
        logger.error(f"❌ Ошибка подключения к БД: {type(e).__name__}: {str(e)}")
        return False
    
    return True


def check_users_table():
    """Проверка таблицы users"""
    logger.info("=" * 60)
    logger.info("2. Проверка таблицы users")
    logger.info("=" * 60)
    
    db = SessionLocal()
    try:
        # Подсчитываем пользователей
        total_users = db.query(User).count()
        logger.info(f"   Всего пользователей в БД: {total_users}")
        
        # Пользователи с паролями
        users_with_passwords = db.query(User).filter(User.hashed_password.isnot(None)).count()
        logger.info(f"   Пользователей с паролями: {users_with_passwords}")
        
        # Пользователи без паролей
        users_without_passwords = db.query(User).filter(User.hashed_password.is_(None)).count()
        logger.info(f"   Пользователей без паролей: {users_without_passwords}")
        
        # Пользователи с Telegram
        telegram_users = db.query(User).filter(User.telegram_id.isnot(None)).count()
        logger.info(f"   Пользователей с Telegram ID: {telegram_users}")
        
        # Проверяем формат хешей паролей
        users = db.query(User).filter(User.hashed_password.isnot(None)).limit(10).all()
        logger.info(f"\n   Проверка формата хешей паролей (первые 10 пользователей):")
        for user in users:
            hash_str = user.hashed_password
            hash_preview = hash_str[:20] if hash_str else "None"
            hash_length = len(hash_str) if hash_str else 0
            
            # Проверяем формат bcrypt
            is_bcrypt = hash_str.startswith('$2a$') or hash_str.startswith('$2b$') or hash_str.startswith('$2y$')
            
            logger.info(f"   User ID {user.id} ({user.email}):")
            logger.info(f"      Hash preview: {hash_preview}...")
            logger.info(f"      Hash length: {hash_length}")
            logger.info(f"      Bcrypt format: {'✅' if is_bcrypt else '❌'}")
            
            # Проверяем кодировку
            try:
                hash_bytes = hash_str.encode('utf-8')
                logger.info(f"      UTF-8 encoding: ✅ ({len(hash_bytes)} bytes)")
            except Exception as e:
                logger.warning(f"      UTF-8 encoding: ❌ {e}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка при проверке таблицы users: {type(e).__name__}: {str(e)}", exc_info=True)
        return False
    finally:
        db.close()


def test_password_verification():
    """Тест проверки паролей"""
    logger.info("=" * 60)
    logger.info("3. Тест проверки паролей")
    logger.info("=" * 60)
    
    db = SessionLocal()
    try:
        # Находим пользователя с паролем
        user = db.query(User).filter(User.hashed_password.isnot(None)).first()
        
        if not user:
            logger.warning("   Нет пользователей с паролями для тестирования")
            return False
        
        logger.info(f"   Тестируем на пользователе: ID={user.id}, email={user.email}")
        logger.info(f"   Hash preview: {user.hashed_password[:20]}...")
        
        # Пробуем разные варианты паролей (если знаем тестовые)
        test_passwords = ["test", "password", "123456", "admin"]
        
        logger.info(f"\n   Попытка проверки паролей (это может не сработать, если пароли другие):")
        for test_pwd in test_passwords:
            try:
                result = verify_password(test_pwd, user.hashed_password)
                logger.info(f"   Пароль '{test_pwd}': {'✅ Совпадает' if result else '❌ Не совпадает'}")
            except Exception as e:
                logger.error(f"   Пароль '{test_pwd}': ❌ Ошибка - {type(e).__name__}: {str(e)}")
        
        # Тест создания нового хеша
        logger.info(f"\n   Тест создания нового хеша пароля:")
        try:
            test_password = "test_password_123"
            new_hash = get_password_hash(test_password)
            logger.info(f"   Новый хеш создан: {new_hash[:20]}...")
            
            # Проверяем, что новый хеш работает
            verify_result = verify_password(test_password, new_hash)
            logger.info(f"   Проверка нового хеша: {'✅ Успешно' if verify_result else '❌ Не работает'}")
        except Exception as e:
            logger.error(f"   ❌ Ошибка при создании/проверке хеша: {type(e).__name__}: {str(e)}", exc_info=True)
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка при тестировании паролей: {type(e).__name__}: {str(e)}", exc_info=True)
        return False
    finally:
        db.close()


def check_database_url():
    """Проверка DATABASE_URL"""
    logger.info("=" * 60)
    logger.info("4. Проверка конфигурации DATABASE_URL")
    logger.info("=" * 60)
    
    db_url = settings.DATABASE_URL
    logger.info(f"   DATABASE_URL: {db_url[:50]}...")
    
    if db_url.startswith("sqlite"):
        logger.warning("   ⚠️  Используется SQLite, а не PostgreSQL!")
        return False
    elif db_url.startswith("postgresql"):
        logger.info("   ✅ Используется PostgreSQL")
        
        # Парсим URL для проверки
        try:
            from urllib.parse import urlparse
            parsed = urlparse(db_url)
            logger.info(f"   Host: {parsed.hostname}")
            logger.info(f"   Port: {parsed.port}")
            logger.info(f"   Database: {parsed.path.lstrip('/')}")
            logger.info(f"   User: {parsed.username}")
        except Exception as e:
            logger.warning(f"   Не удалось распарсить URL: {e}")
        
        return True
    else:
        logger.warning(f"   ⚠️  Неизвестный тип БД: {db_url[:20]}...")
        return False


def main():
    """Основная функция"""
    logger.info("🔍 Диагностика проблем с авторизацией")
    logger.info("=" * 60)
    
    results = []
    
    # Проверка конфигурации
    results.append(("Конфигурация DATABASE_URL", check_database_url()))
    
    # Проверка подключения
    if results[-1][1]:
        results.append(("Подключение к БД", check_database_connection()))
        
        # Проверка таблицы users
        results.append(("Таблица users", check_users_table()))
        
        # Тест проверки паролей
        results.append(("Проверка паролей", test_password_verification()))
    
    # Итоги
    logger.info("=" * 60)
    logger.info("📊 ИТОГИ ДИАГНОСТИКИ")
    logger.info("=" * 60)
    
    for name, result in results:
        status = "✅ Успешно" if result else "❌ Ошибка"
        logger.info(f"   {name}: {status}")
    
    all_ok = all(result for _, result in results)
    
    if all_ok:
        logger.info("\n✅ Все проверки пройдены успешно")
        logger.info("   Если авторизация все еще не работает, проверьте логи приложения")
    else:
        logger.warning("\n⚠️  Обнаружены проблемы")
        logger.warning("   Проверьте ошибки выше и исправьте их")
    
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())

