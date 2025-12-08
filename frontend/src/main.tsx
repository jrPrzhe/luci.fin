import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { initTelegramWebApp } from './utils/telegram'
import { initVKWebApp } from './utils/vk'
import { storageSync, initStorage } from './utils/storage'

// Инициализация Telegram/VK WebApp в фоне - не блокирует рендеринг
// Пытаемся инициализировать сразу, если скрипт уже загружен
// Если нет - попробуем позже
function initPlatforms() {
  // Telegram WebApp
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    try {
      initTelegramWebApp()
      console.log('[main] Telegram WebApp initialized')
    } catch (error) {
      console.error('[main] Failed to initialize Telegram WebApp:', error)
    }
  } else {
    // Если скрипт еще не загружен, попробуем через небольшую задержку
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        try {
          initTelegramWebApp()
          console.log('[main] Telegram WebApp initialized (delayed)')
        } catch (error) {
          console.error('[main] Failed to initialize Telegram WebApp (delayed):', error)
        }
      }
    }, 500)
  }

  // VK WebApp
  try {
    initVKWebApp()
  } catch (error) {
    console.error('[main] Failed to initialize VK WebApp:', error)
  }
}

// Инициализируем платформы в фоне
initPlatforms()

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

// Устанавливаем минимальный фон сразу, чтобы избежать пустого/серого экрана
if (typeof document !== 'undefined') {
  document.body.style.backgroundColor = '#F0F0F0'
  if (document.documentElement.classList.contains('dark')) {
    document.body.style.backgroundColor = '#212121'
  }
}

// Рендерим приложение сразу - это критически важно для Telegram Mini App
// Приложение должно рендериться независимо от состояния Telegram WebApp
try {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found')
  }
  
  console.log('[main] Rendering app...')
  console.log('[main] Telegram WebApp available:', typeof window !== 'undefined' && !!window.Telegram?.WebApp)
  
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

