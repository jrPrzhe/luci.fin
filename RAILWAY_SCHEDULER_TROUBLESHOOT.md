# Устранение проблем Railway Scheduler

## Ошибка "Failed to fetch"

Эта ошибка обычно означает проблему с Railway API или временную недоступность сервиса.

### Решения:

1. **Обновите страницу** и попробуйте снова
2. **Подождите 1-2 минуты** - Railway может быть временно перегружен
3. **Проверьте статус Railway** - возможно, есть проблемы с инфраструктурой

## Альтернативные способы проверки

### Способ 1: Проверка через Railway CLI

Если у вас установлен Railway CLI:

```bash
# Войдите в Railway
railway login

# Выберите проект
railway link

# Проверьте логи
railway logs --service scheduler

# Или запустите команду вручную
railway run --service scheduler "cd /app/backend && python scripts/send_daily_reminders.py"
```

### Способ 2: Проверка через API эндпоинт

Вместо Scheduler можно временно использовать API эндпоинт:

1. Откройте ваш Backend сервис
2. Найдите URL (например, `https://your-backend.railway.app`)
3. Вызовите эндпоинт:
   ```bash
   curl -X POST https://your-backend.railway.app/api/v1/gamification/send-daily-reminders \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

### Способ 3: Использование внешнего cron сервиса

Если Railway Scheduler не работает, используйте внешний сервис:

1. **cron-job.org** (бесплатно):
   - Зарегистрируйтесь на cron-job.org
   - Создайте новую задачу
   - URL: `https://your-backend.railway.app/api/v1/gamification/send-daily-reminders`
   - Метод: POST
   - Headers: `Authorization: Bearer YOUR_ADMIN_TOKEN`
   - Расписание: `0 9 * * *` (каждый день в 9:00 UTC)

2. **EasyCron** (бесплатный план):
   - Аналогично cron-job.org

### Способ 4: Проверка через другой сервис

Создайте временный тестовый сервис в Railway:

1. Создайте новый Empty Service
2. Используйте ту же команду
3. Проверьте, работает ли там

## Проверка текущей настройки

Убедитесь, что в Scheduler сервисе:

1. **Start Command** установлен правильно:
   ```bash
   cd /app/backend && python scripts/send_daily_reminders.py 2>&1
   ```

2. **Variables** скопированы из Backend:
   - `DATABASE_URL` (Reference)
   - `TELEGRAM_BOT_TOKEN` (Reference)

3. **Cron Schedule** установлен:
   ```
   0 9 * * *
   ```

## Временное решение

Пока Railway Scheduler не работает, можно:

1. **Использовать API эндпоинт** для ручного запуска
2. **Настроить внешний cron** (cron-job.org)
3. **Добавить задачу в Backend сервис** через Celery (если используется)

## Проверка работоспособности скрипта локально

Для проверки, что скрипт работает:

```bash
# Локально
cd backend
python scripts/send_daily_reminders.py
```

Если локально работает, значит проблема в настройках Railway.







