# Скрипт для отправки исправления bot.py
cd finance-manager

Write-Host "=== Проверка изменений в bot.py ===" -ForegroundColor Cyan
$content = Get-Content telegram-bot/bot.py -Raw
if ($content -match "parse_mode=None") {
    Write-Host "✓ Изменения найдены в файле" -ForegroundColor Green
} else {
    Write-Host "✗ Изменения НЕ найдены в файле!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Статус Git ===" -ForegroundColor Cyan
git status telegram-bot/bot.py

Write-Host "`n=== Добавление файла ===" -ForegroundColor Yellow
git add telegram-bot/bot.py

Write-Host "`n=== Проверка staged изменений ===" -ForegroundColor Cyan
$diff = git diff --cached telegram-bot/bot.py
if ($diff -match "parse_mode") {
    Write-Host "✓ Изменения добавлены в staging" -ForegroundColor Green
    Write-Host $diff | Select-String -Pattern "parse_mode" -Context 2
} else {
    Write-Host "✗ Изменения не найдены в staging!" -ForegroundColor Red
    Write-Host "Проверяю diff с HEAD..."
    git diff HEAD telegram-bot/bot.py | Select-String -Pattern "parse_mode" -Context 2
}

Write-Host "`n=== Создание коммита ===" -ForegroundColor Yellow
git commit -m "Fix: Remove Markdown parsing from goal roadmap (parse_mode=None)"

Write-Host "`n=== Отправка в GitHub ===" -ForegroundColor Green
git push origin main

Write-Host "`n=== Проверка последнего коммита ===" -ForegroundColor Cyan
git log --oneline -1

Write-Host "`n=== Готово! ===" -ForegroundColor Green























