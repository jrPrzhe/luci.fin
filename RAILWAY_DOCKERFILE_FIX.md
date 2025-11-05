# Исправление ошибки: "no such file or directory" для Dockerfile

## 🐛 Проблема

Railway не может найти Dockerfile:
```
failed to read dockerfile: open /backend/Dockerfile: no such file or directory
```

## ✅ Решение

### Вариант 1: Убедитесь что Root Directory установлен правильно

1. **В Railway Settings → Source:**
   - Убедитесь что **Root Directory** установлен в `backend`
   - Если Root Directory установлен в `backend`, Railway должен искать Dockerfile в `backend/Dockerfile` относительно корня репозитория

2. **Проверьте структуру репозитория:**
   ```
   luci.fin/
   └── backend/
       ├── Dockerfile  ← должен быть здесь
       ├── railway.json
       ├── requirements.txt
       └── app/
   ```

### Вариант 2: Обновите railway.json

Файл `railway.json` уже обновлен с явным указанием пути к Dockerfile:
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  }
}
```

### Вариант 3: Если Root Directory не установлен

Если Root Directory не установлен или установлен в корень проекта:

1. **Установите Root Directory:**
   - Settings → Source → Root Directory: `backend`

2. **Или переместите Dockerfile в корень (не рекомендуется):**
   - Это потребует изменения структуры проекта

## 🔍 Проверка

1. **Убедитесь что Dockerfile существует:**
   ```bash
   ls backend/Dockerfile
   ```

2. **Проверьте что файл в git:**
   ```bash
   git ls-files backend/Dockerfile
   ```

3. **Убедитесь что Root Directory установлен:**
   - В Railway Settings → Source → Root Directory должен быть `backend`

## 📝 После исправления

1. Добавьте изменения в git:
   ```bash
   git add backend/railway.json
   git commit -m "Fix Dockerfile path in railway.json"
   git push origin main
   ```

2. Railway автоматически перезапустит деплой
3. Проверьте логи - сборка должна найти Dockerfile

## ⚠️ Важно

- Root Directory должен быть `backend`
- Dockerfile должен быть в `backend/Dockerfile`
- `railway.json` должен быть в `backend/railway.json`

