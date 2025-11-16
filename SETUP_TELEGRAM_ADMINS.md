# Настройка Telegram админов

## Текущая ситуация

У вас есть 3 пользователя:
- ID: 1 - test@example.com (без Telegram, не админ)
- ID: 2 - admin@example.com (без Telegram, **уже админ**)
- ID: 3 - tg_7295487724@telegram.local (Telegram: 7295487724, **нужно сделать админом**)

## Решение 1: Установить через скрипт (быстро)

```bash
cd finance-manager/backend
python check_admin_access.py --set-admin --user-id 3
```

## Решение 2: Настроить ADMIN_TELEGRAM_IDS в Railway (рекомендуется)

Это позволит автоматически назначать админов на основе Telegram ID.

### Шаг 1: Найдите все Telegram ID админов

Список Telegram ID пользователей, которых нужно сделать админами:
- `7295487724` (пользователь ID: 3)
- Добавьте другие Telegram ID, если нужно

### Шаг 2: Настройте в Railway

1. Откройте Railway → Backend сервис → Variables
2. Найдите или создайте переменную `ADMIN_TELEGRAM_IDS`
3. Установите значение (JSON массив строк):
   ```json
   ["7295487724"]
   ```
   
   Если несколько админов:
   ```json
   ["7295487724", "другой_telegram_id"]
   ```

4. Сохраните изменения
5. Railway автоматически перезапустит сервис

### Шаг 3: Синхронизируйте статус

После перезапуска, когда пользователь войдет через Telegram, статус админа автоматически обновится.

Или можно вызвать API:
```bash
curl -X POST "https://your-backend.railway.app/api/v1/admin/sync-admin-status" \
  -H "Authorization: Bearer TOKEN_ПОЛЬЗОВАТЕЛЯ_3"
```

## Решение 3: Установить через SQL (если нужно)

```sql
-- Установить пользователя с Telegram ID 7295487724 админом
UPDATE users 
SET is_admin = true 
WHERE telegram_id = '7295487724';

-- Или по ID
UPDATE users 
SET is_admin = true 
WHERE id = 3;
```

## Проверка после настройки

```bash
# Проверить список пользователей
python check_admin_access.py --list

# Проверить конкретного пользователя
python check_admin_access.py --check --telegram-id 7295487724
```

## Ожидаемый результат

После выполнения:
```
✅ АДМИН ID:   2 | Email: admin@example.com              | Telegram: N/A             | Admin: True
✅ АДМИН ID:   3 | Email: tg_7295487724@telegram.local   | Telegram: 7295487724      | Admin: True
```

## Доступ к статистике

После установки статуса админа, пользователь сможет:

1. **Получить список всех пользователей:**
   ```bash
   GET /api/v1/admin/users
   ```

2. **Проверить свой статус:**
   ```bash
   GET /api/v1/admin/check-status
   ```

3. **Синхронизировать статус:**
   ```bash
   POST /api/v1/admin/sync-admin-status
   ```

## Важно

- Для Telegram пользователей: используйте `ADMIN_TELEGRAM_IDS` в Railway
- Для Email пользователей: устанавливайте `is_admin = true` вручную через скрипт или SQL
- После изменения `ADMIN_TELEGRAM_IDS` нужно либо перезапустить сервис, либо вызвать `/api/v1/admin/sync-admin-status`






