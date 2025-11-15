# Настройка удаленной базы данных PostgreSQL

Это руководство поможет вам настроить PostgreSQL на удаленном сервере Debian 11 и подключить к нему ваш проект.

## Информация о сервере

- **IP-адрес**: 195.43.142.121
- **ОС**: Debian 11
- **SSH**: Готов к использованию
- **Конфигурация**: 1x2.2ГГц CPU, 0.5ГБ RAM, 10ГБ HDD RAID

⚠️ **ВАЖНО:** Сервер имеет ограниченные ресурсы (0.5ГБ RAM). PostgreSQL необходимо оптимизировать для работы с минимальным объемом памяти!

## Шаг 1: Подключение к серверу

Подключитесь к серверу по SSH:

```bash
ssh root@195.43.142.121
# или
ssh your_user@195.43.142.121
```

## Шаг 2: Установка PostgreSQL

### 2.1. Обновление системы

```bash
sudo apt update
sudo apt upgrade -y
```

### 2.2. Установка PostgreSQL

```bash
sudo apt install postgresql postgresql-contrib -y
```

### 2.3. Проверка статуса PostgreSQL

```bash
sudo systemctl status postgresql
```

PostgreSQL должен быть активен и запущен.

## Шаг 3: Настройка PostgreSQL

### 3.1. Создание базы данных и пользователя

Переключитесь на пользователя postgres:

```bash
sudo -u postgres psql
```

В консоли PostgreSQL выполните следующие команды:

```sql
-- Создание пользователя для приложения
CREATE USER finance_user WITH PASSWORD 'your_secure_password_here';

-- Создание базы данных
CREATE DATABASE finance_db OWNER finance_user;

-- Предоставление всех привилегий пользователю
GRANT ALL PRIVILEGES ON DATABASE finance_db TO finance_user;

-- Выход из консоли PostgreSQL
\q
```

**⚠️ ВАЖНО:** Замените `your_secure_password_here` на надежный пароль!

### 3.2. Определение версии PostgreSQL

Сначала определите версию PostgreSQL:

```bash
sudo -u postgres psql -c "SELECT version();"
```

Или проверьте директорию:

```bash
ls /etc/postgresql/
```

Обычно в Debian 11 это версия 13, но может быть и другая.

### 3.3. Настройка удаленного доступа

Отредактируйте файл конфигурации PostgreSQL (замените `13` на вашу версию, если отличается):

```bash
# Для версии 13
sudo nano /etc/postgresql/13/main/postgresql.conf

# Или для другой версии (например, 14)
# sudo nano /etc/postgresql/14/main/postgresql.conf
```

Найдите строку `#listen_addresses = 'localhost'` и измените на:

```
listen_addresses = '*'
```

Сохраните файл (Ctrl+O, Enter, Ctrl+X).

### 3.4. Настройка аутентификации

Отредактируйте файл `pg_hba.conf` (замените `13` на вашу версию, если отличается):

```bash
# Для версии 13
sudo nano /etc/postgresql/13/main/pg_hba.conf

# Или для другой версии
# sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Добавьте в конец файла следующие строки (замените `YOUR_APP_IP` на IP-адрес вашего приложения или используйте `0.0.0.0/0` для доступа с любого IP):

```
# Разрешить подключение с вашего приложения
host    finance_db    finance_user    0.0.0.0/0    md5
```

**⚠️ БЕЗОПАСНОСТЬ:** Для production рекомендуется указать конкретный IP-адрес вместо `0.0.0.0/0`.

Сохраните файл и перезапустите PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### 3.4. Настройка файрвола (если используется)

Если на сервере включен UFW (Uncomplicated Firewall), разрешите подключения к PostgreSQL:

```bash
sudo ufw allow 5432/tcp
sudo ufw status
```

Если используется другой файрвол, убедитесь, что порт 5432 открыт для входящих подключений.

### 3.5. ⚡ КРИТИЧЕСКИ ВАЖНО: Оптимизация PostgreSQL для сервера с 0.5ГБ RAM

**⚠️ ОБЯЗАТЕЛЬНО:** Сервер имеет всего 0.5ГБ RAM. Без оптимизации PostgreSQL может использовать слишком много памяти и вызвать проблемы.

Определите версию PostgreSQL (если еще не определили):

```bash
PG_VERSION=$(ls /etc/postgresql/ | head -n 1)
echo "Версия PostgreSQL: $PG_VERSION"
```

Отредактируйте файл конфигурации PostgreSQL:

```bash
sudo nano /etc/postgresql/$PG_VERSION/main/postgresql.conf
```

Добавьте или измените следующие параметры в конец файла:

```ini
# ============================================
# Оптимизация для сервера с 0.5ГБ RAM
# ============================================

