import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { OnboardingWizard } from '../components/OnboardingWizard'
import { useToast } from '../contexts/ToastContext'

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
  const { showError, showSuccess } = useToast()
  const queryClient = useQueryClient()
  const [showWizard, setShowWizard] = useState(false)
  const [isEditingIncome, setIsEditingIncome] = useState(false)
  const [editedIncome, setEditedIncome] = useState<number>(0)
  const [isUpdatingLimits, setIsUpdatingLimits] = useState(false)
  const [showUpdateButton, setShowUpdateButton] = useState(false)
  const updatePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const updateStartRef = useRef<number | null>(null)

  const getLimitsSignature = (bio: Biography | null) => {
    if (!bio) return ''
    const limitsSig = Array.isArray(bio.category_limits)
      ? bio.category_limits
          .map(limit => `${limit.id}:${limit.updated_at}:${limit.user_limit}:${limit.ai_recommended_limit}:${limit.actual_spent}`)
          .sort()
          .join('|')
      : ''
    return `${bio.updated_at || ''}|${limitsSig}`
  }

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

  // Получаем статус геймификации для проверки сердец
  const { data: gamificationStatus } = useQuery({
    queryKey: ['gamification-status'],
    queryFn: () => api.getGamificationStatus(),
    staleTime: 30000,
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

  const handleEditIncome = () => {
    if (biography?.monthly_income) {
      setEditedIncome(Number(biography.monthly_income))
      setIsEditingIncome(true)
    }
  }

  const handleSaveIncome = async () => {
    if (!biography) return
    
    if (editedIncome <= 0) {
      showError('Доход должен быть больше 0')
      return
    }

    const incomeChanged = Number(biography.monthly_income) !== editedIncome

    try {
      await api.updateBiographyIncome(editedIncome)
      setIsEditingIncome(false)
      if (incomeChanged) {
        setShowUpdateButton(true)
      }
      await refetch()
      showSuccess('Доход обновлен')
    } catch (error: any) {
      console.error('Error updating income:', error)
      showError(error.message || 'Ошибка при обновлении дохода')
    }
  }

  const handleCancelEditIncome = () => {
    setIsEditingIncome(false)
    setShowUpdateButton(false)
  }

  const handleUpdateCategoryLimits = async () => {
    if (!gamificationStatus?.profile) {
      showError('Не удалось загрузить баланс сердец')
      return
    }

    const heartLevel = gamificationStatus.profile.heart_level
    const HEARTS_COST = 1

    if (heartLevel < HEARTS_COST) {
      showError(
        `Недостаточно сердец Люси. Требуется ${HEARTS_COST}, доступно ${heartLevel}. Заработайте больше сердец или приобретите премиум.`,
        8000
      )
      return
    }

    setIsUpdatingLimits(true)
    const initialSignature = getLimitsSignature(biography)
    const startedAt = Date.now()
    updateStartRef.current = startedAt

    const startPolling = () => {
      if (updatePollRef.current) {
        clearInterval(updatePollRef.current)
      }

      updatePollRef.current = setInterval(async () => {
        const elapsed = Date.now() - (updateStartRef.current || startedAt)
        if (elapsed > 60000) {
          clearInterval(updatePollRef.current as ReturnType<typeof setInterval>)
          updatePollRef.current = null
          setIsUpdatingLimits(false)
          showError('Обновление лимитов заняло слишком много времени. Попробуйте позже.')
          return
        }

        try {
          const result = await refetch()
          const nextBiography = result?.data || null
          const nextSignature = getLimitsSignature(nextBiography)
          if (nextSignature && nextSignature !== initialSignature) {
            clearInterval(updatePollRef.current as ReturnType<typeof setInterval>)
            updatePollRef.current = null
            setIsUpdatingLimits(false)
            setShowUpdateButton(false)
            await queryClient.invalidateQueries({ queryKey: ['gamification-status'] })
            showSuccess('Лимиты категорий обновлены')
          }
        } catch (error) {
          console.warn('Polling biography update failed:', error)
        }
      }, 2000)
    }

    startPolling()
    try {
      showSuccess('Обновление лимитов запущено. Мы уведомим вас по готовности.')
      api.updateCategoryLimits().catch((error: any) => {
        console.error('Error updating category limits:', error)
        const errorMessage = error?.message || 'Ошибка при обновлении лимитов'
        if (updatePollRef.current) {
          clearInterval(updatePollRef.current)
          updatePollRef.current = null
        }
        setIsUpdatingLimits(false)
        if (errorMessage.includes('Недостаточно сердец')) {
          showError(errorMessage, 8000)
        } else {
          showError(errorMessage)
        }
      })
    } catch (error: any) {
      console.error('Error updating category limits:', error)
      const errorMessage = error.message || 'Ошибка при обновлении лимитов'
      if (errorMessage.includes('Недостаточно сердец')) {
        showError(errorMessage, 8000)
      } else {
        showError(errorMessage)
      }
    }
  }

  useEffect(() => {
    return () => {
      if (updatePollRef.current) {
        clearInterval(updatePollRef.current)
      }
    }
  }, [])

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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">
                💰 Ваш доход
              </h2>
              {!isEditingIncome && (
                <button
                  onClick={handleEditIncome}
                  className="text-sm text-telegram-primary dark:text-telegram-dark-primary hover:underline"
                >
                  Изменить
                </button>
              )}
            </div>
            {isEditingIncome ? (
              <div className="space-y-3">
                <input
                  type="number"
                  value={editedIncome || ''}
                  onChange={(e) => setEditedIncome(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 border border-telegram-border dark:border-telegram-dark-border rounded-telegram bg-telegram-bg dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text text-lg"
                  placeholder="Введите сумму"
                  min="0"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveIncome}
                    className="btn-primary flex-1"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={handleCancelEditIncome}
                    className="btn-secondary flex-1"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold text-telegram-primary dark:text-telegram-dark-primary">
                  {Math.round(Number(biography.monthly_income)).toLocaleString('ru-RU', { useGrouping: true, maximumFractionDigits: 0 })} {biography.category_limits[0]?.currency || 'RUB'}
                </p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-2">
                  в месяц
                </p>
                {showUpdateButton && (
                  <div className="mt-4 pt-4 border-t border-telegram-border dark:border-telegram-dark-border">
                    <button
                      onClick={handleUpdateCategoryLimits}
                      disabled={isUpdatingLimits}
                      className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                      {isUpdatingLimits ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Обновление...
                        </>
                      ) : (
                        <>
                          🔄 Обновить лимиты категорий
                        </>
                      )}
                    </button>
                    <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-2 text-center">
                      Стоимость: 1 ❤️ сердце Люси
                    </p>
                    {gamificationStatus?.profile && (
                      <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1 text-center">
                        У вас: {gamificationStatus.profile.heart_level} ❤️
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
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
              {biography.category_limits.map((limit: CategoryLimit) => {
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
