# Решение проблем с ngrok

## Проблема: Страница проверки ngrok

При переходе на ngrok URL может появиться страница с предупреждением или требованием регистрации.

## ✅ Решения

### Вариант 1: Пропустить страницу проверки (для разработки)

Добавьте header в запросы от ngrok. Обновите `backend/app/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class NgrokBypassMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Bypass ngrok browser warning
        response.headers["ngrok-skip-browser-warning"] = "true"
        return response

app.add_middleware(NgrokBypassMiddleware)
```

### Вариант 2: Использовать ngrok с опцией

При запуске ngrok добавьте опцию:
```bash
ngrok http 8443 --host-header=rewrite
```

### Вариант 3: Зарегистрироваться в ngrok (рекомендуется)

1. Зарегистрируйтесь на https://ngrok.com (бесплатно)
2. Получите authtoken
3. Настройте: `ngrok config add-authtoken YOUR_TOKEN`

Это уберет страницу проверки.

## 🔧 Проверка работы

### 1. Проверьте backend напрямую:
```
https://localhost:8443/health
```
Должно вернуть: `{"status": "healthy"}`

### 2. Проверьте через ngrok:
```
https://galleylike-nydia-however.ngrok-free.dev/health
```

Если видите страницу проверки - нажмите кнопку "Visit Site" или добавьте middleware (см. выше).

## 📱 Для Telegram Mini App

Telegram Mini App обычно обходит страницу проверки ngrok автоматически, так как запросы идут от Telegram, а не из браузера.

## ⚠️ Важно

- Backend должен быть доступен на `https://localhost:8443`
- ngrok туннель должен быть активен
- URL в настройках Mini App должен начинаться с `https://`