# Общая память для PostgreSQL (максимум 128MB из 512MB, оставляем остальное для ОС)
shared_buffers = 64MB

# Память для операций сортировки и хеш-таблиц (на каждое соединение)
work_mem = 2MB

# Память для операций обслуживания (VACUUM, CREATE INDEX и т.д.)
maintenance_work_mem = 32MB

# Максимальное количество подключений (ограничиваем для экономии памяти)
max_connections = 20

# Эффективная память для кэша (shared_buffers + work_mem * max_connections)
# Должна быть примерно: 64MB + (2MB * 20) = 104MB, что безопасно для 512MB RAM
effective_cache_size = 128MB

# Отключаем расширенные функции для экономии памяти
jit = off

# Уменьшаем размер WAL (Write-Ahead Logging)
wal_buffers = 1MB
min_wal_size = 80MB
max_wal_size = 256MB

# Оптимизация для медленного диска
random_page_cost = 4.0
effective_io_concurrency = 1

# Отключаем неиспользуемые расширения
# (можно включить позже, если понадобятся)
```

**Объяснение параметров:**
- `shared_buffers = 64MB` - основная память для кэширования данных (обычно 25% RAM, но для 512MB берем 64MB)
- `work_mem = 2MB` - память на операцию сортировки/хеширования (на каждое соединение)
- `max_connections = 20` - ограничиваем количество одновременных подключений
- `effective_cache_size = 128MB` - оценка доступной памяти для кэша ОС
- `jit = off` - отключаем JIT-компиляцию для экономии памяти

Сохраните файл (Ctrl+O, Enter, Ctrl+X) и перезапустите PostgreSQL:

```bash
sudo systemctl restart postgresql
```

Проверьте использование памяти:

```bash
# Проверка использования памяти PostgreSQL
ps aux | grep postgres

# Или более детально
sudo -u postgres psql -c "SHOW shared_buffers;"
sudo -u postgres psql -c "SHOW work_mem;"
sudo -u postgres psql -c "SHOW max_connections;"
```

**Мониторинг использования ресурсов:**

```bash
# Установите утилиты для мониторинга (если еще не установлены)
sudo apt install htop -y

# Запустите мониторинг
htop
```

**Дополнительные рекомендации для сервера с ограниченной памятью:**

1. **Отключите неиспользуемые сервисы:**
   ```bash
   # Проверьте запущенные сервисы
   sudo systemctl list-units --type=service --state=running
   
   # Отключите ненужные (например, если не используете)
   # sudo systemctl stop service_name
   # sudo systemctl disable service_name
   ```

2. **Настройте swap (если еще не настроен):**
   ```bash
   # Проверьте наличие swap
   free -h
   
   # Если swap отсутствует, создайте файл подкачки (1GB)
   sudo fallocate -l 1G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   
   # Сделайте постоянным
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

3. **Ограничьте использование памяти другими процессами:**
   - Убедитесь, что на сервере не запущены другие тяжелые приложения
   - Используйте этот сервер только для PostgreSQL

## Шаг 4: Проверка подключения

### 4.1. Проверка с сервера

