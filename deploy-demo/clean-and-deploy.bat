@echo off
chcp 65001 >nul
echo ========================================
echo   ОЧИСТКА И ПЕРЕЗАГРУЗКА РЕПОЗИТОРИЯ
echo ========================================
echo.

cd /d "%~dp0\..\.."

REM Удаляем старый репозиторий
if exist "demo0811" (
    echo Удаляем старую копию репозитория...
    rmdir /s /q "demo0811"
    timeout /t 1 /nobreak >nul
)

REM Клонируем репозиторий
echo Клонируем репозиторий...
git clone https://github.com/jrPrzhe/demo0811.git
if errorlevel 1 (
    echo ОШИБКА: Не удалось клонировать репозиторий!
    pause
    exit /b 1
)

cd demo0811

REM Обновляем репозиторий
echo Обновляем репозиторий...
git fetch origin
git checkout main
git pull origin main

REM Очищаем репозиторий
echo.
echo Очищаем репозиторий...
powershell -Command "Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force"

REM Копируем файлы
echo.
echo Копируем файлы проекта...
copy /Y "..\finance-manager\deploy-demo\index.html" "index.html"
copy /Y "..\finance-manager\deploy-demo\1.png" "1.png"
copy /Y "..\finance-manager\deploy-demo\2.png" "2.png"
copy /Y "..\finance-manager\deploy-demo\3.png" "3.png"
copy /Y "..\finance-manager\deploy-demo\4.png" "4.png"
copy /Y "..\finance-manager\deploy-demo\5.png" "5.png"

REM Проверяем статус
echo.
echo Проверяем изменения...
git status

REM Добавляем файлы
echo.
echo Добавляем файлы в git...
git add -A

REM Создаем коммит
echo.
echo Создаем коммит...
git commit -m "Clean repository and deploy fresh demo with assistant"

REM Пушим изменения
echo.
echo Отправляем изменения на GitHub...
git push origin main --force

if errorlevel 1 (
    echo.
    echo ========================================
    echo   ОШИБКА ПРИ ОТПРАВКЕ!
    echo ========================================
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo   РЕПОЗИТОРИЙ ОЧИЩЕН И ОБНОВЛЕН!
    echo ========================================
    echo.
    echo Демо будет доступно через 1-2 минуты:
    echo https://jrprzhe.github.io/demo0811/
    echo https://demo0811.vercel.app/
    echo.
    echo Файлы в репозитории:
    dir /b
    echo.
)

pause
