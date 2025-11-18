# Диагностика проблем с авторизацией на проде

## Проблема
После переключения на внешнюю PostgreSQL БД авторизация пользователей не работает на продакшене.

## Быстрая диагностика через API

### Шаг 1: Получите доступ к админ-панели

1. Убедитесь, что у вас есть административный доступ
2. Авторизуйтесь через Telegram или email/password (если работает)

### Шаг 2: Вызовите диагностический endpoint

```bash
# Замените YOUR_API_URL на ваш продакшн URL
# Замените YOUR_TOKEN на ваш JWT токен администратора

curl -X GET "https://YOUR_API_URL/api/v1/admin/diagnose-auth" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Или через браузер (если у вас есть админ-доступ):
```
https://YOUR_API_URL/api/v1/admin/diagnose-auth
```

### Шаг 3: Анализ результатов

Endpoint вернет JSON с результатами диагностики:

```json
{
  "diagnosis_timestamp": "2024-01-01T12:00:00",
  "results": {
    "database_connection": {
      "status": "success",
      "postgresql_version": "..."
    },
    "database_encoding": {
      "status": "success",
      "client_encoding": "UTF8",
      "server_encoding": "UTF8",
      "is_utf8": true
    },
    "users_stats": {
      "total_users": 10,
      "users_with_passwords": 5,
      "users_without_passwords": 5
    },
    "password_hashes": {
      "status": "success",
      "samples_checked": 5,
      "hashes": [...],
      "all_valid_format": true
    },
    "test_password_verification": {
      "status": "success",
      "new_hash_created": true,
      "new_hash_verified": true
    }
  },
  "summary": {
    "all_checks_passed": true,
    "critical_issues": []
  }
}
```

## Проверка логов на проде

### Railway

1. Откройте ваш проект на Railway: https://railway.app
2. Выберите ваш Backend сервис
3. Перейдите на вкладку **"Logs"**
4. Попробуйте авторизоваться
5. Ищите в логах:
   - `Login attempt for email: ...`
   - `User found: id=..., hashed_password present: ...`
   - `Password hash preview: ...`
   - `Password verification result: ...`

### Docker/SSH

Если у вас есть SSH доступ:

```bash
# Просмотр логов в реальном времени
docker logs -f <container_name> --tail 100

# Или если используете docker-compose
docker-compose logs -f backend --tail 100
```

## Типичные проблемы и решения

### Проблема 1: Хеши паролей повреждены

**Симптомы:**
- В диагностике: `"all_valid_format": false`
- В логах: `Password verification result: False`
- Пользователи не могут войти с правильными паролями

**Решение:**
1. Пользователям нужно сбросить пароли
2. Или администратор может создать новые пароли через API:

```bash
# Сброс пароля пользователя (требует админ-доступ)
curl -X POST "https://YOUR_API_URL/api/v1/admin/users/{user_id}/reset-password" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_password": "new_secure_password"}'
```

### Проблема 2: Проблемы с кодировкой

**Симптомы:**
- В диагностике: `"is_utf8": false`
- Ошибки при чтении данных из БД

**Решение:**
1. Проверьте кодировку БД на сервере PostgreSQL
2. Если кодировка не UTF-8, нужно пересоздать БД с правильной кодировкой

### Проблема 3: Пользователи без паролей

**Симптомы:**
- В диагностике: `"users_without_passwords": X` (большое число)
- В логах: `User has no password hash set`

**Решение:**
- Это нормально для пользователей, созданных через Telegram
- Они должны авторизоваться через Telegram, а не через email/password

### Проблема 4: Ошибки подключения к БД

**Симптомы:**
- В диагностике: `"database_connection": {"status": "error"}`
- Ошибки в логах при попытке подключения

**Решение:**
1. Проверьте, что БД доступна и пингуется
2. Проверьте правильность `DATABASE_URL` в переменных окружения Railway
3. Проверьте firewall и сетевые настройки

## Проверка переменных окружения на Railway

1. Откройте ваш Backend сервис на Railway
2. Перейдите в **"Variables"**
3. Проверьте:
   - `DATABASE_URL` - должен начинаться с `postgresql://`
   - `SECRET_KEY` - должен быть установлен (для JWT токенов)
   - `CORS_ORIGINS` - должен содержать ваш frontend URL

## Тестирование авторизации

### Тест 1: Авторизация через email/password

```bash
curl -X POST "https://YOUR_API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test_password"
  }'
```

**Ожидаемый ответ:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": {...}
}
```

**Если не работает:**
- Проверьте логи backend
- Проверьте формат хеша пароля в диагностике

### Тест 2: Авторизация через Telegram

1. Откройте Mini App в Telegram
2. Проверьте логи backend
3. Убедитесь, что пользователь создается/находится правильно

### Тест 3: Регистрация нового пользователя

```bash
curl -X POST "https://YOUR_API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "secure_password",
    "username": "newuser"
  }'
```

Если регистрация работает, но вход не работает - проблема в старых хешах паролей.

## Прямой SQL запрос к БД (если есть доступ)

Если у вас есть прямой доступ к PostgreSQL:

```sql
-- Проверка хешей паролей
SELECT 
    id, 
    email, 
    LEFT(hashed_password, 20) as hash_preview,
    LENGTH(hashed_password) as hash_length,
    CASE 
        WHEN hashed_password LIKE '$2a$%' OR hashed_password LIKE '$2b$%' OR hashed_password LIKE '$2y$%' 
        THEN 'OK' 
        ELSE 'INVALID' 
    END as hash_format
FROM users
WHERE hashed_password IS NOT NULL
LIMIT 10;

-- Проверка кодировки БД
SHOW client_encoding;
SHOW server_encoding;

-- Статистика пользователей
SELECT 
    COUNT(*) as total_users,
    COUNT(hashed_password) as users_with_passwords,
    COUNT(*) - COUNT(hashed_password) as users_without_passwords,
    COUNT(telegram_id) as telegram_users
FROM users;
```

## Если проблема не решена

1. Сохраните результаты диагностического endpoint
2. Сохраните логи backend при попытке авторизации
3. Проверьте:
   - Все ли миграции применены
   - Правильная ли версия кода на проде
   - Нет ли проблем с сетью/firewall

## Контакты для поддержки

Если проблема не решена, предоставьте:
- JSON ответ от `/api/v1/admin/diagnose-auth`
- Логи backend при попытке авторизации (последние 50-100 строк)
- Результат SQL запросов (если есть доступ к БД)











