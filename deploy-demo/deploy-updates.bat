@echo off
chcp 65001 >nul
echo ========================================
echo   ДЕПЛОЙ ОБНОВЛЕНИЙ
echo ========================================
echo.

cd /d "%~dp0\..\.."

REM Копируем обновленный файл
echo Копируем обновленный index.html...
copy /Y "finance-manager\demo.html" "finance-manager\deploy-demo\index.html"
if errorlevel 1 (
    echo ОШИБКА: Не удалось скопировать файл!
    pause
    exit /b 1
)
echo ✅ Файл скопирован

REM Переходим в репозиторий
if not exist "demo0811" (
    echo Клонируем репозиторий...
    git clone https://github.com/jrPrzhe/demo0811.git
    if errorlevel 1 (
        echo ОШИБКА: Не удалось клонировать репозиторий!
        pause
        exit /b 1
    )
)

cd demo0811

REM Обновляем репозиторий
echo Обновляем репозиторий...
git fetch origin
git checkout main
git pull origin main

REM Копируем обновленный файл
echo.
echo Копируем index.html в репозиторий...
copy /Y "..\finance-manager\deploy-demo\index.html" "index.html"
if errorlevel 1 (
    echo ОШИБКА: Не удалось скопировать файл!
    pause
    exit /b 1
)
echo ✅ Файл скопирован

REM Проверяем статус
echo.
echo Проверяем изменения...
git status

REM Добавляем файлы
echo.
echo Добавляем файлы в git...
git add index.html

REM Создаем коммит
echo.
echo Создаем коммит...
git commit -m "Update demo: add expense categories chart, AI analytics recommendations, and improved assistant animation"

REM Пушим изменения
echo.
echo Отправляем изменения на GitHub...
git push origin main

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
    echo   ДЕПЛОЙ ЗАВЕРШЕН УСПЕШНО!
    echo ========================================
    echo.
    echo Демо будет доступно через 1-2 минуты:
    echo https://jrprzhe.github.io/demo0811/
    echo https://demo0811.vercel.app/
    echo.
)

pause

