import { useState, useEffect, useRef } from 'react'
import { storageSync, isVKWebApp, isTelegramWebApp } from '../utils/storage'
import storage from '../utils/storage'
import { api } from '../services/api'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Инициализация: используем значение по умолчанию (темная тема)
    // Реальная тема будет загружена из профиля пользователя в useEffect
    // Применяем тему по умолчанию сразу при инициализации
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.classList.add('dark')
    }
    return 'dark'
  })
  
  const isInitialized = useRef(false)
  const isLoadingFromProfile = useRef(false)

  // Функция для применения темы к DOM
  const applyThemeToDOM = (themeToApply: Theme) => {
    const root = document.documentElement
    if (themeToApply === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  // Загружаем тему из профиля пользователя при монтировании
  useEffect(() => {
    const loadThemeFromProfile = async () => {
      // Предотвращаем множественные загрузки
      if (isLoadingFromProfile.current || isInitialized.current) {
        return
      }
      
      isLoadingFromProfile.current = true
      
      try {
        // Пытаемся загрузить тему из профиля пользователя
        const user = await api.getCurrentUser()
        if (user?.theme && (user.theme === 'light' || user.theme === 'dark')) {
          const profileTheme = user.theme as Theme
          // Применяем тему к DOM сразу
          applyThemeToDOM(profileTheme)
          setTheme(profileTheme)
          // Обновляем локальное хранилище для быстрого доступа
          storageSync.setItem(THEME_STORAGE_KEY, profileTheme)
          // Сохраняем в async storage для VK/Telegram
          if (isVKWebApp() || isTelegramWebApp()) {
            await storage.setItem(THEME_STORAGE_KEY, profileTheme)
          }
          isInitialized.current = true
          return
        }
      } catch (error) {
        console.log('Could not load theme from profile:', error)
        // Если не удалось загрузить из профиля, пробуем локальное хранилище
      }
      
      // Fallback: загружаем из локального хранилища
      try {
        // Для VK и Telegram загружаем из async storage
        if (isVKWebApp() || isTelegramWebApp()) {
          const asyncTheme = await storage.getItem(THEME_STORAGE_KEY)
          if (asyncTheme && (asyncTheme === 'light' || asyncTheme === 'dark')) {
            const themeToApply = asyncTheme as Theme
            // Применяем тему к DOM сразу
            applyThemeToDOM(themeToApply)
            setTheme(themeToApply)
            storageSync.setItem(THEME_STORAGE_KEY, asyncTheme)
            isInitialized.current = true
            return
          }
        }
        
        // Проверяем sync cache или localStorage
        const savedTheme = storageSync.getItem(THEME_STORAGE_KEY) as Theme | null
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          // Применяем тему к DOM сразу
          applyThemeToDOM(savedTheme)
          setTheme(savedTheme)
          isInitialized.current = true
          return
        }
      } catch (error) {
        console.log('Could not load theme from storage:', error)
      }
      
      // Если ничего не найдено, используем значение по умолчанию
      // Применяем тему по умолчанию к DOM
      applyThemeToDOM('dark')
      isInitialized.current = true
    }
    
    loadThemeFromProfile()
  }, [])

  // Применяем тему к DOM и синхронизируем с бэкендом при изменении
  useEffect(() => {
    // Пропускаем, если тема еще не инициализирована (чтобы не применять тему дважды при загрузке)
    if (!isInitialized.current) {
      return
    }
    
    // Применяем тему к DOM
    applyThemeToDOM(theme)
    
    // Сохраняем в локальное хранилище
    storageSync.setItem(THEME_STORAGE_KEY, theme)
    
    // Сохраняем в async storage для VK/Telegram
    if (isVKWebApp() || isTelegramWebApp()) {
      storage.setItem(THEME_STORAGE_KEY, theme).catch(console.error)
    }
    
    // Синхронизируем с бэкендом (в фоне, не ждем)
    api.updateUser({ theme }).catch((error) => {
      console.log('Could not sync theme to profile:', error)
      // Не показываем ошибку пользователю, так как это фоновый процесс
    })
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return { theme, setTheme, toggleTheme }
}
