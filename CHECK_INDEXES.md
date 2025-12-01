# Проверка индексов в базе данных

Индексы критически важны для производительности, особенно на сервере с ограниченными ресурсами.

## Проверка существующих индексов

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db << 'EOF'
-- Список всех индексов
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
EOF
```

## Критичные индексы, которые должны быть

### 1. Таблица transactions

```sql
-- Индекс на user_id (для фильтрации по пользователю)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- Индекс на account_id (для фильтрации по счету)
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);

-- Индекс на transaction_date (для фильтрации по датам)
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);

-- Композитный индекс для частых запросов
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);

-- Индекс на category_id
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
```

### 2. Таблица accounts

```sql
-- Индекс на user_id
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Индекс на shared_budget_id
CREATE INDEX IF NOT EXISTS idx_accounts_shared_budget_id ON accounts(shared_budget_id);
```

### 3. Таблица categories

```sql
-- Индекс на user_id
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Индекс на shared_budget_id
CREATE INDEX IF NOT EXISTS idx_categories_shared_budget_id ON categories(shared_budget_id);
```

### 4. Таблица shared_budget_members

```sql
-- Композитный индекс для поиска участников
CREATE INDEX IF NOT EXISTS idx_budget_members_user_budget ON shared_budget_members(user_id, shared_budget_id);
```

## Скрипт для создания всех индексов

```sql
-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);

-- accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_shared_budget_id ON accounts(shared_budget_id);

-- categories
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_shared_budget_id ON categories(shared_budget_id);

-- shared_budget_members
CREATE INDEX IF NOT EXISTS idx_budget_members_user_budget ON shared_budget_members(user_id, shared_budget_id);

-- goals
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

-- tags
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
```

## Проверка использования индексов

```sql
-- Статистика использования индексов
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Проверка размера индексов

```sql
-- Размер индексов
SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```













