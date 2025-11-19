# Скрипт для деплоя демо на GitHub Pages
# Запустите этот скрипт в PowerShell

Write-Host "🚀 Начинаем деплой демо на GitHub Pages..." -ForegroundColor Green

# Переходим в корень проекта
$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

# Путь к репозиторию
$repoPath = Join-Path $rootDir "demo0811"

# Если репозиторий не существует, клонируем его
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

# Обновляем ветку
Write-Host "🔄 Обновляем репозиторий..." -ForegroundColor Yellow
git fetch origin
git checkout main
git pull origin main

# Копируем файлы из deploy-demo
Write-Host "📋 Копируем файлы..." -ForegroundColor Yellow
$deployDir = Join-Path $rootDir "finance-manager\deploy-demo"

# Копируем index.html
Copy-Item (Join-Path $deployDir "index.html") -Destination "index.html" -Force

# Копируем изображения (если они в корне deploy-demo)
if (Test-Path (Join-Path $deployDir "1.png")) {
    Copy-Item (Join-Path $deployDir "1.png") -Destination "1.png" -Force
    Copy-Item (Join-Path $deployDir "2.png") -Destination "2.png" -Force
    Copy-Item (Join-Path $deployDir "3.png") -Destination "3.png" -Force
    Copy-Item (Join-Path $deployDir "4.png") -Destination "4.png" -Force
    Copy-Item (Join-Path $deployDir "5.png") -Destination "5.png" -Force
    Write-Host "✅ Изображения скопированы" -ForegroundColor Green
}

# Проверяем статус
Write-Host "📊 Проверяем изменения..." -ForegroundColor Yellow
git status

# Добавляем файлы
Write-Host "➕ Добавляем файлы в git..." -ForegroundColor Yellow
git add .

# Создаем коммит
Write-Host "💾 Создаем коммит..." -ForegroundColor Yellow
$commitMessage = "Update demo: add assistant on each screen with different positions"
git commit -m $commitMessage

# Пушим изменения
Write-Host "🚀 Отправляем изменения на GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Деплой завершен успешно!" -ForegroundColor Green
    Write-Host "🌐 Демо будет доступно через несколько минут на:" -ForegroundColor Cyan
    Write-Host "   https://jrprzhe.github.io/demo0811/" -ForegroundColor Cyan
} else {
    Write-Host "❌ Ошибка при отправке изменений!" -ForegroundColor Red
    exit 1
}











