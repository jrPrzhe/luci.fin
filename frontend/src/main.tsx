import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { initTelegramWebApp } from './utils/telegram'
import { initVKWebApp } from './utils/vk'
import { storageSync, initStorage } from './utils/storage'

// Initialize Telegram Web App if running inside Telegram
initTelegramWebApp()

// Initialize VK Web App if running inside VK
initVKWebApp()

// Инициализируем storage и загружаем данные из правильного хранилища
// Важно: ждем завершения инициализации для Telegram/VK, чтобы токены были доступны
initStorage().then(() => {
  console.log('[main] Storage initialized successfully')
}).catch((error) => {
  console.error('[main] Storage initialization failed:', error)
})

// Initialize theme from storage
// Для VK и Telegram используем их хранилища, для веба - localStorage
const savedTheme = storageSync.getItem('theme')
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark')
} else if (savedTheme === 'light') {
  document.documentElement.classList.remove('dark')
} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

