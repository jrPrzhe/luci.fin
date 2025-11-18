# 🔧 Исправление ошибки scheduler: init_gamification_data.py

## Проблема

В логах scheduler ошибка:
```
python3: can't open file '/app/backend/scripts/init_gamification_data.py': [Errno 2] No such file or directory
```

## Причина

Команда в настройках `python backend/scripts/init_gamification_data.py` не работает, потому что:
- Рабочая директория в Railway контейнере - `/app`
- Путь зависит от настройки **Root Directory** в Railway

## ✅ Решение

### Вариант 1: Использовать абсолютный путь (РЕКОМЕНДУЕТСЯ)

В настройках Railway Scheduler → **Settings** → **Deploy** → **Custom Start Command**:

```bash
python /app/backend/scripts/init_gamification_data.py
```

### Вариант 2: Перейти в директорию перед запуском

```bash
cd /app/backend && python scripts/init_gamification_data.py
```

### Вариант 3: Если Root Directory = `backend`

Если в настройках сервиса **Root Directory** установлен в `backend`, то рабочая директория уже `/app` (что соответствует `backend` в репозитории), используйте:

```bash
python scripts/init_gamification_data.py
```

## 🔍 Как проверить Root Directory

1. Откройте сервис scheduler в Railway
2. Перейдите в **Settings** → **Source**
3. Проверьте значение поля **Root Directory**:
   - Если пустое → используйте **Вариант 1** или **Вариант 2**
   - Если `backend` → используйте **Вариант 3**

## 📝 Текущие настройки (из скриншота)

- **Custom Start Command**: `python backend/scripts/init_gamification_data.py`
- **Cron Schedule**: `37 03 * * *` (03:37 каждый день)

## ✅ Правильная команда для вашего случая

Скорее всего, Root Directory пустой (корень проекта), поэтому используйте:

```bash
cd /app/backend && python scripts/init_gamification_data.py
```

Или:

```bash
python /app/backend/scripts/init_gamification_data.py
```

## 🎯 Шаги для исправления

1. Откройте Railway Dashboard
2. Найдите сервис **scheduler**
3. Перейдите в **Settings** → **Deploy**
4. В поле **Custom Start Command** замените:
   - **Было**: `python backend/scripts/init_gamification_data.py`
   - **Стало**: `cd /app/backend && python scripts/init_gamification_data.py`
5. Нажмите **Save**
6. Railway автоматически перезапустит scheduler

## 🔍 Проверка после исправления

1. Подождите следующего запуска по расписанию (03:37)
2. Или запустите вручную через **Deployments** → **Deploy**
3. Проверьте логи - ошибка должна исчезнуть





