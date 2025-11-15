# Быстрая настройка удаленной БД

## Краткая инструкция для подключения к PostgreSQL на сервере 195.43.142.121

### 1. На сервере (через SSH)

**⚠️ Если вы работаете от root (как в вашем случае), используйте команды БЕЗ `sudo`!**

```bash
# Подключитесь к серверу
ssh root@195.43.142.121

# Установите PostgreSQL (от root, без sudo)
apt update
apt install postgresql postgresql-contrib -y

# Создайте БД и пользователя (через su - postgres)
su - postgres << 'EOF'
psql << 'SQL'
CREATE USER finance_user WITH PASSWORD 'ваш_надежный_пароль';
CREATE DATABASE finance_db OWNER finance_user;
GRANT ALL PRIVILEGES ON DATABASE finance_db TO finance_user;
\q
SQL
exit
EOF

# Определите версию PostgreSQL (обычно 13 в Debian 11)
PG_VERSION=$(ls /etc/postgresql/ 2>/dev/null | head -n 1)

# Проверка, что версия найдена
if [ -z "$PG_VERSION" ]; then
    echo "ОШИБКА: PostgreSQL не найден! Проверьте установку: systemctl status postgresql"
    exit 1
fi

echo "Найдена версия PostgreSQL: $PG_VERSION"

# Проверка существования файла конфигурации
if [ ! -f "/etc/postgresql/$PG_VERSION/main/postgresql.conf" ]; then
    echo "ОШИБКА: Файл конфигурации не найден!"
    exit 1
fi

# Настройка удаленного доступа (от root, без sudo)
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/$PG_VERSION/main/postgresql.conf

# Добавьте правило в pg_hba.conf
echo "host    finance_db    finance_user    0.0.0.0/0    md5" >> /etc/postgresql/$PG_VERSION/main/pg_hba.conf

# ⚡ КРИТИЧЕСКИ ВАЖНО: Оптимизация для сервера с 0.5ГБ RAM
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

# Перезапустите PostgreSQL
systemctl restart postgresql

# Откройте порт в файрволе (если используется)
# Проверьте, какой файрвол установлен
if command -v ufw &> /dev/null; then
    ufw allow 5432/tcp
    echo "Порт 5432 открыт в UFW"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=5432/tcp
    firewall-cmd --reload
    echo "Порт 5432 открыт в firewalld"
else
    echo "Файрвол не найден. Проверьте подключение вручную."
    echo "Проверка порта: netstat -tlnp | grep 5432"
fi

# Создайте swap файл (1GB) для дополнительной стабильности
if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
```

**📖 Если у вас проблемы с командами, см. `ROOT_USER_SETUP.md` для подробных инструкций.**

### 2. В проекте (локально)

Создайте файл `backend/.env`:

```env
DATABASE_URL=postgresql://finance_user:ваш_надежный_пароль@195.43.142.121:5432/finance_db
SECRET_KEY=ваш-секретный-ключ-для-production
```

### 3. Проверьте подключение

```bash
cd finance-manager/backend
python test_db_connection.py
```

### 4. Примените миграции

```bash
python run_migrations.py
```

### 5. Запустите приложение

```bash
python -m uvicorn app.main:app --reload
```

---

📖 **Подробная инструкция:** См. `REMOTE_DATABASE_SETUP.md`

