# Исправления авторизации

## Исправленные проблемы

### 1. ✅ Ошибка "Request timeout - сервер не отвечает" при входе через Telegram

**Проблема:**
- Кнопка "Войти через Telegram" вела на несуществующий маршрут `/auth/telegram`
- API URL был неправильно настроен для работы через ngrok

**Исправления:**

1. **Исправлена кнопка "Войти через Telegram"** (`frontend/src/pages/Login.tsx`):
   - Убрана ссылка на несуществующий маршрут
   - Добавлен обработчик `handleTelegramLogin`, который:
     - Проверяет доступность Telegram WebApp
     - Получает `initData` из Telegram
     - Выполняет авторизацию через API
     - Показывает понятные сообщения об ошибках

2. **Исправлен API URL** (`frontend/src/services/api.ts`):
   - Изменена логика определения `API_URL`
   - По умолчанию используется относительный путь (пустая строка)
   - Это позволяет Vite proxy правильно проксировать запросы к бэкенду
   - Для явного указания URL можно использовать переменную окружения `VITE_API_URL`

### 2. ✅ Добавлены тестовые учетные данные

**Что сделано:**

1. Создан скрипт `backend/create_test_user.py` для создания тестового пользователя
2. Созданы скрипты запуска:
   - `create-test-user.bat` (Windows CMD)
   - `create-test-user.ps1` (Windows PowerShell)

**Стандартные учетные данные:**
- **Email:** `test@example.com`
- **Password:** `test123456`

## Как использовать

### Создание тестового пользователя

```bash
# Windows CMD
create-test-user.bat

# Windows PowerShell
.\create-test-user.ps1

# Или вручную
cd backend
call venv\Scripts\activate
python create_test_user.py
```

### Вход через Email+Password

1. Откройте фронтенд (локально или через ngrok)
2. Введите:
   - Email: `test@example.com`
   - Password: `test123456`
3. Нажмите "Войти"

### Вход через Telegram

1. Откройте приложение через Telegram Mini App (не в обычном браузере)
2. На странице входа нажмите "Войти через Telegram"
3. Авторизация выполнится автоматически

## Важные замечания

1. **Telegram авторизация** работает только когда приложение открыто через Telegram Mini App
2. **Vite proxy** проксирует запросы к `/api` на `http://localhost:8000` только если бэкенд запущен на той же машине
3. Если бэкенд недоступен, вы получите ошибку "Request timeout - сервер не отвечает"

## Файлы изменены

- `frontend/src/pages/Login.tsx` - исправлена кнопка Telegram авторизации
- `frontend/src/services/api.ts` - исправлена логика API URL
- `backend/app/schemas/user.py` - исправлена валидация email для поддержки `.local` доменов
- `backend/create_test_user.py` - новый скрипт для создания тестового пользователя
- `create-test-user.bat` - скрипт запуска (Windows CMD)
- `create-test-user.ps1` - скрипт запуска (Windows PowerShell)

## Дополнительные исправления

### Исправлена валидация email для Telegram пользователей

**Проблема:** Pydantic `EmailStr` не принимал email с доменом `.telegram.local`, так как библиотека `email-validator` считает `.local` специальным доменом.

**Решение:**
- Заменена строгая валидация `EmailStr` на кастомную валидацию с регулярным выражением
- Теперь разрешаются `.local` домены для Telegram пользователей (формат: `tg_<id>@telegram.local`)
- Для обычных пользователей также используется базовая проверка формата email

## Документация

- [TEST_CREDENTIALS.md](TEST_CREDENTIALS.md) - подробная инструкция по тестовым учетным данным
- [SIMPLE_START_WITH_NGROK.md](SIMPLE_START_WITH_NGROK.md) - инструкция по запуску с ngrok

