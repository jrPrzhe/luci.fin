import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { storageSync, isVKWebApp, isTelegramWebApp } from '../utils/storage'
import storage from '../utils/storage'
import { api } from '../services/api'

interface NewYearContextType {
  isEnabled: boolean
  setIsEnabled: (value: boolean) => void
  toggle: () => void
}

const NewYearContext = createContext<NewYearContextType | undefined>(undefined)

const NEW_YEAR_THEME_KEY = 'newYearTheme'

export function NewYearProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    // Инициализация: используем значение по умолчанию (включен)
    // Реальное значение будет загружено из профиля пользователя в useEffect
    return true
  })
  
  const isInitialized = useRef(false)
  const isLoadingFromProfile = useRef(false)

  // Загружаем новогодний режим из профиля пользователя при монтировании
  useEffect(() => {
    const loadNewYearThemeFromProfile = async () => {
      // Предотвращаем множественные загрузки
      if (isLoadingFromProfile.current || isInitialized.current) {
        return
      }
      
      isLoadingFromProfile.current = true
      
      try {
        // Пытаемся загрузить новогодний режим из профиля пользователя
        const user = await api.getCurrentUser()
        if (user?.new_year_theme !== undefined) {
          setIsEnabled(user.new_year_theme)
          // Обновляем локальное хранилище для быстрого доступа
          storageSync.setItem(NEW_YEAR_THEME_KEY, user.new_year_theme.toString())
          // Сохраняем в async storage для VK/Telegram
          if (isVKWebApp() || isTelegramWebApp()) {
            await storage.setItem(NEW_YEAR_THEME_KEY, user.new_year_theme.toString())
          }
          isInitialized.current = true
          return
        }
      } catch (error) {
        console.log('Could not load newYearTheme from profile:', error)
        // Если не удалось загрузить из профиля, пробуем локальное хранилище
      }
      
      // Fallback: загружаем из локального хранилища
      try {
        // Для VK и Telegram загружаем из async storage
        if (isVKWebApp() || isTelegramWebApp()) {
          const asyncValue = await storage.getItem(NEW_YEAR_THEME_KEY)
          if (asyncValue !== null) {
            const enabled = asyncValue === 'true'
            setIsEnabled(enabled)
            storageSync.setItem(NEW_YEAR_THEME_KEY, asyncValue)
            isInitialized.current = true
            return
          }
        }
        
        // Проверяем sync cache или localStorage
        const saved = storageSync.getItem(NEW_YEAR_THEME_KEY)
        if (saved !== null) {
          const enabled = saved === 'true'
          setIsEnabled(enabled)
          isInitialized.current = true
          return
        }
      } catch (error) {
        console.log('Could not load newYearTheme from storage:', error)
      }
      
      // Если ничего не найдено, используем значение по умолчанию
      isInitialized.current = true
    }
    
    loadNewYearThemeFromProfile()
  }, [])

  // Сохраняем новогодний режим и синхронизируем с бэкендом при изменении
  useEffect(() => {
    // Пропускаем, если новогодний режим еще не инициализирован
    if (!isInitialized.current) {
      return
    }
    
    // Сохраняем в локальное хранилище
    storageSync.setItem(NEW_YEAR_THEME_KEY, isEnabled.toString())
    
    // Сохраняем в async storage для VK/Telegram
    if (isVKWebApp() || isTelegramWebApp()) {
      storage.setItem(NEW_YEAR_THEME_KEY, isEnabled.toString()).catch(console.error)
    }
    
    // Синхронизируем с бэкендом (в фоне, не ждем)
    api.updateUser({ new_year_theme: isEnabled }).catch((error) => {
      console.log('Could not sync newYearTheme to profile:', error)
      // Не показываем ошибку пользователю, так как это фоновый процесс
    })
  }, [isEnabled])

  const toggle = () => {
    setIsEnabled((prev) => !prev)
  }

  return (
    <NewYearContext.Provider value={{ isEnabled, setIsEnabled, toggle }}>
      {children}
    </NewYearContext.Provider>
  )
}

export function useNewYearTheme() {
  const context = useContext(NewYearContext)
  if (context === undefined) {
    throw new Error('useNewYearTheme must be used within a NewYearProvider')
  }
  return context
}
