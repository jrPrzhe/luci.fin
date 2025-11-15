# Тестовые учетные данные

## Создание тестового пользователя

### Способ 1: Через скрипт (рекомендуется)

**Windows (CMD):**
```cmd
create-test-user.bat
```

**Windows (PowerShell):**
```powershell
.\create-test-user.ps1
```

### Способ 2: Вручную через Python

```bash
cd backend
call venv\Scripts\activate  # Windows
# или source venv/bin/activate  # Linux/Mac

python create_test_user.py
```

### Способ 3: С кастомными параметрами

```bash
cd backend
call venv\Scripts\activate
python create_test_user.py --email mytest@example.com --password mypassword123 --first-name Иван --last-name Тестов
```

## Стандартные тестовые учетные данные

После выполнения скрипта создается пользователь:

- **Email:** `test@example.com`
- **Password:** `test123456`

## Использование

1. Запустите скрипт создания пользователя
2. Откройте фронтенд (локально или через ngrok)
3. Введите email и пароль на странице входа
4. Нажмите "Войти"

## Примечания

- Если пользователь с таким email уже существует, скрипт покажет информацию о существующем пользователе
- Пароль должен быть не менее 8 символов
- Для создания нескольких тестовых пользователей используйте разные email адреса












