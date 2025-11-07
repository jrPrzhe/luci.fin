@echo off
chcp 65001 >nul
echo ========================================
echo   ДЕПЛОЙ В ПРОДАКШН
echo ========================================
echo.

REM Переходим в корень проекта
cd /d "%~dp0\..\.."

REM Копируем изображения в корень deploy-demo (если их там нет)
if not exist "finance-manager\deploy-demo\1.png" (
    echo Копируем изображения в корень deploy-demo...
    copy "finance-manager\deploy-demo\images\1.png" "finance-manager\deploy-demo\1.png" >nul 2>&1
    copy "finance-manager\deploy-demo\images\2.png" "finance-manager\deploy-demo\2.png" >nul 2>&1
    copy "finance-manager\deploy-demo\images\3.png" "finance-manager\deploy-demo\3.png" >nul 2>&1
    copy "finance-manager\deploy-demo\images\4.png" "finance-manager\deploy-demo\4.png" >nul 2>&1
    copy "finance-manager\deploy-demo\images\5.png" "finance-manager\deploy-demo\5.png" >nul 2>&1
)

REM Проверяем наличие репозитория
if not exist "demo0811" (
    echo Клонируем репозиторий...
    git clone https://github.com/jrPrzhe/demo0811.git
    if errorlevel 1 (
        echo ОШИБКА: Не удалось клонировать репозиторий!
        pause
        exit /b 1
    )
)

REM Переходим в репозиторий
cd demo0811

REM Обновляем репозиторий
echo Обновляем репозиторий...
git fetch origin
git checkout main
git pull origin main

REM Копируем файлы
echo.
echo Копируем файлы...
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
git add .

REM Создаем коммит
echo.
echo Создаем коммит...
git commit -m "Update demo: assistant on each screen with different positions"

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
    echo Возможные причины:
    echo - Нет доступа к репозиторию
    echo - Нет изменений для коммита
    echo - Проблемы с сетью
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

