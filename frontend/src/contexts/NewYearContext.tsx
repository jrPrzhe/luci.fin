import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface NewYearContextType {
  isEnabled: boolean
  setIsEnabled: (value: boolean) => void
  toggle: () => void
}

const NewYearContext = createContext<NewYearContextType | undefined>(undefined)

const NEW_YEAR_THEME_KEY = 'newYearTheme'

export function NewYearProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    // Проверяем localStorage при инициализации
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(NEW_YEAR_THEME_KEY)
      if (saved !== null) {
        return saved === 'true'
      }
      // По умолчанию новогодний режим включен
      return true
    }
    return true
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NEW_YEAR_THEME_KEY, isEnabled.toString())
    }
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


