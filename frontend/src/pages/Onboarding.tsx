import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface OnboardingPage {
  title: string
  description: string
  emoji: string
  buttonText?: string
}

const onboardingPages: OnboardingPage[] = [
  {
    title: 'Добро пожаловать в Люся.Бюджет! 👋',
    description: 'Мы помогаем вам легко управлять личными финансами и вести учет доходов и расходов. Теперь все ваши траты будут под контролем!',
    emoji: '👋',
  },
  {
    title: 'Что мы делаем? 📊',
    description: 'Учет всех транзакций: доходы, расходы и переводы между счетами. Создавайте категории, добавляйте счета и отслеживайте баланс в реальном времени.',
    emoji: '🤔',
  },
  {
    title: 'Как мы помогаем? 💡',
    description: 'Категоризация расходов, совместные бюджеты с семьей, аналитика трат и быстрый ввод через карточки категорий. Всё для удобного контроля финансов!',
    emoji: '💡',
  },
  {
    title: 'Для чего это нужно? 🎯',
    description: 'Чтобы понимать, куда уходят деньги, планировать бюджет, экономить и достигать финансовых целей. Финансовая свобода начинается с учета!',
    emoji: '🎯',
  },
  {
    title: 'Готовы начать? 🚀',
    description: 'Начните с добавления первого счета и транзакции. Чем больше данных вы внесете, тем точнее будет анализ ваших финансов!',
    emoji: '🚀',
  },
]


export function Onboarding({ onComplete }: { onComplete?: () => void }) {
  const [currentPage, setCurrentPage] = useState(0)
  const navigate = useNavigate()
  const isLastPage = currentPage === onboardingPages.length - 1

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
          <h1 className="text-2xl md:text-3xl font-bold text-telegram-text mb-4">
            {currentPageData.title}
          </h1>
          <p className="text-base md:text-lg text-telegram-textSecondary leading-relaxed">
            {currentPageData.description}
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-6">
          {onboardingPages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-telegram-primary w-8'
                  : 'bg-telegram-border w-2'
              }`}
              aria-label={`Страница ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentPage > 0 && (
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              className="btn-secondary flex-1"
            >
              ← Назад
            </button>
          )}
          <button
            onClick={handleNext}
            className="btn-primary flex-1"
          >
            {isLastPage ? 'Начать! 🎉' : 'Далее →'}
          </button>
        </div>

        {/* Skip Button */}
        {!isLastPage && (
          <button
            onClick={handleSkip}
            className="w-full mt-4 text-sm text-telegram-textSecondary hover:text-telegram-text transition-colors"
          >
            Пропустить
          </button>
        )}
      </div>
    </div>
  )
}

