# Простое решение для Railway Scheduler

## Проблема с Railway CLI

Если `railway run` не работает, используйте веб-интерфейс Railway.

## Решение через веб-интерфейс

### Шаг 1: Откройте Scheduler сервис

1. Зайдите в Railway Dashboard
2. Откройте проект "truthful-emotion"
3. Найдите сервис "scheduler"
4. Откройте его

### Шаг 2: Проверьте настройки

1. Перейдите в **Settings** → **Deploy**
2. Проверьте **Start Command**:
   ```bash
   cd /app/backend && python scripts/send_daily_reminders.py 2>&1
   ```

3. Проверьте **Cron Schedule**:
   ```
   0 9 * * *
   ```

### Шаг 3: Проверьте переменные окружения

В **Settings** → **Variables** должны быть:
- `DATABASE_URL` (Reference из Backend)
- `TELEGRAM_BOT_TOKEN` (Reference из Backend)

### Шаг 4: Запустите вручную

1. Перейдите в раздел **"Cron Runs"** или **"Deployments"**
2. Нажмите **"Run now"** или **"Deploy"**
3. Подождите 10-20 секунд
4. Откройте **"Logs"**
5. Должны появиться логи выполнения

## Альтернатива: Использовать API эндпоинт

Если Scheduler не работает, используйте API:

### Вариант 1: Через админский эндпоинт

```bash
POST https://your-backend.railway.app/api/v1/gamification/send-daily-reminders
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### Вариант 2: Через публичный эндпоинт (для cron-сервисов)

1. Установите в Backend переменную:
   - `DAILY_REMINDERS_SECRET_KEY` = случайная строка

2. Используйте:
```bash
POST https://your-backend.railway.app/api/v1/gamification/send-daily-reminders/public?secret_key=YOUR_SECRET_KEY
```

3. Настройте внешний cron (cron-job.org) для автоматического вызова

## Проверка через веб-интерфейс

После нажатия "Run now" в Railway Dashboard:

1. Откройте **Logs**
2. Должны увидеть:
   ```
   [START] Script execution started
   [DEBUG] Script directory: ...
   [INFO] Starting send_daily_reminders_to_all_users...
   ...
   ```

Если логов нет - проблема в настройках команды или переменных окружения.









