# Настройка PostgreSQL от пользователя root

Если вы работаете от пользователя **root** (как в вашем случае), команды `sudo` не нужны.

## Проверка установки PostgreSQL

Сначала проверьте, установлен ли PostgreSQL:

```bash
# Проверка статуса PostgreSQL
systemctl status postgresql

# Или проверка наличия пакета
dpkg -l | grep postgresql

# Проверка версии (если установлен)
psql --version
```

## Если PostgreSQL НЕ установлен

Установите PostgreSQL (от root, без sudo):

```bash
apt update
apt install postgresql postgresql-contrib -y
```

## Подключение к PostgreSQL от root

Если PostgreSQL установлен, подключитесь к нему одним из способов:

### Способ 1: Переключение на пользователя postgres

```bash
su - postgres
psql
```

После выполнения команд выйдите:
```sql
\q
exit
```

### Способ 2: Прямое подключение от root

```bash
# Подключение к PostgreSQL от root
psql -U postgres

# Или если нужно указать хост
psql -U postgres -h localhost
```

## Создание базы данных и пользователя

После подключения к PostgreSQL выполните:

```sql
-- Создание пользователя для приложения
CREATE USER finance_user WITH PASSWORD 'ваш_надежный_пароль';

-- Создание базы данных
CREATE DATABASE finance_db OWNER finance_user;

-- Предоставление всех привилегий пользователю
GRANT ALL PRIVILEGES ON DATABASE finance_db TO finance_user;

-- Выход из консоли PostgreSQL
\q
```

## Полный скрипт установки для root

```bash
# 1. Обновление системы
apt update
apt upgrade -y

# 2. Установка PostgreSQL (если не установлен)
apt install postgresql postgresql-contrib -y

# 3. Проверка статуса
systemctl status postgresql

# 4. Создание БД и пользователя (через su)
su - postgres << 'EOF'
psql << 'SQL'
CREATE USER finance_user WITH PASSWORD 'ваш_надежный_пароль';
CREATE DATABASE finance_db OWNER finance_user;
GRANT ALL PRIVILEGES ON DATABASE finance_db TO finance_user;
\q
SQL
exit
EOF

# 5. Определение версии PostgreSQL
PG_VERSION=$(ls /etc/postgresql/ | head -n 1)
echo "Версия PostgreSQL: $PG_VERSION"

# 6. Настройка удаленного доступа
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/$PG_VERSION/main/postgresql.conf

# 7. Добавление правила в pg_hba.conf
echo "host    finance_db    finance_user    0.0.0.0/0    md5" >> /etc/postgresql/$PG_VERSION/main/pg_hba.conf

# 8. Оптимизация для сервера с 0.5ГБ RAM
cat >> /etc/postgresql/$PG_VERSION/main/postgresql.conf << 'CONF'

# Оптимизация для сервера с 0.5ГБ RAM
shared_buffers = 64MB
work_mem = 2MB
maintenance_work_mem = 32MB
max_connections = 20
effective_cache_size = 128MB
jit = off
wal_buffers = 1MB
min_wal_size = 80MB
max_wal_size = 256MB
random_page_cost = 4.0
effective_io_concurrency = 1
CONF

# 9. Перезапуск PostgreSQL
systemctl restart postgresql

# 10. Проверка статуса
systemctl status postgresql

# 11. Открытие порта в файрволе (если используется)
ufw allow 5432/tcp

# 12. Создание swap файла (1GB)
if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 13. Проверка подключения
su - postgres -c "psql -c 'SELECT version();'"
```

## Проверка подключения

После настройки проверьте подключение:

```bash
# От root
su - postgres -c "psql -c 'SELECT current_database(), current_user;'"

# Или подключитесь напрямую
su - postgres
psql -d finance_db -U finance_user
# Введите пароль
```

## Устранение проблем

### Ошибка: "command not found: psql"

PostgreSQL не установлен. Установите:
```bash
apt install postgresql postgresql-contrib -y
```

### Ошибка: "could not connect to server"

Проверьте статус PostgreSQL:
```bash
systemctl status postgresql
systemctl start postgresql
```

### Ошибка при подключении от root

Используйте переключение на пользователя postgres:
```bash
su - postgres
psql
```












