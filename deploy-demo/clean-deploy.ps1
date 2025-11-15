# Скрипт для очистки и перезагрузки репозитория
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ОЧИСТКА И ПЕРЕЗАГРУЗКА РЕПОЗИТОРИЯ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Переходим в корень проекта
$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $rootDir

# Путь к репозиторию
$repoPath = Join-Path $rootDir "demo0811"

# Клонируем репозиторий (если не существует)
if (-not (Test-Path $repoPath)) {
    Write-Host "📥 Клонируем репозиторий..." -ForegroundColor Yellow
    git clone https://github.com/jrPrzhe/demo0811.git $repoPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка при клонировании репозитория!" -ForegroundColor Red
        exit 1
    }
}

# Переходим в репозиторий
Set-Location $repoPath

# Обновляем репозиторий
Write-Host "🔄 Обновляем репозиторий..." -ForegroundColor Yellow
git fetch origin
git checkout main
git pull origin main

# Очищаем репозиторий (удаляем все файлы кроме .git)
Write-Host ""
Write-Host "🧹 Очищаем репозиторий..." -ForegroundColor Yellow
Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
Write-Host "✅ Репозиторий очищен" -ForegroundColor Green

# Копируем только необходимые файлы
Write-Host ""
Write-Host "📋 Копируем файлы проекта..." -ForegroundColor Yellow
$deployDir = Join-Path $rootDir "finance-manager\deploy-demo"

Copy-Item (Join-Path $deployDir "index.html") -Destination "index.html" -Force
Copy-Item (Join-Path $deployDir "1.png") -Destination "1.png" -Force
Copy-Item (Join-Path $deployDir "2.png") -Destination "2.png" -Force
Copy-Item (Join-Path $deployDir "3.png") -Destination "3.png" -Force
Copy-Item (Join-Path $deployDir "4.png") -Destination "4.png" -Force
Copy-Item (Join-Path $deployDir "5.png") -Destination "5.png" -Force

Write-Host "✅ Файлы скопированы" -ForegroundColor Green

# Проверяем статус
Write-Host ""
Write-Host "📊 Проверяем изменения..." -ForegroundColor Yellow
git status

# Добавляем все файлы
Write-Host ""
Write-Host "➕ Добавляем файлы в git..." -ForegroundColor Yellow
git add -A

# Создаем коммит
Write-Host ""
Write-Host "💾 Создаем коммит..." -ForegroundColor Yellow
$commitMessage = "Clean repository and deploy fresh demo with assistant"
git commit -m $commitMessage

# Пушим изменения
Write-Host ""
Write-Host "🚀 Отправляем изменения на GitHub..." -ForegroundColor Yellow
git push origin main --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  РЕПОЗИТОРИЙ ОЧИЩЕН И ОБНОВЛЕН!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Демо будет доступно через 1-2 минуты:" -ForegroundColor Cyan
    Write-Host "   https://jrprzhe.github.io/demo0811/" -ForegroundColor Cyan
    Write-Host "   https://demo0811.vercel.app/" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Ошибка при отправке изменений!" -ForegroundColor Red
    exit 1
}





