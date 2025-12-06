# Скрипт для проверки и отправки изменений в GitHub
cd finance-manager

Write-Host "=== Проверка статуса Git ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Последние коммиты ===" -ForegroundColor Cyan
git log --oneline -3

Write-Host "`n=== Незапушенные коммиты ===" -ForegroundColor Cyan
git log origin/main..HEAD --oneline

Write-Host "`n=== Проверка изменений в bot.py ===" -ForegroundColor Cyan
git diff HEAD telegram-bot/bot.py | Select-String -Pattern "force_refresh|timeout=60" -Context 2

Write-Host "`n=== Добавление и коммит изменений ===" -ForegroundColor Yellow
git add telegram-bot/bot.py
git commit -m "Fix goal command: remove force_refresh parameter, increase timeout to 60s, add error handling"

Write-Host "`n=== Отправка в GitHub ===" -ForegroundColor Green
git push origin main

Write-Host "`n=== Готово! ===" -ForegroundColor Green






