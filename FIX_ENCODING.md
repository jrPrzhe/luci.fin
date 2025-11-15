# Исправление проблемы с кодировкой UTF-8

## Проблема

Ошибка при создании категорий с русскими названиями:
```
UnicodeEncodeError: 'ascii' codec can't encode characters in position 0-7: ordinal not in range(128)
```

## Решение

Исправлены два места:

### 1. Настройка подключения к БД (`app/core/database.py`)

Добавлена явная установка UTF-8 кодировки:

```python
connect_args={
    "connect_timeout": 10,
    "client_encoding": "utf8"  # Явно указываем UTF-8 кодировку
}
```

### 2. Создание категорий (`app/api/v1/auth.py`)

Изменено:
- Использование `add_all()` вместо `bulk_save_objects()` для лучшей поддержки UTF-8
- Явное кодирование строк в UTF-8 перед созданием объектов

```python
# Убеждаемся, что строки правильно кодированы в UTF-8
name = str(cat_data["name"]).encode('utf-8').decode('utf-8')
icon = str(cat_data["icon"]).encode('utf-8').decode('utf-8')

# Используем add_all вместо bulk_save_objects
db.add_all(categories)
```

## Деплой исправления

1. Закоммитьте изменения:
   ```bash
   git add backend/app/core/database.py backend/app/api/v1/auth.py
   git commit -m "Fix UTF-8 encoding issue for default categories"
   git push
   ```

2. Railway автоматически задеплоит изменения

3. Проверьте логи после деплоя - ошибка должна исчезнуть

## Проверка на сервере БД

Убедитесь, что база данных использует UTF-8:

```sql
-- Проверка кодировки базы данных
SHOW server_encoding;

-- Должно быть: UTF8
```

Если не UTF8, измените кодировку базы данных (требует пересоздания):

```sql
-- Создайте новую БД с UTF-8
CREATE DATABASE finance_db_new 
    WITH ENCODING 'UTF8' 
    LC_COLLATE='en_US.UTF-8' 
    LC_CTYPE='en_US.UTF-8' 
    TEMPLATE template0;

-- Мигрируйте данные
-- Затем переключите DATABASE_URL на новую БД
```

## Альтернативное решение (если проблема сохраняется)

Если проблема все еще возникает, можно временно использовать английские названия категорий или установить переменную окружения:

```bash
export PGCLIENTENCODING=UTF8
```

Но это должно быть исправлено в коде, как описано выше.






