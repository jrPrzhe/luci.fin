import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { initTelegramWebApp } from './utils/telegram'
import { initVKWebApp } from './utils/vk'

// Initialize Telegram Web App if running inside Telegram
try {
  initTelegramWebApp()
} catch (error) {
  console.error('[main] Failed to initialize Telegram WebApp:', error)
}

// Initialize VK Web App if running inside VK
try {
  initVKWebApp()
} catch (error) {
  console.error('[main] Failed to initialize VK WebApp:', error)
}

// Рендерим приложение
const rootElement = document.getElementById('root')
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
