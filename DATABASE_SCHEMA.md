# Схема базы данных Finance Manager

Полная схема базы данных PostgreSQL для проекта Finance Manager.

## Общая структура

```
users (пользователи)
├── accounts (счета)
├── transactions (транзакции)
├── categories (категории)
├── tags (теги)
├── goals (цели)
├── reports (отчеты)
├── shared_budgets (общие бюджеты)
│   ├── shared_budget_members (участники)
│   └── invitations (приглашения)
└── notifications (уведомления)
```

## Таблицы

### 1. users (Пользователи)

Основная таблица пользователей.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `email` | VARCHAR(255) UNIQUE | Email пользователя |
| `username` | VARCHAR(100) UNIQUE | Имя пользователя |
| `hashed_password` | VARCHAR(255) | Хешированный пароль |
| `telegram_id` | VARCHAR(50) UNIQUE | Telegram ID (опционально) |
| `telegram_username` | VARCHAR(100) | Telegram username |
| `first_name` | VARCHAR(100) | Имя |
| `last_name` | VARCHAR(100) | Фамилия |
| `timezone` | VARCHAR(50) | Часовой пояс (по умолчанию: UTC) |
| `default_currency` | VARCHAR(3) | Валюта по умолчанию (по умолчанию: USD) |
| `language` | VARCHAR(5) | Язык (по умолчанию: en) |
| `is_2fa_enabled` | BOOLEAN | Включена ли двухфакторная аутентификация |
| `two_factor_secret` | VARCHAR(32) | Секрет для 2FA |
| `backup_codes` | TEXT | Резервные коды для 2FA |
| `is_active` | BOOLEAN | Активен ли пользователь |
| `is_verified` | BOOLEAN | Подтвержден ли email |
| `is_admin` | BOOLEAN | Является ли администратором |
| `verification_token` | VARCHAR(255) | Токен для верификации email |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |
| `last_login` | TIMESTAMP | Дата последнего входа |

**Индексы:**
- `id` (PRIMARY KEY)
- `email` (UNIQUE)
- `username` (UNIQUE)
- `telegram_id` (UNIQUE)

---

### 2. accounts (Счета)

Финансовые счета пользователей.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `user_id` | INTEGER FOREIGN KEY | ID пользователя-владельца |
| `shared_budget_id` | INTEGER FOREIGN KEY | ID общего бюджета (опционально) |
| `name` | VARCHAR(255) | Название счета |
| `account_type` | ENUM | Тип счета: cash, bank_card, bank_account, e_wallet, credit_card, investment, other |
| `currency` | VARCHAR(3) | Валюта счета |
| `initial_balance` | NUMERIC(15,2) | Начальный баланс |
| `is_active` | BOOLEAN | Активен ли счет |
| `is_archived` | BOOLEAN | Архивирован ли счет |
| `description` | VARCHAR(500) | Описание счета |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Связи:**
- `user_id` → `users.id`
- `shared_budget_id` → `shared_budgets.id`

**Индексы:**
- `id` (PRIMARY KEY)
- `user_id`
- `shared_budget_id`

---

### 3. transactions (Транзакции)

Финансовые транзакции.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `user_id` | INTEGER FOREIGN KEY | ID пользователя |
| `account_id` | INTEGER FOREIGN KEY | ID счета |
| `transaction_type` | ENUM | Тип: income, expense, transfer |
| `amount` | NUMERIC(15,2) | Сумма транзакции |
| `currency` | VARCHAR(3) | Валюта транзакции |
| `amount_in_default_currency` | NUMERIC(15,2) | Сумма в валюте по умолчанию |
| `exchange_rate` | NUMERIC(10,6) | Курс обмена |
| `category_id` | INTEGER FOREIGN KEY | ID категории |
| `description` | TEXT | Описание транзакции |
| `transaction_date` | TIMESTAMP | Дата транзакции |
| `is_recurring` | BOOLEAN | Является ли повторяющейся |
| `recurring_frequency` | ENUM | Частота: once, daily, weekly, monthly, quarterly, yearly, custom |
| `recurring_end_date` | TIMESTAMP | Дата окончания повторений |
| `parent_transaction_id` | INTEGER FOREIGN KEY | ID родительской транзакции |
| `to_account_id` | INTEGER FOREIGN KEY | ID счета получателя (для переводов) |
| `shared_budget_id` | INTEGER FOREIGN KEY | ID общего бюджета |
| `distribution_method` | ENUM | Метод распределения: equal, proportional, fixed |
| `distribution_data` | TEXT | JSON данные распределения |
| `goal_id` | INTEGER FOREIGN KEY | ID цели |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Связи:**
- `user_id` → `users.id`
- `account_id` → `accounts.id`
- `to_account_id` → `accounts.id`
- `category_id` → `categories.id`
- `shared_budget_id` → `shared_budgets.id`
- `goal_id` → `goals.id`
- `parent_transaction_id` → `transactions.id`

