import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ru } from '../locales/ru'
import { en } from '../locales/en'
import { api } from '../services/api'

type Language = 'ru' | 'en'

type Translations = typeof ru

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => Promise<void>
  t: Translations
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const translations: Record<Language, Translations> = {
  ru,
  en,
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ru')
  const [isLoading, setIsLoading] = useState(true)

  // Load language from localStorage or user profile
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        // First check localStorage
        const savedLang = localStorage.getItem('language') as Language | null
        if (savedLang && (savedLang === 'ru' || savedLang === 'en')) {
          setLanguageState(savedLang)
          setIsLoading(false)
          return
        }

        // Try to get from user profile
        try {
          const token = localStorage.getItem('token')
          if (token) {
            const user = await api.getCurrentUser()
            if (user?.language) {
              const userLang = user.language.toLowerCase() as Language
              if (userLang === 'ru' || userLang === 'en') {
                setLanguageState(userLang)
                localStorage.setItem('language', userLang)
                setIsLoading(false)
                return
              }
            }
          }
        } catch (error) {
          console.log('Could not load language from user profile:', error)
        }

        // Default to Russian
        setLanguageState('ru')
        localStorage.setItem('language', 'ru')
      } catch (error) {
        console.error('Error loading language:', error)
        setLanguageState('ru')
      } finally {
        setIsLoading(false)
      }
    }

    loadLanguage()
  }, [])

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
    
    // Update user profile if logged in
    try {
      const token = localStorage.getItem('token')
      if (token) {
        await api.updateUser({ language: lang })
      }
    } catch (error) {
      console.error('Error updating user language:', error)
      // Don't fail if update fails, language is still saved in localStorage
    }
  }

  if (isLoading) {
    return null // Or a loading spinner
  }

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language],
      }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

