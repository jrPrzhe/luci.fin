# Создание миграций для базы данных

Таблицы не созданы, потому что миграции не были сгенерированы. Нужно создать начальную миграцию.

## Решение: Создание начальной миграции

### Шаг 1: Создайте директорию для миграций (если не существует)

```bash
cd finance-manager/backend
mkdir -p alembic/versions
```

### Шаг 2: Создайте начальную миграцию

```bash
alembic revision --autogenerate -m "Initial migration"
```

Эта команда:
- Проанализирует все модели в `app/models/`
- Создаст файл миграции в `alembic/versions/`
- Включит создание всех таблиц

### Шаг 3: Примените миграцию

```bash
alembic upgrade head
```

Или используйте скрипт:

```bash
python run_migrations.py
```

### Шаг 4: Проверьте созданные таблицы

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db -c "\dt"
```

Должны быть таблицы: `users`, `accounts`, `transactions`, `categories`, `tags`, `shared_budgets`, `goals`, `reports` и другие.

## Альтернативное решение: Создание таблиц напрямую

Если миграции не работают, можно создать таблицы напрямую через SQLAlchemy (только для разработки):

```python
# create_tables.py
from app.core.database import Base, engine
from app.models import *

# Создать все таблицы
Base.metadata.create_all(bind=engine)
print("Таблицы созданы!")
```

Затем запустите:

```bash
python create_tables.py
```

⚠️ **ВНИМАНИЕ:** Этот метод подходит только для начальной настройки. В production используйте миграции!

## Проверка после создания таблиц

```bash
# Проверка подключения
python test_db_connection.py

# Создание тестового пользователя
python create_test_user.py
```