**Индексы:**
- `id` (PRIMARY KEY)
- `user_id`
- `account_id`
- `category_id`
- `transaction_date`

---

### 4. categories (Категории)

Категории транзакций.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `user_id` | INTEGER FOREIGN KEY | ID пользователя |
| `shared_budget_id` | INTEGER FOREIGN KEY | ID общего бюджета (опционально) |
| `name` | VARCHAR(255) | Название категории |
| `transaction_type` | ENUM | Тип: income, expense, both |
| `parent_id` | INTEGER FOREIGN KEY | ID родительской категории |
| `icon` | VARCHAR(100) | Иконка категории |
| `color` | VARCHAR(7) | HEX цвет |
| `is_system` | BOOLEAN | Системная категория |
| `is_active` | BOOLEAN | Активна ли категория |
| `is_favorite` | BOOLEAN | Избранная категория |
| `budget_limit` | INTEGER | Лимит бюджета (месячный) |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Связи:**
- `user_id` → `users.id`
- `shared_budget_id` → `shared_budgets.id`
- `parent_id` → `categories.id`

**Индексы:**
- `id` (PRIMARY KEY)
- `user_id`
- `shared_budget_id`

---

### 5. tags (Теги)

Теги для транзакций.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `user_id` | INTEGER FOREIGN KEY | ID пользователя |
| `name` | VARCHAR(100) | Название тега |
| `color` | VARCHAR(7) | HEX цвет |
| `created_at` | TIMESTAMP | Дата создания |

**Связи:**
- `user_id` → `users.id`

**Индексы:**
- `id` (PRIMARY KEY)
- `user_id`

---

### 6. transaction_tags (Связь транзакций и тегов)

Связующая таблица для many-to-many связи.

| Поле | Тип | Описание |
|-----|-----|---------|
| `transaction_id` | INTEGER FOREIGN KEY | ID транзакции |
| `tag_id` | INTEGER FOREIGN KEY | ID тега |

**Связи:**
- `transaction_id` → `transactions.id`
- `tag_id` → `tags.id`

**Индексы:**
- `(transaction_id, tag_id)` (PRIMARY KEY)

---

### 7. goals (Цели)

Финансовые цели пользователей.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `user_id` | INTEGER FOREIGN KEY | ID пользователя |
| `name` | VARCHAR(255) | Название цели |
| `description` | TEXT | Описание цели |
| `target_amount` | NUMERIC(15,2) | Целевая сумма |
| `current_amount` | NUMERIC(15,2) | Текущая сумма |
| `currency` | VARCHAR(3) | Валюта |
| `deadline` | TIMESTAMP | Срок достижения |
| `is_completed` | BOOLEAN | Выполнена ли цель |
| `roadmap` | TEXT | JSON данные roadmap |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Связи:**
- `user_id` → `users.id`

**Индексы:**
- `id` (PRIMARY KEY)
- `user_id`

---

### 8. shared_budgets (Общие бюджеты)

Общие бюджеты для совместного управления финансами.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `created_by` | INTEGER FOREIGN KEY | ID создателя (владельца) |
| `name` | VARCHAR(255) | Название бюджета |
| `description` | TEXT | Описание |
| `currency` | VARCHAR(3) | Валюта |
| `invite_code` | VARCHAR(10) UNIQUE | Код приглашения |
| `is_active` | BOOLEAN | Активен ли бюджет |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Связи:**
- `owner_id` → `users.id`

**Индексы:**
- `id` (PRIMARY KEY)
- `owner_id`
- `invite_code` (UNIQUE)

---

### 9. shared_budget_members (Участники общих бюджетов)

