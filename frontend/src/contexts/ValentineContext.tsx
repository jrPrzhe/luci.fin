import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { storageSync, isVKWebApp, isTelegramWebApp } from '../utils/storage'
import storage from '../utils/storage'
import { api } from '../services/api'

interface ValentineContextType {
  isEnabled: boolean
  setIsEnabled: (value: boolean) => void
  toggle: () => void
}

const ValentineContext = createContext<ValentineContextType | undefined>(undefined)

const VALENTINE_THEME_KEY = 'valentineTheme'

export function ValentineProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    // Инициализация: используем значение по умолчанию (включен)
    // Реальное значение будет загружено из профиля пользователя в useEffect
    return true
  })
  
  const isInitialized = useRef(false)
  const isLoadingFromProfile = useRef(false)

  // Загружаем режим Дня святого Валентина из профиля пользователя при монтировании
  useEffect(() => {
    const loadValentineThemeFromProfile = async () => {
      // Предотвращаем множественные загрузки
      if (isLoadingFromProfile.current || isInitialized.current) {
        return
      }
      
      isLoadingFromProfile.current = true
      
      try {
        // Пытаемся загрузить режим Дня святого Валентина из профиля пользователя
        const user = await api.getCurrentUser()
        if (user?.valentine_theme !== undefined) {
          setIsEnabled(user.valentine_theme)
          // Обновляем локальное хранилище для быстрого доступа
          storageSync.setItem(VALENTINE_THEME_KEY, user.valentine_theme.toString())
          // Сохраняем в async storage для VK/Telegram
          if (isVKWebApp() || isTelegramWebApp()) {
            await storage.setItem(VALENTINE_THEME_KEY, user.valentine_theme.toString())
          }
          isInitialized.current = true
          return
        }
      } catch (error) {
        console.log('Could not load valentineTheme from profile:', error)
        // Если не удалось загрузить из профиля, пробуем локальное хранилище
      }
      
      // Fallback: загружаем из локального хранилища
      try {
        // Для VK и Telegram загружаем из async storage
        if (isVKWebApp() || isTelegramWebApp()) {
          const asyncValue = await storage.getItem(VALENTINE_THEME_KEY)
          if (asyncValue !== null) {
            const enabled = asyncValue === 'true'
            setIsEnabled(enabled)
            storageSync.setItem(VALENTINE_THEME_KEY, asyncValue)
            isInitialized.current = true
            return
          }
        }
        
        // Проверяем sync cache или localStorage
        const saved = storageSync.getItem(VALENTINE_THEME_KEY)
        if (saved !== null) {
          const enabled = saved === 'true'
          setIsEnabled(enabled)
          isInitialized.current = true
          return
        }
      } catch (error) {
        console.log('Could not load valentineTheme from storage:', error)
      }
      
      // Если ничего не найдено, используем значение по умолчанию
      isInitialized.current = true
    }
    
    loadValentineThemeFromProfile()
  }, [])

  // Сохраняем режим Дня святого Валентина и синхронизируем с бэкендом при изменении
  useEffect(() => {
    // Пропускаем, если режим еще не инициализирован
    if (!isInitialized.current) {
      return
    }
    
    // Сохраняем в локальное хранилище
    storageSync.setItem(VALENTINE_THEME_KEY, isEnabled.toString())
    
    // Сохраняем в async storage для VK/Telegram
    if (isVKWebApp() || isTelegramWebApp()) {
      storage.setItem(VALENTINE_THEME_KEY, isEnabled.toString()).catch(console.error)
    }
    
    // Синхронизируем с бэкендом (в фоне, не ждем)
    api.updateUser({ valentine_theme: isEnabled }).catch((error) => {
      console.log('Could not sync valentineTheme to profile:', error)
      // Не показываем ошибку пользователю, так как это фоновый процесс
    })
  }, [isEnabled])

  const toggle = () => {
    setIsEnabled((prev) => !prev)
  }

  return (
    <ValentineContext.Provider value={{ isEnabled, setIsEnabled, toggle }}>
      {children}
    </ValentineContext.Provider>
  )
}

export function useValentineTheme() {
  const context = useContext(ValentineContext)
  if (context === undefined) {
    throw new Error('useValentineTheme must be used within a ValentineProvider')
  }
  return context
}
