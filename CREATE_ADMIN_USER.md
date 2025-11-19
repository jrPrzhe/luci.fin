# 🔐 Создание пользователя-администратора через Email

## Вариант 1: Создать тестового пользователя и сделать его админом

### Через Railway CLI:

```bash
# 1. Создать тестового пользователя
railway run python backend/create_test_user.py --email admin@example.com --password admin123456

# 2. Сделать его админом через SQL (если есть доступ к БД)
# Или обновить через скрипт (см. ниже)
```

### Через скрипт (локально, если есть доступ к БД):

```bash
cd backend
python create_test_user.py --email admin@example.com --password admin123456 --first-name Admin --last-name User
```

## Вариант 2: Создать админа напрямую через скрипт

Создайте файл `backend/create_admin_user.py`:

```python
#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User

db = SessionLocal()

try:
    email = "admin@example.com"
    password = "admin123456"
    
    # Проверяем существование
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"Пользователь {email} уже существует!")
        existing.is_admin = True
        db.commit()
        print(f"Статус админа обновлен для {email}")
    else:
        # Создаем нового админа
        user = User(
            email=email,
            username="admin",
            first_name="Admin",
            last_name="User",
            hashed_password=get_password_hash(password),
            is_active=True,
            is_verified=True,
            is_admin=True,  # Сразу делаем админом
            default_currency="RUB",
            timezone="Europe/Moscow",
            language="ru"
        )
        db.add(user)
        db.commit()
        print(f"✅ Админ создан: {email} / {password}")
finally:
    db.close()
```

Запуск:
```bash
railway run python backend/create_admin_user.py
```

## Вариант 3: Обновить существующего пользователя через SQL

Если у вас есть доступ к базе данных Railway:

```sql
-- Найти пользователя
SELECT id, email, is_admin FROM users WHERE email = 'test@example.com';

-- Сделать его админом
UPDATE users SET is_admin = 1 WHERE email = 'test@example.com';
```

## Вариант 4: Использовать стандартного тестового пользователя

Если тестовый пользователь уже создан:

1. **Создайте его (если еще не создан):**
   ```bash
   railway run python backend/create_test_user.py
   ```

2. **Сделайте его админом через SQL или скрипт**

## 📋 Стандартные учетные данные (после создания)

- **Email:** `test@example.com`
- **Password:** `test123456`

## ⚠️ Важно

- Пользователи, созданные через email/password, **НЕ** получают автоматически статус админа из `ADMIN_TELEGRAM_IDS`
- `ADMIN_TELEGRAM_IDS` работает только для Telegram пользователей
- Для email-пользователей нужно вручную установить `is_admin = True` в базе данных












