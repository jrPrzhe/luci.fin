# Использование Railway CLI для Scheduler

## Проблема: "Системе не удается найти указанный путь"

Эта ошибка возникает, если:
1. Railway CLI не настроен
2. Проект не связан с Railway
3. Неправильное имя сервиса

## Решение

### Шаг 1: Убедитесь, что вы в корне проекта

```bash
cd e:\finance-manager\finance-manager
```

### Шаг 2: Проверьте связь с Railway

```bash
railway status
```

Если проект не связан, выполните:
```bash
railway link
```

### Шаг 3: Проверьте список сервисов

```bash
railway service
```

Или:
```bash
railway service list
```

Найдите имя вашего scheduler сервиса (может быть `scheduler`, `daily-reminders` или другое).

### Шаг 4: Запустите команду с правильным именем сервиса

```bash
railway run --service <ИМЯ_СЕРВИСА> "cd /app/backend && python scripts/send_daily_reminders.py"
```

Например:
```bash
railway run --service scheduler "cd /app/backend && python scripts/send_daily_reminders.py"
```

Или если сервис называется по-другому:
```bash
railway run --service daily-reminders "cd /app/backend && python scripts/send_daily_reminders.py"
```

## Альтернативный способ - без указания сервиса

Если у вас только один сервис или вы хотите запустить в текущем сервисе:

```bash
railway run "cd /app/backend && python scripts/send_daily_reminders.py"
```

## Проверка логов

После запуска проверьте логи:

```bash
railway logs --service <ИМЯ_СЕРВИСА>
```

Или в реальном времени:
```bash
railway logs --service <ИМЯ_СЕРВИСА> --follow
```

## Если Railway CLI не установлен

Установите Railway CLI:

```bash
npm i -g @railway/cli
```

Или через другие способы:
- Windows: `iwr https://railway.app/install.ps1 | iex`
- Mac/Linux: `curl -fsSL https://railway.app/install.sh | sh`

## Проверка установки

```bash
railway --version
```

## Вход в Railway

```bash
railway login
```

## Связь проекта

```bash
cd e:\finance-manager\finance-manager
railway link
```

Выберите проект из списка.







