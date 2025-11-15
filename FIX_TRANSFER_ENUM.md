# Исправление ошибки enum для transfer транзакций

## Проблема

При создании transfer транзакции возникает ошибка:
```
invalid input value for enum transactiontype: "TRANSFER"
```

## Причина

В базе данных enum `transactiontype` создан с значениями в **верхнем регистре**:
- `INCOME`
- `EXPENSE`
- `TRANSFER`

Но код использует значения в **нижнем регистре**:
- `income`
- `expense`
- `transfer`

PostgreSQL enum чувствителен к регистру, поэтому возникает ошибка.

## Решение

Создана миграция `5da608aa4f3b_add_transfer_to_transactiontype_enum.py`, которая:
1. Создает новый enum с правильными значениями (нижний регистр)
2. Конвертирует существующие данные
3. Заменяет старый enum на новый

## Применение миграции

### На Railway (продакшн):

```bash
railway run alembic upgrade head
```

Или через Railway Dashboard:
1. Откройте Backend сервис
2. Перейдите в Deployments → последний деплой
3. Откройте Shell/Console
4. Выполните:
   ```bash
   cd backend
   alembic upgrade head
   ```

### Альтернатива (если Railway CLI не работает):

Используйте скрипт:
```bash
railway run python backend/run_migrations.py
```

## Проверка

После применения миграции:

1. Попробуйте создать transfer транзакцию
2. Должна работать без ошибок
3. Проверьте логи - не должно быть ошибок enum

## Откат (если нужно)

Если что-то пошло не так:
```bash
railway run alembic downgrade -1
```

Это вернет enum к верхнему регистру (но тогда нужно будет изменить код).

## Важно

После применения миграции все существующие транзакции будут автоматически конвертированы:
- `INCOME` → `income`
- `EXPENSE` → `expense`
- `TRANSFER` → `transfer`

Данные не будут потеряны.

