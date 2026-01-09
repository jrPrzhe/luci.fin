import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { storageSync, isVKWebApp, isTelegramWebApp } from '../utils/storage'
import storage from '../utils/storage'
import { api } from '../services/api'

interface StrangerThingsContextType {
  isEnabled: boolean
  setIsEnabled: (value: boolean) => void
  toggle: () => void
  isElevenMode: boolean
  setIsElevenMode: (value: boolean) => void
  isUpsideDown: boolean
}

const StrangerThingsContext = createContext<StrangerThingsContextType | undefined>(undefined)

const STRANGER_THINGS_THEME_KEY = 'strangerThingsTheme'

export function StrangerThingsProvider({ children }: { children: ReactNode }) {
  // Загружаем начальное значение из localStorage для быстрого применения темы
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    try {
      const saved = storageSync.getItem(STRANGER_THINGS_THEME_KEY)
      if (saved !== null) {
        return saved === 'true'
      }
    } catch (error) {
      console.log('Could not load strangerThingsTheme from storage on init:', error)
    }
    return false
  })
  
  const [isElevenMode, setIsElevenMode] = useState(false)
  const [isUpsideDown, setIsUpsideDown] = useState(false)
  
  const isInitialized = useRef(false)
  const isLoadingFromProfile = useRef(false)

  // Проверяем время для Upside Down режима (00:00-03:00)
  useEffect(() => {
    const checkTime = () => {
      const hour = new Date().getHours()
      setIsUpsideDown(hour >= 0 && hour < 3)
    }

    checkTime()
    const interval = setInterval(checkTime, 60000) // Проверяем каждую минуту

    return () => clearInterval(interval)
  }, [])

  // Загружаем настройки из профиля пользователя
  useEffect(() => {
    const loadThemeFromProfile = async () => {
      if (isLoadingFromProfile.current || isInitialized.current) {
        return
      }
      
      isLoadingFromProfile.current = true
      
      try {
        const user = await api.getCurrentUser()
        if (user?.stranger_things_theme !== undefined) {
          setIsEnabled(user.stranger_things_theme)
          storageSync.setItem(STRANGER_THINGS_THEME_KEY, user.stranger_things_theme.toString())
          if (isVKWebApp() || isTelegramWebApp()) {
            await storage.setItem(STRANGER_THINGS_THEME_KEY, user.stranger_things_theme.toString())
          }
          isInitialized.current = true
          return
        }
      } catch (error) {
        console.log('Could not load strangerThingsTheme from profile:', error)
      }
      
      // Fallback: загружаем из локального хранилища
      try {
        if (isVKWebApp() || isTelegramWebApp()) {
          const asyncValue = await storage.getItem(STRANGER_THINGS_THEME_KEY)
          if (asyncValue !== null) {
            const enabled = asyncValue === 'true'
            setIsEnabled(enabled)
            storageSync.setItem(STRANGER_THINGS_THEME_KEY, asyncValue)
            isInitialized.current = true
            return
          }
        }
        
        const saved = storageSync.getItem(STRANGER_THINGS_THEME_KEY)
        if (saved !== null) {
          const enabled = saved === 'true'
          setIsEnabled(enabled)
          isInitialized.current = true
          return
        }
      } catch (error) {
        console.log('Could not load strangerThingsTheme from storage:', error)
      }
      
      isInitialized.current = true
    }
    
    loadThemeFromProfile()
  }, [])

  // Применяем тему сразу при монтировании (для быстрого восстановления после перезагрузки)
  useEffect(() => {
    if (isEnabled) {
      document.documentElement.classList.add('theme-stranger-things')
      document.body.classList.add('theme-stranger-things')
    }
  }, []) // Выполняется один раз при монтировании

  // Применяем класс темы к body и html при изменении isEnabled
  useEffect(() => {
    if (isEnabled) {
      const wasAlreadyApplied = document.documentElement.classList.contains('theme-stranger-things')
      document.documentElement.classList.add('theme-stranger-things')
      document.body.classList.add('theme-stranger-things')
      
      // Добавляем VHS эффект только при включении (не при первой загрузке)
      if (!wasAlreadyApplied && isInitialized.current) {
        document.body.classList.add('vhs-intro')
        setTimeout(() => {
          document.body.classList.remove('vhs-intro')
        }, 1500)
      }
    } else {
      document.documentElement.classList.remove('theme-stranger-things', 'upside-down', 'eleven-mode')
      document.body.classList.remove('theme-stranger-things', 'upside-down', 'eleven-mode', 'vhs-intro')
    }
  }, [isEnabled])

  // Применяем режимы Upside Down и Eleven
  useEffect(() => {
    if (isEnabled) {
      if (isUpsideDown) {
        document.documentElement.classList.add('upside-down')
        document.body.classList.add('upside-down')
      } else {
        document.documentElement.classList.remove('upside-down')
        document.body.classList.remove('upside-down')
      }
    }
  }, [isEnabled, isUpsideDown])

  useEffect(() => {
    if (isEnabled) {
      if (isElevenMode) {
        document.documentElement.classList.add('eleven-mode')
        document.body.classList.add('eleven-mode')
      } else {
        document.documentElement.classList.remove('eleven-mode')
        document.body.classList.remove('eleven-mode')
      }
    }
  }, [isEnabled, isElevenMode])

  // Сохраняем настройки при изменении
  useEffect(() => {
    if (!isInitialized.current) {
      return
    }
    
    storageSync.setItem(STRANGER_THINGS_THEME_KEY, isEnabled.toString())
    
    if (isVKWebApp() || isTelegramWebApp()) {
      storage.setItem(STRANGER_THINGS_THEME_KEY, isEnabled.toString()).catch(console.error)
    }
    
    // Синхронизируем с бэкендом (в фоне)
    api.updateUser({ stranger_things_theme: isEnabled }).catch((error) => {
      console.log('Could not sync strangerThingsTheme to profile:', error)
    })
  }, [isEnabled])

  const toggle = () => {
    setIsEnabled((prev) => !prev)
  }

  return (
    <StrangerThingsContext.Provider 
      value={{ 
        isEnabled, 
        setIsEnabled, 
        toggle, 
        isElevenMode, 
        setIsElevenMode,
        isUpsideDown
      }}
    >
      {children}
    </StrangerThingsContext.Provider>
  )
}

export function useStrangerThingsTheme() {
  const context = useContext(StrangerThingsContext)
  if (context === undefined) {
    throw new Error('useStrangerThingsTheme must be used within a StrangerThingsProvider')
  }
  return context
}
