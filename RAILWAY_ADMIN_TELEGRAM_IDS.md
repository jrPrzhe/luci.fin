# Настройка ADMIN_TELEGRAM_IDS в Railway

## Текущая ситуация

У вас есть 2 админа:
- ID: 2 - admin@example.com (email пользователь, уже админ)
- ID: 3 - tg_7295487724@telegram.local (Telegram: 7295487724, **только что установлен админом**)

## Настройка в Railway (для автоматической синхронизации)

### Шаг 1: Откройте Railway

1. Перейдите на https://railway.app
2. Откройте ваш проект
3. Откройте **Backend сервис**
4. Перейдите в раздел **Variables**

### Шаг 2: Найдите или создайте переменную

1. Найдите переменную `ADMIN_TELEGRAM_IDS`
2. Если её нет - нажмите **"New Variable"**
3. Имя переменной: `ADMIN_TELEGRAM_IDS`

### Шаг 3: Установите значение

**Важно:** Значение должно быть JSON массивом строк!

```json
["7295487724"]
```

Если у вас несколько Telegram админов:
```json
["7295487724", "другой_telegram_id"]
```

### Шаг 4: Сохраните и перезапустите

1. Нажмите **"Save"**
2. Railway автоматически перезапустит сервис (~1-2 минуты)

## Что это даст?

После настройки `ADMIN_TELEGRAM_IDS`:

1. **Автоматическая синхронизация** - при входе через Telegram статус админа будет автоматически обновляться
2. **Не нужно вручную устанавливать** - если пользователь в списке, он автоматически станет админом
3. **Легко управлять** - просто добавьте/удалите Telegram ID из списка

## Проверка после настройки

### 1. Проверьте в БД

```bash
cd finance-manager/backend
python check_admin_access.py --list
```

Ожидаемый результат:
```
[ADMIN] ID:   2 | Email: admin@example.com              | Telegram: N/A             | Admin: True
[ADMIN] ID:   3 | Email: tg_7295487724@telegram.local   | Telegram: 7295487724      | Admin: True
```

### 2. Проверьте через API

```bash
# Проверить статус админа
curl -X GET "https://your-backend.railway.app/api/v1/admin/check-status" \
  -H "Authorization: Bearer TOKEN_ПОЛЬЗОВАТЕЛЯ_3"
```

Ожидаемый ответ:
```json
{
  "user_id": 3,
  "email": "tg_7295487724@telegram.local",
  "telegram_id": "7295487724",
  "is_admin": true,
  "is_active": true,
  "is_verified": true
}
```

### 3. Получите статистику пользователей

```bash
# Список всех пользователей со статистикой
curl -X GET "https://your-backend.railway.app/api/v1/admin/users" \
  -H "Authorization: Bearer TOKEN_ПОЛЬЗОВАТЕЛЯ_3"
```

## Добавление новых Telegram админов

Когда нужно добавить нового Telegram админа:

1. Откройте Railway → Variables
2. Найдите `ADMIN_TELEGRAM_IDS`
3. Добавьте новый Telegram ID в массив:
   ```json
   ["7295487724", "новый_telegram_id"]
   ```
4. Сохраните
5. Пользователь автоматически станет админом при следующем входе

Или вызовите API для синхронизации:
```bash
POST /api/v1/admin/sync-admin-status
```

## Важные моменты

1. **Формат:** JSON массив строк, не чисел!
   - ✅ Правильно: `["7295487724"]`
   - ❌ Неправильно: `[7295487724]` (без кавычек)

2. **Telegram ID как строка:** В БД Telegram ID хранится как строка, поэтому в списке тоже должна быть строка

3. **Email пользователи:** Для email пользователей (без Telegram) нужно устанавливать `is_admin = true` вручную через скрипт или SQL

4. **Перезапуск:** После изменения переменной Railway перезапустит сервис автоматически

## Быстрая команда для проверки

```bash
# Проверить всех пользователей
python check_admin_access.py --list

# Проверить конкретного Telegram пользователя
python check_admin_access.py --check --telegram-id 7295487724
```










