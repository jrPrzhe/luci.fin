# ⚠️ КРИТИЧЕСКИ ВАЖНО: Настройка Telegram бота на Railway

## 🔴 Проблема 1: BACKEND_URL не установлен

**Ошибка в логах:**
```
POST https://your-backend.railway.app//api/v1/auth/bot-token "HTTP/1.1 404 Not Found"
```

**Решение:**

1. Откройте ваш **Telegram Bot сервис** на Railway
2. Перейдите в **Variables** (переменные окружения)
3. Найдите переменную `BACKEND_URL`
4. **Установите правильный URL вашего backend:**
   - Откройте ваш **Backend сервис** на Railway
   - Скопируйте URL (например: `https://your-backend-production.up.railway.app`)
   - Вернитесь в **Telegram Bot сервис** → **Variables**
   - Установите `BACKEND_URL` = ваш реальный backend URL
   - **ВАЖНО:** URL должен быть без слэша в конце!
     - ✅ Правильно: `https://your-backend-production.up.railway.app`
     - ❌ Неправильно: `https://your-backend-production.up.railway.app/`

5. Перезапустите сервис бота (Railway сделает это автоматически)

## 🔴 Проблема 2: База данных перезаписывается при деплое

**Что было исправлено:**
- Убрана строка `Base.metadata.create_all(bind=engine)` из `main.py`
- Теперь таблицы не пересоздаются при каждом деплое

**ВАЖНО:** Используйте Alembic миграции для изменения структуры базы данных!

### Применение миграций на Railway:

#### Вариант 1: Автоматически при старте (рекомендуется)

Добавьте в `backend/app/main.py` автоматическое применение миграций:

```python
# В начале main.py после импортов
import subprocess
import sys
import os

# Auto-run migrations on startup (only in production)
if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_PROJECT_ID"):
    try:
        logger.info("Running database migrations...")
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd="/app",
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            logger.info("Migrations applied successfully")
        else:
            logger.error(f"Migration failed: {result.stderr}")
    except Exception as e:
        logger.error(f"Error running migrations: {e}")
```

#### Вариант 2: Вручную через Railway CLI

```bash
# Установите Railway CLI
npm i -g @railway/cli

# Авторизуйтесь
railway login

# Подключитесь к проекту
railway link

# Запустите миграции
railway run alembic upgrade head
```

#### Вариант 3: Через Railway Dashboard

1. Откройте ваш Backend сервис
2. Перейдите в **Deployments**
3. Найдите последний деплой
4. Нажмите **View Logs** → **Shell** (если доступно)
5. Выполните: `alembic upgrade head`

## ✅ Проверка настройки

### Проверьте переменные окружения бота:

В Railway → Telegram Bot Service → Variables должны быть:

```env
TELEGRAM_BOT_TOKEN=your-actual-token-from-botfather
BACKEND_URL=https://your-actual-backend-url.railway.app
```

**НЕ должно быть:**
- ❌ `BACKEND_URL=https://your-backend.railway.app` (плейсхолдер)
- ❌ `BACKEND_URL=http://localhost:8000` (локальный адрес)
- ❌ `BACKEND_URL=https://...railway.app/` (слэш в конце)

### Проверьте логи бота:

После настройки BACKEND_URL в логах должно быть:
```
Backend URL configured: https://your-actual-backend-url.railway.app
```

**НЕ должно быть:**
- ❌ `⚠️ BACKEND_URL seems to be a placeholder`
- ❌ `404 Not Found` при запросе к `/api/v1/auth/bot-token`

## 📝 Структура переменных окружения

### Backend Service (Railway)
```env
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://... (автоматически от Railway)
CORS_ORIGINS=https://your-frontend.vercel.app
```

### Telegram Bot Service (Railway)
```env
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
BACKEND_URL=https://your-backend-production.up.railway.app
```

## 🐛 Диагностика

### Если бот все еще не работает:

1. **Проверьте логи бота:**
   - Railway → Telegram Bot Service → Deployments → View Logs
   - Ищите строки с "Backend URL configured" и "Fetching token"

2. **Проверьте логи backend:**
   - Railway → Backend Service → Deployments → View Logs
   - Ищите запросы к `/api/v1/auth/bot-token`

3. **Проверьте что backend доступен:**
   - Откройте в браузере: `https://your-backend-url.railway.app/health`
   - Должно вернуть: `{"status": "healthy"}`

4. **Проверьте URL в переменных окружения:**
   - Убедитесь что нет опечаток
   - Убедитесь что URL начинается с `https://`
   - Убедитесь что нет слэша в конце

## 🎉 После исправления

После правильной настройки BACKEND_URL:
1. Бот должен успешно подключаться к backend
2. Запросы к `/api/v1/auth/bot-token` должны возвращать 200 OK
3. Пользователи смогут использовать бота

---

**Если проблема сохраняется:** Проверьте логи на Railway и убедитесь, что переменные окружения установлены правильно.














