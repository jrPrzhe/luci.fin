# Применение миграций в Railway

## Проблема
При выполнении `railway run alembic upgrade head` возникает ошибка:
```
FAILED: No config file 'alembic.ini' found
```

## Решение

### Вариант 1: Использовать готовый скрипт (рекомендуется)

```bash
railway run python backend/run_migrations.py
```

Этот скрипт автоматически находит `alembic.ini` в разных местах.

### Вариант 2: Указать путь к alembic.ini явно

```bash
# Если рабочая директория - корень проекта
railway run alembic -c backend/alembic.ini upgrade head

# Или перейти в директорию backend
railway run bash -c "cd backend && alembic upgrade head"
```

### Вариант 3: Через Railway Dashboard

1. Откройте ваш Backend Service в Railway
2. Перейдите в **Deployments** → последний деплой
3. Откройте **Shell/Console**
4. Выполните:
   ```bash
   cd backend
   python run_migrations.py
   ```

### Вариант 4: Использовать Railway CLI с указанием рабочей директории

```bash
railway run --directory backend alembic upgrade head
```

## Инициализация данных геймификации

После применения миграций инициализируйте базовые квесты и достижения:

```bash
railway run python backend/scripts/init_gamification_data.py
```

Или через Railway Dashboard Shell:
```bash
cd backend
python scripts/init_gamification_data.py
```

## Проверка

После применения миграций проверьте, что таблицы созданы:

```bash
railway run python -c "
from app.core.database import engine
from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()
gamification_tables = [t for t in tables if 'gamification' in t or 'quest' in t or 'achievement' in t]
print('Gamification tables:', gamification_tables)
"
```

Должны быть таблицы:
- `user_gamification_profiles`
- `daily_quests`
- `user_daily_quests`
- `achievements`
- `user_achievements`







