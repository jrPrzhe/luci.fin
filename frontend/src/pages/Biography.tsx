import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { OnboardingWizard } from '../components/OnboardingWizard'
import { useToast } from '../contexts/ToastContext'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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
  const [showIncomeHistory, setShowIncomeHistory] = useState(false)
  const incomeDetailsRef = useRef<HTMLDetailsElement | null>(null)
  const problemsDetailsRef = useRef<HTMLDetailsElement | null>(null)
  const goalDetailsRef = useRef<HTMLDetailsElement | null>(null)
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

  const { data: biographyHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['biography-history'],
    queryFn: () => api.getBiographyHistory(),
    enabled: showIncomeHistory,
    staleTime: 60000,
  })

  const incomeHistory = useMemo(() => {
    return (biographyHistory || [])
      .filter((entry: any) => entry && entry.monthly_income)
      .map((entry: any) => ({
        date: entry.period_start || entry.created_at,
        income: Number(entry.monthly_income) || 0,
      }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [biographyHistory])

  const formatDateLabel = (value: string) => {
    if (!value) return ''
    const date = new Date(value)
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

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
      if (incomeDetailsRef.current) {
        incomeDetailsRef.current.open = true
      }
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

  const currency = biography.category_limits?.[0]?.currency || 'RUB'
  const incomeValue = biography.monthly_income ? Math.round(Number(biography.monthly_income)) : 0
  const incomeLabel = `${incomeValue.toLocaleString('ru-RU', { useGrouping: true, maximumFractionDigits: 0 })} ${currency}`

  const getTextPreview = (value: string | null | undefined, maxLen = 140) => {
    const raw = (value || '').trim()
    if (!raw) return ''
    const normalized = raw.replace(/\s+/g, ' ')
    if (normalized.length <= maxLen) return normalized
    return `${normalized.slice(0, maxLen - 1)}…`
  }

  const openAndScroll = (ref: React.RefObject<HTMLDetailsElement | null>) => {
    const el = ref.current
    if (!el) return
    el.open = true
    // allow <details> to expand before scroll
    requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch {
        el.scrollIntoView()
      }
    })
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
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
              Ваш план
            </h1>
            <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
              Коротко и по делу: доход, приоритеты и лимиты на месяц
            </p>
          </div>

          {(biography.problems || biography.goal) && (
            <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
              {biography.problems && (
                <button
                  onClick={() => openAndScroll(problemsDetailsRef)}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold border border-telegram-border dark:border-telegram-dark-border bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover shadow-telegram"
                  title="Открыть: Проблемы"
                >
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-telegram-bg dark:bg-telegram-dark-bg border border-telegram-border dark:border-telegram-dark-border">
                    ⚠️
                  </span>
                  Проблема
                </button>
              )}
              {biography.goal && (
                <button
                  onClick={() => openAndScroll(goalDetailsRef)}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold border border-telegram-border dark:border-telegram-dark-border bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover shadow-telegram"
                  title="Открыть: Цель"
                >
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-telegram-bg dark:bg-telegram-dark-bg border border-telegram-border dark:border-telegram-dark-border">
                    🎯
                  </span>
                  Цель
                </button>
              )}
            </div>
          )}
        </div>

        {/* Доход */}
        {biography.monthly_income && (
          <details
            ref={incomeDetailsRef}
            className="group card p-0 overflow-hidden"
          >
            <summary className="cursor-pointer select-none p-5 [&::-webkit-details-marker]:hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-telegram-text dark:text-telegram-dark-text">
                    💰 Доход
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-telegram-surface dark:bg-telegram-dark-surface border border-telegram-border dark:border-telegram-dark-border text-telegram-primary dark:text-telegram-dark-primary">
                      {incomeLabel}
                    </span>
                    <span className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      в месяц
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowIncomeHistory(true)
                    }}
                    className="px-3 py-1 rounded-full text-xs font-semibold border border-telegram-border dark:border-telegram-dark-border bg-telegram-bg dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover"
                  >
                    📈 История
                  </button>
                  {!isEditingIncome && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleEditIncome()
                      }}
                      className="px-3 py-1 rounded-full text-xs font-semibold border border-telegram-border dark:border-telegram-dark-border bg-telegram-bg dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover"
                    >
                      ✏️ Изменить
                    </button>
                  )}
                  <span className="ml-1 text-telegram-textSecondary dark:text-telegram-dark-textSecondary transition-transform duration-200 group-open:rotate-180">
                    ▾
                  </span>
                </div>
              </div>
            </summary>

            <div className="px-5 pb-5 pt-1 border-t border-telegram-border dark:border-telegram-dark-border">
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
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        Текущий доход
                      </div>
                      <div className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text">
                        {incomeLabel}
                      </div>
                    </div>
                    {showUpdateButton && (
                      <div className="text-right">
                        <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                          Стоимость: 1 ❤️
                          {gamificationStatus?.profile ? ` · У вас: ${gamificationStatus.profile.heart_level} ❤️` : ''}
                        </div>
                      </div>
                    )}
                  </div>

                  {showUpdateButton && (
                    <div className="mt-4">
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
                          <>🔄 Обновить лимиты категорий</>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </details>
        )}

        {/* Проблемы и цель (коротко → раскрыть) */}
        {(biography.problems || biography.goal) && (
          <div className="grid md:grid-cols-2 gap-6">
            {biography.problems && (
              <details ref={problemsDetailsRef} className="group card p-0 overflow-hidden">
                <summary className="cursor-pointer select-none p-5 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-telegram-text dark:text-telegram-dark-text">
                        ⚠️ Проблемы
                      </div>
                      <div className="mt-1 text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        {getTextPreview(biography.problems, 160)}
                      </div>
                    </div>
                    <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary transition-transform duration-200 group-open:rotate-180">
                      ▾
                    </span>
                  </div>
                </summary>
                <div className="px-5 pb-5 pt-1 border-t border-telegram-border dark:border-telegram-dark-border">
                  <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary whitespace-pre-wrap">
                    {biography.problems}
                  </p>
                </div>
              </details>
            )}
            {biography.goal && (
              <details ref={goalDetailsRef} className="group card p-0 overflow-hidden">
                <summary className="cursor-pointer select-none p-5 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-telegram-text dark:text-telegram-dark-text">
                        🎯 Цель
                      </div>
                      <div className="mt-1 text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        {getTextPreview(biography.goal, 160)}
                      </div>
                    </div>
                    <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary transition-transform duration-200 group-open:rotate-180">
                      ▾
                    </span>
                  </div>
                </summary>
                <div className="px-5 pb-5 pt-1 border-t border-telegram-border dark:border-telegram-dark-border">
                  <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary whitespace-pre-wrap">
                    {biography.goal}
                  </p>
                </div>
              </details>
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
              Это ваш “план на месяц” по категориям: сколько тратить комфортно, чтобы приблизиться к цели.
            </p>

            <details className="mb-5 rounded-telegram border border-telegram-border dark:border-telegram-dark-border bg-telegram-bg dark:bg-telegram-dark-bg overflow-hidden">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-telegram-text dark:text-telegram-dark-text [&::-webkit-details-marker]:hidden">
                ℹ️ Как читать лимиты
                <span className="ml-2 text-telegram-textSecondary dark:text-telegram-dark-textSecondary font-normal">
                  (простое объяснение)
                </span>
              </summary>
              <div className="px-4 pb-4 pt-0 text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary space-y-2">
                <div>
                  <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">Ваш лимит</span> — то, что вы указали в анкете для категории.
                </div>
                <div>
                  <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">План от ИИ</span> — рекомендуемый лимит на месяц (ИИ опирается на вашу анкету и данные в приложении).
                </div>
                <div>
                  <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">Потрачено</span> — сколько уже потрачено в текущем периоде.
                </div>
                <div>
                  <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">Осталось / Превышение</span> — сколько ещё можно потратить по плану (или на сколько вы вышли за план).
                </div>
              </div>
            </details>

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
                          Ваш лимит (из анкеты):
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
                            План от ИИ (рекомендуемый):
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
                            {actualSpent <= aiLimit ? 'Осталось до плана:' : 'Превышение плана:'}
                          </span>
                          <span
                            className={`font-semibold ${
                              actualSpent <= aiLimit
                                ? 'text-green-500'
                                : 'text-red-500'
                            }`}
                          >
                            {(Math.abs(aiLimit - actualSpent)).toLocaleString('ru-RU')} {currency}
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

      {showIncomeHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-telegram-bg dark:bg-telegram-dark-bg rounded-telegram w-full max-w-2xl shadow-xl border border-telegram-border dark:border-telegram-dark-border">
            <div className="flex items-center justify-between p-4 border-b border-telegram-border dark:border-telegram-dark-border">
              <h3 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                История дохода
              </h3>
              <button
                onClick={() => setShowIncomeHistory(false)}
                className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {historyLoading ? (
                <div className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  Загрузка...
                </div>
              ) : incomeHistory.length === 0 ? (
                <div className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  Пока нет истории изменений дохода.
                </div>
              ) : (
                <>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={incomeHistory}>
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis />
                        <Tooltip
                          formatter={(value: number) => `${value.toLocaleString('ru-RU')} ₽`}
                          labelFormatter={(label: string) => formatDateLabel(label)}
                        />
                        <Line type="monotone" dataKey="income" stroke="#3390EC" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="max-h-52 overflow-auto border border-telegram-border dark:border-telegram-dark-border rounded-telegram">
                    <table className="w-full text-sm">
                      <thead className="bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        <tr>
                          <th className="text-left px-3 py-2">Дата</th>
                          <th className="text-right px-3 py-2">Доход</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeHistory.map((entry, idx) => (
                          <tr key={`${entry.date}-${idx}`} className="border-t border-telegram-border dark:border-telegram-dark-border">
                            <td className="px-3 py-2">{formatDateLabel(entry.date)}</td>
                            <td className="px-3 py-2 text-right">{entry.income.toLocaleString('ru-RU')} ₽</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
