from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# SQLite doesn't need connection pooling, but PostgreSQL does
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        echo=False  # Set to True for SQL debugging
    )
else:
    # Оптимизация для сервера с ограниченными ресурсами (0.5ГБ RAM)
    # На сервере max_connections = 20, поэтому ограничиваем пул соединений
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,  # Уменьшено с 10 для сервера с ограниченной памятью
        max_overflow=5,  # Уменьшено с 20 для соответствия max_connections на сервере
        pool_recycle=3600,  # Переиспользование соединений через час
        connect_args={
            "connect_timeout": 10,  # Таймаут подключения 10 секунд
            "client_encoding": "UTF8",  # Явно указываем UTF-8 кодировку (заглавными буквами для PostgreSQL)
            "options": "-c client_encoding=UTF8"  # Дополнительная настройка кодировки
        },
        echo=False  # Set to True for SQL debugging
        # В SQLAlchemy 2.0 все строки по умолчанию обрабатываются как Unicode
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

