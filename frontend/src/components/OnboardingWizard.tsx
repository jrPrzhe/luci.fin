import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useI18n } from '../contexts/I18nContext'

interface OnboardingWizardProps {
  onComplete?: () => void
  onSkip?: () => void
}

// Базовые категории для анкетирования
const DEFAULT_CATEGORIES = [
  { name: 'Продукты', icon: '🛒' },
  { name: 'ЖКХ', icon: '🏠' },
  { name: 'Съем квартиры', icon: '🏡' },
  { name: 'Транспорт', icon: '🚗' },
  { name: 'Развлечения', icon: '🎬' },
  { name: 'Здоровье', icon: '🏥' },
  { name: 'Образование', icon: '📚' },
  { name: 'Прочее', icon: '📦' },
]

// Базовые варианты проблем
const PROBLEM_OPTIONS = [
  'Кредиты',
  'Не умею копить',
  'Лудомания',
  'Много импульсивных покупок',
  'Не знаю куда уходят деньги',
  'Живу не по средствам',
]

// Базовые варианты целей
const GOAL_OPTIONS = [
  'Накопить на крупную покупку',
  'Избавиться от долгов',
  'Начать копить',
  'Контролировать расходы',
  'Планировать бюджет',
  'Достичь финансовой свободы',
]

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const { t } = useI18n()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(false)
  
  // Данные слайдов
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({})
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0)
  const [problemsText, setProblemsText] = useState<string>('')
  const [problemsOptions, setProblemsOptions] = useState<string[]>([])
  const [goalText, setGoalText] = useState<string>('')
  const [goalOptions, setGoalOptions] = useState<string[]>([])

  // Инициализация категорий
  useEffect(() => {
    const initialLimits: Record<string, number> = {}
    DEFAULT_CATEGORIES.forEach(cat => {
      initialLimits[cat.name] = 0
    })
    setCategoryLimits(initialLimits)
  }, [])

  const handleNext = async () => {
    if (currentSlide < 3) {
      setCurrentSlide(currentSlide + 1)
    } else {
      // Последний слайд - отправляем анкету
      await handleSubmit()
    }
  }

  const handleBack = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Валидация
      if (currentSlide === 0) {
        // Проверяем что хотя бы одна категория заполнена
        const hasData = Object.values(categoryLimits).some(v => v > 0)
        if (!hasData) {
          alert('Пожалуйста, укажите лимиты хотя бы для одной категории')
          setLoading(false)
          return
        }
      } else if (currentSlide === 1) {
        if (monthlyIncome <= 0) {
          alert('Пожалуйста, укажите ваш месячный доход')
          setLoading(false)
          return
        }
      }

      await api.submitQuestionnaire({
        category_limits: categoryLimits,
        monthly_income: monthlyIncome,
        problems_text: problemsText || undefined,
        problems_options: problemsOptions.length > 0 ? problemsOptions : undefined,
        goal_text: goalText || undefined,
        goal_options: goalOptions.length > 0 ? goalOptions : undefined,
      })

      if (onComplete) {
        onComplete()
      }
    } catch (error: any) {
      console.error('Error submitting questionnaire:', error)
      alert('Ошибка при отправке анкеты. Попробуйте еще раз.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    try {
      await api.markUserNotNew()
      if (onSkip) {
        onSkip()
      }
    } catch (error) {
      console.error('Error marking user as not new:', error)
      // Продолжаем даже при ошибке
      if (onSkip) {
        onSkip()
      }
    }
  }

  const toggleProblemOption = (option: string) => {
    setProblemsOptions(prev =>
      prev.includes(option)
        ? prev.filter(o => o !== option)
        : [...prev, option]
    )
  }

  const toggleGoalOption = (option: string) => {
    setGoalOptions(prev =>
      prev.includes(option)
        ? prev.filter(o => o !== option)
        : [...prev, option]
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-telegram-surface dark:bg-telegram-dark-surface rounded-telegram max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Заголовок */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text">
              Анкетирование
            </h2>
            <button
              onClick={handleSkip}
              className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text"
            >
              ✕
            </button>
          </div>

          {/* Прогресс */}
          <div className="flex gap-2 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i === currentSlide
                    ? 'bg-telegram-primary dark:bg-telegram-dark-primary'
                    : i < currentSlide
                    ? 'bg-telegram-primary/50 dark:bg-telegram-dark-primary/50'
                    : 'bg-telegram-border dark:bg-telegram-dark-border'
                }`}
              />
            ))}
          </div>

          {/* Слайд 1: Лимиты категорий */}
          {currentSlide === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-telegram-text dark:text-telegram-dark-text">
                  Лимиты категорий
                </h3>
                <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
                  Укажите сколько вы тратите на популярные категории в месяц (в рублях):
                </p>
              </div>
              <div className="space-y-3">
                {DEFAULT_CATEGORIES.map(cat => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="flex-1 text-telegram-text dark:text-telegram-dark-text">
                      {cat.name}
                    </span>
                    <input
                      type="number"
                      value={categoryLimits[cat.name] || 0}
                      onChange={e => setCategoryLimits({
                        ...categoryLimits,
                        [cat.name]: parseFloat(e.target.value) || 0
                      })}
                      className="w-32 px-3 py-2 border border-telegram-border dark:border-telegram-dark-border rounded-telegram bg-telegram-bg dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text"
                      placeholder="0"
                      min="0"
                    />
                    <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      руб.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Слайд 2: Зарплата */}
          {currentSlide === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-telegram-text dark:text-telegram-dark-text">
                  Ваш доход
                </h3>
                <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
                  На основании этого дохода будет происходить весь анализ ваших финансов.
                </p>
              </div>
              <div>
                <label className="block text-telegram-text dark:text-telegram-dark-text mb-2">
                  Месячный доход (руб.)
                </label>
                <input
                  type="number"
                  value={monthlyIncome || ''}
                  onChange={e => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 border border-telegram-border dark:border-telegram-dark-border rounded-telegram bg-telegram-bg dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text text-lg"
                  placeholder="Введите сумму"
                  min="0"
                />
              </div>
            </div>
          )}

          {/* Слайд 3: Проблемы */}
          {currentSlide === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-telegram-text dark:text-telegram-dark-text">
                  Ваши финансовые проблемы
                </h3>
                <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
                  Опишите ваши финансовые проблемы. Ваши ответы будут обработаны ИИ для более точного анализа.
                  Мы хотим помочь вам, поэтому важно получить искренний ответ.
                </p>
              </div>
              
              {/* Базовые варианты */}
              <div>
                <label className="block text-telegram-text dark:text-telegram-dark-text mb-2">
                  Выберите подходящие варианты:
                </label>
                <div className="space-y-2">
                  {PROBLEM_OPTIONS.map(option => (
                    <label
                      key={option}
                      className="flex items-center gap-2 p-3 border border-telegram-border dark:border-telegram-dark-border rounded-telegram cursor-pointer hover:bg-telegram-bg dark:hover:bg-telegram-dark-bg"
                    >
                      <input
                        type="checkbox"
                        checked={problemsOptions.includes(option)}
                        onChange={() => toggleProblemOption(option)}
                        className="w-4 h-4"
                      />
                      <span className="text-telegram-text dark:text-telegram-dark-text">
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Свободный текст */}
              <div>
                <label className="block text-telegram-text dark:text-telegram-dark-text mb-2">
                  Или опишите своими словами (приоритет):
                </label>
                <textarea
                  value={problemsText}
                  onChange={e => setProblemsText(e.target.value)}
                  className="w-full px-4 py-3 border border-telegram-border dark:border-telegram-dark-border rounded-telegram bg-telegram-bg dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text"
                  rows={4}
                  placeholder="Опишите ваши финансовые проблемы..."
                />
              </div>
            </div>
          )}

          {/* Слайд 4: Цель */}
          {currentSlide === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-telegram-text dark:text-telegram-dark-text">
                  Ваша цель
                </h3>
                <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
                  Расскажите, что вы хотите добиться от приложения. Ваши ответы помогут ИИ составить персональный план.
                </p>
              </div>
              
              {/* Базовые варианты */}
              <div>
                <label className="block text-telegram-text dark:text-telegram-dark-text mb-2">
                  Выберите подходящие варианты:
                </label>
                <div className="space-y-2">
                  {GOAL_OPTIONS.map(option => (
                    <label
                      key={option}
                      className="flex items-center gap-2 p-3 border border-telegram-border dark:border-telegram-dark-border rounded-telegram cursor-pointer hover:bg-telegram-bg dark:hover:bg-telegram-dark-bg"
                    >
                      <input
                        type="checkbox"
                        checked={goalOptions.includes(option)}
                        onChange={() => toggleGoalOption(option)}
                        className="w-4 h-4"
                      />
                      <span className="text-telegram-text dark:text-telegram-dark-text">
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Свободный текст */}
              <div>
                <label className="block text-telegram-text dark:text-telegram-dark-text mb-2">
                  Или опишите своими словами (приоритет):
                </label>
                <textarea
                  value={goalText}
                  onChange={e => setGoalText(e.target.value)}
                  className="w-full px-4 py-3 border border-telegram-border dark:border-telegram-dark-border rounded-telegram bg-telegram-bg dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text"
                  rows={4}
                  placeholder="Опишите вашу цель..."
                />
              </div>
            </div>
          )}

          {/* Навигация */}
          <div className="flex gap-3 mt-6">
            {currentSlide > 0 && (
              <button
                onClick={handleBack}
                className="btn-secondary flex-1"
                disabled={loading}
              >
                ← Назад
              </button>
            )}
            <button
              onClick={currentSlide === 3 ? handleSubmit : handleNext}
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Отправка...' : currentSlide === 3 ? 'Завершить' : 'Далее →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
