import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useI18n } from '../contexts/I18nContext'
import { AchievementModal } from '../components/AchievementModal'
import { LevelUpModal } from '../components/LevelUpModal'
import { UserStatsCard } from '../components/UserStatsCard'
import { useToast } from '../contexts/ToastContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface Account {
  id: number
  name: string
  type: string
  currency: string
  balance: number
}

interface Category {
  id: number
  name: string
  icon?: string
  color?: string
  transaction_type: 'income' | 'expense' | 'both'
  is_favorite: boolean
}

export function Dashboard() {
  const { t, translateCategoryName } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showError, showSuccess } = useToast()
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [quickFormStep, setQuickFormStep] = useState<'category' | 'form'>('category')
  const [quickFormType, setQuickFormType] = useState<'income' | 'expense' | 'transfer' | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newAchievement, setNewAchievement] = useState<any>(null)
  const [levelUp, setLevelUp] = useState<number | null>(null)

  // Quick form state
  const [quickFormData, setQuickFormData] = useState({
    category_id: '',
    account_id: '',
    to_account_id: '',
    amount: '',
    description: '',
    goal_id: '',
  })

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => {
      try {
        return await api.getBalance()
      } catch (error) {
        console.error('Error fetching balance:', error)
        return { total: 0, currency: 'RUB', accounts: [] }
      }
    },
    retry: 1,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      try {
        return await api.getAccounts()
      } catch (error) {
        console.error('Error fetching accounts:', error)
        return []
      }
    },
    retry: 1,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  })

  const { data: recentTransactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      try {
        return await api.getTransactions(10)
      } catch (error) {
        console.error('Error fetching transactions:', error)
        return []
      }
    },
    retry: 1,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })

  // Получаем данные текущего пользователя для проверки премиум статуса
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.getCurrentUser(),
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  })

  // Получаем доходы и расходы за текущий месяц
  const { data: monthlyStats, isLoading: monthlyStatsLoading } = useQuery({
    queryKey: ['monthly-stats'],
    queryFn: async () => {
      try {
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        
        // Форматируем даты в формат YYYY-MM-DD
        const startDate = firstDay.toISOString().split('T')[0]
        const endDate = lastDay.toISOString().split('T')[0]
        
        const [incomeTransactions, expenseTransactions] = await Promise.all([
          api.getTransactions(1000, 0, undefined, undefined, 'income', startDate, endDate),
          api.getTransactions(1000, 0, undefined, undefined, 'expense', startDate, endDate),
        ])
        
        // Исключаем транзакции перевода из доходов (транзакции с to_account_id - это переводы)
        // В расходах переводы учитываем (перевод из личного счета = расход)
        const income = (incomeTransactions || [])
          .filter((t: any) => !t.to_account_id) // Исключаем переводы
          .reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0)
        const expense = (expenseTransactions || []).reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0)
        
        return { income, expense }
      } catch (error) {
        console.error('Error fetching monthly stats:', error)
        return { income: 0, expense: 0 }
      }
    },
    retry: 1,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  // Получаем цели для выбора в форме дохода
  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.getGoals('active'),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const loadCategories = async (transactionType: 'income' | 'expense'): Promise<void> => {
    console.log(`[loadCategories] Starting to load categories for ${transactionType}`)
    try {
      // Call API with Promise.race for timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.error('[loadCategories] Timeout after 8 seconds')
          reject(new Error(t.dashboard.form.retry))
        }, 8000)
      })
      
      // Call API: getCategories(transactionType?, favoritesOnly?, includeShared?)
      console.log(`[loadCategories] Calling API...`)
      const cats = await Promise.race([
        api.getCategories(transactionType, false, true),
        timeoutPromise
      ]) as any[]
      
      console.log(`[loadCategories] API response received:`, cats)
      
      // Ensure we have a valid array
      if (cats && Array.isArray(cats)) {
        console.log(`[loadCategories] Setting ${cats.length} categories`)
        setCategories(cats)
      } else {
        console.warn(`[loadCategories] Invalid response format:`, cats)
        setCategories([])
      }
      console.log(`[loadCategories] Successfully loaded categories`)
    } catch (err: any) {
      console.error('[loadCategories] Error loading categories:', err)
      showError(err.message || 'Ошибка загрузки категорий')
      setCategories([])
      throw err // Re-throw to handle in calling function
    }
  }

  const handleQuickAction = async (type: 'income' | 'expense' | 'transfer') => {
    console.log(`[handleQuickAction] Starting for type: ${type}`)
    setQuickFormType(type)
    
    // Reset categories first
    setCategories([])
    setCategoriesLoading(true)
    console.log(`[handleQuickAction] Set categoriesLoading = true`)
    
    // Show form immediately with loading state
    setShowQuickForm(true)
    setQuickFormStep(type === 'transfer' ? 'form' : 'category')
    
    setQuickFormData({
      category_id: '',
      account_id: accounts && accounts.length > 0 ? accounts[0].id.toString() : '',
      to_account_id: '',
      amount: '',
      description: '',
      goal_id: '',
    })
    
    // Load categories for income/expense
    if (type === 'income' || type === 'expense') {
      try {
        console.log(`[handleQuickAction] Loading categories for ${type}...`)
        await loadCategories(type)
        console.log(`[handleQuickAction] Categories loaded successfully`)
      } catch (err: any) {
        console.error('[handleQuickAction] Error loading categories:', err)
        showError(err.message || t.errors.networkError)
      } finally {
        // Always reset loading state
        console.log(`[handleQuickAction] Setting categoriesLoading = false`)
        setCategoriesLoading(false)
      }
    } else {
      console.log(`[handleQuickAction] Transfer type, skipping categories`)
      setCategoriesLoading(false)
    }
    console.log(`[handleQuickAction] Completed`)
  }

  const handleCategorySelect = (categoryId: number) => {
    setQuickFormData({ ...quickFormData, category_id: categoryId.toString() })
    setQuickFormStep('form')
  }

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!quickFormData.account_id) {
      showError(t.dashboard.form.selectAccount)
      return
    }

    if (!quickFormData.amount || parseFloat(quickFormData.amount) <= 0) {
      showError(t.errors.required)
      return
    }

    // Validate amount: max 13 digits before decimal point (NUMERIC(15, 2) constraint)
    const amountStr = quickFormData.amount.toString()
    const parts = amountStr.split('.')
    const integerPart = parts[0].replace(/[^0-9]/g, '') // Remove any non-digits
    if (integerPart.length > 13) {
      showError('Сумма слишком большая. Максимум 13 цифр перед запятой.')
      return
    }

    if (quickFormType === 'transfer' && !quickFormData.to_account_id) {
      showError(t.dashboard.form.toAccount)
      return
    }

    setSubmitting(true)

    try {
      const account = (accounts as Account[]).find(a => a.id === parseInt(quickFormData.account_id))
      if (!account) {
        showError(t.errors.notFound)
        setSubmitting(false)
        return
      }

      const submitData: any = {
        account_id: parseInt(quickFormData.account_id),
        transaction_type: quickFormType,
        amount: parseFloat(quickFormData.amount),
        currency: account.currency,
        description: quickFormData.description || undefined,
        transaction_date: new Date().toISOString(),
      }

      // Add category_id if selected (for income/expense)
      if (quickFormData.category_id && (quickFormType === 'income' || quickFormType === 'expense')) {
        submitData.category_id = parseInt(quickFormData.category_id)
      }

      if (quickFormType === 'transfer') {
        submitData.to_account_id = parseInt(quickFormData.to_account_id)
      }

      // Add goal_id if specified (only for income transactions to add to goal)
      if (quickFormData.goal_id && quickFormType === 'income') {
        submitData.goal_id = parseInt(quickFormData.goal_id)
      }

      // Create transaction
      const response = await api.createTransaction(submitData)
      
      // Проверяем события геймификации
      if (response.gamification) {
        const gamification = response.gamification
        
        // Проверяем повышение уровня
        if (gamification.level_up && gamification.new_level) {
          setLevelUp(gamification.new_level)
        }
        
        // Проверяем новые достижения
        if (gamification.new_achievements && gamification.new_achievements.length > 0) {
          // Показываем первое достижение, остальные покажем после закрытия
          setNewAchievement(gamification.new_achievements[0])
        }
      }
      
      // Close form immediately (optimistic UI update)
      setShowQuickForm(false)
      setQuickFormType(null)
      setQuickFormStep('category')
      setQuickFormData({
        category_id: '',
        account_id: '',
        to_account_id: '',
        amount: '',
        description: '',
        goal_id: '',
      })
      
      // Invalidate queries in background (don't wait for refetch)
      // This will trigger refetch on next useQuery call
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['monthly-stats'] })
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['gamification-status'] })
      queryClient.invalidateQueries({ queryKey: ['daily-quests'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      
      // Optionally refetch critical data in background (non-blocking)
      Promise.all([
        queryClient.refetchQueries({ queryKey: ['balance'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['recent-transactions'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['goals'], type: 'active' }),
      ]).catch(console.error) // Don't block UI on refetch errors
      
      showSuccess(t.dashboard.quickActions[quickFormType || 'expense'] + ' добавлен')
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      const errorMessage = translateError(err)
      showError(errorMessage)
      setSubmitting(false)
    } finally {
      // Reset submitting after a short delay to allow form to close
      setTimeout(() => setSubmitting(false), 100)
    }
  }

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'income': return t.dashboard.quickActions.income
      case 'expense': return t.dashboard.quickActions.expense
      case 'transfer': return t.dashboard.quickActions.transfer
      default: return type
    }
  }

  return (
    <div className="min-h-screen animate-fade-in w-full">
      {/* Header - скрыт на мобильных, так как есть в Layout */}
      <div className="mb-4 md:mb-6 hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-1">
            {t.dashboard.title}
          </h1>
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            {t.dashboard.subtitle}
          </p>
        </div>
      </div>

      {/* Balance Card - Hero */}
      <div className="card mb-4 md:mb-6 bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight text-white border-0 shadow-telegram-lg p-4 md:p-5 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {/* Premium Badge - перед "Общий баланс" */}
              {currentUser?.is_premium && (
                <div className="flex items-center gap-1.5 bg-yellow-400/20 backdrop-blur-sm border border-yellow-300/30 rounded-full px-2.5 py-1">
                  <span className="text-yellow-300 text-sm">⭐</span>
                  <span className="text-yellow-100 text-xs font-semibold">Премиум</span>
                </div>
              )}
              <p className="text-xs md:text-sm opacity-90">{t.dashboard.totalBalance}</p>
            </div>
            {balanceLoading ? (
              <div className="h-8 md:h-10 w-24 md:w-32 bg-white/20 rounded-telegram animate-pulse"></div>
            ) : (
              <p className="text-2xl md:text-4xl font-bold break-all">
                {Math.round(balance?.total || 0).toLocaleString('ru-RU')} {balance?.currency || '₽'}
              </p>
            )}
          </div>
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl md:text-3xl ml-2 flex-shrink-0">
            💰
          </div>
        </div>
        <div className="flex gap-2 md:gap-4 text-xs md:text-sm mb-3 md:mb-4">
          <div className="flex-1 bg-white/10 rounded-telegram p-2 md:p-3 backdrop-blur-sm">
            <p className="opacity-80 mb-1">{t.dashboard.income}</p>
            {monthlyStatsLoading ? (
              <div className="h-5 md:h-6 w-20 md:w-24 bg-white/20 rounded animate-pulse"></div>
            ) : (
              <p className="text-base md:text-lg font-semibold">
                +{Math.round(monthlyStats?.income || 0).toLocaleString('ru-RU')} {balance?.currency || '₽'}
              </p>
            )}
          </div>
          <div className="flex-1 bg-white/10 rounded-telegram p-2 md:p-3 backdrop-blur-sm">
            <p className="opacity-80 mb-1">{t.dashboard.expenses}</p>
            {monthlyStatsLoading ? (
              <div className="h-5 md:h-6 w-20 md:w-24 bg-white/20 rounded animate-pulse"></div>
            ) : (
              <p className="text-base md:text-lg font-semibold">
                -{Math.round(monthlyStats?.expense || 0).toLocaleString('ru-RU')} {balance?.currency || '₽'}
              </p>
            )}
          </div>
        </div>
        
        {/* Quick Actions - внутри блока баланса */}
        <div className="grid grid-cols-4 gap-2 md:gap-3 pt-2 md:pt-3 border-t border-white/20">
          <button 
            onClick={() => handleQuickAction('expense')}
            className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-3 rounded-telegram bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all group"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center text-lg md:text-xl group-active:bg-white/30 transition-colors">
              ➖
            </div>
            <span className="text-xs font-medium text-white/90">{t.dashboard.quickActions.expense}</span>
          </button>
          <button 
            onClick={() => handleQuickAction('income')}
            className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-3 rounded-telegram bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all group"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center text-lg md:text-xl group-active:bg-white/30 transition-colors">
              ➕
            </div>
            <span className="text-xs font-medium text-white/90">{t.dashboard.quickActions.income}</span>
          </button>
          <button 
            onClick={() => handleQuickAction('transfer')}
            className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-3 rounded-telegram bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all group"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center text-lg md:text-xl group-active:bg-white/30 transition-colors">
              🔄
            </div>
            <span className="text-xs font-medium text-white/90">{t.dashboard.quickActions.transfer}</span>
          </button>
          <button 
            onClick={() => navigate('/categories')}
            className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-3 rounded-telegram bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all group"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center text-lg md:text-xl group-active:bg-white/30 transition-colors">
              📦
            </div>
            <span className="text-xs font-medium text-white/90">{t.dashboard.quickActions.categories}</span>
          </button>
        </div>
      </div>

      {/* User Stats Card - Level, Streak, Hearts */}
      <div className="mb-4 md:mb-6">
        <UserStatsCard />
      </div>

      {/* Achievement Modal */}
      {newAchievement && (
        <AchievementModal
          achievement={newAchievement}
          onClose={() => {
            setNewAchievement(null)
            // Можно добавить очередь для показа следующих достижений
          }}
        />
      )}

      {/* Level Up Modal */}
      {levelUp && (
        <LevelUpModal
          newLevel={levelUp}
          onClose={() => setLevelUp(null)}
        />
      )}

      {/* Quick Form Modal */}
      {showQuickForm && quickFormType && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md sm:max-w-lg md:max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                {quickFormStep === 'category' && (
                  <button
                    onClick={() => {
                      setShowQuickForm(false)
                      setQuickFormType(null)
                      setQuickFormStep('category')
                    }}
                    className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-lg mr-2"
                  >
                    ←
                  </button>
                )}
                {quickFormStep === 'form' && quickFormType !== 'transfer' && (
                  <button
                    onClick={() => setQuickFormStep('category')}
                    className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-lg mr-2"
                  >
                    ←
                  </button>
                )}
                  <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                  {quickFormStep === 'category' ? t.dashboard.form.selectCategory : getTransactionTypeLabel(quickFormType)}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowQuickForm(false)
                  setQuickFormType(null)
                  setQuickFormStep('category')
                }}
                className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-xl"
              >
                ✕
              </button>
            </div>

            {/* Category Selection Step */}
            {quickFormStep === 'category' && quickFormType !== 'transfer' && (
              <div>
                {categoriesLoading ? (
                  <div className="text-center py-8">
                    <LoadingSpinner fullScreen={false} size="sm" />
                    <button
                      onClick={() => {
                        console.log('[UI] User cancelled loading')
                        setCategoriesLoading(false)
                        setShowQuickForm(false)
                      }}
                      className="mt-4 text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary underline hover:text-telegram-text dark:hover:text-telegram-dark-text"
                    >
                      {t.common.cancel}
                    </button>
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
                      {t.dashboard.form.noCategories} {quickFormType === 'income' ? t.dashboard.incomeGenitive : t.dashboard.expensesGenitive}
                    </p>
                    <button
                      onClick={() => {
                        setShowQuickForm(false)
                        navigate('/categories')
                      }}
                      className="btn-primary"
                    >
                      {t.dashboard.form.createCategory}
                    </button>
                    <button
                      onClick={() => {
                        // Retry loading categories
                        if (quickFormType === 'income' || quickFormType === 'expense') {
                          loadCategories(quickFormType)
                        }
                      }}
                      className="btn-secondary mt-2"
                    >
                      {t.dashboard.form.retry}
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-3">
                      {t.dashboard.form.selectCategory} ({categories.length} {t.dashboard.form.available})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                      {categories
                        .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0))
                        .map((category) => (
                          <button
                            key={category.id}
                            onClick={() => handleCategorySelect(category.id)}
                            className="card p-4 text-left hover:shadow-lg transition-all active:scale-[0.98]"
                            style={{
                              borderLeft: `4px solid ${category.color || '#4CAF50'}`,
                            }}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <div
                                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                                style={{ backgroundColor: `${category.color || '#4CAF50'}20` }}
                              >
                                {category.icon || '📦'}
                              </div>
                              <span className="font-medium text-sm text-telegram-text dark:text-telegram-dark-text text-center">
                                {translateCategoryName(category.name)}
                              </span>
                              {category.is_favorite && (
                                <span className="text-xs text-yellow-500">⭐</span>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Form Step */}
            {quickFormStep === 'form' && (
              <form onSubmit={handleQuickSubmit} className="space-y-3">
              {/* Show selected category - compact display */}
              {quickFormType !== 'transfer' && quickFormData.category_id && (
                <div className="bg-telegram-surface dark:bg-telegram-dark-surface p-2 rounded-telegram mb-2 flex items-center gap-2">
                  {(() => {
                    const selectedCategory = categories.find(c => c.id === parseInt(quickFormData.category_id))
                    return selectedCategory ? (
                      <>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                          style={{ backgroundColor: `${selectedCategory.color || '#4CAF50'}20` }}
                        >
                          {selectedCategory.icon || '📦'}
                        </div>
                        <span className="font-medium text-sm text-telegram-text dark:text-telegram-dark-text">{selectedCategory.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickFormStep('category')
                            setQuickFormData({ ...quickFormData, category_id: '' })
                          }}
                          className="ml-auto text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text"
                        >
                          {t.dashboard.form.change}
                        </button>
                      </>
                    ) : null
                  })()}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {quickFormType === 'transfer' ? t.dashboard.form.fromAccount : t.dashboard.form.account}
                  </label>
                  <select
                    value={quickFormData.account_id}
                    onChange={(e) => setQuickFormData({ ...quickFormData, account_id: e.target.value })}
                    className="input text-sm py-2"
                    required
                    disabled={accountsLoading || submitting}
                  >
                    <option value="">{t.dashboard.form.selectAccount}</option>
                    {(accounts as Account[] || []).map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({Math.round(account.balance).toLocaleString('ru-RU')} {account.currency})
                      </option>
                    ))}
                  </select>
                </div>

                {quickFormType === 'transfer' ? (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                      {t.dashboard.form.toAccount}
                    </label>
                    <select
                      value={quickFormData.to_account_id}
                      onChange={(e) => setQuickFormData({ ...quickFormData, to_account_id: e.target.value })}
                      className="input text-sm py-2"
                      required
                      disabled={accountsLoading || submitting}
                    >
                      <option value="">{t.dashboard.form.selectAccount}</option>
                      {(accounts as Account[] || [])
                        .filter(account => account.id !== parseInt(quickFormData.account_id || '0'))
                        .map(account => (
                          <option key={account.id} value={account.id}>
                            {account.name} ({Math.round(account.balance).toLocaleString('ru-RU')} {account.currency})
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {t.dashboard.form.amount} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={quickFormData.amount}
                    onChange={(e) => setQuickFormData({ ...quickFormData, amount: e.target.value })}
                    className="input text-lg font-semibold py-2"
                    placeholder="0"
                    required
                    autoFocus
                    disabled={submitting}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {t.dashboard.form.description}
                  </label>
                  <input
                    type="text"
                    value={quickFormData.description}
                    onChange={(e) => setQuickFormData({ ...quickFormData, description: e.target.value })}
                    className="input text-sm py-2"
                    placeholder={t.common.optional}
                    disabled={submitting}
                  />
                </div>
              </div>

              {quickFormType === 'income' && goals.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                    🎯 {t.dashboard.form.addToGoalOptional}
                  </label>
                  <select
                    value={quickFormData.goal_id}
                    onChange={(e) => setQuickFormData({ ...quickFormData, goal_id: e.target.value })}
                    className="input"
                    disabled={submitting}
                  >
                    <option value="">{t.dashboard.form.notAddToGoal}</option>
                    {goals.map((goal: any) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name} ({Math.round(goal.current_amount).toLocaleString()} / {Math.round(goal.target_amount).toLocaleString()} {goal.currency})
                      </option>
                    ))}
                  </select>
                  {quickFormData.goal_id && (
                    <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                      {t.dashboard.form.goalAmountNote}
                    </p>
                  )}
                </div>
              )}

                <div className="flex gap-3">
                  <button 
                    type="submit" 
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>{t.dashboard.form.processing}</span>
                      </>
                    ) : (
                      t.common.add
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickForm(false)
                      setQuickFormType(null)
                      setQuickFormStep('category')
                      setSubmitting(false)
                    }}
                    className="btn-secondary"
                    disabled={submitting}
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card p-4 md:p-5">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-base md:text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
            {t.dashboard.recentTransactions}
          </h2>
          <button 
            onClick={() => navigate('/transactions')}
            className="text-xs md:text-sm text-telegram-primary dark:text-telegram-dark-primary active:underline"
          >
            {t.dashboard.viewAll}
          </button>
        </div>
        
        {transactionsLoading ? (
          <div className="space-y-2 md:space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-telegram bg-telegram-bg dark:bg-telegram-dark-bg animate-pulse">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-telegram-border dark:bg-telegram-dark-border flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="h-3 md:h-4 w-20 md:w-24 bg-telegram-border dark:bg-telegram-dark-border rounded mb-2"></div>
                  <div className="h-2 md:h-3 w-14 md:w-16 bg-telegram-border dark:bg-telegram-dark-border rounded"></div>
                </div>
                <div className="h-3 md:h-4 w-16 md:w-20 bg-telegram-border dark:bg-telegram-dark-border rounded flex-shrink-0"></div>
              </div>
            ))}
          </div>
        ) : recentTransactions && recentTransactions.length > 0 ? (
          <div className="space-y-1 md:space-y-2">
            {recentTransactions.map((transaction: any) => (
              <div 
                key={transaction.id} 
                className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-telegram active:bg-telegram-hover transition-colors group"
              >
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-base md:text-lg flex-shrink-0 ${
                  transaction.transaction_type === 'income' 
                    ? 'bg-telegram-success/10' 
                    : transaction.transaction_type === 'expense'
                    ? 'bg-telegram-danger/10'
                    : 'bg-telegram-primaryLight/20'
                }`}>
                  {transaction.transaction_type === 'income' ? '➕' : transaction.transaction_type === 'expense' ? '➖' : '🔄'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {transaction.category_icon && (
                      <span className="text-base">{transaction.category_icon}</span>
                    )}
                    <p className="font-medium text-sm md:text-base text-telegram-text dark:text-telegram-dark-text truncate">
                      {transaction.category_name || transaction.description || t.dashboard.form.category}
                    </p>
                  </div>
                  <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary truncate">
                    {new Date(transaction.transaction_date).toLocaleDateString('ru-RU')}
                    {transaction.description && transaction.category_name && (
                      <span className="ml-2">• <span className="truncate">{transaction.description}</span></span>
                    )}
                  </p>
                </div>
                <p className={`font-semibold text-sm md:text-base whitespace-nowrap flex-shrink-0 ${
                  transaction.transaction_type === 'income' 
                    ? 'text-telegram-success' 
                    : transaction.transaction_type === 'expense'
                    ? 'text-telegram-danger'
                    : 'text-telegram-primary'
                }`}>
                  {transaction.transaction_type === 'income' ? '+' : transaction.transaction_type === 'expense' ? '-' : '↔'}
                  {Math.round(transaction.amount).toLocaleString('ru-RU')} {transaction.currency}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 md:py-12">
            <div className="text-4xl md:text-5xl mb-3 md:mb-4 opacity-30">💳</div>
            <p className="text-sm md:text-base text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-2">{t.dashboard.noTransactions}</p>
            <p className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary px-4">
              {t.dashboard.noTransactionsDesc}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

