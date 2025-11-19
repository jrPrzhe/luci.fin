# Быстрый запуск нагрузочного теста на Production (Railway)
# Quick Start Script for Production Load Testing

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Нагрузочное тестирование Production" -ForegroundColor Cyan
Write-Host "Railway: lucifin-production.up.railway.app" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Установка Production URL
$env:LOCUST_HOST = "https://lucifin-production.up.railway.app"

Write-Host "Production URL установлен:" -ForegroundColor Green
Write-Host "  $env:LOCUST_HOST" -ForegroundColor Cyan
Write-Host ""

# Проверка доступности
Write-Host "Проверка доступности сервера..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$env:LOCUST_HOST/health" -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Сервер доступен" -ForegroundColor Green
        Write-Host "  Ответ: $($response.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Не удалось подключиться к /health" -ForegroundColor Yellow
    Write-Host "  Попробуем проверить корневой endpoint..." -ForegroundColor Yellow
    try {
        $rootResponse = Invoke-WebRequest -Uri "$env:LOCUST_HOST/" -Method GET -TimeoutSec 10 -UseBasicParsing
        Write-Host "✓ Сервер доступен (корневой endpoint)" -ForegroundColor Green
    } catch {
        Write-Host "✗ Сервер недоступен. Проверьте URL и доступность." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "⚠️  ВНИМАНИЕ: ТЕСТИРОВАНИЕ PRODUCTION ⚠️" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Выберите сценарий тестирования:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Легкая нагрузка (10 пользователей, 5 мин) - РЕКОМЕНДУЕТСЯ" -ForegroundColor Green
Write-Host "  2. Средняя нагрузка (50 пользователей, 10 мин)" -ForegroundColor Yellow
Write-Host "  3. Высокая нагрузка (200 пользователей, 15 мин)" -ForegroundColor Yellow
Write-Host "  4. Стресс-тест (500 пользователей, 20 мин) - ТРЕБУЕТ ОДОБРЕНИЯ" -ForegroundColor Red
Write-Host "  5. Тест на скачок (100 пользователей, 2 мин)" -ForegroundColor Red
Write-Host "  6. Интерактивный режим (веб-интерфейс)" -ForegroundColor Cyan
Write-Host "  0. Отмена" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Введите номер сценария (1-6, 0 для отмены)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Запуск легкого теста..." -ForegroundColor Green
        .\run_tests_prod.ps1 light
    }
    "2" {
        Write-Host ""
        Write-Host "Запуск среднего теста..." -ForegroundColor Yellow
        .\run_tests_prod.ps1 medium
    }
    "3" {
        Write-Host ""
        Write-Host "Запуск высокого теста..." -ForegroundColor Yellow
        $confirm = Read-Host "Вы уверены? (y/N)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            .\run_tests_prod.ps1 high
        } else {
            Write-Host "Тест отменен." -ForegroundColor Gray
        }
    }
    "4" {
        Write-Host ""
        Write-Host "Запуск стресс-теста..." -ForegroundColor Red
        Write-Host "⚠️  ВНИМАНИЕ: Это очень агрессивный тест!" -ForegroundColor Red
        $confirm = Read-Host "Введите 'YES' для подтверждения"
        if ($confirm -eq "YES") {
            .\run_tests_prod.ps1 stress
        } else {
            Write-Host "Тест отменен." -ForegroundColor Gray
        }
    }
    "5" {
        Write-Host ""
        Write-Host "Запуск теста на скачок..." -ForegroundColor Red
        Write-Host "⚠️  ВНИМАНИЕ: Резкий скачок нагрузки!" -ForegroundColor Red
        $confirm = Read-Host "Вы уверены? (y/N)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            .\run_tests_prod.ps1 spike
        } else {
            Write-Host "Тест отменен." -ForegroundColor Gray
        }
    }
    "6" {
        Write-Host ""
        Write-Host "Запуск интерактивного режима..." -ForegroundColor Cyan
        Write-Host "Откройте http://localhost:8089 в браузере" -ForegroundColor Cyan
        Write-Host "⚠️  ВАЖНО: Начинайте с 5-10 пользователей!" -ForegroundColor Yellow
        .\run_tests_prod.ps1 interactive
    }
    "0" {
        Write-Host "Отменено." -ForegroundColor Gray
        exit 0
    }
    default {
        Write-Host "Неверный выбор. Отменено." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Готово!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan





