import { useState, useEffect } from 'react'
import { storageSync, storage } from '../utils/storage'
import { isVKWebApp, isTelegramWebApp } from '../utils/storage'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Проверяем storage при инициализации
    // Для VK и Telegram используем их хранилища, для веба - localStorage
    const savedTheme = storageSync.getItem(THEME_STORAGE_KEY) as Theme | null
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      return savedTheme
    }
    // По умолчанию темная тема
    return 'dark'
  })

  // Загружаем тему асинхронно при монтировании (для VK и Telegram)
  useEffect(() => {
    const loadTheme = async () => {
      // Для VK и Telegram загружаем из async storage
      if (isVKWebApp() || isTelegramWebApp()) {
        try {
          const asyncTheme = await storage.getItem(THEME_STORAGE_KEY)
          if (asyncTheme && (asyncTheme === 'light' || asyncTheme === 'dark')) {
            setTheme(asyncTheme as Theme)
            // Обновляем кэш
            storageSync.setItem(THEME_STORAGE_KEY, asyncTheme)
            return
          }
        } catch (error) {
          console.log('Could not load theme from async storage:', error)
        }
      }
    }
    loadTheme()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    // Сохраняем в storage (VK Storage, Telegram Cloud Storage или localStorage)
    storageSync.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return { theme, setTheme, toggleTheme }
}


