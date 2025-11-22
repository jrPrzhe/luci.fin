# 🔍 Проверка браузерных алертов в VK Mini App

⚠️ **ВАЖНО**: В проекте **НЕ ИСПОЛЬЗУЮТСЯ** браузерные алерты (`alert()`, `confirm()`, `prompt()`). Все уведомления и подтверждения реализованы через:
- **ToastContext** для уведомлений
- **Модальные окна** для подтверждений
- **VK Bridge** методы для нативных уведомлений VK

## 📋 Содержание

1. [Обзор методов проверки](#обзор-методов-проверки)
2. [Быстрая проверка](#быстрая-проверка)
3. [Программная проверка](#программная-проверка)
4. [Мониторинг алертов](#мониторинг-алертов)
5. [Тестирование в DevTools](#тестирование-в-devtools)
6. [Автоматические тесты](#автоматические-тесты)

## 🔧 Обзор методов проверки

### 1. Использование встроенных функций

В проекте добавлены функции для работы с алертами:

- `showVKAlert(message, callback)` - показывает алерт через VK Bridge или браузер
- `showVKSnackbar(message, duration)` - показывает уведомление через VK Bridge
- `checkAlertSupport()` - проверяет доступность методов показа алертов
- `monitorBrowserAlerts(callback)` - мониторит вызовы `window.alert`

### 2. Расположение функций

Функции находятся в файле:
```
frontend/src/utils/vk.ts
```

## 🚀 Быстрая проверка

### Метод 1: Проверка в консоли браузера

1. Откройте ваше VK Mini App
2. Откройте DevTools (F12 или Ctrl+Shift+I)
3. Перейдите на вкладку **Console**
4. Выполните команду:

```javascript
// Импортируем функции (в DevTools напрямую это может не работать)
// Поэтому используем прямой вызов:

// Проверка доступности alert
console.log('Browser alert available:', typeof window.alert === 'function')

// Проверка VK Bridge
console.log('VK Bridge available:', typeof window.bridge !== 'undefined')

// Попытка вызвать alert
window.alert('Тестовый алерт')
```

### Метод 2: Использование функций проекта

Добавьте в любой компонент React:

```typescript
import { checkAlertSupport, showVKAlert, monitorBrowserAlerts } from '../utils/vk'

// Проверка поддержки алертов
const checkAlerts = async () => {
  const support = await checkAlertSupport()
  console.log('Alert support:', support)
  // Выведет: { vkBridgeAvailable: true/false, browserAlertAvailable: true/false, preferredMethod: 'vk'|'browser'|'none' }
}

// Показать тестовый алерт
const testAlert = async () => {
  await showVKAlert('Тестовое сообщение', () => {
    console.log('Alert был закрыт')
  })
}
```

## 💻 Программная проверка

### Пример компонента для проверки алертов

Создайте компонент для тестирования (например, `AlertTestPage.tsx`):

```typescript
import { useState, useEffect } from 'react'
import { checkAlertSupport, showVKAlert, showVKSnackbar, monitorBrowserAlerts } from '../utils/vk'

export function AlertTestPage() {
  const [alertSupport, setAlertSupport] = useState<any>(null)
  const [alertsDetected, setAlertsDetected] = useState<string[]>([])

  useEffect(() => {
    // Проверяем поддержку алертов при загрузке
    checkAlertSupport().then(setAlertSupport)

    // Запускаем мониторинг алертов
    const stopMonitoring = monitorBrowserAlerts((message) => {
      setAlertsDetected(prev => [...prev, message])
    })

    return () => {
      stopMonitoring() // Останавливаем мониторинг при размонтировании
    }
  }, [])

  const handleTestBrowserAlert = () => {
    window.alert('Браузерный алерт (window.alert)')
  }

  const handleTestVKAlert = async () => {
    await showVKAlert('Алерт через VK Bridge')
  }

  const handleTestVKSnackbar = async () => {
    await showVKSnackbar('Snackbar уведомление', 'short')
  }

  return (
    <div className="p-4">
      <h1>Тест алертов VK Mini App</h1>
      
      <div className="mt-4 space-y-4">
        <div>
          <h2>Поддержка алертов:</h2>
          <pre>{JSON.stringify(alertSupport, null, 2)}</pre>
        </div>

        <div>
          <h2>Обнаруженные алерты:</h2>
          {alertsDetected.length === 0 ? (
            <p>Алерты не обнаружены</p>
          ) : (
            <ul>
              {alertsDetected.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-x-2">
          <button onClick={handleTestBrowserAlert}>
            Тест browser alert
          </button>
          <button onClick={handleTestVKAlert}>
            Тест VK Alert
          </button>
          <button onClick={handleTestVKSnackbar}>
            Тест VK Snackbar
          </button>
        </div>
      </div>
    </div>
  )
}
```

## 🔍 Мониторинг алертов

### Автоматический мониторинг при запуске

Добавьте в `App.tsx` или другой корневой компонент:

```typescript
import { useEffect } from 'react'
import { monitorBrowserAlerts } from './utils/vk'

function App() {
  useEffect(() => {
    // Запускаем мониторинг только в development режиме
    if (process.env.NODE_ENV === 'development') {
      const stopMonitoring = monitorBrowserAlerts((message) => {
        console.warn('⚠️ Browser alert detected:', message)
        // Можно отправить в систему логирования
        // sendToLogging('alert_detected', { message })
      })

      return () => {
        stopMonitoring()
      }
    }
  }, [])

  // ... остальной код
}
```

### Поиск мест, где используются алерты

Используйте grep для поиска всех использований `alert`:

```bash
# В корне проекта
grep -r "alert(" frontend/src/
grep -r "window.alert" frontend/src/
grep -r "\.alert" frontend/src/
```

## 🧪 Тестирование в DevTools

### 1. Проверка через Console

Откройте консоль и выполните:

```javascript
// Проверка базового алерта
alert('Тест 1: Базовый алерт')

// Проверка через VK Bridge (если доступен)
if (window.bridge) {
  window.bridge.send('VKWebAppShowSnackbar', {
    text: 'Тест 2: VK Snackbar',
    duration: 'short'
  }).then(console.log).catch(console.error)
}

// Проверка обертки window.alert
const originalAlert = window.alert
window.alert = function(msg) {
  console.log('Alert intercepted:', msg)
  return originalAlert(msg)
}
alert('Тест 3: Перехваченный алерт')
```

### 2. Проверка через Network tab

1. Откройте DevTools → Network
2. Фильтр: WS (WebSocket) или XHR
3. Попробуйте показать алерт
4. Проверьте, есть ли запросы к VK Bridge API

### 3. Проверка через Sources tab

1. Откройте DevTools → Sources
2. Найдите файл `frontend/src/utils/vk.ts`
3. Поставьте breakpoint в функции `showVKAlert`
4. Попробуйте вызвать алерт
5. Проверьте, какой путь выполнения используется

## 🤖 Автоматические тесты

### Пример теста с Jest/Vitest

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkAlertSupport, showVKAlert, monitorBrowserAlerts } from './vk'

describe('VK Alert Functions', () => {
  let originalAlert: typeof window.alert

  beforeEach(() => {
    originalAlert = window.alert
  })

  afterEach(() => {
    window.alert = originalAlert
  })

  it('should detect alert support', async () => {
    const support = await checkAlertSupport()
    expect(support).toHaveProperty('browserAlertAvailable')
    expect(support).toHaveProperty('vkBridgeAvailable')
    expect(support).toHaveProperty('preferredMethod')
  })

  it('should monitor browser alerts', () => {
    const alerts: string[] = []
    const stopMonitoring = monitorBrowserAlerts((message) => {
      alerts.push(message)
    })

    window.alert('Test message')
    
    expect(alerts).toContain('Test message')
    
    stopMonitoring()
  })

  it('should fallback to browser alert if VK Bridge fails', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    // Mock VK Bridge to fail
    vi.mock('@vkontakte/vk-bridge', () => ({
      default: {
        send: vi.fn().mockRejectedValue(new Error('Bridge error'))
      }
    }))

    await showVKAlert('Test message')
    
    expect(alertSpy).toHaveBeenCalledWith('Test message')
    
    alertSpy.mockRestore()
  })
})
```

### E2E тесты с Playwright

```typescript
import { test, expect } from '@playwright/test'

test('should detect and handle alerts in VK Mini App', async ({ page }) => {
  // Подключаемся к VK Mini App
  await page.goto('https://vk.com/appYOUR_APP_ID')
  
  // Ждем загрузки приложения
  await page.waitForLoadState('networkidle')

  // Проверяем наличие VK Bridge
  const vkBridgeAvailable = await page.evaluate(() => {
    return typeof window.bridge !== 'undefined'
  })
  
  expect(vkBridgeAvailable).toBe(true)

  // Перехватываем алерты
  page.on('dialog', async dialog => {
    console.log('Alert detected:', dialog.message())
    await dialog.accept()
  })

  // Вызываем функцию проверки
  await page.evaluate(() => {
    window.alert('Test alert')
  })

  // Проверяем, что VK Bridge доступен
  const bridgeResponse = await page.evaluate(() => {
    return window.bridge?.send('VKWebAppInit')
  })
  
  expect(bridgeResponse).toBeDefined()
})
```

## 📝 Чек-лист проверки

- [ ] VK Bridge инициализирован (`VKWebAppInit` вызван)
- [ ] `checkAlertSupport()` возвращает корректные данные
- [ ] `showVKAlert()` работает в VK Mini App
- [ ] `showVKSnackbar()` работает в VK Mini App
- [ ] Браузерные алерты (`window.alert`) обнаруживаются мониторингом
- [ ] Fallback на браузерный alert работает, если VK Bridge недоступен
- [ ] Нет неожиданных алертов в production
- [ ] Все алерты переведены на VK Bridge методы

## 🐛 Решение проблем

### Проблема: Алерты не появляются

**Решение:**
1. Проверьте, что VK Bridge инициализирован:
   ```javascript
   console.log('VK Bridge:', window.bridge)
   ```
2. Проверьте поддержку алертов:
   ```javascript
   checkAlertSupport().then(console.log)
   ```
3. Убедитесь, что вы находитесь в VK Mini App (не в обычном браузере)

### Проблема: Алерты блокируются

**Решение:**
1. В VK Mini App браузерные алерты могут блокироваться
2. Используйте `showVKAlert()` или `showVKSnackbar()` вместо `window.alert`
3. VK Bridge методы не блокируются

### Проблема: Мониторинг не работает

**Решение:**
1. Убедитесь, что `monitorBrowserAlerts()` вызывается до всех алертов
2. Проверьте, что функция не была остановлена (`stopMonitoring()`)
3. Проверьте консоль на наличие ошибок

## 🔗 Полезные ссылки

- [VK Bridge API Documentation](https://dev.vk.com/mini-apps/development/bridge)
- [VKWebAppShowSnackbar](https://dev.vk.com/mini-apps/development/bridge/events#vkwebappshowsnackbar)
- [VK Mini Apps Debugger](https://dev.vk.com/mini-apps/development/tools/debugger)

---

**Готово!** Теперь вы можете проверять наличие браузерных алертов в вашем VK Mini App! 🎉
