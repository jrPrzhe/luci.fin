# Отладка Railway Scheduler - нет логов выполнения

## Проблема

При запуске "Run now" видны только логи сборки Docker образа, но нет логов выполнения скрипта.

## Возможные причины

1. **Скрипт не запускается** - команда неправильная
2. **Скрипт падает сразу** - ошибка импорта или переменных окружения
3. **Логи не попадают в stdout** - нужно использовать flush
4. **Cron не настроен** - расписание не установлено

## Решения

### 1. Проверьте Start Command

В Settings → Deploy → Start Command должно быть:
```bash
cd backend && python scripts/send_daily_reminders.py
```

Или попробуйте с полным путем:
```bash
python /app/backend/scripts/send_daily_reminders.py
```

### 2. Проверьте переменные окружения

Убедитесь, что установлены:
- `DATABASE_URL` (Reference из Backend сервиса)
- `TELEGRAM_BOT_TOKEN` (Reference из Backend сервиса)

### 3. Проверьте Cron Schedule

В Settings → Deploy → Cron Schedule должно быть:
```
0 9 * * *
```

### 4. Используйте простую тестовую команду

Для проверки, что команда вообще выполняется, временно замените Start Command на:
```bash
echo "Test command executed" && date && ls -la /app
```

Если эта команда работает и видна в логах, значит проблема в скрипте.

### 5. Проверьте логи в реальном времени

1. Откройте раздел **"Logs"** в Railway
2. Нажмите **"Run now"**
3. Сразу после нажатия смотрите логи - они должны появиться в течение 5-10 секунд

### 6. Альтернативный способ запуска

Попробуйте использовать обертку-скрипт. Создайте файл `run_reminders.sh` в корне проекта:

```bash
#!/bin/bash
set -e
cd /app/backend
export PYTHONPATH=/app/backend
python scripts/send_daily_reminders.py
```

И в Start Command укажите:
```bash
bash /app/run_reminders.sh
```

### 7. Проверка через Railway CLI

Если у вас установлен Railway CLI:
```bash
railway logs --service scheduler
```

## Что должно быть в логах после исправления

После деплоя обновленного скрипта с flush, в логах должно появиться:

```
[START] Script execution started
[START] Python version: 3.11.x
[DEBUG] Script directory: /app/backend/scripts
[DEBUG] Backend directory: /app/backend
[DEBUG] DATABASE_URL: set
[DEBUG] TELEGRAM_BOT_TOKEN: set
[INFO] Starting send_daily_reminders_to_all_users...
[INFO] Found X users with Telegram or VK IDs
[INFO] Processing user 1/X: ID=1, Telegram=True, VK=False
[SUCCESS] Telegram reminder sent to user 1
...
✅ Daily reminders sent to X users
[END] Script execution completed successfully
```

## Если логов все еще нет

1. **Проверьте, что изменения задеплоены** - подождите 1-2 минуты после push
2. **Проверьте Root Directory** - должен быть `/` или пусто
3. **Попробуйте пересоздать сервис** - иногда помогает
4. **Используйте Railway Cron** - если доступен в вашем плане

## Контакты для поддержки

Если ничего не помогает, обратитесь в поддержку Railway или используйте альтернативный способ - вызывайте эндпоинт через внешний cron сервис (например, cron-job.org).









