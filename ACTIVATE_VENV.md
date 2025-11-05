# Как активировать виртуальное окружение в Windows PowerShell

## Правильная команда активации

В PowerShell используйте один из вариантов:

```powershell
# Вариант 1 (рекомендуется):
.\venv\Scripts\Activate.ps1

# Вариант 2:
venv\Scripts\Activate.ps1

# Вариант 3 (если создали venvv):
.\venvv\Scripts\Activate.ps1
```

## Если появляется ошибка о политике выполнения

Если PowerShell выдает ошибку `не удается загрузить файл`, выполните:

```powershell
# Проверить текущую политику
Get-ExecutionPolicy

# Разрешить выполнение скриптов для текущего пользователя (безопасно)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

После этого снова попробуйте активировать:
```powershell
.\venv\Scripts\Activate.ps1
```

## Альтернативный способ (без изменения политики)

Можно использовать Command Prompt (cmd) вместо PowerShell:

```cmd
cd C:\finance-manager\backend
venv\Scripts\activate.bat
```

Или активировать напрямую через Python:
```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Быстрая проверка

После активации в начале строки должно появиться `(venv)`:

```powershell
(venv) PS C:\finance-manager\backend>
```

