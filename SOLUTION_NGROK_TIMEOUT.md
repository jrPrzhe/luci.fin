# Решение: ngrok не получает ответ от backend

## 🔴 Проблема

ngrok показывает: "Waiting to receive a response from your server"

## ✅ Быстрое решение

### Проблема: ngrok туннелирует HTTP, а backend на HTTPS

ngrok по умолчанию использует HTTP. Если backend на HTTPS (порт 8443), нужно указать схему.

### Решение 1: Используйте HTTP backend (РЕКОМЕНДУЕТСЯ)

Для разработки проще использовать HTTP backend:

**Остановите текущий backend (Ctrl+C) и запустите на HTTP:**

```powershell
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Затем перезапустите ngrok:**

```powershell
# Остановите ngrok (Ctrl+C) и запустите заново:
.\ngrok.exe http 8000
```

### Решение 2: Настройте ngrok для HTTPS backend

Если хотите оставить HTTPS backend, используйте:

```powershell
# Остановите текущий ngrok (Ctrl+C)
.\ngrok.exe http https://localhost:8443 --host-header=localhost:8443
```

Или проще:
```powershell
.\ngrok.exe http 8443 --scheme=https
```

## 🎯 Рекомендация

**Используйте HTTP backend для разработки:**

1. **Backend на HTTP (порт 8000):**
   ```powershell
   cd backend
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **ngrok на HTTP:**
   ```powershell
   .\ngrok.exe http 8000
   ```

3. **Telegram Mini App получит HTTPS автоматически** - ngrok предоставляет HTTPS!

## ✅ Проверка

После перезапуска:

1. Проверьте backend: http://localhost:8000/health
2. Проверьте через ngrok: https://xxxx-xx-xxx-xxx-xx.ngrok-free.app/health
3. Оба должны вернуть: `{"status": "healthy"}`

## 📝 Обновленные скрипты

Скрипты `start-ngrok.bat` и `start-ngrok.ps1` обновлены для работы с HTTPS backend.

Но для разработки лучше использовать HTTP backend!

