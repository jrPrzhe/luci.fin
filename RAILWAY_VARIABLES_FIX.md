# Исправление: Переменные окружения не установлены

## Проблема

Скрипт запускается, но выдает:
```
[DEBUG] DATABASE_URL: NOT SET
[DEBUG] TELEGRAM_BOT_TOKEN: NOT SET
[ERROR] DATABASE_URL is not set!
```

## Решение: Настройка переменных окружения в Railway

### Шаг 1: Откройте настройки Scheduler сервиса

1. В Railway Dashboard откройте сервис **"scheduler"**
2. Перейдите в **Settings** → **Variables**

### Шаг 2: Добавьте переменные окружения

Нужно добавить следующие переменные:

#### Обязательные:

1. **DATABASE_URL**
   - Нажмите **"+ New Variable"**
   - Name: `DATABASE_URL`
   - Value: Можно использовать **Reference** из Backend сервиса
     - Нажмите на иконку ссылки рядом с полем
     - Выберите сервис **"BACKEND"**
     - Выберите переменную `DATABASE_URL`
   - Или введите значение напрямую (если знаете)

2. **TELEGRAM_BOT_TOKEN**
   - Name: `TELEGRAM_BOT_TOKEN`
   - Value: Используйте **Reference** из Backend или TG_BOT сервиса
   - Или введите значение напрямую

#### Опциональные:

3. **VK_BOT_TOKEN** (если используете VK)
   - Name: `VK_BOT_TOKEN`
   - Value: Reference из VK_BOT сервиса

4. **GOOGLE_AI_API_KEY** (для AI сообщений)
   - Name: `GOOGLE_AI_API_KEY`
   - Value: Reference из Backend сервиса

### Шаг 3: Использование Reference (рекомендуется)

**Reference** позволяет использовать переменные из другого сервиса без дублирования:

1. При создании переменной нажмите на иконку **"Reference"** или **"Link"**
2. Выберите сервис (например, **BACKEND**)
3. Выберите переменную из списка
4. Сохраните

Это гарантирует, что переменные всегда синхронизированы.

### Шаг 4: Проверка

После добавления переменных:

1. Сохраните изменения
2. Нажмите **"Run now"** в разделе Cron Runs
3. Проверьте логи - должны увидеть:
   ```
   [DEBUG] DATABASE_URL: set
   [DEBUG] TELEGRAM_BOT_TOKEN: set
   ```

## Альтернатива: Копирование переменных вручную

Если Reference не работает:

1. Откройте Backend сервис → Settings → Variables
2. Найдите значение `DATABASE_URL`
3. Скопируйте его
4. В Scheduler сервисе создайте новую переменную с этим значением

**⚠️ Внимание:** При изменении переменной в Backend нужно будет обновить и в Scheduler.

## Проверка через Railway CLI

После настройки переменных можно проверить:

```bash
railway variables --service scheduler
```

Должны увидеть список всех переменных.

## Что должно быть в логах после исправления

```
[DEBUG] DATABASE_URL: set
[DEBUG] TELEGRAM_BOT_TOKEN: set
[INFO] Starting send_daily_reminders_to_all_users...
[INFO] Found X users with Telegram or VK IDs
[INFO] Processing user 1/X: ID=1, Telegram=True, VK=False
[SUCCESS] Telegram reminder sent to user 1
...
✅ Daily reminders sent to X users
```

## Если переменные все еще не видны

1. **Перезапустите сервис** - нажмите "Deploy" или "Restart"
2. **Проверьте Environment** - убедитесь, что переменные добавлены в правильный environment (production)
3. **Проверьте синтаксис** - нет ли лишних пробелов или кавычек в значениях









