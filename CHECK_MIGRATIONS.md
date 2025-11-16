# Проверка миграций в базе данных

## Как проверить, какие миграции применены

### Вариант 1: Через Railway CLI

```bash
# Подключитесь к Railway
railway link

# Запустите скрипт проверки миграций
railway run python backend/check_migrations.py
```

### Вариант 2: Через Railway Dashboard

1. Откройте Backend сервис в Railway
2. Перейдите в **Deployments** → последний деплой
3. Откройте **Shell/Console**
4. Выполните:
   ```bash
   cd backend
   python check_migrations.py
   ```

### Вариант 3: Прямое подключение к БД (если есть доступ)

```bash
# Используя psql
psql $DATABASE_URL -c "SELECT version_num FROM alembic_version;"

# Проверить значения enum
psql $DATABASE_URL -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transactiontype') ORDER BY enumsortorder;"
```

## Что проверить

### 1. Текущая версия миграции

Должна быть последняя миграция: `9fae3a73c9e6` (fix_transaction_type_enum_case)

Если версия старше, нужно применить миграции:
```bash
railway run alembic upgrade head
```

### 2. Значения enum transactiontype

Должны быть в **нижнем регистре**:
- `income`
- `expense`
- `transfer`
- `both`

Если видны значения в **верхнем регистре** (`INCOME`, `EXPENSE`, `TRANSFER`), нужно применить миграцию `9fae3a73c9e6`.

### 3. Применить миграцию вручную (если нужно)

```bash
railway run alembic upgrade head
```

Или через Railway Dashboard:
1. Откройте Shell в последнем деплое
2. Выполните:
   ```bash
   cd backend
   alembic upgrade head
   ```

## Если миграция не применяется

Если миграция `9fae3a73c9e6` не применяется автоматически, можно применить её вручную через SQL:

```sql
-- Проверить текущие значения enum
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transactiontype')
ORDER BY enumsortorder;

-- Если видны значения в верхнем регистре, применить миграцию вручную
-- (см. содержимое миграции 9fae3a73c9e6_fix_transaction_type_enum_case.py)
```

## После проверки

После того как убедитесь, что:
1. Миграция `9fae3a73c9e6` применена
2. Enum значения в нижнем регистре

Переводы должны работать корректно.

