# Скрипт для деплоя функции уведомления о премиум
cd finance-manager

Write-Host "=== Добавление файлов ===" -ForegroundColor Cyan
git add backend/app/api/v1/admin.py
git add backend/app/services/premium.py
git add telegram-bot/locales/ru.py
git add telegram-bot/locales/en.py

Write-Host "`n=== Создание коммита ===" -ForegroundColor Yellow
git commit -m "Add premium notification feature: send Telegram message when user gets Premium status"

Write-Host "`n=== Отправка в GitHub ===" -ForegroundColor Green
git push origin main

Write-Host "`n=== Готово! ===" -ForegroundColor Green



