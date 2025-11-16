# Мониторинг логов PostgreSQL в реальном времени

Инструкция по просмотру логов базы данных PostgreSQL на сервере 195.43.142.121.

## Способ 1: Просмотр логов PostgreSQL через SSH

### Подключение к серверу

```bash
ssh root@195.43.142.121
```

### Просмотр логов в реальном времени

```bash
# Определите версию PostgreSQL
PG_VERSION=$(ls /etc/postgresql/ | head -n 1)

# Просмотр логов в реальном времени (tail -f)
tail -f /var/log/postgresql/postgresql-$PG_VERSION-main.log

# Или если логи в другом месте
tail -f /var/log/postgresql/postgresql-13-main.log
```

### Просмотр последних записей

```bash
# Последние 100 строк
tail -n 100 /var/log/postgresql/postgresql-$PG_VERSION-main.log

# Последние 50 строк с фильтрацией ошибок
tail -n 50 /var/log/postgresql/postgresql-$PG_VERSION-main.log | grep -i error

# Поиск ошибок
grep -i error /var/log/postgresql/postgresql-$PG_VERSION-main.log | tail -n 20
```

## Способ 2: Через journalctl (systemd)

Если PostgreSQL работает через systemd:

```bash
# Логи в реальном времени
journalctl -u postgresql -f

# Последние 100 записей
journalctl -u postgresql -n 100

# Логи с фильтрацией по ошибкам
journalctl -u postgresql -p err -n 50

# Логи за последний час
journalctl -u postgresql --since "1 hour ago"
```

## Способ 3: Прямой мониторинг через psql

### Подключение к БД

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db
```

### Включение логирования запросов в сессии

```sql
-- Включить логирование всех запросов
SET log_statement = 'all';

-- Или только медленных запросов (> 1 секунда)
SET log_min_duration_statement = 1000;

-- Просмотр активных подключений
SELECT * FROM pg_stat_activity;

-- Просмотр последних запросов (если включен pg_stat_statements)
SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

## Способ 4: Мониторинг через pg_stat_activity

### Просмотр активных подключений и запросов

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db -c "
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    state_change,
    wait_event_type,
    wait_event,
    query
FROM pg_stat_activity 
WHERE datname = 'finance_db'
ORDER BY query_start DESC;
"
```

### Мониторинг в реальном времени (цикл)

```bash
# Обновление каждые 2 секунды
watch -n 2 "psql -h 195.43.142.121 -U finance_user -d finance_db -c \"SELECT pid, usename, state, query FROM pg_stat_activity WHERE datname = 'finance_db' AND state = 'active';\""
```

## Способ 5: Настройка детального логирования

### Редактирование postgresql.conf

```bash
# На сервере
PG_VERSION=$(ls /etc/postgresql/ | head -n 1)
sudo nano /etc/postgresql/$PG_VERSION/main/postgresql.conf
```

Добавьте или измените:

```ini
# Логирование всех запросов
log_statement = 'all'

# Или только медленных (> 1 секунда)
log_min_duration_statement = 1000

# Логирование подключений
log_connections = on
log_disconnections = on

# Логирование ошибок
log_min_messages = warning

# Формат логов
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

Перезапустите PostgreSQL:

```bash
sudo systemctl restart postgresql
```

## Способ 6: Мониторинг через Python скрипт

Создайте скрипт для мониторинга:

```python
# monitor_db.py
import psycopg2
import time
from datetime import datetime

conn = psycopg2.connect(
    host="195.43.142.121",
    user="finance_user",
    password="ваш_пароль",
    database="finance_db"
)

cursor = conn.cursor()

while True:
    cursor.execute("""
        SELECT 
            pid,
            usename,
            state,
            query_start,
            query
        FROM pg_stat_activity 
        WHERE datname = 'finance_db' 
        AND state = 'active'
        ORDER BY query_start DESC;
    """)
    
    print(f"\n{'='*60}")
    print(f"Time: {datetime.now()}")
    print(f"{'='*60}")
    
    for row in cursor.fetchall():
        print(f"PID: {row[0]}, User: {row[1]}, State: {row[2]}")
        print(f"Query: {row[4][:100]}...")
        print("-" * 60)
    
    time.sleep(2)
```

Запуск:

```bash
python monitor_db.py
```

## Способ 7: Мониторинг через pgAdmin или DBeaver

Если используете GUI инструменты:

1. **pgAdmin**: 
   - Подключитесь к серверу
   - Server → Logs → View Logs

2. **DBeaver**:
   - Подключитесь к БД
   - Database → Monitor → Activity Monitor

## Полезные команды для мониторинга

### Проверка размера БД

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db -c "
SELECT 
    pg_size_pretty(pg_database_size('finance_db')) as database_size;
"
```

### Проверка количества подключений

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db -c "
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE datname = 'finance_db';
"
```

### Проверка блокировок

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db -c "
SELECT * FROM pg_locks WHERE NOT granted;
"
```

### Проверка медленных запросов (если включен pg_stat_statements)

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db -c "
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
"
```

## Быстрый старт

Для быстрого мониторинга выполните:

```bash
# 1. Подключитесь к серверу
ssh root@195.43.142.121

# 2. Определите версию PostgreSQL
PG_VERSION=$(ls /etc/postgresql/ | head -n 1)

# 3. Смотрите логи в реальном времени
tail -f /var/log/postgresql/postgresql-$PG_VERSION-main.log
```

Или через systemd:

```bash
journalctl -u postgresql -f
```

## Фильтрация логов

### Только ошибки

```bash
tail -f /var/log/postgresql/postgresql-$PG_VERSION-main.log | grep -i error
```

### Только подключения

```bash
tail -f /var/log/postgresql/postgresql-$PG_VERSION-main.log | grep -i connection
```

### Только запросы

```bash
tail -f /var/log/postgresql/postgresql-$PG_VERSION-main.log | grep -i "statement:"
```

## Мониторинг производительности

### Использование памяти

```bash
ps aux | grep postgres
```

### Использование диска

```bash
df -h
du -sh /var/lib/postgresql/
```

### Активные транзакции

```bash
psql -h 195.43.142.121 -U finance_user -d finance_db -c "
SELECT * FROM pg_stat_activity WHERE state = 'active';
"
```







