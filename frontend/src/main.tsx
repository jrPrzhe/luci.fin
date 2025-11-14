import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { initTelegramWebApp } from './utils/telegram'
import { initVKWebApp } from './utils/vk'

// Initialize Telegram Web App if running inside Telegram
initTelegramWebApp()

// Initialize VK Web App if running inside VK
initVKWebApp()

// Initialize theme from localStorage
const savedTheme = localStorage.getItem('theme')
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

