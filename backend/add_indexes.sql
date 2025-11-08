-- Скрипт для добавления критичных индексов в базу данных
-- Выполните на сервере БД для улучшения производительности

-- ============================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ transactions
-- ============================================

-- Индекс на user_id (для фильтрации по пользователю)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- Индекс на account_id (для фильтрации по счету)
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);

-- Индекс на transaction_date (для фильтрации по датам)
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);

-- Композитный индекс для частых запросов (user_id + date)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);

-- Индекс на category_id (для фильтрации по категориям)
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);

-- Индекс на shared_budget_id (для общих бюджетов)
CREATE INDEX IF NOT EXISTS idx_transactions_shared_budget_id ON transactions(shared_budget_id);

-- ============================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ accounts
-- ============================================

-- Индекс на user_id (для фильтрации по пользователю)
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Индекс на shared_budget_id (для общих бюджетов)
CREATE INDEX IF NOT EXISTS idx_accounts_shared_budget_id ON accounts(shared_budget_id);

-- Композитный индекс для поиска активных счетов пользователя
CREATE INDEX IF NOT EXISTS idx_accounts_user_active ON accounts(user_id, is_active) WHERE is_active = true;

-- ============================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ categories
-- ============================================

-- Индекс на user_id (для фильтрации по пользователю)
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Индекс на shared_budget_id (для общих бюджетов)
CREATE INDEX IF NOT EXISTS idx_categories_shared_budget_id ON categories(shared_budget_id);

-- Композитный индекс для поиска активных категорий
CREATE INDEX IF NOT EXISTS idx_categories_user_active ON categories(user_id, is_active) WHERE is_active = true;

-- ============================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ shared_budget_members
-- ============================================

-- Композитный индекс для поиска участников
CREATE INDEX IF NOT EXISTS idx_budget_members_user_budget ON shared_budget_members(user_id, shared_budget_id);

-- Индекс на shared_budget_id (для поиска всех участников бюджета)
CREATE INDEX IF NOT EXISTS idx_budget_members_budget_id ON shared_budget_members(shared_budget_id);

-- ============================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ goals
-- ============================================

-- Индекс на user_id (для фильтрации по пользователю)
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

-- Индекс на status (для фильтрации по статусу)
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

-- Композитный индекс для поиска активных целей (enum значения в верхнем регистре: ACTIVE, COMPLETED, FAILED, PAUSED)
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status) WHERE status = 'ACTIVE'::goalstatus;

-- ============================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ tags
-- ============================================

-- Индекс на user_id (для фильтрации по пользователю)
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- ============================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ invitations
-- ============================================

-- Индекс на shared_budget_id
CREATE INDEX IF NOT EXISTS idx_invitations_budget_id ON invitations(shared_budget_id);

-- Индекс на email (для поиска приглашений по email)
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email) WHERE email IS NOT NULL;

-- Индекс на status (для фильтрации по статусу)
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- ============================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ notifications
-- ============================================

-- Индекс на user_id (для фильтрации по пользователю)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Композитный индекс для поиска непрочитанных уведомлений
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- ============================================
-- ИНДЕКСЫ ДЛЯ ТАБЛИЦЫ reports
-- ============================================

-- Индекс на user_id (для фильтрации по пользователю)
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);

-- ============================================
-- ПРОВЕРКА СОЗДАННЫХ ИНДЕКСОВ
-- ============================================

-- Просмотр всех созданных индексов
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Статистика использования индексов (после некоторого времени работы)
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;

