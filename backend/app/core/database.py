import sys
print("[DATABASE] Starting database module import...", file=sys.stderr, flush=True)

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging

print("[DATABASE] Importing config...", file=sys.stderr, flush=True)
try:
    from app.core.config import settings
    print(f"[DATABASE] Config imported, DATABASE_URL length: {len(settings.DATABASE_URL) if settings.DATABASE_URL else 0}", file=sys.stderr, flush=True)
except Exception as e:
    print(f"[DATABASE] ERROR importing config: {e}", file=sys.stderr, flush=True)
    raise

logger = logging.getLogger(__name__)

# SQLite doesn't need connection pooling, but PostgreSQL does
print("[DATABASE] Creating database engine...", file=sys.stderr, flush=True)
connect_args = {}
try:
    if settings.DATABASE_URL.startswith("sqlite"):
        print("[DATABASE] Using SQLite", file=sys.stderr, flush=True)
        connect_args = {"check_same_thread": False}
        engine = create_engine(
            settings.DATABASE_URL,
            connect_args=connect_args,
            echo=False  # Set to True for SQL debugging
        )
    else:
        print(f"[DATABASE] Using PostgreSQL, URL preview: {settings.DATABASE_URL[:50]}...", file=sys.stderr, flush=True)
        # Настройки пула соединений для продакшена
        # Увеличено для обработки большего количества одновременных запросов
        engine = create_engine(
            settings.DATABASE_URL,
            pool_pre_ping=True,  # Проверка соединений перед использованием
            pool_size=10,  # Базовый размер пула
            max_overflow=10,  # Дополнительные соединения при перегрузке
            pool_recycle=1800,  # Переиспользование соединений через 30 минут (быстрее освобождение)
            pool_timeout=30,  # Таймаут ожидания соединения из пула
            connect_args={
                "connect_timeout": 10,  # Таймаут подключения 10 секунд
                "client_encoding": "utf8"  # Явно указываем UTF-8 кодировку
            },
            echo=False  # Set to True for SQL debugging
        )
        print("[DATABASE] Engine created successfully", file=sys.stderr, flush=True)
        logger.info("Database engine created successfully")
except Exception as e:
    error_msg = f"Failed to create database engine: {e}"
    print(f"[DATABASE] ERROR: {error_msg}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc(file=sys.stderr)
    logger.error(error_msg, exc_info=True)
    # Пробуем создать engine без пула для SQLite fallback
    if not settings.DATABASE_URL.startswith("sqlite"):
        raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

