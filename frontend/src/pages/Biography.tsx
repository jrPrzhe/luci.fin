import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useI18n } from '../contexts/I18nContext'
import { OnboardingWizard } from '../components/OnboardingWizard'
import { useNavigate } from 'react-router-dom'

interface CategoryLimit {
  id: number
  biography_id: number
  category_name: string
  category_id: number | null
  user_limit: number
  ai_recommended_limit: number | null
  actual_spent: number
  currency: string
  created_at: string
  updated_at: string
}

interface Biography {
  id: number
  user_id: number
  monthly_income: number | null
  problems: string | null
  goal: string | null
  period_start: string
  period_end: string | null
  is_current: boolean
  created_at: string
  updated_at: string
  category_limits: CategoryLimit[]
}

export function Biography() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [showWizard, setShowWizard] = useState(false)

  const { data: biography, isLoading, refetch } = useQuery({
    queryKey: ['biography'],
    queryFn: async () => {
      try {
        return await api.getBiography()
      } catch (error) {
        console.error('Error fetching biography:', error)
        return null
      }
    },
    staleTime: 30000,
  })

  const { data: newUserStatus } = useQuery({
    queryKey: ['newUserStatus'],
    queryFn: async () => {
      try {
        return await api.getNewUserStatus()
      } catch (error) {
        console.error('Error fetching new user status:', error)
        return { new_user: false, has_biography: false }
      }
    },
  })

  // Показываем визард если пользователь новый и нет биографии
  useEffect(() => {
    if (newUserStatus?.new_user && !newUserStatus?.has_biography && !biography) {
      setShowWizard(true)
    }
  }, [newUserStatus, biography])

  const handleWizardComplete = async () => {
    setShowWizard(false)
    await refetch()
  }

  const handleWizardSkip = async () => {
    setShowWizard(false)
    await api.markUserNotNew()
  }

  const handleStartQuestionnaire = () => {
    setShowWizard(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary mb-4"></div>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            Загрузка...
          </p>
        </div>
      </div>
    )
  }

  if (!biography) {
    return (
      <div className="p-6">
        {showWizard && (
          <OnboardingWizard
            onComplete={handleWizardComplete}
            onSkip={handleWizardSkip}
          />
        )}
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text mb-4">
            Биография пуста
          </h2>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6">
            Пройдите анкетирование, чтобы получить персональный финансовый план от ИИ
          </p>
          <button
            onClick={handleStartQuestionnaire}
            className="btn-primary"
          >
            Пройти анкетирование
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {showWizard && (
        <OnboardingWizard
          onComplete={handleWizardComplete}
          onSkip={handleWizardSkip}
        />
      )}

      <div className="space-y-6">
        {/* Заголовок */}
        <div>
          <h1 className="text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
            Биография
          </h1>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            Ваш персональный финансовый план на основе анкетирования
          </p>
        </div>

        {/* Доходы */}
        {biography.monthly_income && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              💰 Ваш доход
            </h2>
            <p className="text-2xl font-bold text-telegram-primary dark:text-telegram-dark-primary">
              {biography.monthly_income.toLocaleString('ru-RU')} {biography.category_limits[0]?.currency || 'RUB'}
            </p>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-2">
              в месяц
            </p>
          </div>
        )}

        {/* Проблемы и цели */}
        {(biography.problems || biography.goal) && (
          <div className="grid md:grid-cols-2 gap-6">
            {biography.problems && (
              <div className="card p-6">
                <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
                  ⚠️ Ваши проблемы
                </h2>
                <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary whitespace-pre-wrap">
                  {biography.problems}
                </p>
              </div>
            )}
            {biography.goal && (
              <div className="card p-6">
                <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
                  🎯 Ваша цель
                </h2>
                <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary whitespace-pre-wrap">
                  {biography.goal}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Лимиты категорий */}
        {biography.category_limits && biography.category_limits.length > 0 && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-6">
              📊 Лимиты категорий
            </h2>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
              Мы предлагаем вам план на месяц - показатели, к которым нужно стремиться. 
              ИИ проанализировал ваши данные и предложил оптимальные лимиты.
            </p>

            <div className="space-y-4">
              {biography.category_limits.map((limit) => {
                const currency = limit.currency || 'RUB'
                const userLimit = Number(limit.user_limit)
                const aiLimit = limit.ai_recommended_limit ? Number(limit.ai_recommended_limit) : null
                const actualSpent = Number(limit.actual_spent)
                
                // Вычисляем процент использования для планового лимита
                const planPercent = aiLimit ? (actualSpent / aiLimit) * 100 : null
                const userPercent = (actualSpent / userLimit) * 100
                
                // Цвет индикатора
                const getColor = (percent: number | null) => {
                  if (percent === null) return 'text-telegram-textSecondary'
                  if (percent <= 70) return 'text-green-500'
                  if (percent <= 90) return 'text-yellow-500'
                  return 'text-red-500'
                }

                return (
                  <div
                    key={limit.id}
                    className="border border-telegram-border dark:border-telegram-dark-border rounded-telegram p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                        {limit.category_name}
                      </h3>
                      <span className={`text-sm font-semibold ${getColor(planPercent)}`}>
                        Потрачено: {actualSpent.toLocaleString('ru-RU')} {currency}
                      </span>
                    </div>

                    {/* Фактический лимит пользователя */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                          Ваш фактический лимит:
                        </span>
                        <span className="text-telegram-text dark:text-telegram-dark-text font-semibold">
                          {userLimit.toLocaleString('ru-RU')} {currency}
                        </span>
                      </div>
                      <div className="w-full bg-telegram-bg dark:bg-telegram-dark-bg rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            userPercent <= 70
                              ? 'bg-green-500'
                              : userPercent <= 90
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(userPercent, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Плановый лимит от ИИ */}
                    {aiLimit && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                            Плановый лимит от ИИ:
                          </span>
                          <span className="text-telegram-primary dark:text-telegram-dark-primary font-semibold">
                            {aiLimit.toLocaleString('ru-RU')} {currency}
                          </span>
                        </div>
                        <div className="w-full bg-telegram-bg dark:bg-telegram-dark-bg rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              planPercent! <= 70
                                ? 'bg-green-500'
                                : planPercent! <= 90
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(planPercent || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Разница между фактом и планом */}
                    {aiLimit && (
                      <div className="pt-2 border-t border-telegram-border dark:border-telegram-dark-border">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                            Разница с планом:
                          </span>
                          <span
                            className={`font-semibold ${
                              actualSpent <= aiLimit
                                ? 'text-green-500'
                                : 'text-red-500'
                            }`}
                          >
                            {actualSpent <= aiLimit ? '+' : ''}
                            {(aiLimit - actualSpent).toLocaleString('ru-RU')} {currency}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Информация о периоде */}
        <div className="card p-6 bg-telegram-bg dark:bg-telegram-dark-bg">
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            Период: {new Date(biography.period_start).toLocaleDateString('ru-RU')} - {biography.period_end ? new Date(biography.period_end).toLocaleDateString('ru-RU') : 'текущий'}
          </p>
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-2">
            Спустя месяц мы создадим новые данные исходя из ваших трат. 
            Данные за прошедший месяц будут сохранены для сравнения.
          </p>
        </div>
      </div>
    </div>
  )
}