Участники общих бюджетов.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `shared_budget_id` | INTEGER FOREIGN KEY | ID общего бюджета |
| `user_id` | INTEGER FOREIGN KEY | ID пользователя |
| `role` | VARCHAR(50) | Роль: owner, member, viewer |
| `joined_at` | TIMESTAMP | Дата присоединения |

**Связи:**
- `shared_budget_id` → `shared_budgets.id`
- `user_id` → `users.id`

**Индексы:**
- `id` (PRIMARY KEY)
- `shared_budget_id`
- `user_id`

---

### 10. invitations (Приглашения)

Приглашения в общие бюджеты.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `shared_budget_id` | INTEGER FOREIGN KEY | ID общего бюджета |
| `inviter_id` | INTEGER FOREIGN KEY | ID приглашающего |
| `invitee_email` | VARCHAR(255) | Email приглашаемого |
| `invite_code` | VARCHAR(10) | Код приглашения |
| `status` | VARCHAR(50) | Статус: pending, accepted, rejected, expired |
| `expires_at` | TIMESTAMP | Дата истечения |
| `created_at` | TIMESTAMP | Дата создания |

**Связи:**
- `shared_budget_id` → `shared_budgets.id`
- `inviter_id` → `users.id`

**Индексы:**
- `id` (PRIMARY KEY)
- `shared_budget_id`
- `invite_code`

---

### 11. reports (Отчеты)

Сохраненные отчеты пользователей.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `user_id` | INTEGER FOREIGN KEY | ID пользователя |
| `name` | VARCHAR(255) | Название отчета |
| `report_type` | VARCHAR(50) | Тип отчета |
| `parameters` | TEXT | JSON параметры отчета |
| `data` | TEXT | JSON данные отчета |
| `created_at` | TIMESTAMP | Дата создания |

**Связи:**
- `user_id` → `users.id`

**Индексы:**
- `id` (PRIMARY KEY)
- `user_id`

---

### 12. notifications (Уведомления)

Уведомления пользователей.

| Поле | Тип | Описание |
|-----|-----|---------|
| `id` | INTEGER PRIMARY KEY | Уникальный идентификатор |
| `user_id` | INTEGER FOREIGN KEY | ID пользователя |
| `title` | VARCHAR(255) | Заголовок |
| `message` | TEXT | Сообщение |
| `type` | VARCHAR(50) | Тип уведомления |
| `is_read` | BOOLEAN | Прочитано ли |
| `created_at` | TIMESTAMP | Дата создания |

**Связи:**
- `user_id` → `users.id`

**Индексы:**
- `id` (PRIMARY KEY)
- `user_id`
- `is_read`

---

### 13. alembic_version (Версии миграций)

Служебная таблица Alembic для отслеживания миграций.

| Поле | Тип | Описание |
|-----|-----|---------|
| `version_num` | VARCHAR(32) PRIMARY KEY | Номер версии миграции |

---

## Диаграмма связей

```
users
├── accounts (1:N)
│   └── transactions (1:N)
├── transactions (1:N)
│   ├── categories (N:1)
│   ├── tags (N:M через transaction_tags)
│   ├── goals (N:1)
│   └── shared_budgets (N:1)
├── categories (1:N)
│   └── categories (1:N, parent-child)
├── tags (1:N)
├── goals (1:N)
├── reports (1:N)
├── shared_budgets (1:N, owner)
│   ├── shared_budget_members (1:N)
│   ├── invitations (1:N)
│   ├── accounts (1:N)
│   └── transactions (1:N)
└── notifications (1:N)
```

## Проверка схемы в БД

### Просмотр всех таблиц

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### Просмотр структуры таблицы

```sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

### Просмотр индексов

```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Просмотр внешних ключей

```sql
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

## Ожидаемое количество таблиц

После применения миграций должно быть **13 таблиц**:

1. `users`
2. `accounts`
3. `transactions`
4. `categories`
5. `tags`
6. `transaction_tags`
7. `goals`
8. `shared_budgets`
9. `shared_budget_members`
10. `invitations`
11. `reports`
12. `notifications`
13. `alembic_version`

## Проверка схемы

```bash
# Подсчет таблиц
psql -h 195.43.142.121 -U finance_user -d finance_db -c "
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';
"

# Список всех таблиц
psql -h 195.43.142.121 -U finance_user -d finance_db -c "\dt"
```

