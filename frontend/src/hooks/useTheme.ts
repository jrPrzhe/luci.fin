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

  // Helper function to apply theme synchronously
  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    // Save to storage
    storageSync.setItem(THEME_STORAGE_KEY, newTheme)
  }

  // Use useLayoutEffect to apply theme synchronously before paint
  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light'
      // Apply theme synchronously before state update to prevent flicker
      applyTheme(newTheme)
      return newTheme
    })
  }

  // Wrapper for setTheme that applies theme synchronously
  const setThemeSync = (newTheme: Theme | ((prev: Theme) => Theme)) => {
    if (typeof newTheme === 'function') {
      setTheme((prev) => {
        const result = newTheme(prev)
        applyTheme(result)
        return result
      })
    } else {
      applyTheme(newTheme)
      setTheme(newTheme)
    }
  }

  return { theme, setTheme: setThemeSync, toggleTheme }
}


