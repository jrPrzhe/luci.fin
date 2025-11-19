# Быстрое исправление ошибки "No such file or directory"

## Проблема

При запуске Scheduler возникает ошибка:
```
python: can't open file '/app/backend/scripts/send_daily_reminders.py': [Errno 2] No such file or directory
```

## Причина

Рабочая директория в контейнере не соответствует структуре проекта, или файлы не скопированы правильно.

## Решение 1: Изменить Start Command (самое простое)

В настройках Scheduler сервиса в Railway:

1. Перейдите в **Settings** → **Deploy**
2. Найдите **"Start Command"**
3. Измените команду на одну из следующих:

**Вариант A (если backend скопирован в /app):**
```bash
cd /app && python scripts/send_daily_reminders.py
```

**Вариант B (если структура как в репозитории):**
```bash
cd /app/backend && python scripts/send_daily_reminders.py
```

**Вариант C (с полным путем):**
```bash
PYTHONPATH=/app python /app/scripts/send_daily_reminders.py
```

## Решение 2: Использовать правильный Root Directory

1. В настройках Scheduler:
   - **Settings** → **Build**
   - Найдите **"Root Directory"**
   - Установите: `backend` (если хотите, чтобы контекст был backend/)
   - Или оставьте пустым `/` (корень проекта)

2. Затем в **Start Command** используйте:
   ```bash
   python scripts/send_daily_reminders.py
   ```
   (если Root Directory = `backend`)

## Решение 3: Создать обертку-скрипт

Создайте файл `run_scheduler.sh` в корне проекта:

```bash
#!/bin/bash
set -e

# Переходим в директорию backend
cd "$(dirname "$0")/backend" || exit 1

# Устанавливаем PYTHONPATH
export PYTHONPATH="$(pwd):$PYTHONPATH"

# Запускаем скрипт
python scripts/send_daily_reminders.py
```

И в Start Command укажите:
```bash
bash run_scheduler.sh
```

## Решение 4: Использовать существующий Backend сервис

Вместо отдельного Scheduler, можно добавить команду в существующий Backend:

1. В Backend сервисе создайте отдельный deployment с командой:
   ```bash
   python backend/scripts/send_daily_reminders.py
   ```

2. Или используйте Railway Cron (если доступен)

## Решение 5: Исправить Dockerfile

Если используете Dockerfile, убедитесь, что он правильно копирует файлы:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Копируем requirements
COPY backend/requirements.txt /app/requirements.txt

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь backend
COPY backend/ /app/

# Устанавливаем PYTHONPATH
ENV PYTHONPATH=/app

# Команда запуска
CMD ["python", "scripts/send_daily_reminders.py"]
```

## Рекомендуемое решение

**Для Railway Scheduler используйте:**

1. **Root Directory:** `/` (корень проекта, пустое поле)
2. **Builder:** Nixpacks (автоматическое определение)
3. **Start Command:**
   ```bash
   cd backend && python scripts/send_daily_reminders.py
   ```

Или если Nixpacks не работает:

1. **Root Directory:** `backend`
2. **Start Command:**
   ```bash
   python scripts/send_daily_reminders.py
   ```

## Проверка структуры файлов

Чтобы понять, какая структура в контейнере, добавьте в Start Command:

```bash
ls -la /app && ls -la /app/backend 2>/dev/null || echo "backend not found" && pwd
```

Это покажет структуру директорий в контейнере.







