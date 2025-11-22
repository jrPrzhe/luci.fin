# ⚡ Быстрый старт: Проверка алертов в VK Mini App

⚠️ **ВАЖНО**: В проекте **НЕ ИСПОЛЬЗУЮТСЯ** браузерные алерты. Все уведомления реализованы через ToastContext и модальные окна.

## 🔥 Быстрая проверка в консоли

⚠️ **Примечание**: Следующие примеры показаны только для справки. В реальном коде браузерные алерты НЕ используются.

Откройте консоль браузера (F12) в вашем VK Mini App и выполните:

### 1. Проверка доступности методов

```javascript
// Проверка браузерного alert
console.log('Browser alert:', typeof window.alert === 'function')

// Проверка VK Bridge
console.log('VK Bridge:', typeof window.bridge !== 'undefined')
console.log('Bridge object:', window.bridge)
```

### 2. Использование функций проекта

Если у вас есть доступ к модулям (например, через React DevTools или прямое подключение):

```javascript
// Импорт функций (в зависимости от структуры проекта)
import { checkAlertSupport, showVKAlert, monitorBrowserAlerts } from './utils/vk'

// Проверка поддержки
checkAlertSupport().then(result => {
  console.log('Alert Support:', result)
})

// Тестовый алерт
showVKAlert('Тестовое сообщение')
```

### 3. Прямой тест через VK Bridge

```javascript
// Инициализация VK Bridge
if (window.bridge) {
  window.bridge.send('VKWebAppInit').then(() => {
    console.log('VK Bridge initialized')
    
    // Показать snackbar
    window.bridge.send('VKWebAppShowSnackbar', {
      text: 'Тестовое уведомление',
      duration: 'short'
    }).then(result => {
      console.log('Snackbar result:', result)
    }).catch(error => {
      console.error('Snackbar error:', error)
    })
  })
}
```

### 4. Мониторинг алертов

```javascript
// Перехват всех алертов
const originalAlert = window.alert
const alertsDetected = []

window.alert = function(message) {
  console.warn('⚠️ Alert detected:', message)
  alertsDetected.push(message)
  return originalAlert(message)
}

// Восстановление после тестирования
// window.alert = originalAlert
```

## 💻 Использование в коде

### Базовое использование

```typescript
import { showVKAlert, showVKSnackbar, checkAlertSupport } from '../utils/vk'

// Простое уведомление
await showVKAlert('Сообщение об ошибке')

// Snackbar уведомление
await showVKSnackbar('Операция завершена', 'short')

// Проверка поддержки перед использованием
const support = await checkAlertSupport()
if (support.preferredMethod === 'vk') {
  await showVKSnackbar('Используется VK Bridge')
} else {
  alert('Fallback на браузерный alert')
}
```

### С обработчиком

```typescript
import { showVKAlert } from '../utils/vk'

const handleError = async (error: Error) => {
  await showVKAlert(
    `Произошла ошибка: ${error.message}`,
    () => {
      console.log('Пользователь закрыл алерт')
      // Дополнительная логика после закрытия
    }
  )
}
```

### Автоматический мониторинг в App.tsx

```typescript
import { useEffect } from 'react'
import { monitorBrowserAlerts } from './utils/vk'

function App() {
  useEffect(() => {
    // Только в режиме разработки
    if (process.env.NODE_ENV === 'development') {
      const stopMonitoring = monitorBrowserAlerts((message) => {
        console.warn('[Alert Monitor]', message)
        // Можно отправить в систему аналитики
      })
      
      return stopMonitoring
    }
  }, [])
  
  // ... остальной код
}
```

## 🧪 Тестовый компонент

Добавьте временную страницу для тестирования:

```typescript
// src/pages/AlertTest.tsx
import { useState, useEffect } from 'react'
import { checkAlertSupport, showVKAlert, showVKSnackbar, monitorBrowserAlerts } from '../utils/vk'

export function AlertTest() {
  const [support, setSupport] = useState<any>(null)
  const [detectedAlerts, setDetectedAlerts] = useState<string[]>([])

  useEffect(() => {
    checkAlertSupport().then(setSupport)
    
    const stop = monitorBrowserAlerts((msg) => {
      setDetectedAlerts(prev => [...prev, msg])
    })
    
    return stop
  }, [])

  return (
    <div className="p-4">
      <h1>Тест алертов</h1>
      <pre>{JSON.stringify(support, null, 2)}</pre>
      
      <div className="mt-4 space-x-2">
        <button onClick={() => window.alert('Browser alert')}>
          Browser Alert
        </button>
        <button onClick={() => showVKAlert('VK Alert')}>
          VK Alert
        </button>
        <button onClick={() => showVKSnackbar('Snackbar')}>
          Snackbar
        </button>
      </div>
      
      {detectedAlerts.length > 0 && (
        <div className="mt-4">
          <h2>Обнаруженные алерты:</h2>
          <ul>
            {detectedAlerts.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

## ✅ Чек-лист

- [ ] VK Bridge инициализирован
- [ ] `checkAlertSupport()` возвращает корректные данные
- [ ] `showVKAlert()` работает
- [ ] `showVKSnackbar()` работает
- [ ] Мониторинг алертов активен
- [ ] Нет неожиданных алертов в консоли

---

📖 Подробная документация: [VK_ALERTS_CHECKING_GUIDE.md](./VK_ALERTS_CHECKING_GUIDE.md)
