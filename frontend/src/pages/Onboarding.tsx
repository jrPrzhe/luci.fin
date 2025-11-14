import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'

interface OnboardingPage {
  title: string
  description: string
  emoji: string
  buttonText?: string
  isLanguageSelection?: boolean
}

export function Onboarding({ onComplete }: { onComplete?: () => void }) {
  const { t, setLanguage, language } = useI18n()
  const [currentPage, setCurrentPage] = useState(0)
  const navigate = useNavigate()
  
  const onboardingPages: OnboardingPage[] = [
    {
      title: t.onboarding.selectLanguage,
      description: t.onboarding.selectLanguageDesc,
      emoji: '🌍',
      isLanguageSelection: true,
    },
    {
      title: t.onboarding.welcome,
      description: t.onboarding.welcomeDesc,
      emoji: '👋',
    },
    {
      title: t.onboarding.whatWeDo,
      description: t.onboarding.whatWeDoDesc,
      emoji: '🤔',
    },
    {
      title: t.onboarding.howWeHelp,
      description: t.onboarding.howWeHelpDesc,
      emoji: '💡',
    },
    {
      title: t.onboarding.why,
      description: t.onboarding.whyDesc,
      emoji: '🎯',
    },
    {
      title: t.onboarding.ready,
      description: t.onboarding.readyDesc,
      emoji: '🚀',
    },
  ]
  
  const isLastPage = currentPage === onboardingPages.length - 1

  const handleLanguageSelect = async (lang: 'ru' | 'en') => {
    await setLanguage(lang)
    setCurrentPage(1) // Move to first content page
  }

  const handleNext = () => {
    if (isLastPage) {
      // Завершаем онбординг
      localStorage.setItem('onboarding_completed', 'true')
      // Показываем приветствие после онбординга
      sessionStorage.setItem('justLoggedIn', 'true')
      if (onComplete) {
        onComplete()
      } else {
        navigate('/')
      }
    } else {
      setCurrentPage(currentPage + 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding_completed', 'true')
    // Показываем приветствие после онбординга
    sessionStorage.setItem('justLoggedIn', 'true')
    if (onComplete) {
      onComplete()
    } else {
      navigate('/')
    }
  }

  const currentPageData = onboardingPages[currentPage]
  const isLanguagePage = currentPageData.isLanguageSelection

  return (
    <div className="min-h-screen bg-telegram-bg flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Emoji Display */}
        <div className="text-center mb-8">
          <div className="text-8xl md:text-9xl mb-4 transform transition-transform duration-300 hover:scale-105">
            {currentPageData.emoji}
          </div>
        </div>

        {/* Content */}
        <div className="card p-6 md:p-8 text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-4">
            {currentPageData.title}
          </h1>
          <p className="text-base md:text-lg text-telegram-textSecondary dark:text-telegram-dark-textSecondary leading-relaxed">
            {currentPageData.description}
          </p>
          
          {/* Language Selection */}
          {isLanguagePage && (
            <div className="mt-6 space-y-3">
              <button
                onClick={() => handleLanguageSelect('ru')}
                className={`w-full p-4 rounded-telegram border-2 transition-all ${
                  language === 'ru'
                    ? 'border-telegram-primary bg-telegram-primary/10 dark:bg-telegram-dark-primary/10'
                    : 'border-telegram-border hover:border-telegram-primary/50'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl">🇷🇺</span>
                  <span className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Русский
                  </span>
                </div>
              </button>
              <button
                onClick={() => handleLanguageSelect('en')}
                className={`w-full p-4 rounded-telegram border-2 transition-all ${
                  language === 'en'
                    ? 'border-telegram-primary bg-telegram-primary/10 dark:bg-telegram-dark-primary/10'
                    : 'border-telegram-border hover:border-telegram-primary/50'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl">🇬🇧</span>
                  <span className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                    English
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Progress Dots */}
        {!isLanguagePage && (
          <div className="flex justify-center gap-2 mb-6">
            {onboardingPages.filter(p => !p.isLanguageSelection).map((_, index) => {
              const actualIndex = index + 1 // Skip language selection page
              return (
                <button
                  key={actualIndex}
                  onClick={() => setCurrentPage(actualIndex)}
                  className={`h-2 rounded-full transition-all ${
                    currentPage === actualIndex
                      ? 'bg-telegram-primary w-8'
                      : 'bg-telegram-border w-2'
                  }`}
                  aria-label={`${t.common.page} ${index + 1}`}
                />
              )
            })}
          </div>
        )}

        {/* Navigation */}
        {!isLanguagePage && (
          <div className="flex gap-3">
            {currentPage > 1 && (
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                className="btn-secondary flex-1"
              >
                ← {t.common.back}
              </button>
            )}
            <button
              onClick={handleNext}
              className="btn-primary flex-1"
            >
              {isLastPage ? t.onboarding.start : `${t.common.next} →`}
            </button>
          </div>
        )}

        {/* Skip Button */}
        {!isLastPage && !isLanguagePage && (
          <button
            onClick={handleSkip}
            className="w-full mt-4 text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text transition-colors"
          >
            {t.common.skip}
          </button>
        )}
      </div>
    </div>
  )
}

