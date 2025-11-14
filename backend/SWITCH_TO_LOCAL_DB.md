# Переключение на локальную SQLite базу данных

## Значение DATABASE_URL для локальной БД

```
DATABASE_URL=sqlite:///./finance.db
```

## Как переключиться

### Вариант 1: Создать/обновить файл .env

Создайте файл `.env` в директории `backend/` со следующим содержимым:

```env
# База данных - локальная SQLite
DATABASE_URL=sqlite:///./finance.db

# Безопасность (для локальной разработки)
SECRET_KEY=dev-secret-key-change-in-production-please-use-random-string

# CORS - адреса фронтенда
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### Вариант 2: Удалить переменную DATABASE_URL

Если вы удалите переменную `DATABASE_URL` из `.env` или переменных окружения, будет использовано значение по умолчанию из `config.py`:
```python
DATABASE_URL: str = "sqlite:///./finance.db"
```

## Проверка

После переключения:

1. **Перезапустите backend сервер**
2. **Проверьте, что файл `finance.db` создался** в директории `backend/`
3. **Попробуйте авторизоваться** - должно работать с локальной БД

## Важно

- Файл `finance.db` будет создан автоматически при первом запуске
- Все данные будут храниться локально в этом файле
- При удалении файла `finance.db` все данные будут потеряны
- Для продакшена рекомендуется использовать PostgreSQL



