# Следующие шаги после настройки listen_addresses

Вы уже выполнили настройку `listen_addresses`. Продолжайте выполнять команды по порядку:

## Шаг 1: Добавьте правило в pg_hba.conf

```bash
echo "host    finance_db    finance_user    0.0.0.0/0    md5" >> /etc/postgresql/$PG_VERSION/main/pg_hba.conf
```

Проверьте, что правило добавлено:
```bash
tail -n 3 /etc/postgresql/$PG_VERSION/main/pg_hba.conf
```

## Шаг 2: Добавьте оптимизацию для сервера с 0.5ГБ RAM

```bash
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
```

Проверьте, что настройки добавлены:
```bash
tail -n 15 /etc/postgresql/$PG_VERSION/main/postgresql.conf
```

## Шаг 3: Перезапустите PostgreSQL

```bash
systemctl restart postgresql
```

Проверьте статус:
```bash
systemctl status postgresql
```

## Шаг 4: Настройте файрвол (если используется)

```bash
# Проверьте, используется ли UFW
ufw status

# Если активен, откройте порт
ufw allow 5432/tcp

# Или если используется другой файрвол, убедитесь, что порт 5432 открыт
```

## Шаг 5: Создайте swap файл (рекомендуется для стабильности)

```bash
# Проверьте, есть ли уже swap
free -h

# Если swap нет, создайте (1GB)
if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "Swap файл создан и активирован"
else
    echo "Swap файл уже существует"
fi

# Проверьте
free -h
```

## Шаг 6: Проверьте подключение к PostgreSQL

```bash
# Проверка версии
su - postgres -c "psql -c 'SELECT version();'"

# Проверка текущих настроек
su - postgres -c "psql -c 'SHOW listen_addresses;'"
su - postgres -c "psql -c 'SHOW shared_buffers;'"
su - postgres -c "psql -c 'SHOW max_connections;'"
```

## Шаг 7: Проверьте подключение к базе данных finance_db

```bash
# Подключитесь к базе данных
su - postgres -c "psql -d finance_db -U finance_user"

# Если подключение успешно, выполните:
# SELECT current_database(), current_user;
# \q
```

## Если база данных еще не создана

Если вы еще не создали базу данных и пользователя, выполните:

```bash
su - postgres << 'EOF'
psql << 'SQL'
CREATE USER finance_user WITH PASSWORD 'ваш_надежный_пароль';
CREATE DATABASE finance_db OWNER finance_user;
GRANT ALL PRIVILEGES ON DATABASE finance_db TO finance_user;
\q
SQL
exit
EOF
```

**⚠️ ВАЖНО:** Замените `'ваш_надежный_пароль'` на реальный надежный пароль!

## Проверка всех настроек одной командой

```bash
echo "=== Проверка конфигурации PostgreSQL ==="
echo "Версия: $PG_VERSION"
echo ""
echo "listen_addresses:"
grep "^listen_addresses" /etc/postgresql/$PG_VERSION/main/postgresql.conf
echo ""
echo "shared_buffers:"
grep "^shared_buffers" /etc/postgresql/$PG_VERSION/main/postgresql.conf
echo ""
echo "max_connections:"
grep "^max_connections" /etc/postgresql/$PG_VERSION/main/postgresql.conf
echo ""
echo "Правила pg_hba.conf (последние 3 строки):"
tail -n 3 /etc/postgresql/$PG_VERSION/main/pg_hba.conf
echo ""
echo "Статус PostgreSQL:"
systemctl status postgresql --no-pager | head -n 5
```






