import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { ru } from '../locales/ru'
import { en } from '../locales/en'
import { api } from '../services/api'
import { isVKWebApp, getVKLanguage } from '../utils/vk'
import { storageSync, default as storage } from '../utils/storage'

type Language = 'ru' | 'en'

type Translations = typeof ru

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => Promise<void>
  t: Translations
  translateCategoryName: (name: string) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const translations: Record<Language, Translations> = {
  ru,
  en,
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ru')
  const [isLoading, setIsLoading] = useState(true)
  const languageRef = useRef<Language>('ru')

  // Load language from localStorage or user profile
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        // Priority 1: Check localStorage first (user's explicit choice)
        const savedLang = storageSync.getItem('language') as Language | null
        if (savedLang && (savedLang === 'ru' || savedLang === 'en')) {
          setLanguageState(savedLang)
          languageRef.current = savedLang
          setIsLoading(false)
          // Sync with profile in background (don't wait for it)
          syncLanguageToProfile(savedLang).catch(console.error)
          return
        }

        // Priority 2: If in VK Mini App and no saved language, check vk_language from launch params
        if (isVKWebApp()) {
          const vkLang = getVKLanguage()
          if (vkLang && (vkLang === 'ru' || vkLang === 'en')) {
            setLanguageState(vkLang as Language)
            languageRef.current = vkLang as Language
            storageSync.setItem('language', vkLang)
            storage.setItem('language', vkLang).catch(console.error)
            setIsLoading(false)
            // Update user profile with VK language if logged in
            syncLanguageToProfile(vkLang as Language).catch(console.error)
            return
          }
        }

        // Priority 3: Try to get from user profile (only if no saved language)
        await loadLanguageFromProfile()
      } catch (error) {
        console.error('Error loading language:', error)
        setLanguageState('ru')
        languageRef.current = 'ru'
        storageSync.setItem('language', 'ru')
        storage.setItem('language', 'ru').catch(console.error)
        setIsLoading(false)
      }
    }

    const loadLanguageFromProfile = async () => {
      try {
        const token = storageSync.getItem('token')
        if (token) {
          const user = await api.getCurrentUser()
          if (user?.language) {
            const userLang = user.language.toLowerCase() as Language
            if (userLang === 'ru' || userLang === 'en') {
              setLanguageState(userLang)
              languageRef.current = userLang
              storageSync.setItem('language', userLang)
              storage.setItem('language', userLang).catch(console.error)
              setIsLoading(false)
              return
            }
          }
        }
      } catch (error) {
        console.log('Could not load language from user profile:', error)
      }
      
      // Default to Russian if no profile language
      setLanguageState('ru')
      languageRef.current = 'ru'
      storageSync.setItem('language', 'ru')
      storage.setItem('language', 'ru').catch(console.error)
      setIsLoading(false)
    }

    const syncLanguageToProfile = async (lang: Language) => {
      // Only sync to profile, don't overwrite localStorage
      try {
        const token = storageSync.getItem('token')
        if (token) {
          await api.updateUser({ language: lang })
        }
      } catch (error) {
        console.log('Could not sync language to profile:', error)
      }
    }

    loadLanguage()
  }, []) // Only run once on mount

  const setLanguage = async (lang: Language) => {
    // Save to localStorage immediately (highest priority)
    setLanguageState(lang)
    languageRef.current = lang
    storageSync.setItem('language', lang)
    storage.setItem('language', lang).catch(console.error)
    
    // Update user profile if logged in (sync in background)
    try {
      const token = storageSync.getItem('token')
      if (token) {
        await api.updateUser({ language: lang })
      }
    } catch (error) {
      console.error('Error updating user language:', error)
      // Don't fail if update fails, language is still saved in storage
    }
  }

  if (isLoading) {
    return null // Or a loading spinner
  }

  const translateCategoryName = (name: string): string => {
    // Если название категории есть в маппинге, возвращаем перевод
    const categoryNames = translations[language].categories.names
    if (categoryNames && name in categoryNames) {
      return categoryNames[name as keyof typeof categoryNames] as string
    }
    // Иначе возвращаем оригинальное название
    return name
  }

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language],
        translateCategoryName,
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

