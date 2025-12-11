import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { storageSync, isVKWebApp, isTelegramWebApp } from '../utils/storage'
import storage from '../utils/storage'

interface NewYearContextType {
  isEnabled: boolean
  setIsEnabled: (value: boolean) => void
  toggle: () => void
}

const NewYearContext = createContext<NewYearContextType | undefined>(undefined)

const NEW_YEAR_THEME_KEY = 'newYearTheme'

export function NewYearProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    // Проверяем storage при инициализации
    // Для VK и Telegram используем их хранилища, для веба - localStorage
    const saved = storageSync.getItem(NEW_YEAR_THEME_KEY)
    if (saved !== null) {
      return saved === 'true'
    }
    // По умолчанию новогодний режим включен
    return true
  })

  // Загружаем новогодний режим асинхронно при монтировании (для VK и Telegram)
  useEffect(() => {
    const loadNewYearTheme = async () => {
      // Для VK и Telegram загружаем из async storage
      if (isVKWebApp() || isTelegramWebApp()) {
        try {
          const asyncValue = await storage.getItem(NEW_YEAR_THEME_KEY)
          if (asyncValue !== null) {
            const enabled = asyncValue === 'true'
            setIsEnabled(enabled)
            // Обновляем кэш
            storageSync.setItem(NEW_YEAR_THEME_KEY, asyncValue)
            return
          }
        } catch (error) {
          console.log('Could not load newYearTheme from async storage:', error)
        }
      }
    }
    loadNewYearTheme()
  }, [])

  useEffect(() => {
    // Сохраняем в storage (VK Storage, Telegram Cloud Storage или localStorage)
    storageSync.setItem(NEW_YEAR_THEME_KEY, isEnabled.toString())
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


