# 🧹 Очистка и перезагрузка репозитория

## Быстрый способ

Запустите скрипт:

```powershell
cd E:\finance-manager\finance-manager\deploy-demo
powershell -ExecutionPolicy Bypass -File .\clean-repo-and-deploy.ps1
```

## Ручной способ

Выполните команды по порядку:

```bash
# 1. Перейдите в корень проекта
cd E:\finance-manager

# 2. Удалите старый репозиторий (если есть)
rmdir /s /q demo0811

# 3. Клонируйте репозиторий заново
git clone https://github.com/jrPrzhe/demo0811.git

# 4. Перейдите в репозиторий
cd demo0811

# 5. Очистите все файлы кроме .git
powershell -Command "Get-ChildItem -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force"

# 6. Скопируйте файлы из deploy-demo
copy ..\finance-manager\deploy-demo\index.html index.html
copy ..\finance-manager\deploy-demo\1.png 1.png
copy ..\finance-manager\deploy-demo\2.png 2.png
copy ..\finance-manager\deploy-demo\3.png 3.png
copy ..\finance-manager\deploy-demo\4.png 4.png
copy ..\finance-manager\deploy-demo\5.png 5.png

# 7. Добавьте файлы в git
git add -A

# 8. Создайте коммит
git commit -m "Clean repository and deploy fresh demo with assistant"

# 9. Отправьте изменения (force push)
git push origin main --force
```

## ⚠️ Важно

- Используется `--force` для полной перезаписи истории
- Все старые файлы будут удалены
- В репозитории останутся только: `index.html` и `1.png` - `5.png`

## ✅ После выполнения

Демо будет доступно на:
- https://jrprzhe.github.io/demo0811/
- https://demo0811.vercel.app/













