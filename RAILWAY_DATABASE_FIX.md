# Исправление ошибки подключения к базе данных на Railway

## Проблема
```
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) 
connection to server at "localhost" (::1), port 5432 failed: Connection refused
```

Это означает, что приложение пытается подключиться к PostgreSQL на `localhost:5432`, но на Railway нужно использовать `DATABASE_URL` из переменных окружения.

## Решение

### Шаг 1: Добавить PostgreSQL сервис на Railway

1. Откройте ваш проект на Railway: https://railway.app
2. В вашем проекте нажмите **"+ New"** или **"New Service"**
3. Выберите **"Database"** → **"Add PostgreSQL"**
4. Railway автоматически создаст PostgreSQL базу данных

### Шаг 2: Связать PostgreSQL с вашим Backend сервисом

1. После создания PostgreSQL сервиса, Railway автоматически создаст переменную `DATABASE_URL`
2. Откройте ваш **Backend сервис** (не PostgreSQL)
3. Перейдите в **"Variables"** (или **"Settings"** → **"Variables"**)
4. Найдите переменную `DATABASE_URL` — она должна быть автоматически добавлена Railway
5. Если её нет, вернитесь к PostgreSQL сервису:
   - Откройте PostgreSQL сервис
   - Перейдите в **"Variables"** → **"Connect"**
   - Скопируйте значение `DATABASE_URL`
   - Вернитесь в Backend сервис → **"Variables"**
   - Добавьте новую переменную:
     - **Name**: `DATABASE_URL`
     - **Value**: вставьте скопированное значение

### Шаг 3: Проверить формат DATABASE_URL

`DATABASE_URL` должен выглядеть примерно так:
```
postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway
```

**НЕ** должно быть:
- `localhost`
- `127.0.0.1`
- `sqlite://`

### Шаг 4: Убедиться, что все необходимые переменные окружения установлены

В Backend сервисе в разделе **"Variables"** должны быть:

1. **`DATABASE_URL`** - автоматически из PostgreSQL сервиса
2. **`SECRET_KEY`** - случайная строка (например, сгенерируйте: `openssl rand -hex 32`)
3. **`CORS_ORIGINS`** - URL вашего фронтенда на Vercel, например:
   ```
   https://your-app.vercel.app
   ```
   Или если несколько:
   ```
   https://your-app.vercel.app,http://localhost:5173
   ```

### Шаг 5: Перезапустить деплой

После добавления/изменения переменных окружения:
1. Railway должен автоматически перезапустить деплой
2. Или вручную нажмите **"Deployments"** → выберите последний деплой → **"Redeploy"**

### Шаг 6: Проверить логи

1. Откройте ваш Backend сервис
2. Перейдите в **"Deployments"** → выберите последний деплой → **"View Logs"**
3. Убедитесь, что нет ошибок подключения к базе данных
4. Приложение должно успешно запуститься

## Проверка конфигурации

Ваше приложение использует `pydantic_settings`, которое автоматически читает переменные окружения. Проверьте, что:

1. В `backend/app/core/config.py` есть:
   ```python
   DATABASE_URL: str = "sqlite:///./finance.db"  # Это значение по умолчанию
   ```
   Но если `DATABASE_URL` установлен в переменных окружения Railway, он будет использован вместо значения по умолчанию.

2. В `backend/app/core/database.py` используется:
   ```python
   engine = create_engine(settings.DATABASE_URL, ...)
   ```

## Альтернативное решение (если проблема сохраняется)

Если Railway не автоматически связывает PostgreSQL с Backend:

1. Откройте PostgreSQL сервис
2. Перейдите в **"Connect"** или **"Variables"**
3. Скопируйте все переменные:
   - `DATABASE_URL`
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`
4. Откройте Backend сервис → **"Variables"**
5. Добавьте все эти переменные вручную

## Полезные команды для проверки

После деплоя, проверьте, что приложение работает:
```bash
curl https://your-backend.railway.app/health
```

Должен вернуться:
```json
{"status": "healthy"}
```










