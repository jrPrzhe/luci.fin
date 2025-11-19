# Инструкция по добавлению индексов

## Способ 1: Через psql с файлом (из директории backend)

```bash
cd finance-manager/backend
psql -h 195.43.142.121 -U finance_user -d finance_db -f add_indexes.sql
```

## Способ 2: Через psql с файлом (полный путь)

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db -f E:\finance-manager\finance-manager\backend\add_indexes.sql
```

## Способ 3: Копировать-вставить команды напрямую

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db
```

Затем в консоли PostgreSQL выполните команды из файла `add_indexes.sql`.

## Способ 4: Через heredoc (рекомендуется)

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db << 'EOF'
-- Критичные индексы
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shared_budget_id ON transactions(shared_budget_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_shared_budget_id ON accounts(shared_budget_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_active ON accounts(user_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_shared_budget_id ON categories(shared_budget_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_active ON categories(user_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_budget_members_user_budget ON shared_budget_members(user_id, shared_budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_members_budget_id ON shared_budget_members(shared_budget_id);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

CREATE INDEX IF NOT EXISTS idx_invitations_budget_id ON invitations(shared_budget_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
EOF
```

## Проверка после создания

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db -c "
SELECT 
    tablename,
    COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
GROUP BY tablename
ORDER BY tablename;
"
```











