# Восстановление файла .env

Файл `.env` был удален или потерян. Вот как его восстановить.

## Быстрое восстановление

### Шаг 1: Перейдите в директорию backend

```bash
cd finance-manager/backend
```

### Шаг 2: Создайте файл .env

**Windows (PowerShell):**
```powershell
@"
DATABASE_URL=postgresql://finance_user:ваш_пароль@195.43.142.121:5432/finance_db
SECRET_KEY=ваш-секретный-ключ-для-production-минимум-32-символа
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
FRONTEND_URL=http://localhost:5173
"@ | Out-File -FilePath .env -Encoding utf8
```

**Linux/Mac:**
```bash
cat > .env << 'EOF'
DATABASE_URL=postgresql://finance_user:ваш_пароль@195.43.142.121:5432/finance_db
SECRET_KEY=ваш-секретный-ключ-для-production-минимум-32-символа
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
FRONTEND_URL=http://localhost:5173
EOF
```

### Шаг 3: Отредактируйте файл .env

Откройте файл `.env` в текстовом редакторе и замените:

1. **`ваш_пароль`** - на реальный пароль, который вы установили для `finance_user` в PostgreSQL
2. **`ваш-секретный-ключ-для-production-минимум-32-символа`** - на случайную строку

## Генерация SECRET_KEY

Выполните команду для генерации безопасного SECRET_KEY:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Скопируйте результат и вставьте в файл `.env` вместо `ваш-секретный-ключ-для-production-минимум-32-символа`.

## Полный шаблон .env файла

Создайте файл `.env` в директории `backend/` со следующим содержимым:

```env
# Database - подключение к удаленной PostgreSQL БД
DATABASE_URL=postgresql://finance_user:ваш_пароль@195.43.142.121:5432/finance_db

# Security - ОБЯЗАТЕЛЬНО измените на случайную строку!
SECRET_KEY=ваш-секретный-ключ-для-production-минимум-32-символа

# CORS - разрешенные домены
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Опциональные настройки (можно оставить пустыми)
# REDIS_URL=
# GOOGLE_AI_API_KEY=
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_WEBHOOK_URL=
# ADMIN_TELEGRAM_IDS=
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASSWORD=
# EXCHANGE_RATE_API_KEY=
```

## Проверка после восстановления

После создания файла `.env` проверьте:

```bash
# 1. Проверка подключения к БД
python test_db_connection.py

# 2. Проверка загрузки переменных окружения
python -c "from app.core.config import settings; print(f'DATABASE_URL: {settings.DATABASE_URL[:50]}...')"
```

## Важные моменты

1. **Файл `.env` должен быть в директории `backend/`** (не в корне проекта)
2. **Не коммитьте `.env` в git** - он уже в `.gitignore`
3. **Пароль в DATABASE_URL** - это пароль, который вы установили для `finance_user` при создании БД
4. **SECRET_KEY** - должен быть уникальным и случайным для каждого окружения

## Если забыли пароль от БД

Если вы забыли пароль от `finance_user`, вы можете:

1. Подключиться к серверу по SSH
2. Подключиться к PostgreSQL от пользователя postgres
3. Изменить пароль:

```bash
# На сервере
su - postgres
psql

# В консоли PostgreSQL
ALTER USER finance_user WITH PASSWORD 'новый_пароль';
\q
exit
```

Затем обновите пароль в файле `.env`.






