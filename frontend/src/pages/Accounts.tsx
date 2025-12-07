import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useI18n } from '../contexts/I18nContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface Account {
  id: number
  name: string
  type: string
  currency: string
  balance: number
  initial_balance: number
  is_active: boolean
  description?: string
  created_at?: string
  shared_budget_id?: number
  shared_budget_name?: string
  shared_budget_description?: string
  is_shared?: boolean
}

// accountTypeLabels will be replaced with translations

const accountTypeIcons: Record<string, string> = {
  cash: '💵',
  bank_card: '💳',
  bank_account: '🏦',
  e_wallet: '📱',
  credit_card: '💳',
  investment: '📈',
  other: '📦',
}

export function Accounts() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showError, showSuccess } = useToast()
  const { t } = useI18n()
  
  const accountTypeLabels: Record<string, string> = {
    cash: t.accounts.types.cash,
    bank_card: t.accounts.types.bank_card,
    bank_account: t.accounts.types.bank_account,
    e_wallet: t.accounts.types.e_wallet,
    credit_card: t.accounts.types.credit_card,
    investment: t.accounts.types.investment,
    other: t.accounts.types.other,
  }
  const [accounts, setAccounts] = useState<Account[]>([])
  const [sharedBudgets, setSharedBudgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
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
    name: '',
    account_type: 'cash',
    currency: 'RUB',
    initial_balance: '0',
    description: '',
    shared_budget_id: '',
  })

  // Save draft to localStorage whenever formData changes (but not when editing)
  useEffect(() => {
    if (!editingAccount && showForm) {
      localStorage.setItem('accountFormDraft', JSON.stringify(formData))
    }
  }, [formData, editingAccount, showForm])

  useEffect(() => {
    const initialize = async () => {
      const budgets = await loadSharedBudgets()
      if (budgets) {
        await loadAccounts(budgets)
      } else {
        await loadAccounts()
      }
    }
    initialize()
  }, [])

  const loadSharedBudgets = async () => {
    try {
      const budgets = await api.getSharedBudgets()
      const budgetsArray = budgets || []
      setSharedBudgets(budgetsArray)
      return budgetsArray
    } catch (err) {
      // Ignore errors - budgets might not be accessible
      console.error('Error loading shared budgets:', err)
      setSharedBudgets([])
      return []
    }
  }

  const loadAccounts = async (budgets?: any[]) => {
    try {
      setLoading(true)
      const accountsData = await api.getAccounts()
      const budgetsToUse = budgets || sharedBudgets
      // Обогащаем счета описаниями бюджетов
      const enrichedAccounts = accountsData.map((account: Account) => {
        if (account.shared_budget_id) {
          const budget = budgetsToUse.find(b => b.id === account.shared_budget_id)
          if (budget) {
            return {
              ...account,
              shared_budget_description: budget.description
            }
          }
        }
        return account
      })
      setAccounts(enrichedAccounts)
    } catch (err: any) {
      showError(err.message || 'Ошибка загрузки счетов')
    } finally {
      setLoading(false)
    }
  }

  const toggleDescription = (accountId: number) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(accountId)) {
        newSet.delete(accountId)
      } else {
        newSet.add(accountId)
      }
      return newSet
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent multiple submissions
    if (isSubmitting) {
      return
    }

    if (!formData.name.trim()) {
      showError('Название счета обязательно')
      return
    }

    // Trim name and validate length
    const trimmedName = formData.name.trim()
    if (trimmedName.length > 255) {
      showError('Название счета не может превышать 255 символов')
      return
    }

    // Validate name: only letters, numbers, spaces, hyphens, and underscores
    const namePattern = /^[a-zA-Zа-яА-ЯёЁ0-9\s\-_]+$/
    if (!namePattern.test(trimmedName)) {
      showError('Название счета может содержать только буквы, цифры, пробелы, дефисы и подчеркивания')
      return
    }

    // Trim description and validate length (check after trim to match backend validation)
    const trimmedDescription = formData.description ? formData.description.trim() : ''
    if (trimmedDescription.length > 250) {
      showError('Описание не может превышать 250 символов')
      return
    }

    setIsSubmitting(true)
    try {
      if (editingAccount) {
        // Update existing account
        await api.updateAccount(editingAccount.id, {
          name: trimmedName,
          account_type: formData.account_type,
          currency: formData.currency,
          description: trimmedDescription || undefined,
        })
        showSuccess('Счет обновлен')
      } else {
        // Create new account
        // Replace comma with dot for decimal separator (Russian locale uses comma)
        const balanceValue = formData.initial_balance.replace(',', '.')
        const balanceNumber = parseFloat(balanceValue)
        
        // Validate balance value
        if (isNaN(balanceNumber)) {
          showError('Введите корректное число для начального баланса')
          setIsSubmitting(false)
          return
        }
        
        if (!isFinite(balanceNumber)) {
          showError('Сумма слишком большая. Максимальная сумма: 999 999 999 999 999.99')
          setIsSubmitting(false)
          return
        }
        
        // Maximum value for Numeric(15, 2): 999,999,999,999,999.99
        const MAX_BALANCE = 999999999999999.99
        if (Math.abs(balanceNumber) > MAX_BALANCE) {
          showError('Сумма слишком большая. Максимальная сумма: 999 999 999 999 999.99')
          setIsSubmitting(false)
          return
        }
        
        await api.createAccount({
          name: trimmedName,
          account_type: formData.account_type,
          currency: formData.currency,
          initial_balance: balanceNumber,
          description: trimmedDescription || undefined,
          shared_budget_id: formData.shared_budget_id ? parseInt(formData.shared_budget_id) : undefined,
        })
        showSuccess(t.accounts.createdSuccess)
      }

      // Clear draft and reset form only after successful creation
      localStorage.removeItem('accountFormDraft')
      setFormData({
        name: '',
        account_type: 'cash',
        currency: 'RUB',
        initial_balance: '0',
        description: '',
        shared_budget_id: '',
      })
      setShowForm(false)
      setEditingAccount(null)
      await loadAccounts()
      // Invalidate React Query cache for accounts so other pages see the new account
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (account: Account) => {
    setEditingAccount(account)
    // When editing, clear draft and use account data
    localStorage.removeItem('accountFormDraft')
    setFormData({
      name: account.name,
      account_type: account.type,
      currency: account.currency,
      initial_balance: account.initial_balance.toString(),
      description: account.description || '',
      shared_budget_id: account.shared_budget_id?.toString() || '',
    })
    setShowForm(true)
  }

  const formatBalance = (balance: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(balance))
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-telegram-text dark:text-telegram-dark-text">{t.accounts.title}</h1>
        <button
          onClick={() => {
            // Load draft when opening form for creation (not editing)
            if (!editingAccount) {
              const savedDraft = localStorage.getItem('accountFormDraft')
              if (savedDraft) {
                try {
                  const draft = JSON.parse(savedDraft)
                  setFormData(draft)
                } catch (e) {
                  console.error('Error loading account form draft:', e)
                }
              }
            }
            setShowForm(true)
          }}
          className="btn-primary"
        >
          ➕ {t.accounts.addAccount}
        </button>
      </div>


      {accounts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.accounts.noAccountsDesc}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-3xl flex-shrink-0">
                    {accountTypeIcons[account.type] || '📦'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg text-telegram-text dark:text-telegram-dark-text truncate flex-1 min-w-0">
                        {account.name}
                      </h3>
                      {account.is_shared && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded flex-shrink-0">
                          {t.accounts.shared}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary truncate">
                      {t.accounts.types[account.type as keyof typeof t.accounts.types] || account.type}
                      {account.shared_budget_name && (
                        <span className="ml-2">• {account.shared_budget_name}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-3xl font-bold text-telegram-primary dark:text-telegram-dark-primary">
                  {formatBalance(account.balance, account.currency)}
                </p>
                {/* Описание совместного бюджета */}
                {account.shared_budget_description && (
                  <div className="mt-2">
                    <p className={`text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary break-words ${
                      expandedDescriptions.has(account.id) ? '' : 'line-clamp-2'
                    }`}>
                      {account.shared_budget_description}
                    </p>
                    {account.shared_budget_description.length > 100 && (
                      <button
                        onClick={() => toggleDescription(account.id)}
                        className="text-xs text-telegram-primary dark:text-telegram-dark-primary hover:underline mt-1"
                      >
                        {expandedDescriptions.has(account.id) ? t.accounts.hide : t.accounts.expand}
                      </button>
                    )}
                  </div>
                )}
                {/* Описание счета (если нет описания бюджета) */}
                {account.description && !account.shared_budget_description && (
                  <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-2 line-clamp-2 break-words">
                    {account.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-telegram-border dark:border-telegram-dark-border">
                <button
                  onClick={() => {
                    navigate('/transactions', { state: { accountId: account.id } })
                  }}
                  className="w-full btn-secondary text-sm py-2"
                >
                  📋 {t.accounts.transactionHistory}
                </button>
                
                <div className="flex justify-between items-center">
                  <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    {account.created_at && (
                      <div>{t.accounts.created} {formatDate(account.created_at)}</div>
                    )}
                    {account.initial_balance !== account.balance && (
                      <div>
                        {t.accounts.initialBalance} {formatBalance(account.initial_balance, account.currency)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(account)}
                      className="text-telegram-primary dark:text-telegram-dark-primary hover:text-telegram-primary/80 dark:hover:text-telegram-dark-primary/80 px-2 py-1 text-sm"
                      title={t.accounts.edit}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          // Получаем количество транзакций перед удалением
                          const transactionInfo = await api.getAccountTransactionCount(account.id)
                          const transactionCount = transactionInfo.transaction_count
                          
                          let message = t.accounts.messages.deleteConfirm
                          if (transactionCount > 0) {
                            const transactionsWord = transactionCount === 1 
                              ? t.accounts.transaction 
                              : transactionCount < 5 
                                ? t.accounts.transactions2 
                                : t.accounts.transactions5
                            message = t.accounts.messages.deleteConfirmWithTransactions
                              .replace('{count}', transactionCount.toString())
                              .replace('{transactionsWord}', transactionsWord)
                          }
                          
                          setConfirmModal({
                            show: true,
                            message,
                            onConfirm: async () => {
                              if (isDeleting) return // Prevent multiple clicks
                              setIsDeleting(true)
                              try {
                                await api.deleteAccount(account.id)
                                await loadAccounts()
                                // Also invalidate goals query in case this was a goal account
                                queryClient.invalidateQueries({ queryKey: ['goals'] })
                                queryClient.invalidateQueries({ queryKey: ['transactions'] })
                                queryClient.invalidateQueries({ queryKey: ['analytics'] })
                                queryClient.invalidateQueries({ queryKey: ['balance'] })
                                showSuccess(t.accounts.messages.deleted)
                                setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                              } catch (err: any) {
                                showError(err.message || t.accounts.messages.deleteError)
                                setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                              } finally {
                                setIsDeleting(false)
                              }
                            },
                          })
                        } catch (err: any) {
                          // Если не удалось получить количество транзакций, показываем стандартное предупреждение
                          setConfirmModal({
                            show: true,
                            message: t.accounts.messages.deleteConfirmDefault,
                            onConfirm: async () => {
                              if (isDeleting) return // Prevent multiple clicks
                              setIsDeleting(true)
                              try {
                                await api.deleteAccount(account.id)
                                await loadAccounts()
                                queryClient.invalidateQueries({ queryKey: ['goals'] })
                                queryClient.invalidateQueries({ queryKey: ['transactions'] })
                                queryClient.invalidateQueries({ queryKey: ['analytics'] })
                                queryClient.invalidateQueries({ queryKey: ['balance'] })
                                showSuccess(t.accounts.messages.deleted)
                                setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                              } catch (err: any) {
                                showError(err.message || t.accounts.messages.deleteError)
                                setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                              } finally {
                                setIsDeleting(false)
                              }
                            },
                          })
                        }
                      }}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 text-sm"
                      title={t.common.delete}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50"
          onClick={(e) => {
            // Close modal when clicking outside - don't reset form, keep draft
            if (e.target === e.currentTarget) {
              setShowForm(false)
              setEditingAccount(null)
              // Don't reset formData - it's already saved in localStorage
            }
          }}
        >
          <div 
            className="bg-telegram-surface dark:bg-telegram-dark-surface rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text">
                  {editingAccount ? t.accounts.edit : t.accounts.addAccount}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingAccount(null)
                    // Don't reset formData - it's already saved in localStorage
                  }}
                  className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    Название счета <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="input"
                    placeholder="Например: Основной счет"
                    maxLength={60}
                    required
                  />
                  <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1 text-right">
                    {formData.name.length}/60
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    Тип счета <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <select
                    value={formData.account_type}
                    onChange={(e) =>
                      setFormData({ ...formData, account_type: e.target.value })
                    }
                    className="input"
                  >
                    {Object.entries(accountTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {accountTypeIcons[value]} {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    Валюта <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value })
                    }
                    className="input"
                  >
                    <option value="RUB">₽ RUB</option>
                    <option value="USD">$ USD</option>
                  </select>
                </div>

                {!editingAccount && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                        Начальный баланс
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.initial_balance}
                        onChange={(e) => {
                          // Allow both comma and dot as decimal separator
                          // Replace comma with dot for internal storage, but allow user to type comma
                          let value = e.target.value
                          // Replace comma with dot
                          value = value.replace(',', '.')
                          // Remove any non-numeric characters except dot
                          value = value.replace(/[^0-9.]/g, '')
                          // Ensure only one dot
                          const parts = value.split('.')
                          if (parts.length > 2) {
                            value = parts[0] + '.' + parts.slice(1).join('')
                          }
                          setFormData({ ...formData, initial_balance: value })
                        }}
                        className="input"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                        Совместный бюджет (необязательно)
                      </label>
                      <select
                        value={formData.shared_budget_id}
                        onChange={(e) =>
                          setFormData({ ...formData, shared_budget_id: e.target.value })
                        }
                        className="input"
                      >
                        <option value="">Личный счет</option>
                        {sharedBudgets && Array.isArray(sharedBudgets) && sharedBudgets.length > 0
                          ? sharedBudgets
                              .filter(() => {
                                // Only show budgets where user is admin (only admins can create shared accounts)
                                // We'll check this on backend, but filter on frontend for UX
                                return true // Show all budgets user is member of
                              })
                              .map((budget) => (
                                <option key={budget.id} value={budget.id}>
                                  {budget.name}
                                </option>
                              ))
                          : null}
                      </select>
                      <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                        Выберите совместный бюджет для создания общего счета. Только администраторы могут создавать совместные счета.
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    Описание (необязательно)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="input resize-y max-h-32"
                    rows={3}
                    placeholder="Дополнительная информация о счете"
                    maxLength={250}
                  />
                  <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1 text-right">
                    {formData.description.length}/250
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingAccount(null)
                      // Don't reset formData - it's already saved in localStorage
                    }}
                    className="flex-1 btn-secondary"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting 
                      ? (editingAccount ? 'Сохранение...' : 'Создание...') 
                      : (editingAccount ? 'Сохранить изменения' : 'Создать счет')
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              Подтверждение
            </h2>
            <div className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6 whitespace-pre-line">
              {confirmModal.message}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  confirmModal.onConfirm()
                }}
                disabled={isDeleting}
                className="flex-1 btn-primary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Удаление...' : 'Да'}
              </button>
              <button
                onClick={() => {
                  setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                  setIsDeleting(false)
                }}
                disabled={isDeleting}
                className="flex-1 btn-secondary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
