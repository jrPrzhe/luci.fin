# Скрипт для полной очистки и перезагрузки репозитория
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ОЧИСТКА И ПЕРЕЗАГРУЗКА РЕПОЗИТОРИЯ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Переходим в корень проекта
$rootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $rootDir
Write-Host "📂 Рабочая директория: $rootDir" -ForegroundColor Gray

# Путь к репозиторию
$repoPath = Join-Path $rootDir "demo0811"
$repoUrl = "https://github.com/jrPrzhe/demo0811.git"

# Удаляем старый репозиторий если существует
if (Test-Path $repoPath) {
    Write-Host "🗑️  Удаляем старую копию репозитория..." -ForegroundColor Yellow
    Remove-Item -Path $repoPath -Recurse -Force
    Start-Sleep -Seconds 1
}

# Клонируем репозиторий заново
Write-Host "📥 Клонируем репозиторий..." -ForegroundColor Yellow
git clone $repoUrl $repoPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Ошибка при клонировании репозитория!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Репозиторий клонирован" -ForegroundColor Green

# Переходим в репозиторий
Set-Location $repoPath

# Обновляем репозиторий
Write-Host "🔄 Обновляем репозиторий..." -ForegroundColor Yellow
git fetch origin
git checkout main
git pull origin main
Write-Host "✅ Репозиторий обновлен" -ForegroundColor Green

# Очищаем репозиторий (удаляем все файлы кроме .git)
Write-Host ""
Write-Host "🧹 Очищаем репозиторий..." -ForegroundColor Yellow
$itemsToRemove = Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' }
if ($itemsToRemove) {
    $itemsToRemove | Remove-Item -Recurse -Force
    Write-Host "✅ Удалено файлов: $($itemsToRemove.Count)" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Репозиторий уже пуст" -ForegroundColor Gray
}

# Копируем только необходимые файлы
Write-Host ""
Write-Host "📋 Копируем файлы проекта..." -ForegroundColor Yellow
$deployDir = Join-Path $rootDir "finance-manager\deploy-demo"

$filesToCopy = @(
    @{Source = "index.html"; Dest = "index.html"},
    @{Source = "1.png"; Dest = "1.png"},
    @{Source = "2.png"; Dest = "2.png"},
    @{Source = "3.png"; Dest = "3.png"},
    @{Source = "4.png"; Dest = "4.png"},
    @{Source = "5.png"; Dest = "5.png"}
)

foreach ($file in $filesToCopy) {
    $sourcePath = Join-Path $deployDir $file.Source
    $destPath = $file.Dest
    
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $destPath -Force
        Write-Host "  ✓ $($file.Dest)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ Файл не найден: $($file.Source)" -ForegroundColor Yellow
    }
}

Write-Host "✅ Файлы скопированы" -ForegroundColor Green

# Проверяем статус
Write-Host ""
Write-Host "📊 Проверяем изменения..." -ForegroundColor Yellow
git status --short

# Добавляем все файлы
Write-Host ""
Write-Host "➕ Добавляем файлы в git..." -ForegroundColor Yellow
git add -A
$addedFiles = (git status --short | Measure-Object -Line).Lines
Write-Host "✅ Добавлено файлов: $addedFiles" -ForegroundColor Green

# Создаем коммит
Write-Host ""
Write-Host "💾 Создаем коммит..." -ForegroundColor Yellow
$commitMessage = "Clean repository and deploy fresh demo with assistant"
git commit -m $commitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Нет изменений для коммита или коммит уже существует" -ForegroundColor Yellow
} else {
    Write-Host "✅ Коммит создан" -ForegroundColor Green
}

# Пушим изменения
Write-Host ""
Write-Host "🚀 Отправляем изменения на GitHub..." -ForegroundColor Yellow
git push origin main --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ РЕПОЗИТОРИЙ ОЧИЩЕН И ОБНОВЛЕН!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Демо будет доступно через 1-2 минуты:" -ForegroundColor Cyan
    Write-Host "   https://jrprzhe.github.io/demo0811/" -ForegroundColor White
    Write-Host "   https://demo0811.vercel.app/" -ForegroundColor White
    Write-Host ""
    Write-Host "📁 Файлы в репозитории:" -ForegroundColor Cyan
    Get-ChildItem -File | ForEach-Object { Write-Host "   - $($_.Name)" -ForegroundColor Gray }
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Ошибка при отправке изменений!" -ForegroundColor Red
    Write-Host "Проверьте подключение к интернету и права доступа к репозиторию" -ForegroundColor Yellow
    exit 1
}






