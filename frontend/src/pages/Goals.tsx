import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

interface Goal {
  id: number
  name: string
  description?: string
  target_amount: number
  current_amount: number
  currency: string
  progress_percentage: number
  status: string
  target_date?: string
  start_date: string
  roadmap?: string
  created_at: string
}

export function Goals() {
  const queryClient = useQueryClient()
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.getGoals(),
    refetchInterval: 30000, // Refetch every 30 seconds to update progress
    staleTime: 10000, // Consider data stale after 10 seconds
  })

  const activeGoals = goals.filter((g: Goal) => g.status === 'active')
  const completedGoals = goals.filter((g: Goal) => g.status === 'completed')

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary mb-4"></div>
          <p className="text-telegram-textSecondary">Загрузка целей...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text">
            🎯 Мои цели
          </h1>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
            Достигайте финансовых целей с удовольствием!
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2"
        >
          <span className="text-xl">+</span>
          <span>Новая цель</span>
        </button>
      </div>

      {/* Active Goals - Game Mode */}
      {activeGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text">
            🎮 Активные цели
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoals.map((goal: Goal) => {
              const daysRemaining = getDaysRemaining(goal.target_date)
              const progressColor = getProgressColor(goal.progress_percentage)
              
              return (
                <div
                  key={goal.id}
                  onClick={() => setSelectedGoal(goal)}
                  className="relative bg-gradient-to-br from-telegram-surface dark:from-telegram-dark-surface to-telegram-surface/80 dark:to-telegram-dark-surface/80 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-telegram-border dark:border-telegram-dark-border transform hover:scale-[1.02]"
                >
                  {/* Game Level Badge */}
                  <div className="absolute top-4 right-4">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Уровень {Math.floor(goal.progress_percentage / 25) + 1}
                    </div>
                  </div>

                  {/* Goal Name */}
                  <h3 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2 pr-20">
                    {goal.name}
                  </h3>

                  {/* Progress Bar - Game Style */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        Прогресс
                      </span>
                      <span className="text-lg font-bold bg-gradient-to-r from-telegram-primary to-telegram-primaryLight bg-clip-text text-transparent">
                        {goal.progress_percentage}%
                      </span>
                    </div>
                    <div className="relative h-6 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${progressColor} transition-all duration-500 ease-out rounded-full shadow-lg`}
                        style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-telegram-text dark:text-telegram-dark-text z-10">
                          {Math.round(goal.current_amount).toLocaleString()} / {Math.round(goal.target_amount).toLocaleString()} {goal.currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {daysRemaining !== null && (
                      <div className="bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg p-3">
                        <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1">
                          ⏰ Дней осталось
                        </div>
                        <div className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text">
                          {daysRemaining}
                        </div>
                      </div>
                    )}
                    <div className="bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg p-3">
                      <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1">
                        💰 Осталось
                      </div>
                      <div className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text">
                        {Math.round(goal.target_amount - goal.current_amount).toLocaleString()} {goal.currency}
                      </div>
                    </div>
                  </div>

                  {/* Achievement Badge */}
                  {goal.progress_percentage >= 50 && (
                    <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                      <span className="text-xl">🏆</span>
                      <span className="font-semibold">Половина пути пройдена!</span>
                    </div>
                  )}

                  {/* Sparkle Effect for High Progress */}
                  {goal.progress_percentage >= 75 && (
                    <div className="absolute top-2 left-2 text-2xl animate-pulse">✨</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text">
            🏆 Достигнутые цели
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedGoals.map((goal: Goal) => (
              <div
                key={goal.id}
                className="bg-gradient-to-br from-green-50 dark:from-green-900/20 to-emerald-50 dark:to-emerald-900/20 rounded-2xl p-6 border-2 border-green-300 dark:border-green-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text">
                    {goal.name}
                  </h3>
                  <span className="text-3xl">🎉</span>
                </div>
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
                  <span>✅ Достигнуто</span>
                  <span>{goal.created_at ? formatDate(goal.created_at) : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {goals.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
            Нет целей
          </h3>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6">
            Создайте свою первую финансовую цель и начните путь к мечте!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary px-6 py-3"
          >
            Создать цель
          </button>
        </div>
      )}

      {/* Goal Detail Modal */}
      {selectedGoal && (
        <GoalDetailModal
          goal={selectedGoal}
          onClose={() => setSelectedGoal(null)}
          onDelete={() => {
            setSelectedGoal(null)
            queryClient.invalidateQueries({ queryKey: ['goals'] })
          }}
        />
      )}

      {/* Create Goal Modal */}
      {showCreateModal && (
        <CreateGoalModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ['goals'] })
          }}
        />
      )}
    </div>
  )
}

// Goal Detail Modal Component
function GoalDetailModal({ goal, onClose, onDelete }: { goal: Goal; onClose: () => void; onDelete: () => void }) {
  const roadmap = parseRoadmap(goal.roadmap)
  const daysRemaining = getDaysRemaining(goal.target_date)
  const progressColor = getProgressColor(goal.progress_percentage)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const { data: transactions } = useQuery({
    queryKey: ['goal-transactions', goal.id],
    queryFn: () => api.getTransactions(100),
  })

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту цель? Это действие нельзя отменить.')) {
      return
    }

    setIsDeleting(true)
    try {
      await api.deleteGoal(goal.id)
      onDelete()
    } catch (error: any) {
      console.error('Error deleting goal:', error)
      alert(error.message || 'Ошибка при удалении цели')
    } finally {
      setIsDeleting(false)
    }
  }

  // Calculate monthly recurring expenses
  const monthlyExpenses = transactions ? (() => {
    const expenses = transactions.filter((t: any) => t.transaction_type === 'expense')
    const monthlyTotal = expenses.reduce((sum: number, t: any) => sum + t.amount, 0) / 12
    return monthlyTotal
  })() : 0

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-telegram-surface dark:bg-telegram-dark-surface rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
                {goal.name}
              </h2>
              {goal.description && (
                <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {goal.description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-2xl text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text"
            >
              ×
            </button>
          </div>

          {/* Progress Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                Прогресс
              </span>
              <span className="text-2xl font-bold bg-gradient-to-r from-telegram-primary to-telegram-primaryLight bg-clip-text text-transparent">
                {goal.progress_percentage}%
              </span>
            </div>
            <div className="relative h-8 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden mb-2">
              <div
                className={`absolute inset-y-0 left-0 bg-gradient-to-r ${progressColor} transition-all duration-500 ease-out rounded-full`}
                style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            <div className="flex justify-between text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
              <span>{Math.round(goal.current_amount).toLocaleString()} {goal.currency}</span>
              <span>{Math.round(goal.target_amount).toLocaleString()} {goal.currency}</span>
            </div>
          </div>

          {/* Roadmap Section */}
          {roadmap && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text mb-3">
                🗺️ Дорожная карта
              </h3>
              <div className="bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg p-4 whitespace-pre-wrap text-telegram-text dark:text-telegram-dark-text">
                {roadmap.roadmap_text || 'Дорожная карта загружается...'}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text mb-3">
              📅 Сроки
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg">
                <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  Начало
                </span>
                <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">
                  {formatDate(goal.start_date)}
                </span>
              </div>
              {goal.target_date && (
                <div className="flex items-center justify-between p-3 bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg">
                  <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    Дедлайн
                  </span>
                  <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">
                    {formatDate(goal.target_date)}
                  </span>
                </div>
              )}
              {daysRemaining !== null && (
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-cyan-50 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    ⏰ Осталось дней
                  </span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {daysRemaining}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Plan */}
          {roadmap?.monthly_plan && roadmap.monthly_plan.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text mb-3">
                📊 Месячный план
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {roadmap.monthly_plan.slice(0, 6).map((month: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg"
                  >
                    <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      Месяц {month.month}
                    </span>
                    <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">
                      {Math.round(month.target_savings).toLocaleString()} {goal.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Expenses */}
          {monthlyExpenses > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text mb-3">
                💳 Ежемесячные платежи
              </h3>
              <div className="bg-gradient-to-r from-orange-50 dark:from-orange-900/20 to-red-50 dark:to-red-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center justify-between">
                  <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    Средние расходы в месяц
                  </span>
                  <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                    {Math.round(monthlyExpenses).toLocaleString()} {goal.currency}
                  </span>
                </div>
                {roadmap?.monthly_savings_needed && (
                  <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between">
                      <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        Нужно откладывать в месяц
                      </span>
                      <span className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                        {Math.round(roadmap.monthly_savings_needed).toLocaleString()} {goal.currency}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      Итого нужно: {Math.round(monthlyExpenses + roadmap.monthly_savings_needed).toLocaleString()} {goal.currency}/мес
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {roadmap?.recommendations && roadmap.recommendations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text mb-3">
                💡 Рекомендации
              </h3>
              <ul className="space-y-2">
                {roadmap.recommendations.map((rec: string, index: number) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 p-3 bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg"
                  >
                    <span className="text-xl">✨</span>
                    <span className="text-telegram-text dark:text-telegram-dark-text">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Delete Button */}
          <div className="mt-6 pt-6 border-t border-telegram-border dark:border-telegram-dark-border">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full btn-secondary text-telegram-danger dark:text-telegram-dark-danger hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-telegram-danger dark:hover:text-red-300 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Удаление...' : '🗑️ Удалить цель'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Create Goal Modal Component
function CreateGoalModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_amount: '',
    currency: 'RUB',
    target_date: '',
  })

  const handleCreate = async () => {
    if (!formData.name || !formData.target_amount) {
      alert('Заполните обязательные поля')
      return
    }

    setLoading(true)
    try {
      // First, generate roadmap
      const balance = await api.getBalance()
      const transactions = await api.getTransactions(100)
      
      const incomeTotal = transactions
        .filter((t: any) => t.transaction_type === 'income')
        .reduce((sum: number, t: any) => sum + t.amount, 0)
      
      const expenseTotal = transactions
        .filter((t: any) => t.transaction_type === 'expense')
        .reduce((sum: number, t: any) => sum + t.amount, 0)

      const roadmapResponse = await api.generateRoadmap({
        goal_name: formData.name,
        target_amount: parseFloat(formData.target_amount),
        currency: formData.currency,
        transactions,
        balance: balance.total,
        income_total: incomeTotal,
        expense_total: expenseTotal,
      })

      // Then create goal
      await api.createGoal({
        name: formData.name,
        description: formData.description || undefined,
        target_amount: parseFloat(formData.target_amount),
        currency: formData.currency,
        target_date: formData.target_date || undefined,
        roadmap: roadmapResponse.roadmap,
      })

      onSuccess()
    } catch (error) {
      console.error('Error creating goal:', error)
      alert('Ошибка при создании цели')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-telegram-surface dark:bg-telegram-dark-surface rounded-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text">
            Новая цель
          </h2>
          <button
            onClick={onClose}
            className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-xl"
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
              Название цели *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover border border-telegram-border dark:border-telegram-dark-border text-telegram-text dark:text-telegram-dark-text"
              placeholder="Например: Машина"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
              Стоимость *
            </label>
            <input
              type="number"
              value={formData.target_amount}
              onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover border border-telegram-border dark:border-telegram-dark-border text-telegram-text dark:text-telegram-dark-text"
              placeholder="2000000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
              Валюта
            </label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover border border-telegram-border dark:border-telegram-dark-border text-telegram-text dark:text-telegram-dark-text"
            >
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
              Дедлайн (опционально)
            </label>
            <input
              type="date"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover border border-telegram-border dark:border-telegram-dark-border text-telegram-text dark:text-telegram-dark-text"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover border border-telegram-border dark:border-telegram-dark-border text-telegram-text dark:text-telegram-dark-text"
              rows={3}
              placeholder="Описание цели..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleCreate}
            className="flex-1 btn-primary"
            disabled={loading}
          >
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function parseRoadmap(roadmap?: string) {
  if (!roadmap) return null
  try {
    return JSON.parse(roadmap)
  } catch {
    return null
  }
}

function getProgressColor(percentage: number) {
  if (percentage >= 75) return 'from-green-500 to-emerald-600'
  if (percentage >= 50) return 'from-blue-500 to-cyan-600'
  if (percentage >= 25) return 'from-yellow-500 to-orange-600'
  return 'from-pink-500 to-rose-600'
}

function getDaysRemaining(targetDate?: string) {
  if (!targetDate) return null
  const today = new Date()
  const target = new Date(targetDate)
  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 0
}

