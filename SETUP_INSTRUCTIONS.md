# Инструкция по настройке

## Шаг 1: Настройка переменных окружения

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

### Обязательные переменные

Отредактируйте `.env` файл и укажите:

```env
# Безопасность - СГЕНЕРИРУЙТЕ СВОЙ УНИКАЛЬНЫЙ КЛЮЧ!
SECRET_KEY=your-very-secret-key-here-please-change-me

# База данных (для Docker уже настроено)
DATABASE_URL=postgresql://finance_user:finance_password@postgres:5432/finance_db

# Redis (для Docker уже настроено)
REDIS_URL=redis://redis:6379/0

# Google AI Studio API (ОБЯЗАТЕЛЬНО для ИИ-функций)
GOOGLE_AI_API_KEY=your-google-ai-api-key-here

# Telegram Bot (ОБЯЗАТЕЛЬНО для бота)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-here

# CORS - где будет работать фронтенд
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### Опциональные переменные

```env
# Email уведомления
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Exchange Rate API (для конвертации валют)
EXCHANGE_RATE_API_KEY=your-api-key

# Telegram Webhook
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook
```

## Шаг 2: Получение API ключей

### Google AI Studio API Key (Gemini)

1. Зайдите на https://aistudio.google.com
2. Войдите с вашим Google аккаунтом
3. Нажмите "Get API key" или "Создать API-ключ"
4. Выберите проект или создайте новый
5. Скопируйте созданный API ключ
6. Вставьте в `.env` как `GOOGLE_AI_API_KEY`

**Важно**: Google AI Studio предоставляет бесплатный tier с щедрыми лимитами! 🎉

### Telegram Bot Token

1. Найдите @BotFather в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям (название, username)
4. Получите токен вида: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
5. Вставьте в `.env`

**Бесплатно!** Telegram боты бесплатные.

## Шаг 3: Запуск проекта

### Docker (Рекомендуется)

```bash
# Запустить все сервисы
docker-compose up -d

# Проверить логи
docker-compose logs -f

# Остановить
docker-compose down

# Перезапустить
docker-compose restart
```

### Локальная разработка

#### 1. PostgreSQL

Установите PostgreSQL 15+ или используйте Docker:

```bash
docker run -d \
  --name postgres \
  -e POSTGRES_USER=finance_user \
  -e POSTGRES_PASSWORD=finance_password \
  -e POSTGRES_DB=finance_db \
  -p 5432:5432 \
  postgres:15
```

#### 2. Redis

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

#### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Обновите DATABASE_URL в .env для локального подключения
# DATABASE_URL=postgresql://finance_user:finance_password@localhost:5432/finance_db

# Миграции
alembic upgrade head

# Запуск
uvicorn app.main:app --reload
```

#### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

#### 5. Telegram Bot

```bash
cd telegram-bot
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python bot.py
```

## Шаг 4: Проверка работоспособности

### 1. Backend API

Откройте в браузере:
- http://localhost:8000/docs - Swagger UI
- http://localhost:8000/health - Health check

Должен вернуться `{"status": "healthy"}`

### 2. Frontend

Откройте: http://localhost:5173

Должна открыться страница входа.

### 3. Telegram Bot

Отправьте боту в Telegram: `/start`

Должен ответить приветствием.

### 4. База данных

```bash
# Подключитесь к PostgreSQL
docker exec -it finance_postgres psql -U finance_user -d finance_db

# Проверьте таблицы
\dt

# Должны увидеть:
# users, accounts, transactions, categories, tags, shared_budgets, etc.
```

## Шаг 5: Создание первого аккаунта

### Через Frontend

1. Откройте http://localhost:5173
2. Нажмите "Зарегистрироваться"
3. Введите email и пароль
4. Войдите

### Через API

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepassword123"
  }'
```

### Через Telegram

Отправьте боту `/start` и следуйте инструкциям.

## Шаг 6: Первый счёт

После входа:

1. Перейдите в "Счета"
2. Нажмите "➕ Добавить счёт"
3. Заполните форму:
   - Название: "Наличные"
   - Тип: Наличные
   - Баланс: 10000
   - Валюта: RUB
4. Сохраните

## Шаг 7: Первая транзакция

1. Нажмите "➕ Добавить расход"
2. Заполните:
   - Сумма: 500
   - Категория: Еда
   - Дата: Сегодня
   - Описание: Обед
3. Сохраните

## Решение проблем

### База данных не подключается

```bash
# Проверьте, что PostgreSQL запущен
docker-compose ps postgres

# Проверьте логи
docker-compose logs postgres

# Пересоздайте
docker-compose down -v
docker-compose up -d postgres
```

### Backend не запускается

```bash
# Проверьте логи
docker-compose logs backend

# Проверьте .env файл
cat .env | grep DATABASE_URL

# Пересоздайте контейнер
docker-compose up -d --force-recreate backend
```

### Telegram Bot не отвечает

```bash
# Проверьте токен
cat .env | grep TELEGRAM_BOT_TOKEN

# Проверьте логи
docker-compose logs telegram-bot

# Перезапустите
docker-compose restart telegram-bot
```

### Google AI API ошибки

```bash
# Проверьте ключ
cat .env | grep GOOGLE_AI_API_KEY

# Проверьте лимиты на aistudio.google.com

# Проверьте логи
docker-compose logs backend | grep google
```

### Frontend не открывается

```bash
# Проверьте, что backend запущен
curl http://localhost:8000/health

# Проверьте CORS настройки в .env

# Перезапустите
docker-compose restart frontend
```

## Следующие шаги

1. ✅ Проект настроен и запущен
2. 📖 Изучите [README.md](README.md)
3. 🚀 Прочитайте [QUICKSTART.md](QUICKSTART.md)
4. 💡 Посмотрите [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
5. 🔧 Начните разработку!

## Полезные команды

```bash
# Просмотр всех логов
docker-compose logs -f

# Просмотр логов конкретного сервиса
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f telegram-bot

# Остановка всех сервисов
docker-compose down

# Остановка с удалением данных
docker-compose down -v

# Пересоздание всех сервисов
docker-compose up -d --force-recreate

# Проверка статуса
docker-compose ps

# Доступ к shell контейнера
docker exec -it finance_backend bash
docker exec -it finance_postgres psql -U finance_user -d finance_db

# Просмотр использования ресурсов
docker stats
```

## Готово! 🎉

Теперь у вас настроен и запущен полнофункциональный Finance Manager!