```bash
sudo -u postgres psql -h localhost -U finance_user -d finance_db
```

Введите пароль, который вы установили для `finance_user`.

### 4.2. Проверка с вашего локального компьютера

Установите PostgreSQL клиент (если еще не установлен):

**Windows:**
- Скачайте и установите PostgreSQL с официального сайта: https://www.postgresql.org/download/windows/
- Или используйте psql из установленного PostgreSQL

**Linux/Mac:**
```bash
# Ubuntu/Debian
sudo apt install postgresql-client

# Mac
brew install postgresql
```

Проверьте подключение:

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db
```

## Шаг 5: Настройка проекта

### 5.1. Создание файла .env

В директории `backend/` создайте файл `.env` (если его еще нет):

```bash
cd finance-manager/backend
```

Создайте файл `.env` со следующим содержимым:

```env
# Database
DATABASE_URL=postgresql://finance_user:your_secure_password_here@195.43.142.121:5432/finance_db

# Security
SECRET_KEY=your-secret-key-here-change-in-production

# Other settings...
# (добавьте остальные переменные окружения по необходимости)
```

**⚠️ ВАЖНО:** 
- Замените `your_secure_password_here` на пароль, который вы установили для `finance_user`
- Замените `your-secret-key-here-change-in-production` на случайную строку для SECRET_KEY

### 5.2. Формат DATABASE_URL

Формат строки подключения PostgreSQL:

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

Пример:
```
postgresql://finance_user:mypassword123@195.43.142.121:5432/finance_db
```

## Шаг 6: Применение миграций

После настройки подключения к БД, примените миграции:

```bash
cd finance-manager/backend
python run_migrations.py
```

Или используйте Alembic напрямую:

```bash
alembic upgrade head
```

## Шаг 7: Проверка работы приложения

Запустите приложение:

```bash
cd finance-manager/backend
python -m uvicorn app.main:app --reload
```

Проверьте логи на наличие ошибок подключения к БД.

## Устранение неполадок

### Ошибка: "Connection refused"

1. Проверьте, что PostgreSQL запущен:
   ```bash
   sudo systemctl status postgresql
   ```

2. Проверьте, что `listen_addresses = '*'` в `postgresql.conf`

3. Проверьте файрвол:
   ```bash
   sudo ufw status
   ```

### Ошибка: "password authentication failed"

1. Проверьте правильность пароля в `.env` файле
2. Убедитесь, что пользователь существует:
   ```bash
   sudo -u postgres psql -c "\du"
   ```

### Ошибка: "database does not exist"

1. Проверьте, что база данных создана:
   ```bash
   sudo -u postgres psql -c "\l"
   ```

### Ошибка: "permission denied"

1. Убедитесь, что пользователь имеет права на базу данных:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE finance_db TO finance_user;
   ```

## Безопасность

### Рекомендации для production:

1. **Используйте сильные пароли** - минимум 16 символов, смесь букв, цифр и символов
2. **Ограничьте доступ по IP** - в `pg_hba.conf` укажите конкретные IP-адреса вместо `0.0.0.0/0`
3. **Используйте SSL** - настройте SSL для подключений к PostgreSQL
4. **Регулярные бэкапы** - настройте автоматические бэкапы базы данных
5. **Обновления** - регулярно обновляйте PostgreSQL до последней версии

### Настройка SSL (опционально)

Для настройки SSL подключений к PostgreSQL см. официальную документацию:
https://www.postgresql.org/docs/current/ssl-tcp.html

## Дополнительные команды

### Создание бэкапа

```bash
sudo -u postgres pg_dump finance_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Восстановление из бэкапа

```bash
sudo -u postgres psql finance_db < backup_file.sql
```

### Просмотр активных подключений

```sql
SELECT * FROM pg_stat_activity;
```

### Остановка всех подключений к базе данных

```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'finance_db' AND pid <> pg_backend_pid();
```

