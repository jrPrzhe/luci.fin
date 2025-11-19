# Доступ к статистике админа

## Доступные эндпоинты

Админские эндпоинты доступны по пути `/api/v1/admin/*`:

1. **GET `/api/v1/admin/users`** - Список всех пользователей со статистикой
2. **GET `/api/v1/admin/check-status`** - Проверить статус админа (доступно всем авторизованным)
3. **GET/POST `/api/v1/admin/sync-admin-status`** - Синхронизировать статус админа
4. **POST `/api/v1/admin/users/{user_id}/reset`** - Сбросить настройки пользователя
5. **GET `/api/v1/admin/diagnose-auth`** - Диагностика авторизации (только для админов)

## Проверка статуса админа

### Шаг 1: Проверьте, является ли пользователь админом

```bash
# Через API (нужен токен авторизации)
curl -X GET "https://your-backend.railway.app/api/v1/admin/check-status" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Или через Swagger UI:
1. Откройте https://your-backend.railway.app/docs
2. Авторизуйтесь (кнопка "Authorize")
3. Вызовите `/api/v1/admin/check-status`

**Ожидаемый ответ:**
```json
{
  "user_id": 1,
  "email": "your@email.com",
  "telegram_id": "123456789",
  "is_admin": true,  // ← должно быть true
  "is_active": true,
  "is_verified": true
}
```

### Шаг 2: Если `is_admin: false`, синхронизируйте статус

```bash
# Синхронизация статуса админа
curl -X POST "https://your-backend.railway.app/api/v1/admin/sync-admin-status" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Или через Swagger UI:
1. Вызовите `/api/v1/admin/sync-admin-status` (POST)

**Ожидаемый ответ:**
```json
{
  "is_admin": true,  // ← должно стать true
  "email": "your@email.com",
  "telegram_id": "123456789",
  "in_admin_list": true,
  "admin_list": ["123456789"]
}
```

## Настройка админа

### Для Telegram пользователей

Админ определяется через переменную окружения `ADMIN_TELEGRAM_IDS` в Railway:

1. Откройте Railway → Backend сервис → Variables
2. Найдите или создайте `ADMIN_TELEGRAM_IDS`
3. Установите значение (JSON массив):
   ```json
   ["123456789", "987654321"]
   ```
   Где `123456789` - ваш Telegram ID

4. Сохраните и перезапустите сервис

### Для Email пользователей

Нужно вручную установить `is_admin = true` в БД:

```sql
-- Установить пользователя админом
UPDATE users SET is_admin = true WHERE email = 'your@email.com';
```

Или через Python скрипт:

```python
from app.core.database import SessionLocal
from app.models.user import User

db = SessionLocal()
user = db.query(User).filter(User.email == 'your@email.com').first()
if user:
    user.is_admin = True
    db.commit()
    print(f"User {user.email} is now admin")
```

## Доступ к статистике пользователей

### Через API

```bash
curl -X GET "https://your-backend.railway.app/api/v1/admin/users" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Ожидаемый ответ:**
```json
[
  {
    "id": 1,
    "email": "user1@example.com",
    "username": "user1",
    "first_name": "John",
    "last_name": "Doe",
    "telegram_id": "123456789",
    "telegram_username": "john_doe",
    "created_at": "2025-01-01T00:00:00",
    "last_login": "2025-01-15T12:00:00",
    "transaction_count": 150,
    "account_count": 3,
    "category_count": 32,
    "is_active": true,
    "is_verified": true
  },
  ...
]
```

### Через Swagger UI

1. Откройте https://your-backend.railway.app/docs
2. Авторизуйтесь как админ
3. Найдите эндпоинт `/api/v1/admin/users` (GET)
4. Нажмите "Try it out" → "Execute"

## Проверка в БД

```sql
-- Проверить статус админа
SELECT id, email, telegram_id, is_admin 
FROM users 
WHERE is_admin = true;

-- Установить пользователя админом
UPDATE users 
SET is_admin = true 
WHERE email = 'your@email.com';
```

## Фронтенд для админ-панели

Если фронтенда нет, можно использовать:

1. **Swagger UI** - https://your-backend.railway.app/docs
2. **Postman** - импортировать OpenAPI схему
3. **Создать простую HTML страницу** для админ-панели

## Типичные проблемы

### 1. "Admin access required" (403)

**Причина:** Пользователь не является админом (`is_admin = false`)

**Решение:**
- Синхронизируйте статус: `/api/v1/admin/sync-admin-status`
- Или установите в БД: `UPDATE users SET is_admin = true WHERE id = X`

### 2. "User not found" (404)

**Причина:** Пользователь не авторизован или токен неверный

**Решение:**
- Проверьте токен авторизации
- Переавторизуйтесь

### 3. Статус админа не обновляется

**Причина:** `ADMIN_TELEGRAM_IDS` не настроен или неверный

**Решение:**
- Проверьте переменную `ADMIN_TELEGRAM_IDS` в Railway
- Убедитесь, что Telegram ID указан как строка: `["123456789"]`
- Перезапустите сервис

## Быстрая проверка

```bash
# 1. Проверить статус
curl -X GET "https://your-backend.railway.app/api/v1/admin/check-status" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Если не админ, синхронизировать
curl -X POST "https://your-backend.railway.app/api/v1/admin/sync-admin-status" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Получить список пользователей (только для админов)
curl -X GET "https://your-backend.railway.app/api/v1/admin/users" \
  -H "Authorization: Bearer YOUR_TOKEN"
```











