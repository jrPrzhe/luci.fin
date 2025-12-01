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
  const lastManualChangeRef = useRef<number>(0) // Timestamp of last manual language change
  const skipAutoSyncRef = useRef<boolean>(false) // Flag to skip auto-sync after manual change

  // Load language from localStorage or user profile
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        // If in VK Mini App, prioritize vk_language from launch params
        if (isVKWebApp()) {
          const vkLang = getVKLanguage()
          if (vkLang && (vkLang === 'ru' || vkLang === 'en')) {
            setLanguageState(vkLang as Language)
            languageRef.current = vkLang as Language
            storageSync.setItem('language', vkLang)
            storage.setItem('language', vkLang).catch(console.error)
            setIsLoading(false)
            // Update user profile with VK language if logged in
            checkProfileLanguage(vkLang as Language)
            return
          }
        }

        // First check storage
        const savedLang = storageSync.getItem('language') as Language | null
        if (savedLang && (savedLang === 'ru' || savedLang === 'en')) {
          setLanguageState(savedLang)
          languageRef.current = savedLang
          setIsLoading(false)
          // Still check profile to sync
          checkProfileLanguage(savedLang)
          return
        }

        // Try to get from user profile
        await checkProfileLanguage()
      } catch (error) {
        console.error('Error loading language:', error)
        setLanguageState('ru')
        languageRef.current = 'ru'
        setIsLoading(false)
      }
    }

    const checkProfileLanguage = async (currentLang?: Language) => {
      // Skip auto-sync if user recently changed language manually (within 60 seconds)
      const timeSinceLastManualChange = Date.now() - lastManualChangeRef.current
      if (skipAutoSyncRef.current && timeSinceLastManualChange < 60000) {
        return
      }

      try {
        const token = storageSync.getItem('token')
        if (token) {
          const user = await api.getCurrentUser()
          if (user?.language) {
            const userLang = user.language.toLowerCase() as Language
            if (userLang === 'ru' || userLang === 'en') {
              // Don't update if user manually changed language recently
              if (timeSinceLastManualChange < 60000) {
                return
              }
              
              // If language changed in profile, update state
              if (!currentLang || currentLang !== userLang) {
                setLanguageState(userLang)
                languageRef.current = userLang
                storageSync.setItem('language', userLang)
                storage.setItem('language', userLang).catch(console.error)
              }
              if (!currentLang) {
                setIsLoading(false)
              }
              return
            }
          }
        }
      } catch (error) {
        console.log('Could not load language from user profile:', error)
      }
      
      // Default to Russian if no profile language
      if (!currentLang) {
        setLanguageState('ru')
        languageRef.current = 'ru'
        storageSync.setItem('language', 'ru')
        storage.setItem('language', 'ru').catch(console.error)
        setIsLoading(false)
      }
    }

    loadLanguage()
    
    // Periodically check for language changes (every 5 seconds)
    // But only if user hasn't manually changed language recently
    const interval = setInterval(() => {
      const token = storageSync.getItem('token')
      if (token) {
        checkProfileLanguage(languageRef.current)
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, []) // Only run once on mount

  const setLanguage = async (lang: Language) => {
    // Mark as manual change
    lastManualChangeRef.current = Date.now()
    skipAutoSyncRef.current = true
    
    setLanguageState(lang)
    languageRef.current = lang
    storageSync.setItem('language', lang)
    storage.setItem('language', lang).catch(console.error)
    
    // Update user profile if logged in
    try {
      const token = storageSync.getItem('token')
      if (token) {
        await api.updateUser({ language: lang })
      }
    } catch (error) {
      console.error('Error updating user language:', error)
      // Don't fail if update fails, language is still saved in storage
    }
    
    // Re-enable auto-sync after 60 seconds
    setTimeout(() => {
      skipAutoSyncRef.current = false
    }, 60000)
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

