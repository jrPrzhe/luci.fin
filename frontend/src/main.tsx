import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { initTelegramWebApp } from './utils/telegram'
import { initVKWebApp } from './utils/vk'
import { storageSync, initStorage } from './utils/storage'

/**
 * Wait for Telegram WebApp script to load
 * Returns true if Telegram WebApp is available, false otherwise
 */
function waitForTelegramScript(maxWaitMs: number = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    // If already available, return immediately
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      resolve(true)
      return
    }

    // Check if script tag exists
    const scriptTag = document.querySelector('script[src*="telegram-web-app.js"]')
    if (!scriptTag) {
      // Script tag not found, Telegram WebApp is not expected
      resolve(false)
      return
    }

    // Wait for script to load
    const startTime = Date.now()
    const checkInterval = 50 // Check every 50ms

    const checkScript = () => {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        resolve(true)
        return
      }

      if (Date.now() - startTime >= maxWaitMs) {
        // Timeout reached
        console.warn('[main] Telegram WebApp script timeout - continuing without Telegram support')
        resolve(false)
        return
      }

      setTimeout(checkScript, checkInterval)
    }

    // If script is already loaded (has onload event), check immediately
    if (scriptTag.getAttribute('data-loaded') === 'true') {
      checkScript()
    } else {
      // Wait a bit for script to load
      setTimeout(checkScript, 100)
    }
  })
}

// Initialize Telegram Web App if running inside Telegram
// Wait for script to load first
waitForTelegramScript(2000).then((isAvailable) => {
  if (isAvailable) {
    try {
      initTelegramWebApp()
      console.log('[main] Telegram WebApp initialized successfully')
    } catch (error) {
      console.error('[main] Failed to initialize Telegram WebApp:', error)
    }
  } else {
    console.log('[main] Telegram WebApp not available - running in web mode')
  }
}).catch((error) => {
  console.error('[main] Error waiting for Telegram script:', error)
})

// Initialize VK Web App if running inside VK
try {
  initVKWebApp()
} catch (error) {
  console.error('[main] Failed to initialize VK WebApp:', error)
}

// Инициализируем storage и загружаем данные из правильного хранилища
// Важно: ждем завершения инициализации для Telegram/VK, чтобы токены были доступны
// НО не блокируем рендеринг приложения
initStorage().then(() => {
  console.log('[main] Storage initialized successfully')
}).catch((error) => {
  console.error('[main] Storage initialization failed:', error)
})

// Initialize theme from storage
// Для VK и Telegram используем их хранилища, для веба - localStorage
try {
  const savedTheme = storageSync.getItem('theme')
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark')
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark')
  }
} catch (error) {
  console.error('[main] Failed to initialize theme:', error)
}

// Рендерим приложение с обработкой ошибок
// Важно: рендерим приложение сразу, не дожидаясь инициализации Telegram/VK
// Это гарантирует, что пользователь увидит интерфейс даже если Telegram WebApp не загрузился
function renderApp() {
  try {
    const rootElement = document.getElementById('root')
    if (!rootElement) {
      throw new Error('Root element not found')
    }
    
    // Добавляем логирование для отладки
    console.log('[main] Root element found, rendering app...')
    console.log('[main] Telegram WebApp available:', typeof window !== 'undefined' && !!window.Telegram?.WebApp)
    console.log('[main] Current URL:', window.location.href)
    
    // Устанавливаем минимальный фон, чтобы избежать серого экрана
    document.body.style.backgroundColor = '#F0F0F0'
    if (document.documentElement.classList.contains('dark')) {
      document.body.style.backgroundColor = '#212121'
    }
    
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
    
    console.log('[main] App rendered successfully')
  } catch (error) {
    console.error('[main] Failed to render app:', error)
    // Показываем сообщение об ошибке пользователю
    const rootElement = document.getElementById('root')
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; padding: 20px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F0F0F0;">
          <div>
            <h1 style="font-size: 24px; margin-bottom: 16px; color: #000;">Ошибка загрузки приложения</h1>
            <p style="color: #666; margin-bottom: 8px;">Не удалось загрузить приложение.</p>
            <p style="color: #999; font-size: 14px; margin-bottom: 16px;">Пожалуйста, обновите страницу или попробуйте позже.</p>
            <button onclick="window.location.reload()" style="margin-top: 16px; padding: 12px 24px; background: #3390EC; color: white; border: none; border-radius: 12px; cursor: pointer; font-size: 16px;">
              Обновить страницу
            </button>
            <p style="color: #999; font-size: 12px; margin-top: 16px;">Ошибка: ${error instanceof Error ? error.message : String(error)}</p>
          </div>
        </div>
      `
    }
  }
}

// Рендерим приложение сразу, не дожидаясь инициализации Telegram/VK
// Это гарантирует, что пользователь увидит интерфейс даже если Telegram WebApp не загрузился
renderApp()

