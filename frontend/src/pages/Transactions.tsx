import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useI18n } from '../contexts/I18nContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface Transaction {
  id: number
  account_id: number
  transaction_type: 'income' | 'expense' | 'transfer'
  amount: number
  currency: string
  category_id?: number
  category_name?: string
  category_icon?: string
  description?: string
  transaction_date: string
  to_account_id?: number
  parent_transaction_id?: number
  created_at: string
  updated_at?: string
  is_shared?: boolean
}

interface Account {
  id: number
  name: string
  type: string
  currency: string
  balance: number
  is_shared?: boolean
  shared_budget_id?: number | null
}

interface Category {
  id: number
  name: string
  icon?: string
  color?: string
  transaction_type: 'income' | 'expense' | 'both'
  is_favorite: boolean
}

export function Transactions() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const { showError, showSuccess } = useToast()
  const { translateCategoryName } = useI18n()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  // Загружаем сохраненные фильтры из localStorage при инициализации
  const loadSavedFilters = () => {
    try {
      const saved = localStorage.getItem('transactionsFilters')
      if (saved) {
        const filters = JSON.parse(saved)
        return {
          filterType: filters.filterType || 'all',
          transactionTypeFilter: filters.transactionTypeFilter || 'all',
          dateFilter: filters.dateFilter || 'all',
          customStartDate: filters.customStartDate || '',
          customEndDate: filters.customEndDate || '',
          showDateFilter: filters.showDateFilter || false,
        }
      }
    } catch (e) {
      console.error('Error loading saved filters:', e)
    }
    return {
      filterType: 'all' as const,
      transactionTypeFilter: 'all' as const,
      dateFilter: 'all' as const,
      customStartDate: '',
      customEndDate: '',
      showDateFilter: false,
    }
  }

  const savedFilters = loadSavedFilters()
  const [filterType, setFilterType] = useState<'all' | 'own' | 'shared'>(savedFilters.filterType)
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>(savedFilters.transactionTypeFilter)
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>(savedFilters.dateFilter)
  const [customStartDate, setCustomStartDate] = useState(savedFilters.customStartDate)
  const [customEndDate, setCustomEndDate] = useState(savedFilters.customEndDate)
  const [showDateFilter, setShowDateFilter] = useState(savedFilters.showDateFilter)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const accountIdFromNavigation = useRef<number | null>(null)

  const [goals, setGoals] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean
    message: string
    onConfirm: () => void | Promise<void>
  }>({
    show: false,
    message: '',
    onConfirm: () => {},
  })

  // Form state
  const [formData, setFormData] = useState({
    account_id: '',
    transaction_type: 'expense' as 'income' | 'expense' | 'transfer',
    amount: '',
    currency: 'RUB',
    category_id: '',
    description: '',
    transaction_date: new Date().toISOString().slice(0, 16),
    to_account_id: '',
    goal_id: '',
  })

  const getDateRange = () => {
    const now = new Date()
    let startDate: string | undefined
    let endDate: string | undefined

    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      startDate = today.toISOString()
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      startDate = weekAgo.toISOString()
      endDate = now.toISOString()
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      startDate = monthAgo.toISOString()
      endDate = now.toISOString()
    } else if (dateFilter === 'year') {
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      startDate = yearAgo.toISOString()
      endDate = now.toISOString()
    } else if (dateFilter === 'custom') {
      if (customStartDate) {
        startDate = new Date(customStartDate).toISOString()
      }
      if (customEndDate) {
        const end = new Date(customEndDate)
        end.setHours(23, 59, 59, 999)
        endDate = end.toISOString()
      }
    }

    return { startDate, endDate }
  }

  const loadGoals = async () => {
    try {
      const activeGoals = await api.getGoals('active')
      setGoals(activeGoals)
    } catch (err) {
      console.error('Failed to load goals:', err)
    }
  }

  const loadData = async (reset: boolean = true) => {
    try {
      if (reset) {
        setLoading(true)
        setTransactions([])
      } else {
        setLoadingMore(true)
      }
      
      // Load goals in background (don't block transactions loading)
      loadGoals().catch(err => console.error('Failed to load goals:', err))
      
      const filterParam = filterType === 'all' ? undefined : filterType
      const transactionTypeParam = transactionTypeFilter === 'all' ? undefined : transactionTypeFilter
      const { startDate, endDate } = getDateRange()
      
      // Загружаем только 25 транзакций за раз
      const limit = 25
      const offset = reset ? 0 : transactions.length
      
      // Use selectedAccountId if set (from navigation from Accounts page)
      const accountIdParam = selectedAccountId || undefined
      
      const batch = await api.getTransactions(
        limit, 
        offset, 
        accountIdParam, 
        filterParam, 
        transactionTypeParam, 
        startDate, 
        endDate
      )
      
      // Если получили меньше чем limit, значит это последняя страница
      setHasMore(batch.length === limit)
      
      if (reset) {
        setTransactions(batch)
      } else {
        setTransactions([...transactions, ...batch])
      }
      
      // Загружаем счета только при первой загрузке
      if (reset && accounts.length === 0) {
        const accountsData = await api.getAccounts()
        setAccounts(accountsData)
      }
    } catch (err: any) {
      showError(err.message || 'Ошибка загрузки данных')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = async () => {
    await loadData(false)
  }

  // Сохраняем фильтры в localStorage при их изменении
  useEffect(() => {
    const filtersToSave = {
      filterType,
      transactionTypeFilter,
      dateFilter,
      customStartDate,
      customEndDate,
      showDateFilter,
    }
    localStorage.setItem('transactionsFilters', JSON.stringify(filtersToSave))
  }, [filterType, transactionTypeFilter, dateFilter, customStartDate, customEndDate, showDateFilter])

  // Check if we came from Accounts page with accountId
  useEffect(() => {
    const state = location.state as { accountId?: number } | null
    if (state?.accountId && !accountIdFromNavigation.current) {
      // Save accountId from navigation
      const accountId = state.accountId
      accountIdFromNavigation.current = accountId
      setSelectedAccountId(accountId)
      // Clear state to avoid re-applying on re-render
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Load data when selectedAccountId changes (after it's set from location.state)
  useEffect(() => {
    // Only load if selectedAccountId was set from navigation
    if (selectedAccountId !== null && accountIdFromNavigation.current === selectedAccountId) {
      // Load data with the account filter
      loadData(true)
      // Clear the ref to prevent re-loading
      accountIdFromNavigation.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId])

  // Load data only on initial mount (if no accountId in location.state)
  useEffect(() => {
    // Only load if we didn't come from Accounts page (which will trigger loadData in the effect above)
    const state = location.state as { accountId?: number } | null
    if (!state?.accountId) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadCategories = async (transactionType: 'income' | 'expense' | 'transfer') => {
    if (transactionType === 'transfer') {
      setCategories([])
      return
    }
    try {
      const cats = await api.getCategories(transactionType, false)
      setCategories(cats)
    } catch (err: any) {
      console.error('Failed to load categories:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate amount: max 13 digits before decimal point (NUMERIC(15, 2) constraint)
    const amountStr = formData.amount.toString()
    const parts = amountStr.split('.')
    const integerPart = parts[0].replace(/[^0-9]/g, '') // Remove any non-digits
    if (integerPart.length > 13) {
      showError('Сумма слишком большая. Максимум 13 цифр перед запятой.')
      return
    }

    try {
      // Validate category for income/expense transactions
      if ((formData.transaction_type === 'income' || formData.transaction_type === 'expense') && !formData.category_id) {
        showError('Выберите категорию')
        return
      }

      const submitData: any = {
        account_id: parseInt(formData.account_id),
        transaction_type: formData.transaction_type,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        description: formData.description || undefined,
        transaction_date: new Date(formData.transaction_date).toISOString(),
      }

      if (formData.transaction_type === 'transfer') {
        if (!formData.to_account_id) {
          showError('Выберите счет получателя для перевода')
          return
        }
        submitData.to_account_id = parseInt(formData.to_account_id)
      } else {
        // Category is already validated above, so we can safely add it
        submitData.category_id = parseInt(formData.category_id)
      }

      // Add goal_id if specified (only for income transactions to add to goal)
      if (formData.goal_id && formData.transaction_type === 'income') {
        submitData.goal_id = parseInt(formData.goal_id)
      }

      if (editingTransaction) {
        await api.updateTransaction(editingTransaction.id, submitData)
      } else {
        await api.createTransaction(submitData)
      }

      // Reset form and reload
      resetForm()
      await loadData()
      await loadGoals()  // Reload goals to update progress
      setShowForm(false)
      
      // Invalidate React Query cache for analytics/reports
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] })
      
      showSuccess(editingTransaction ? 'Транзакция обновлена' : 'Транзакция добавлена')
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      const errorMessage = translateError(err)
      showError(errorMessage)
    }
  }

  const handleEdit = async (transaction: Transaction) => {
    setEditingTransaction(transaction)
    await loadCategories(transaction.transaction_type)
    setFormData({
      account_id: transaction.account_id.toString(),
      transaction_type: transaction.transaction_type,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      category_id: transaction.category_id?.toString() || '',
      description: transaction.description || '',
      transaction_date: new Date(transaction.transaction_date).toISOString().slice(0, 16),
      to_account_id: transaction.to_account_id?.toString() || '',
      goal_id: (transaction as any).goal_id?.toString() || '',
    })
    setShowForm(true)
    
    // Прокручиваем к форме редактирования после небольшой задержки для рендеринга
    setTimeout(() => {
      const formElement = document.getElementById(`edit-form-${transaction.id}`)
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const handleDelete = (id: number) => {
    setConfirmModal({
      show: true,
      message: 'Вы уверены, что хотите удалить эту транзакцию?',
      onConfirm: async () => {
        // Сохраняем текущий список транзакций для отката в случае ошибки
        const previousTransactions = [...transactions]
        
        try {
          // Удаляем транзакцию на сервере
          await api.deleteTransaction(id)
          
          // Оптимистично удаляем транзакцию из состояния
          setTransactions(prev => prev.filter(t => t.id !== id))
          
          // Перезагружаем данные для синхронизации с сервером (но не блокируем UI)
          loadData().catch(err => {
            console.error('Error reloading transactions after delete:', err)
            // Если перезагрузка не удалась, но удаление прошло успешно, 
            // транзакция уже удалена из состояния, так что просто логируем ошибку
          })
          
          showSuccess('Транзакция удалена')
          setConfirmModal({ show: false, message: '', onConfirm: () => {} })
        } catch (err: any) {
          // В случае ошибки восстанавливаем предыдущее состояние
          setTransactions(previousTransactions)
          showError(err.message || 'Ошибка удаления транзакции')
          setConfirmModal({ show: false, message: '', onConfirm: () => {} })
        }
      },
    })
  }

  const resetForm = () => {
    setEditingTransaction(null)
    setFormData({
      account_id: '',
      transaction_type: 'expense',
      amount: '',
      currency: 'RUB',
      category_id: '',
      description: '',
      transaction_date: new Date().toISOString().slice(0, 16),
      to_account_id: '',
      goal_id: '',
    })
    setCategories([])
  }

  const handleTransactionTypeChange = async (newType: 'income' | 'expense' | 'transfer') => {
    setFormData({ ...formData, transaction_type: newType, category_id: '' })
    await loadCategories(newType)
  }

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'income':
        return 'Доход'
      case 'expense':
        return 'Расход'
      case 'transfer':
        return 'Перевод'
      default:
        return type
    }
  }

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'income':
        return '💰'
      case 'expense':
        return '💸'
      case 'transfer':
        return '↔️'
      default:
        return '💵'
    }
  }

  const getAccountName = (accountId: number) => {
    const account = accounts.find(a => a.id === accountId)
    return account ? account.name : `Счет #${accountId}`
  }

  const isSharedTransaction = (transaction: Transaction) => {
    const account = accounts.find(a => a.id === transaction.account_id)
    return account?.is_shared === true || (account?.shared_budget_id !== null && account?.shared_budget_id !== undefined)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount))
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text">Транзакции</h1>
        <button
          onClick={async () => {
            resetForm()
            await loadCategories('expense')
            setShowForm(true)
          }}
          className="btn-primary"
        >
          ➕ Добавить транзакцию
        </button>
      </div>


      {/* Show selected account filter if set */}
      {selectedAccountId && (
        <div className="card p-3 mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>📋</span>
              <span className="text-sm text-telegram-text dark:text-telegram-dark-text">
                Показаны транзакции по счету: <strong>{getAccountName(selectedAccountId)}</strong>
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedAccountId(null)
                loadData(true)
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-2 py-1"
            >
              ✕ Сбросить
            </button>
          </div>
        </div>
      )}

      {/* Filters - Collapsible */}
      <div className="card p-4 mb-4">
        <button
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
            Фильтры
          </h3>
          <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary text-xl">
            {filtersExpanded ? '▼' : '▶'}
          </span>
        </button>
        
        {filtersExpanded && (
          <div className="space-y-4">
            {/* Основные фильтры - Мои/Общие */}
            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Тип транзакций
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                    filterType === 'all'
                      ? 'bg-telegram-primary dark:bg-telegram-dark-primary text-white'
                      : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                  }`}
                >
                  📋 Все
                </button>
                <button
                  onClick={() => setFilterType('own')}
                  className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                    filterType === 'own'
                      ? 'bg-telegram-primary dark:bg-telegram-dark-primary text-white'
                      : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                  }`}
                >
                  👤 Мои
                </button>
                <button
                  onClick={() => setFilterType('shared')}
                  className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                    filterType === 'shared'
                      ? 'bg-telegram-primary dark:bg-telegram-dark-primary text-white'
                      : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                  }`}
                >
                  👥 Общие
                </button>
              </div>
            </div>

            {/* Фильтр по типу - Доход/Расход */}
            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Доходы / Расходы
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                onClick={() => setTransactionTypeFilter('all')}
                className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                  transactionTypeFilter === 'all'
                    ? 'bg-telegram-primary dark:bg-telegram-dark-primary text-white'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setTransactionTypeFilter('income')}
                className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                  transactionTypeFilter === 'income'
                    ? 'bg-green-500 text-white'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                💰 Доходы
              </button>
              <button
                onClick={() => setTransactionTypeFilter('expense')}
                className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                  transactionTypeFilter === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                💸 Расходы
              </button>
              <button
                onClick={() => setTransactionTypeFilter('transfer')}
                className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                  transactionTypeFilter === 'transfer'
                    ? 'bg-blue-500 text-white'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                ↔️ Переводы
              </button>
              </div>
            </div>

            {/* Фильтр по датам */}
            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Период
              </label>
              <div className="flex gap-2 flex-wrap">
                <button
                onClick={() => {
                  setDateFilter('all')
                  setShowDateFilter(false)
                }}
                className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                  dateFilter === 'all'
                    ? 'bg-telegram-primary dark:bg-telegram-dark-primary text-white'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                Все время
              </button>
              <button
                onClick={() => {
                  setDateFilter('today')
                  setShowDateFilter(false)
                }}
                className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                  dateFilter === 'today'
                    ? 'bg-telegram-primary dark:bg-telegram-dark-primary text-white'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                Сегодня
              </button>
              <button
                onClick={() => {
                  setDateFilter('week')
                  setShowDateFilter(false)
                }}
                className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                  dateFilter === 'week'
                    ? 'bg-telegram-primary dark:bg-telegram-dark-primary text-white'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                Неделя
              </button>
              <button
                onClick={() => {
                  setDateFilter('month')
                  setShowDateFilter(false)
                }}
                className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                  dateFilter === 'month'
                    ? 'bg-telegram-primary dark:bg-telegram-dark-primary text-white'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                Месяц
              </button>
              <button
                onClick={() => {
                  setDateFilter('year')
                  setShowDateFilter(false)
                }}
                className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                  dateFilter === 'year'
                    ? 'bg-telegram-primary dark:bg-telegram-dark-primary text-white'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                Год
              </button>
              <button
                onClick={() => {
                  setDateFilter('custom')
                  setShowDateFilter(true)
                }}
                className={`px-4 py-2 rounded-telegram transition-all text-sm ${
                  dateFilter === 'custom'
                    ? 'bg-telegram-primary dark:bg-telegram-dark-primary text-white'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                📅 Свой период
              </button>
              </div>
              
              {/* Кастомный выбор дат */}
              {showDateFilter && dateFilter === 'custom' && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1">
                      От
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="input text-sm"
                      max={customEndDate || undefined}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1">
                      До
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="input text-sm"
                      min={customStartDate || undefined}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Кнопка применения фильтров */}
            <div className="pt-4 border-t border-telegram-border dark:border-telegram-dark-border">
              <button
                onClick={() => loadData(true)}
                className="w-full btn-primary py-3 text-base font-medium"
              >
                🔍 Применить фильтры
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && !editingTransaction && (
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">
              Новая транзакция
            </h2>
            <button
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
              className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Тип транзакции
              </label>
              <select
                value={formData.transaction_type}
                onChange={(e) => handleTransactionTypeChange(e.target.value as any)}
                className="input"
                required
              >
                <option value="income">💰 Доход</option>
                <option value="expense">💸 Расход</option>
                <option value="transfer">↔️ Перевод</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                {formData.transaction_type === 'transfer' ? 'Счет отправления' : 'Счет'}
              </label>
              <select
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="input"
                required
              >
                <option value="">Выберите счет</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({formatAmount(account.balance, account.currency)})
                  </option>
                ))}
              </select>
            </div>

            {formData.transaction_type === 'transfer' && (
              <div>
                <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                  Счет получателя
                </label>
                <select
                  value={formData.to_account_id}
                  onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Выберите счет</option>
                  {accounts
                    .filter(account => account.id !== parseInt(formData.account_id || '0'))
                    .map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({formatAmount(account.balance, account.currency)})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {formData.transaction_type !== 'transfer' && categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                  Категория
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="input"
                >
                  <option value="">Без категории</option>
                  {categories
                    .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0))
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.icon || '📦'} {category.name} {category.is_favorite ? '⭐' : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {formData.transaction_type === 'income' && goals.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                  🎯 Добавить к цели (опционально)
                </label>
                <select
                  value={formData.goal_id}
                  onChange={(e) => setFormData({ ...formData, goal_id: e.target.value })}
                  className="input"
                >
                  <option value="">Не добавлять к цели</option>
                  {goals.map(goal => (
                    <option key={goal.id} value={goal.id}>
                      {goal.name} ({Math.round(goal.current_amount).toLocaleString()} / {Math.round(goal.target_amount).toLocaleString()} {goal.currency})
                    </option>
                  ))}
                </select>
                {formData.goal_id && (
                  <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                    Эта сумма будет добавлена к выбранной цели
                  </p>
                )}
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
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="input"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Валюта
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="input"
                required
              >
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Дата и время
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  className="input pr-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Описание
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={3}
                placeholder="Описание транзакции (необязательно)"
              />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1">
                {editingTransaction ? 'Сохранить' : 'Добавить'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="btn-secondary"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="card">
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary text-center py-8">
            Транзакции не найдены. Добавьте первую транзакцию!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions
            .filter(transaction => {
              // Hide income transactions that are part of a transfer (they have parent_transaction_id)
              // These are the "income" side of transfers and should not be shown separately
              if (transaction.transaction_type === 'income' && transaction.parent_transaction_id) {
                return false
              }
              // Also hide old transfer income transactions by description (for backward compatibility)
              if (transaction.transaction_type === 'income' && transaction.description) {
                const descLower = transaction.description.toLowerCase().trim()
                if (descLower.startsWith('перевод из')) {
                  return false
                }
              }
              return true
            })
            .map(transaction => (
            <div key={`transaction-wrapper-${transaction.id}`}>
              <div
                id={`transaction-${transaction.id}`}
                className="card p-4 hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors"
              >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getTransactionTypeIcon(transaction.transaction_type)}</span>
                    <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">
                      {getTransactionTypeLabel(transaction.transaction_type)}
                    </span>
                  </div>
                  
                  <div className={`text-lg font-bold mb-1 ${
                    transaction.transaction_type === 'expense' ? 'text-red-600 dark:text-red-400' :
                    transaction.transaction_type === 'income' ? 'text-green-600 dark:text-green-400' :
                    'text-blue-600 dark:text-blue-400'
                  }`}>
                    {transaction.transaction_type === 'expense' ? '-' : transaction.transaction_type === 'income' ? '+' : ''}
                    {formatAmount(transaction.amount, transaction.currency)}
                  </div>
                  
                  <div className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary space-y-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="truncate min-w-0 flex-1">Счет: <span className="truncate">{getAccountName(transaction.account_id)}</span></span>
                      {isSharedTransaction(transaction) && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium flex-shrink-0">
                          👥 Общий
                        </span>
                      )}
                    </div>
                    {transaction.transaction_type === 'transfer' && transaction.to_account_id && (
                      <div className="truncate">→ {getAccountName(transaction.to_account_id)}</div>
                    )}
                    {transaction.category_name && (
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="flex-shrink-0">{transaction.category_icon || '📦'}</span>
                        <span className="truncate">{translateCategoryName(transaction.category_name)}</span>
                      </div>
                    )}
                    {transaction.description && (
                      <div className="truncate">{transaction.description}</div>
                    )}
                    <div>{formatDate(transaction.transaction_date)}</div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(transaction)}
                    className="p-2 text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-primary dark:hover:text-telegram-dark-primary hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover rounded"
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(transaction.id)}
                    className="p-2 text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-red-500 dark:hover:text-red-400 hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover rounded"
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
              
            {/* Форма редактирования показывается сразу под редактируемой транзакцией */}
            {editingTransaction && editingTransaction.id === transaction.id && (
                <div id={`edit-form-${transaction.id}`} className="card mb-3 mt-3">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">
                      Редактировать транзакцию
                    </h2>
                    <button
                      onClick={() => {
                        setShowForm(false)
                        resetForm()
                      }}
                      className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                        Тип транзакции
                      </label>
                      <select
                        value={formData.transaction_type}
                        onChange={(e) => handleTransactionTypeChange(e.target.value as any)}
                        className="input"
                        required
                      >
                        <option value="income">💰 Доход</option>
                        <option value="expense">💸 Расход</option>
                        <option value="transfer">↔️ Перевод</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                        {formData.transaction_type === 'transfer' ? 'Счет отправления' : 'Счет'}
                      </label>
                      <select
                        value={formData.account_id}
                        onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                        className="input"
                        required
                      >
                        <option value="">Выберите счет</option>
                        {accounts.map(account => (
                          <option key={account.id} value={account.id}>
                            {account.name} ({formatAmount(account.balance, account.currency)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {formData.transaction_type === 'transfer' && (
                      <div>
                        <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                          Счет получателя
                        </label>
                        <select
                          value={formData.to_account_id}
                          onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value })}
                          className="input"
                          required
                        >
                          <option value="">Выберите счет</option>
                          {accounts
                            .filter(account => account.id !== parseInt(formData.account_id || '0'))
                            .map(account => (
                              <option key={account.id} value={account.id}>
                                {account.name} ({formatAmount(account.balance, account.currency)})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {formData.transaction_type !== 'transfer' && categories.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                          Категория
                        </label>
                        <select
                          value={formData.category_id}
                          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                          className="input"
                        >
                          <option value="">Без категории</option>
                          {categories
                            .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0))
                            .map(category => (
                              <option key={category.id} value={category.id}>
                                {category.icon || '📦'} {category.name} {category.is_favorite ? '⭐' : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {formData.transaction_type === 'income' && goals.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                          🎯 Добавить к цели (опционально)
                        </label>
                        <select
                          value={formData.goal_id}
                          onChange={(e) => setFormData({ ...formData, goal_id: e.target.value })}
                          className="input"
                        >
                          <option value="">Не добавлять к цели</option>
                          {goals.map(goal => (
                            <option key={goal.id} value={goal.id}>
                              {goal.name} ({Math.round(goal.current_amount).toLocaleString()} / {Math.round(goal.target_amount).toLocaleString()} {goal.currency})
                            </option>
                          ))}
                        </select>
                        {formData.goal_id && (
                          <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                            Эта сумма будет добавлена к выбранной цели
                          </p>
                        )}
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
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="input"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                        Валюта
                      </label>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="input"
                        required
                      >
                        <option value="RUB">RUB</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                        Дата и время
                      </label>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={formData.transaction_date}
                          onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                          className="input pr-10"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                        Описание
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="input"
                        rows={3}
                        placeholder="Описание транзакции (необязательно)"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button type="submit" className="btn-primary flex-1">
                        Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false)
                          resetForm()
                        }}
                        className="btn-secondary"
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))}
          
          {/* Кнопка загрузки дополнительных транзакций */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="btn-secondary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></span>
                    Загрузка...
                  </>
                ) : (
                  '📄 Загрузить еще'
                )}
              </button>
            </div>
          )}
          
          {/* Индикатор что все транзакции загружены */}
          {!hasMore && transactions.length > 0 && (
            <div className="text-center py-4 text-telegram-textSecondary dark:text-telegram-dark-textSecondary text-sm">
              Показано {transactions.length} транзакций
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              Подтверждение
            </h2>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6">
              {confirmModal.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  confirmModal.onConfirm()
                }}
                className="flex-1 btn-primary text-sm md:text-base py-2.5 md:py-3"
              >
                Да
              </button>
              <button
                onClick={() => {
                  setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                }}
                className="flex-1 btn-secondary text-sm md:text-base py-2.5 md:py-3"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

