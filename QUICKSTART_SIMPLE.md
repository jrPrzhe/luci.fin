# Быстрый старт БЕЗ PostgreSQL и Redis

Самая простая инструкция для запуска проекта с SQLite (не требует установки дополнительных сервисов).

## ⚡ Быстрый запуск

### 1. Создайте `.env` файл в корне проекта:

```env
SECRET_KEY=your-random-secret-key-here
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

**Остальные настройки имеют значения по умолчанию!**

### 2. Backend (Терминал 1):

```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows PowerShell (если ошибка - см. ACTIVATE_VENV.md)
# или для CMD: venv\Scripts\activate.bat
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

✅ Backend: http://localhost:8000

### 3. Frontend (Терминал 2):

```bash
cd frontend
npm install
npm run dev
```

✅ Frontend: http://localhost:5173

### 4. Telegram Bot (Терминал 3):

```bash
cd telegram-bot
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python bot.py
```

✅ Бот работает в Telegram

## 🎉 Готово!

База данных SQLite создастся автоматически в `backend/finance.db`

**Подробная инструкция:** [LOCAL_SETUP_SIMPLE.md](LOCAL_SETUP_SIMPLE.md)

