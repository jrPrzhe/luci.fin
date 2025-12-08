import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { initTelegramWebApp, isTelegramWebApp } from './utils/telegram'
import { initVKWebApp, isVKWebApp } from './utils/vk'

// Глобальный обработчик ошибок для логирования
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack,
    isTelegram: isTelegramWebApp(),
    isVK: isVKWebApp(),
    hasTelegramSDK: !!window.Telegram?.WebApp,
    url: window.location.href
  })
})

// Обработчик необработанных промисов
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Unhandled Rejection]', {
    reason: event.reason,
    promise: event.promise,
    isTelegram: isTelegramWebApp(),
    isVK: isVKWebApp(),
    hasTelegramSDK: !!window.Telegram?.WebApp,
    url: window.location.href
  })
})

// Логируем информацию о платформе при загрузке
console.log('[main] Application starting...', {
  url: window.location.href,
  userAgent: navigator.userAgent,
  referrer: document.referrer,
  isTelegram: isTelegramWebApp(),
  isVK: isVKWebApp(),
  hasTelegramSDK: !!window.Telegram?.WebApp,
  timestamp: new Date().toISOString()
})

// Initialize Telegram Web App if running inside Telegram (async)
// Don't block app rendering - initialization happens in background
if (isTelegramWebApp()) {
  console.log('[main] Detected Telegram environment, initializing...')
  initTelegramWebApp()
    .then((success) => {
      if (success) {
        console.log('[main] Telegram WebApp initialized successfully')
      } else {
        console.error('[main] Telegram WebApp initialization failed or incomplete')
      }
    })
    .catch((error) => {
      console.error('[main] Failed to initialize Telegram WebApp:', error)
    })
} else {
  console.log('[main] Not in Telegram environment, skipping Telegram initialization')
}

// Initialize VK Web App if running inside VK (async)
if (isVKWebApp()) {
  console.log('[main] Detected VK environment, initializing...')
  initVKWebApp()
    .then(() => {
      console.log('[main] VK WebApp initialized successfully')
    })
    .catch((error) => {
      console.error('[main] Failed to initialize VK WebApp:', error)
    })
} else {
  console.log('[main] Not in VK environment, skipping VK initialization')
}

// Рендерим приложение (не ждем инициализации миниапов)
// Приложение должно всегда рендериться, даже если миниап не инициализирован
const rootElement = document.getElementById('root')
if (rootElement) {
  console.log('[main] Rendering React app...')
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
    console.log('[main] React app rendered successfully')
  } catch (error) {
    console.error('[main] Failed to render React app:', error)
    // Показываем fallback UI в случае критической ошибки
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: #fff; color: #000; font-family: system-ui, -apple-system, sans-serif;">
        <div style="text-align: center; max-width: 400px;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Ошибка загрузки приложения</h1>
          <p style="margin-bottom: 16px; color: #666;">Произошла критическая ошибка при загрузке приложения.</p>
          <p style="margin-bottom: 24px; color: #666; font-size: 14px;">Попробуйте обновить страницу или обратитесь в поддержку.</p>
          <button onclick="window.location.reload()" style="padding: 12px 24px; background: #0088cc; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
            Обновить страницу
          </button>
          <details style="margin-top: 24px; text-align: left;">
            <summary style="cursor: pointer; color: #666; font-size: 14px;">Детали ошибки</summary>
            <pre style="margin-top: 8px; padding: 12px; background: #f5f5f5; border-radius: 4px; overflow: auto; font-size: 12px;">${error instanceof Error ? error.stack : String(error)}</pre>
          </details>
        </div>
      </div>
    `
  }
} else {
  console.error('[main] Root element not found!')
  document.body.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: #fff; color: #000; font-family: system-ui, -apple-system, sans-serif;">
      <div style="text-align: center;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">Критическая ошибка</h1>
        <p style="color: #666;">Корневой элемент приложения не найден.</p>
      </div>
    </div>
  `
}
