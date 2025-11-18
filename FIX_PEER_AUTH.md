# Исправление ошибки "Peer authentication failed"

Ошибка возникает потому, что при подключении от пользователя `postgres` через `su`, PostgreSQL использует peer authentication (по имени пользователя системы), а не пароль.

## Решение 1: Подключение от postgres без указания пользователя

```bash
# Переключитесь на пользователя postgres
su - postgres

# Подключитесь к базе данных (без -U, использует текущего пользователя postgres)
psql -d finance_db

# Или просто
psql finance_db

# В консоли PostgreSQL выполните:
SELECT current_database(), current_user;
\q

# Выйдите из сессии postgres
exit
```

## Решение 2: Подключение с указанием хоста (принудительно использует пароль)

```bash
# Подключение с указанием хоста (заставит использовать пароль)
su - postgres -c "psql -h localhost -d finance_db -U finance_user -c 'SELECT current_database(), current_user;'"
```

## Решение 3: Проверка через пользователя postgres

```bash
# Переключитесь на postgres
su - postgres

# Подключитесь как postgres
psql

# В консоли PostgreSQL проверьте пользователей и базы данных
\du
\l

# Проверьте подключение к базе finance_db
\c finance_db

# Проверьте текущего пользователя
SELECT current_database(), current_user;

# Выйдите
\q
exit
```

## Решение 4: Проверка правил аутентификации в pg_hba.conf

Убедитесь, что в `/etc/postgresql/$PG_VERSION/main/pg_hba.conf` есть правильные правила:

```bash
# Просмотр правил аутентификации
cat /etc/postgresql/$PG_VERSION/main/pg_hba.conf | grep -v "^#" | grep -v "^$"
```

Должны быть строки:
- Для локальных подключений: `local   all   all   peer` или `local   all   all   md5`
- Для удаленных подключений: `host    finance_db    finance_user    0.0.0.0/0    md5`

## Рекомендуемый способ проверки

```bash
# Переключитесь на postgres
su - postgres

# Проверьте список пользователей
psql -c "\du"

# Проверьте список баз данных
psql -c "\l"

# Подключитесь к базе finance_db (как postgres)
psql finance_db

# В консоли PostgreSQL:
SELECT current_database(), current_user;

# Проверьте подключение от имени finance_user (с паролем)
\c finance_db finance_user
# Введите пароль, который вы установили

# Выйдите
\q
exit
```











