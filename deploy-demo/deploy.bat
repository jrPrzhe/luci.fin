@echo off
echo ========================================
echo   Деплой демо на GitHub Pages
echo ========================================
echo.

REM Переходим в корень проекта
cd /d "%~dp0\.."

REM Путь к репозиторию
set REPO_PATH=%CD%\demo0811

REM Если репозиторий не существует, клонируем его
if not exist "%REPO_PATH%" (
    echo Клонируем репозиторий...
    git clone https://github.com/jrPrzhe/demo0811.git "%REPO_PATH%"
    if errorlevel 1 (
        echo Ошибка при клонировании репозитория!
        pause
        exit /b 1
    )
)

REM Переходим в репозиторий
cd /d "%REPO_PATH%"

REM Обновляем ветку
echo Обновляем репозиторий...
git fetch origin
git checkout main
git pull origin main

REM Копируем файлы
echo Копируем файлы...
set DEPLOY_DIR=%~dp0

REM Копируем index.html
copy /Y "%DEPLOY_DIR%index.html" "index.html"

REM Копируем изображения из корня deploy-demo
if exist "%DEPLOY_DIR%1.png" (
    copy /Y "%DEPLOY_DIR%1.png" "1.png"
    copy /Y "%DEPLOY_DIR%2.png" "2.png"
    copy /Y "%DEPLOY_DIR%3.png" "3.png"
    copy /Y "%DEPLOY_DIR%4.png" "4.png"
    copy /Y "%DEPLOY_DIR%5.png" "5.png"
    echo Изображения скопированы
) else if exist "%DEPLOY_DIR%images\1.png" (
    REM Если изображения в папке images
    copy /Y "%DEPLOY_DIR%images\1.png" "1.png"
    copy /Y "%DEPLOY_DIR%images\2.png" "2.png"
    copy /Y "%DEPLOY_DIR%images\3.png" "3.png"
    copy /Y "%DEPLOY_DIR%images\4.png" "4.png"
    copy /Y "%DEPLOY_DIR%images\5.png" "5.png"
    echo Изображения скопированы из папки images
)

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
git commit -m "Update demo: add assistant on each screen with different positions"

REM Пушим изменения
echo.
echo Отправляем изменения на GitHub...
git push origin main

if errorlevel 1 (
    echo.
    echo Ошибка при отправке изменений!
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo   Деплой завершен успешно!
    echo ========================================
    echo.
    echo Демо будет доступно через несколько минут на:
    echo https://jrprzhe.github.io/demo0811/
    echo.
)

pause

