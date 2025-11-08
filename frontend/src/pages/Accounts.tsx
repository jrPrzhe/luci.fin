import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { SnowPile } from '../components/SnowPile'
import { useNewYearTheme } from '../contexts/NewYearContext'

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
  is_shared?: boolean
}

const accountTypeLabels: Record<string, string> = {
  cash: 'Наличные',
  bank_card: 'Банковская карта',
  bank_account: 'Банковский счёт',
  e_wallet: 'Электронный кошелёк',
  credit_card: 'Кредитная карта',
  investment: 'Инвестиции',
  other: 'Прочее',
}

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
  const [accounts, setAccounts] = useState<Account[]>([])
  const [sharedBudgets, setSharedBudgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    account_type: 'cash',
    currency: 'RUB',
    initial_balance: '0',
    description: '',
    shared_budget_id: '',
  })

  useEffect(() => {
    loadAccounts()
    loadSharedBudgets()
  }, [])

  const loadSharedBudgets = async () => {
    try {
      const budgets = await api.getSharedBudgets()
      setSharedBudgets(budgets || [])
    } catch (err) {
      // Ignore errors - budgets might not be accessible
      console.error('Error loading shared budgets:', err)
      setSharedBudgets([])
    }
  }

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const accountsData = await api.getAccounts()
      setAccounts(accountsData)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки счетов')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Название счёта обязательно')
      return
    }

    try {
      await api.createAccount({
        name: formData.name.trim(),
        account_type: formData.account_type,
        currency: formData.currency,
        initial_balance: parseFloat(formData.initial_balance) || 0,
        description: formData.description.trim() || undefined,
        shared_budget_id: formData.shared_budget_id ? parseInt(formData.shared_budget_id) : undefined,
      })

      // Reset form
      setFormData({
        name: '',
        account_type: 'cash',
        currency: 'RUB',
        initial_balance: '0',
        description: '',
        shared_budget_id: '',
      })
      setShowForm(false)
      await loadAccounts()
    } catch (err: any) {
      setError(err.message || 'Ошибка создания счёта')
    }
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
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-telegram-text dark:text-telegram-dark-text">Загрузка...</div>
        </div>
      </div>
    )
  }

  const { isEnabled: newYearEnabled } = useNewYearTheme()

  return (
    <div className="p-8 relative">
      {/* Снежные кучки на странице */}
      {newYearEnabled && (
        <>
          <SnowPile className="top-8 right-8" size="small" />
          <SnowPile className="top-32 left-8" size="small" />
        </>
      )}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-telegram-text dark:text-telegram-dark-text">Счета</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary"
        >
          ➕ Добавить счёт
        </button>
      </div>

      {error && !showForm && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">У вас пока нет счетов</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            Создать первый счёт
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="card hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {accountTypeIcons[account.type] || '📦'}
                  </span>
                  <div>
                    <h3 className="font-semibold text-lg text-telegram-text dark:text-telegram-dark-text">
                      {account.name}
                      {account.is_shared && (
                        <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                          Совместный
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      {accountTypeLabels[account.type] || account.type}
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
                {account.description && (
                  <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-2">
                    {account.description}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-telegram-border dark:border-telegram-dark-border">
                <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {account.created_at && (
                    <div>Создан: {formatDate(account.created_at)}</div>
                  )}
                  {account.initial_balance !== account.balance && (
                    <div>
                      Начальный баланс: {formatBalance(account.initial_balance, account.currency)}
                    </div>
                  )}
                </div>
                {!account.is_shared && (
                  <button
                    onClick={async () => {
                      if (!confirm('Вы уверены, что хотите удалить этот счёт?')) {
                        return
                      }
                      try {
                        await api.deleteAccount(account.id)
                        await loadAccounts()
                      } catch (err: any) {
                        setError(err.message || 'Ошибка удаления счёта')
                      }
                    }}
                    className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 text-sm"
                    title="Удалить счёт"
                  >
                    🗑️
                  </button>
                )}
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
            // Close modal when clicking outside
            if (e.target === e.currentTarget) {
              setShowForm(false)
              setError('')
              setFormData({
                name: '',
                account_type: 'cash',
                currency: 'RUB',
                initial_balance: '0',
                description: '',
                shared_budget_id: '',
              })
            }
          }}
        >
          <div 
            className="bg-telegram-surface dark:bg-telegram-dark-surface rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text">Добавить счёт</h2>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setError('')
                    setFormData({
                      name: '',
                      account_type: 'cash',
                      currency: 'RUB',
                      initial_balance: '0',
                      description: '',
                      shared_budget_id: '',
                    })
                  }}
                  className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-2xl"
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    Название счёта <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="input"
                    placeholder="Например: Основной счёт"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    Тип счёта <span className="text-red-500 dark:text-red-400">*</span>
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
                    <option value="EUR">€ EUR</option>
                    <option value="KZT">₸ KZT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    Начальный баланс
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.initial_balance}
                    onChange={(e) =>
                      setFormData({ ...formData, initial_balance: e.target.value })
                    }
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
                    <option value="">Личный счёт</option>
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
                    Выберите совместный бюджет для создания общего счёта. Только администраторы могут создавать совместные счета.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    Описание (необязательно)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="input"
                    rows={3}
                    placeholder="Дополнительная информация о счёте"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setError('')
                      setFormData({
                        name: '',
                        account_type: 'cash',
                        currency: 'RUB',
                        initial_balance: '0',
                        description: '',
                        shared_budget_id: '',
                      })
                    }}
                    className="flex-1 btn-secondary"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-primary"
                  >
                    Создать счёт
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
