import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { SnowPile } from '../components/SnowPile'
import { useNewYearTheme } from '../contexts/NewYearContext'

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
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [quickFormStep, setQuickFormStep] = useState<'category' | 'form'>('category')
  const [quickFormType, setQuickFormType] = useState<'income' | 'expense' | 'transfer' | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [error, setError] = useState('')

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
      setError('')
      
      // Call API with Promise.race for timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.error('[loadCategories] Timeout after 8 seconds')
          reject(new Error('Превышено время ожидания загрузки категорий'))
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
      setError(err.message || 'Ошибка загрузки категорий')
      setCategories([])
      throw err // Re-throw to handle in calling function
    }
  }

  const handleQuickAction = async (type: 'income' | 'expense' | 'transfer') => {
    console.log(`[handleQuickAction] Starting for type: ${type}`)
    setQuickFormType(type)
    setError('')
    
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
        setError(err.message || 'Ошибка загрузки категорий')
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
    setError('')

    if (!quickFormData.account_id) {
      setError('Выберите счет')
      return
    }

    if (!quickFormData.amount || parseFloat(quickFormData.amount) <= 0) {
      setError('Введите сумму больше 0')
      return
    }

    if (quickFormType === 'transfer' && !quickFormData.to_account_id) {
      setError('Выберите счет получателя')
      return
    }

    try {
      const account = (accounts as Account[]).find(a => a.id === parseInt(quickFormData.account_id))
      if (!account) {
        setError('Счет не найден')
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

      await api.createTransaction(submitData)
      
      // Refresh data - force refetch to ensure goals progress is updated
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['balance'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['monthly-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['goals'] }),
      ])
      
      // Refetch goals immediately to update progress
      await queryClient.refetchQueries({ queryKey: ['goals'] })
      
      // Close form
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
    } catch (err: any) {
      setError(err.message || 'Ошибка создания транзакции')
    }
  }

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'income': return 'Доход'
      case 'expense': return 'Расход'
      case 'transfer': return 'Перевод'
      default: return type
    }
  }

  const { isEnabled: newYearEnabled } = useNewYearTheme()

  return (
    <div className="min-h-screen p-4 md:p-6 animate-fade-in max-w-4xl mx-auto w-full relative">
      {/* Снежные кучки на странице */}
      {newYearEnabled && (
        <>
          <SnowPile className="top-20 right-4 md:right-8" size="small" />
          <SnowPile className="top-40 left-4 md:left-8" size="small" />
        </>
      )}

      {/* Header - скрыт на мобильных, так как есть в Layout */}
      <div className="mb-4 md:mb-6 hidden md:block">
        <h1 className="text-2xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-1">
          Дашборд
        </h1>
        <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
          Обзор ваших финансов
        </p>
      </div>

      {/* Balance Card - Hero */}
      <div className="card mb-4 md:mb-6 bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight text-white border-0 shadow-telegram-lg p-4 md:p-5 relative overflow-hidden">
        {/* Снежная кучка на карточке баланса */}
        {newYearEnabled && (
          <SnowPile className="bottom-2 right-2" size="small" />
        )}
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex-1">
            <p className="text-xs md:text-sm opacity-90 mb-1">Общий баланс</p>
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
        <div className="flex gap-2 md:gap-4 text-xs md:text-sm">
          <div className="flex-1 bg-white/10 rounded-telegram p-2 md:p-3 backdrop-blur-sm">
            <p className="opacity-80 mb-1">Доходы</p>
            {monthlyStatsLoading ? (
              <div className="h-5 md:h-6 w-20 md:w-24 bg-white/20 rounded animate-pulse"></div>
            ) : (
              <p className="text-base md:text-lg font-semibold">
                +{Math.round(monthlyStats?.income || 0).toLocaleString('ru-RU')} {balance?.currency || '₽'}
              </p>
            )}
          </div>
          <div className="flex-1 bg-white/10 rounded-telegram p-2 md:p-3 backdrop-blur-sm">
            <p className="opacity-80 mb-1">Расходы</p>
            {monthlyStatsLoading ? (
              <div className="h-5 md:h-6 w-20 md:w-24 bg-white/20 rounded animate-pulse"></div>
            ) : (
              <p className="text-base md:text-lg font-semibold">
                -{Math.round(monthlyStats?.expense || 0).toLocaleString('ru-RU')} {balance?.currency || '₽'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4 md:mb-6 relative">
        {/* Снежная кучка на быстрых действиях */}
        {newYearEnabled && (
          <SnowPile className="top-2 left-1/2 -translate-x-1/2" size="small" />
        )}
        <button 
          onClick={() => handleQuickAction('expense')}
          className="card-compact flex flex-col items-center gap-1.5 md:gap-2 p-3 md:p-4 group active:scale-[0.98] transition-transform relative"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-telegram-danger/10 flex items-center justify-center text-xl md:text-2xl group-active:bg-telegram-danger/20 transition-colors">
            ➖
          </div>
          <span className="text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text">Расход</span>
        </button>
        <button 
          onClick={() => handleQuickAction('income')}
          className="card-compact flex flex-col items-center gap-1.5 md:gap-2 p-3 md:p-4 group active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-telegram-success/10 dark:bg-telegram-success/20 flex items-center justify-center text-xl md:text-2xl group-active:bg-telegram-success/20 dark:group-active:bg-telegram-success/30 transition-colors">
            ➕
          </div>
          <span className="text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text">Доход</span>
        </button>
        <button 
          onClick={() => handleQuickAction('transfer')}
          className="card-compact flex flex-col items-center gap-1.5 md:gap-2 p-3 md:p-4 group active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-telegram-primaryLight/20 dark:bg-telegram-dark-primaryLight/20 flex items-center justify-center text-xl md:text-2xl group-active:bg-telegram-primaryLight/30 dark:group-active:bg-telegram-dark-primaryLight/30 transition-colors">
            🔄
          </div>
          <span className="text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text">Перевод</span>
        </button>
      </div>

      {/* Quick Form Modal */}
      {showQuickForm && quickFormType && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                {quickFormStep === 'category' && (
                  <button
                    onClick={() => {
                      setShowQuickForm(false)
                      setQuickFormType(null)
                      setQuickFormStep('category')
                      setError('')
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
                  {quickFormStep === 'category' ? 'Выберите категорию' : getTransactionTypeLabel(quickFormType)}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowQuickForm(false)
                  setQuickFormType(null)
                  setQuickFormStep('category')
                  setError('')
                }}
                className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-xl"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-telegram mb-4 text-sm">
                {error}
              </div>
            )}

            {/* Category Selection Step */}
            {quickFormStep === 'category' && quickFormType !== 'transfer' && (
              <div>
                {categoriesLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-telegram-primary dark:border-telegram-dark-primary mb-4"></div>
                    <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-3">Загрузка категорий...</p>
                    <button
                      onClick={() => {
                        console.log('[UI] User cancelled loading')
                        setCategoriesLoading(false)
                        setShowQuickForm(false)
                      }}
                      className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary underline hover:text-telegram-text dark:hover:text-telegram-dark-text"
                    >
                      Отмена
                    </button>
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
                      Нет доступных категорий для {quickFormType === 'income' ? 'доходов' : 'расходов'}
                    </p>
                    <button
                      onClick={() => {
                        setShowQuickForm(false)
                        navigate('/categories')
                      }}
                      className="btn-primary"
                    >
                      Создать категорию
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
                      Повторить загрузку
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-3">
                      Выберите категорию ({categories.length} доступно)
                    </p>
                    <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
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
                                {category.name}
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
              <form onSubmit={handleQuickSubmit} className="space-y-4">
              {/* Show selected category */}
              {quickFormType !== 'transfer' && quickFormData.category_id && (
                <div className="bg-telegram-surface dark:bg-telegram-dark-surface p-3 rounded-telegram mb-4">
                  <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1">Выбранная категория:</p>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const selectedCategory = categories.find(c => c.id === parseInt(quickFormData.category_id))
                      return selectedCategory ? (
                        <>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                            style={{ backgroundColor: `${selectedCategory.color || '#4CAF50'}20` }}
                          >
                            {selectedCategory.icon || '📦'}
                          </div>
                          <span className="font-medium text-telegram-text dark:text-telegram-dark-text">{selectedCategory.name}</span>
                        </>
                      ) : null
                    })()}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                  {quickFormType === 'transfer' ? 'Счет отправления' : 'Счет'}
                </label>
                <select
                  value={quickFormData.account_id}
                  onChange={(e) => setQuickFormData({ ...quickFormData, account_id: e.target.value })}
                  className="input"
                  required
                  disabled={accountsLoading}
                >
                  <option value="">Выберите счет</option>
                  {(accounts as Account[] || []).map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.balance.toLocaleString('ru-RU')} {account.currency})
                    </option>
                  ))}
                </select>
              </div>

              {quickFormType === 'transfer' && (
                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                    Счет получателя
                  </label>
                  <select
                    value={quickFormData.to_account_id}
                    onChange={(e) => setQuickFormData({ ...quickFormData, to_account_id: e.target.value })}
                    className="input"
                    required
                    disabled={accountsLoading}
                  >
                    <option value="">Выберите счет</option>
                    {(accounts as Account[] || [])
                      .filter(account => account.id !== parseInt(quickFormData.account_id || '0'))
                      .map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.balance.toLocaleString('ru-RU')} {account.currency})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                  Сумма
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={quickFormData.amount}
                  onChange={(e) => setQuickFormData({ ...quickFormData, amount: e.target.value })}
                  className="input"
                  placeholder="0.00"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                  Описание (необязательно)
                </label>
                <input
                  type="text"
                  value={quickFormData.description}
                  onChange={(e) => setQuickFormData({ ...quickFormData, description: e.target.value })}
                  className="input"
                  placeholder="Краткое описание"
                />
              </div>

              {quickFormType === 'income' && goals.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                    🎯 Добавить к цели (опционально)
                  </label>
                  <select
                    value={quickFormData.goal_id}
                    onChange={(e) => setQuickFormData({ ...quickFormData, goal_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Не добавлять к цели</option>
                    {goals.map((goal: any) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name} ({Math.round(goal.current_amount).toLocaleString()} / {Math.round(goal.target_amount).toLocaleString()} {goal.currency})
                      </option>
                    ))}
                  </select>
                  {quickFormData.goal_id && (
                    <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                      Эта сумма будет добавлена к выбранной цели
                    </p>
                  )}
                </div>
              )}

                <div className="flex gap-3">
                  <button type="submit" className="btn-primary flex-1">
                    Добавить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickForm(false)
                      setQuickFormType(null)
                      setQuickFormStep('category')
                      setError('')
                    }}
                    className="btn-secondary"
                  >
                    Отмена
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
            Последние транзакции
          </h2>
          <button 
            onClick={() => navigate('/transactions')}
            className="text-xs md:text-sm text-telegram-primary dark:text-telegram-dark-primary active:underline"
          >
            Все →
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
                      {transaction.category_name || transaction.description || 'Без категории'}
                    </p>
                  </div>
                  <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    {new Date(transaction.transaction_date).toLocaleDateString('ru-RU')}
                    {transaction.description && transaction.category_name && (
                      <span className="ml-2">• {transaction.description}</span>
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
            <p className="text-sm md:text-base text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-2">Нет транзакций</p>
            <p className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary px-4">
              Добавьте первую транзакцию, нажав на кнопки выше
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

