import { useState, useLayoutEffect } from 'react'
import { storageSync } from '../utils/storage'

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

  // Use useLayoutEffect to apply theme synchronously before paint
  useLayoutEffect(() => {
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
    setTheme((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light'
      // Apply theme synchronously before state update to prevent flicker
      const root = document.documentElement
      if (newTheme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
      // Also save to storage immediately
      storageSync.setItem(THEME_STORAGE_KEY, newTheme)
      return newTheme
    })
  }

  return { theme, setTheme, toggleTheme }
}


