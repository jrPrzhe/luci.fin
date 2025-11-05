# Команды для быстрого запуска (NGROK + локально)

## 🎯 Упрощенный вариант:
- Фронт → через NGROK (публичный URL)
- Бэк → локально (порт 8000)
- Телеграм → локально

---

## 📝 Команды по порядку запуска

### 1️⃣ Бэкенд (Терминал 1)
```bash
# Windows CMD
cd backend
call venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Windows PowerShell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Или через скрипт:
start-backend-simple.bat      # CMD
.\start-backend-simple.ps1    # PowerShell
```

---

### 2️⃣ Фронтенд (Терминал 2)
```bash
# Windows CMD
cd frontend
npm install
npm run dev

# Windows PowerShell
cd frontend
npm install
npm run dev

# Или через скрипт:
start-frontend.bat      # CMD
.\start-frontend.ps1    # PowerShell
```

---

### 3️⃣ NGROK для фронтенда (Терминал 3)
```bash
# Windows CMD
ngrok http 5173

# Windows PowerShell
ngrok http 5173

# Или через скрипт:
start-ngrok-frontend.bat      # CMD
.\start-ngrok-frontend.ps1    # PowerShell
```

**⚠️ Скопируйте публичный HTTPS URL из ngrok (например: `https://xxxx.ngrok-free.app`)**

---

### 4️⃣ Телеграм бот (Терминал 4)
```bash
# Windows CMD
cd telegram-bot
call venv\Scripts\activate
pip install -r requirements.txt
python bot.py

# Windows PowerShell
cd telegram-bot
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python bot.py

# Или через скрипт:
start-bot.bat      # CMD
.\start-bot.ps1    # PowerShell
```

---

## ✅ Проверка работы

1. **Бэкенд**: http://localhost:8000/docs (Swagger UI)
2. **Фронтенд локально**: http://localhost:5173
3. **Фронтенд через ngrok**: используйте URL из терминала ngrok
4. **Телеграм бот**: отправьте сообщение боту в Telegram

---

## 🔄 Порядок остановки

Нажмите `Ctrl+C` в каждом терминале в обратном порядке:
1. Телеграм бот
2. NGROK
3. Фронтенд
4. Бэкенд




