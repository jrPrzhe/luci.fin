# Исправление ошибки конфликта бота

## Проблема

Ошибка: `Conflict: terminated by other getUpdates request`

Это означает, что где-то уже запущен другой экземпляр бота.

## Решение

### Шаг 1: Остановите все экземпляры бота

1. **Закройте все терминалы**, где запущен бот (Ctrl+C)
2. **Проверьте запущенные процессы Python:**
   ```powershell
   Get-Process python | Where-Object {$_.Path -like "*telegram-bot*"}
   ```
   
   Если нашли процессы - завершите их:
   ```powershell
   Stop-Process -Name python -Force
   ```

### Шаг 2: Убедитесь, что webhook не установлен

Откройте @BotFather в Telegram и выполните:
```
/setcommands
```
Выберите вашего бота, затем:
```
/setwebhook
```
Или удалите webhook через API.

### Шаг 3: Перезапустите бота

Убедитесь, что запущен **только один** экземпляр:
```powershell
cd telegram-bot
python bot.py
```

## После исправления

Когда бот запустится успешно, вы увидите:
```
INFO - Starting Telegram bot in polling mode...
INFO - Polling mode works on HTTP (no HTTPS required)
INFO - Application started
```

Без ошибок про конфликт!

