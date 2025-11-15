# Исправление ошибки: переменная PG_VERSION пуста

Если вы получили ошибку:
```
sed: can't read /etc/postgresql//main/postgresql.conf: No such file or directory
```

Это означает, что переменная `$PG_VERSION` не определена.

## Решение

### Шаг 1: Определите версию PostgreSQL

```bash
# Проверьте, какие версии PostgreSQL установлены
ls /etc/postgresql/

# Или проверьте версию через psql
su - postgres -c "psql -c 'SELECT version();'"

# Или через dpkg
dpkg -l | grep postgresql | grep server
```

### Шаг 2: Установите переменную PG_VERSION

После того как узнаете версию (например, `13` или `14`), выполните:

```bash
# Для версии 13
PG_VERSION=13

# Или автоматически (берет первую найденную версию)
PG_VERSION=$(ls /etc/postgresql/ | head -n 1)

# Проверьте значение
echo "Версия PostgreSQL: $PG_VERSION"
```

### Шаг 3: Выполните команды с определенной версией

```bash
# Убедитесь, что PG_VERSION установлена
echo $PG_VERSION

# Если пусто, установите вручную
PG_VERSION=$(ls /etc/postgresql/ | head -n 1)

# Теперь выполните команды
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/$PG_VERSION/main/postgresql.conf
```

## Полный скрипт с проверкой

```bash
# 1. Определение версии PostgreSQL
PG_VERSION=$(ls /etc/postgresql/ 2>/dev/null | head -n 1)

# Проверка, что версия найдена
if [ -z "$PG_VERSION" ]; then
    echo "ОШИБКА: PostgreSQL не найден или не установлен!"
    echo "Проверьте установку: systemctl status postgresql"
    exit 1
fi

echo "Найдена версия PostgreSQL: $PG_VERSION"

# 2. Проверка существования файла конфигурации
if [ ! -f "/etc/postgresql/$PG_VERSION/main/postgresql.conf" ]; then
    echo "ОШИБКА: Файл конфигурации не найден!"
    echo "Путь: /etc/postgresql/$PG_VERSION/main/postgresql.conf"
    echo "Проверьте установку PostgreSQL"
    exit 1
fi

# 3. Настройка удаленного доступа
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/$PG_VERSION/main/postgresql.conf

# 4. Проверка изменений
grep "listen_addresses" /etc/postgresql/$PG_VERSION/main/postgresql.conf

# 5. Добавление правила в pg_hba.conf
echo "host    finance_db    finance_user    0.0.0.0/0    md5" >> /etc/postgresql/$PG_VERSION/main/pg_hba.conf

# 6. Оптимизация для сервера с 0.5ГБ RAM
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

# 7. Перезапуск PostgreSQL
systemctl restart postgresql

# 8. Проверка статуса
systemctl status postgresql
```






