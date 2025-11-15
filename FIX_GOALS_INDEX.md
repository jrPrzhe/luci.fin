# Исправление индекса для goals.status

Была ошибка при создании индекса с условием WHERE для enum поля.

## Проблема

```sql
ERROR: invalid input value for enum goalstatus: "active"
```

## Решение

Используйте приведение типа к text:

```sql
CREATE INDEX IF NOT EXISTS idx_goals_user_status 
ON goals(user_id, status) 
WHERE status::text = 'active';
```

## Выполнение

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db -c "CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status) WHERE status::text = 'active';"
```

Или если enum значения другие, проверьте:

```sql
-- Проверка значений enum
SELECT unnest(enum_range(NULL::goalstatus));
```

Возможные значения:
- `active`
- `completed`
- `failed`
- `paused`





