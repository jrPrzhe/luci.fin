import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useI18n } from '../contexts/I18nContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

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
  const { showError } = useToast()
  const { t } = useI18n()
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean
    message: string
    onConfirm: () => void | Promise<void>
  }>({
    show: false,
    message: '',
    onConfirm: () => {},
  })

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
    return <LoadingSpinner />
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text">
            🎯 {t.goals.title}
          </h1>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
            {t.goals.subtitle}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-1"
        >
          <span>➕</span> {t.goals.newGoal}
        </button>
      </div>

      {/* Active Goals - Game Mode */}
      {activeGoals.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text">
            🎮 {t.goals.activeGoals}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoals.map((goal: Goal) => {
              const daysRemaining = getDaysRemaining(goal.target_date)
              const progressColor = getProgressColor(goal.progress_percentage)
              
              return (
                <div
                  key={goal.id}
                  className="relative bg-gradient-to-br from-telegram-surface dark:from-telegram-dark-surface to-telegram-surface/80 dark:to-telegram-dark-surface/80 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-telegram-border dark:border-telegram-dark-border transform hover:scale-[1.02]"
                >
                  {/* Game Level Badge and Delete Button */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmModal({
                          show: true,
                          message: 'Вы уверены, что хотите удалить эту цель?',
                          onConfirm: async () => {
                            try {
                              await api.deleteGoal(goal.id)
                              queryClient.invalidateQueries({ queryKey: ['goals'] })
                              setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                            } catch (err: any) {
                              showError(err.message || 'Ошибка при удалении цели')
                              setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                            }
                          },
                        })
                      }}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      title="Удалить цель"
                    >
                      🗑️
                    </button>
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {t.goals.form.level} {Math.floor(goal.progress_percentage / 25) + 1}
                    </div>
                  </div>
                  
                  <div
                    onClick={() => setSelectedGoal(goal)}
                    className="cursor-pointer"
                  >

                  {/* Goal Name */}
                  <h3 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2 pr-20">
                    {goal.name}
                  </h3>

                  {/* Progress Bar - Enhanced Visual */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        {t.goals.form.progress}
                      </span>
                      <span className="text-xl font-bold bg-gradient-to-r from-telegram-primary to-telegram-primaryLight bg-clip-text text-transparent">
                        {goal.progress_percentage}%
                      </span>
                    </div>
                    <div className="relative h-7 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${progressColor} transition-all duration-700 ease-out rounded-full shadow-lg`}
                        style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-telegram-text dark:text-telegram-dark-text z-10 drop-shadow-sm">
                          {Math.round(goal.current_amount).toLocaleString()} / {Math.round(goal.target_amount).toLocaleString()} {goal.currency}
                        </span>
                      </div>
                    </div>
                    {/* Mini scale indicator */}
                    <div className="mt-2 relative h-1 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${progressColor} transition-all duration-500 ease-out rounded-full`}
                        style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Grid - Enhanced */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {daysRemaining !== null && (
                      <div className="bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-cyan-50 dark:to-cyan-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                        <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1 flex items-center gap-1">
                          <span>⏰</span>
                          <span>{t.goals.form.daysRemaining}</span>
                        </div>
                        <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                          {daysRemaining}
                        </div>
                      </div>
                    )}
                    <div className="bg-gradient-to-br from-orange-50 dark:from-orange-900/20 to-red-50 dark:to-red-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                      <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1 flex items-center gap-1">
                        <span>💰</span>
                        <span>{t.goals.form.remaining}</span>
                      </div>
                      <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                        {Math.round(goal.target_amount - goal.current_amount).toLocaleString()} {goal.currency}
                      </div>
                    </div>
                  </div>

                  {/* Achievement Badge */}
                  {goal.progress_percentage >= 50 && (
                    <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                      <span className="text-xl">🏆</span>
                      <span className="font-semibold">{t.goals.halfWay}</span>
                    </div>
                  )}

                  {/* Sparkle Effect for High Progress */}
                  {goal.progress_percentage >= 75 && (
                    <div className="absolute top-2 left-2 text-2xl animate-pulse">✨</div>
                  )}
                  </div>
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
            🏆 {t.goals.completedGoals}
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmModal({
                          show: true,
                          message: 'Вы уверены, что хотите удалить эту цель?',
                          onConfirm: async () => {
                            try {
                              await api.deleteGoal(goal.id)
                              queryClient.invalidateQueries({ queryKey: ['goals'] })
                              setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                            } catch (err: any) {
                              showError(err.message || 'Ошибка при удалении цели')
                              setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                            }
                          },
                        })
                      }}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      title="Удалить цель"
                    >
                      🗑️
                    </button>
                    <span className="text-3xl">🎉</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold">
                  <span>{t.goals.achieved}</span>
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

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              {t.goals.confirm}
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
                {t.goals.yes}
              </button>
              <button
                onClick={() => {
                  setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                }}
                className="flex-1 btn-secondary text-sm md:text-base py-2.5 md:py-3"
              >
                {t.goals.no}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Goal Detail Modal Component
function GoalDetailModal({ goal, onClose, onDelete }: { goal: Goal; onClose: () => void; onDelete: () => void }) {
  const { t } = useI18n()
  const roadmap = parseRoadmap(goal.roadmap)
  const daysRemaining = getDaysRemaining(goal.target_date)
  const progressColor = getProgressColor(goal.progress_percentage)
  const [isDeleting, setIsDeleting] = useState(false)
  const { showError } = useToast()
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  
  const { data: transactions } = useQuery({
    queryKey: ['goal-transactions', goal.id],
    queryFn: () => api.getTransactions(100),
  })

  const handleDelete = () => {
    setShowConfirmModal(true)
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    setShowConfirmModal(false)
    try {
      await api.deleteGoal(goal.id)
      onDelete()
    } catch (error: any) {
      console.error('Error deleting goal:', error)
      showError(error.message || 'Ошибка при удалении цели')
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

  // Use portal to render modal directly in body, above all content including VK header
  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        margin: 0,
        padding: '1rem'
      }}
      onClick={onClose}
    >
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

          {/* Progress Section - Enhanced Visual */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                Прогресс
              </span>
              <span className="text-3xl font-bold bg-gradient-to-r from-telegram-primary to-telegram-primaryLight bg-clip-text text-transparent">
                {goal.progress_percentage}%
              </span>
            </div>
            
            {/* Large Progress Bar */}
            <div className="relative h-10 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden mb-3 shadow-inner">
              <div
                className={`absolute inset-y-0 left-0 bg-gradient-to-r ${progressColor} transition-all duration-700 ease-out rounded-full shadow-lg`}
                style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-white font-bold text-xs drop-shadow-lg">
                  {goal.progress_percentage > 5 ? `${goal.progress_percentage}%` : ''}
                </div>
              </div>
            </div>
            
            {/* Amount Scale */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg p-3 border border-telegram-border dark:border-telegram-dark-border">
                <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1">
                  Накоплено
                </div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {Math.round(goal.current_amount).toLocaleString()} {goal.currency}
                </div>
              </div>
              <div className="bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg p-3 border border-telegram-border dark:border-telegram-dark-border">
                <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1">
                  Осталось
                </div>
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {Math.round(goal.target_amount - goal.current_amount).toLocaleString()} {goal.currency}
                </div>
              </div>
            </div>
            
            {/* Visual Scale Indicator */}
            <div className="relative">
              <div className="flex justify-between text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1">
                <span>0</span>
                <span className="font-semibold">Цель: {Math.round(goal.target_amount).toLocaleString()} {goal.currency}</span>
              </div>
              <div className="relative h-2 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 bg-gradient-to-r ${progressColor} transition-all duration-500 ease-out rounded-full`}
                  style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                />
                {/* Milestone markers */}
                {[25, 50, 75, 100].map((milestone) => (
                  <div
                    key={milestone}
                    className="absolute top-0 h-full w-0.5 bg-telegram-textSecondary/30 dark:bg-telegram-dark-textSecondary/30"
                    style={{ left: `${milestone}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                <span>{Math.round(goal.current_amount).toLocaleString()}</span>
                <span>{Math.round(goal.target_amount).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Roadmap Section - Show if roadmap exists OR if goal has roadmap string */}
          {(roadmap || goal.roadmap) && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text mb-3">
                🗺️ Дорожная карта
              </h3>
              
              {/* Feasibility Status */}
              {roadmap?.feasibility && (
                <div className="mb-3 p-3 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {roadmap.feasibility === 'feasible' ? '✅' : roadmap.feasibility === 'challenging' ? '⚠️' : '❌'}
                    </span>
                    <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">
                      {roadmap.feasibility === 'feasible' ? 'Достижимо' : roadmap.feasibility === 'challenging' ? 'Сложно, но возможно' : 'Очень сложно'}
                    </span>
                    {roadmap?.estimated_months && (
                      <span className="ml-auto text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        Оценка: {roadmap.estimated_months} {roadmap.estimated_months === 1 ? 'месяц' : roadmap.estimated_months < 5 ? 'месяца' : 'месяцев'}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Roadmap Text from AI */}
              {roadmap?.roadmap_text ? (
                <div className="bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-cyan-50 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800 mb-4">
                  <div className="whitespace-pre-wrap text-telegram-text dark:text-telegram-dark-text text-sm leading-relaxed">
                    {roadmap.roadmap_text}
                  </div>
                </div>
              ) : (
                // Fallback: Show basic roadmap info if AI text is not available
                <div className="bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-cyan-50 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800 mb-4">
                  <div className="text-telegram-text dark:text-telegram-dark-text text-sm leading-relaxed">
                    <p className="font-semibold mb-2">📋 План действий:</p>
                    {roadmap?.monthly_savings_needed && (
                      <p className="mb-2">
                        • Ежемесячно откладывайте: <strong>{Math.round(roadmap.monthly_savings_needed).toLocaleString()} {goal.currency}</strong>
                      </p>
                    )}
                    {roadmap?.estimated_months && (
                      <p className="mb-2">
                        • Срок достижения цели: <strong>{roadmap.estimated_months} {roadmap.estimated_months === 1 ? 'месяц' : roadmap.estimated_months < 5 ? 'месяца' : 'месяцев'}</strong>
                      </p>
                    )}
                    <p className="mb-2">• Отслеживайте прогресс ежемесячно</p>
                    <p>• Оптимизируйте расходы для ускорения достижения цели</p>
                  </div>
                </div>
              )}
              
              {/* Monthly Savings Summary */}
              {roadmap?.monthly_savings_needed && (
                <div className="bg-gradient-to-r from-green-50 dark:from-green-900/20 to-emerald-50 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary font-medium">
                      💵 {t.goals.monthlySavings}
                    </span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {Math.round(roadmap.monthly_savings_needed).toLocaleString()} {goal.currency}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text mb-3">
              📅 {t.goals.timeline}
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg">
                <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {t.goals.startDate}
                </span>
                <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">
                  {formatDate(goal.start_date)}
                </span>
              </div>
              {goal.target_date && (
                <div className="flex items-center justify-between p-3 bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg">
                  <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    {t.goals.deadline}
                  </span>
                  <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">
                    {formatDate(goal.target_date)}
                  </span>
                </div>
              )}
              {daysRemaining !== null && (
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-cyan-50 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    {t.goals.daysRemaining}
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
                {t.goals.monthlyPlan}
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {roadmap.monthly_plan.map((month: any, index: number) => {
                  const cumulativeProgress = goal.target_amount > 0 
                    ? Math.min(100, (month.cumulative_target / goal.target_amount) * 100)
                    : 0
                  
                  return (
                    <div
                      key={index}
                      className="p-3 bg-telegram-hover dark:bg-telegram-dark-hover rounded-lg border border-telegram-border dark:border-telegram-dark-border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-telegram-text dark:text-telegram-dark-text">
                          {t.goals.month} {month.month}
                        </span>
                        <span className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                          {t.goals.saved}: {Math.round(month.cumulative_target).toLocaleString()} {goal.currency}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                          Отложить в этом месяце:
                        </span>
                        <span className="font-bold text-telegram-text dark:text-telegram-dark-text">
                          {Math.round(month.target_savings).toLocaleString()} {goal.currency}
                        </span>
                      </div>
                      {/* Progress bar for this month */}
                      <div className="mt-2 h-2 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-600 transition-all duration-500"
                          style={{ width: `${cumulativeProgress}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              {roadmap.monthly_plan.length > 6 && (
                <div className="mt-2 text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary text-center">
                  Показано {roadmap.monthly_plan.length} месяцев
                </div>
              )}
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              {t.goals.confirm}
            </h2>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6">
              Вы уверены, что хотите удалить эту цель? Это действие нельзя отменить.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 btn-primary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Да, удалить
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
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

  // Render modal using portal to body to ensure it's above all content including VK header
  if (typeof window !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body)
  }
  
  return modalContent
}

// Create Goal Modal Component
function CreateGoalModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false)
  const [roadmapStatus, setRoadmapStatus] = useState<string>('')
  const [amountError, setAmountError] = useState<string>('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_amount: '',
    currency: 'RUB',
    target_date: '',
  })

  const { showError, showSuccess } = useToast()

  // Validate amount input
  const validateAmount = (value: string): boolean => {
    if (!value || value.trim() === '') {
      setAmountError('')
      return false
    }
    
    // Check if value is a valid number
    const numValue = value.replace(/,/g, '.').replace(/\s/g, '') // Replace comma with dot and remove spaces
    const parsed = parseFloat(numValue)
    
    if (isNaN(parsed) || !isFinite(parsed)) {
      setAmountError(t.goals.form.enterNumber || 'Enter a number')
      return false
    }
    
    if (parsed <= 0) {
      setAmountError(t.goals.form.amountMustBePositive || 'Amount must be greater than zero')
      return false
    }
    
    // Validate amount: max 13 digits before decimal point (NUMERIC(15, 2) constraint)
    const parts = numValue.split('.')
    const integerPart = parts[0].replace(/[^0-9]/g, '')
    if (integerPart.length > 13) {
      setAmountError(t.goals.form.amountTooLarge || 'Amount is too large. Maximum 13 digits before decimal point.')
      return false
    }
    
    setAmountError('')
    return true
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({ ...formData, target_amount: value })
    validateAmount(value)
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.target_amount) {
      showError(t.goals.form.fillRequired || 'Please fill in required fields')
      return
    }

    // Validate amount before proceeding
    if (!validateAmount(formData.target_amount)) {
      return
    }

    // Validate amount: max 13 digits before decimal point (NUMERIC(15, 2) constraint)
    const amountStr = formData.target_amount.toString().replace(/,/g, '.').replace(/\s/g, '')
    const parts = amountStr.split('.')
    const integerPart = parts[0].replace(/[^0-9]/g, '') // Remove any non-digits
    if (integerPart.length > 13) {
      showError(t.goals.form.amountTooLarge || 'Amount is too large. Maximum 13 digits before decimal point.')
      return
    }

    // Validate target_date if provided - cannot be in the past
    if (formData.target_date) {
      const selectedDate = new Date(formData.target_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Reset time to compare only dates
      selectedDate.setHours(0, 0, 0, 0)
      
      if (selectedDate < today) {
        showError(t.goals.targetDatePastError)
        return
      }
    }

    setLoading(true)
    try {
      let roadmap: string | undefined = undefined
      
      // Generate roadmap with user feedback
      try {
        setGeneratingRoadmap(true)
        setRoadmapStatus(t.goals.form.gettingTransactions || 'Getting transaction data...')
        
        const balancePromise = api.getBalance()
        const transactionsPromise = api.getTransactions(100)
        
        // Use Promise.race to add timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 15000) // 15 seconds timeout
        )
        
        setRoadmapStatus(t.goals.form.analyzingTransactions || 'Analyzing your transactions...')
        const [balance, transactions] = await Promise.race([
          Promise.all([balancePromise, transactionsPromise]),
          timeoutPromise
        ]) as [any, any]
        
        const incomeTotal = transactions
          .filter((t: any) => t.transaction_type === 'income')
          .reduce((sum: number, t: any) => sum + t.amount, 0)
        
        const expenseTotal = transactions
          .filter((t: any) => t.transaction_type === 'expense')
          .reduce((sum: number, t: any) => sum + t.amount, 0)

        // Generate roadmap with timeout
        setRoadmapStatus(t.goals.form.creatingPlan || 'Creating personalized plan via AI...')
        const cleanAmount = formData.target_amount.replace(/,/g, '.').replace(/\s/g, '')
        const roadmapPromise = api.generateRoadmap({
          goal_name: formData.name,
          target_amount: parseFloat(cleanAmount),
          currency: formData.currency,
          transactions,
          balance: balance.total,
          income_total: incomeTotal,
          expense_total: expenseTotal,
        })
        
        const roadmapTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Roadmap generation timeout')), 60000) // 60 seconds for roadmap (AI can take time)
        )
        
        const roadmapResponse = await Promise.race([
          roadmapPromise,
          roadmapTimeoutPromise
        ]) as any
        
        console.log('Roadmap response received:', { 
          hasRoadmap: !!roadmapResponse.roadmap,
          roadmapType: typeof roadmapResponse.roadmap,
          roadmapLength: roadmapResponse.roadmap ? roadmapResponse.roadmap.length : 0,
          fullResponse: roadmapResponse
        })
        
        // Ensure roadmap is a string (it should already be a JSON string from backend)
        if (roadmapResponse && roadmapResponse.roadmap) {
          roadmap = typeof roadmapResponse.roadmap === 'string' 
            ? roadmapResponse.roadmap 
            : JSON.stringify(roadmapResponse.roadmap)
          console.log('Roadmap processed:', { 
            isString: typeof roadmap === 'string',
            length: roadmap ? roadmap.length : 0,
            preview: roadmap ? roadmap.substring(0, 100) : 'empty'
          })
        } else {
          console.warn('Roadmap response missing roadmap field:', roadmapResponse)
          roadmap = undefined
        }
        setRoadmapStatus(t.goals.form.roadmapCreated || 'Roadmap created successfully!')
      } catch (roadmapError: any) {
        console.error('Roadmap generation failed or timed out, creating goal without roadmap:', roadmapError)
        console.error('Roadmap error details:', {
          message: roadmapError?.message,
          stack: roadmapError?.stack,
          response: roadmapError?.response
        })
        setRoadmapStatus(t.goals.form.roadmapFailed || 'Failed to create roadmap, creating goal without it...')
        // Continue without roadmap - goal can be created without it
        // Wait a bit to show the message
        await new Promise(resolve => setTimeout(resolve, 1000))
      } finally {
        setGeneratingRoadmap(false)
      }

      // Create goal (with or without roadmap)
      setRoadmapStatus(t.goals.form.creatingGoal || 'Creating goal...')
      const cleanAmount = formData.target_amount.replace(/,/g, '.').replace(/\s/g, '')
      const goalData: any = {
        name: formData.name,
        description: formData.description || undefined,
        target_amount: parseFloat(cleanAmount),
        currency: formData.currency,
        target_date: formData.target_date || undefined,
      }
      
      // Only include roadmap if it exists and is a valid string
      if (roadmap && typeof roadmap === 'string' && roadmap.trim().length > 0) {
        goalData.roadmap = roadmap
        console.log('Including roadmap in goal data:', {
          roadmapLength: roadmap.length,
          roadmapPreview: roadmap.substring(0, 200)
        })
      } else {
        console.warn('Roadmap not included in goal data:', {
          roadmap: roadmap,
          roadmapType: typeof roadmap,
          roadmapLength: roadmap ? roadmap.length : 0
        })
      }
      
      console.log('Creating goal with data:', {
        name: goalData.name,
        hasRoadmap: !!goalData.roadmap,
        roadmapLength: goalData.roadmap ? goalData.roadmap.length : 0
      })
      
      await api.createGoal(goalData)

      showSuccess(roadmap ? t.goals.goalCreatedWithRoadmap : t.goals.goalCreated)
      onSuccess()
    } catch (error: any) {
      console.error('Error creating goal:', error)
      const { translateError } = await import('../utils/errorMessages')
      
      // Если ошибка содержит response.data (массив ошибок валидации Pydantic), обрабатываем его
      let errorToTranslate = error
      if (error?.response?.data && Array.isArray(error.response.data)) {
        // Это массив ошибок валидации Pydantic
        const validationErrors = error.response.data.map((err: any) => {
          if (err.loc && err.msg) {
            const field = err.loc[err.loc.length - 1]
            return `${field}: ${err.msg}`
          }
          return err.msg || JSON.stringify(err)
        })
        errorToTranslate = validationErrors.join('; ')
      }
      
      showError(translateError(errorToTranslate))
    } finally {
      setLoading(false)
      setGeneratingRoadmap(false)
      setRoadmapStatus('')
    }
  }

  // Use portal to render modal directly in body, above all content including VK header
  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        margin: 0,
        padding: '1rem'
      }}
      onClick={() => {
        // Don't close modal during loading
        if (!loading && !generatingRoadmap) {
          onClose()
        }
      }}
    >
      <div
        className="bg-telegram-surface dark:bg-telegram-dark-surface rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text">
            {t.goals.newGoalTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-xl disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || generatingRoadmap}
          >
            ×
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreate()
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
              {t.goals.goalNameLabel} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover border border-telegram-border dark:border-telegram-dark-border text-telegram-text dark:text-telegram-dark-text disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={t.goals.goalNamePlaceholder}
              disabled={loading || generatingRoadmap}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
              {t.goals.targetAmountLabel} *
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.target_amount}
              onChange={handleAmountChange}
              className={`w-full px-4 py-2 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover border ${
                amountError 
                  ? 'border-red-500 dark:border-red-500' 
                  : 'border-telegram-border dark:border-telegram-dark-border'
              } text-telegram-text dark:text-telegram-dark-text disabled:opacity-50 disabled:cursor-not-allowed`}
              placeholder="2000000"
              disabled={loading || generatingRoadmap}
            />
            {amountError && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">{amountError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
              {t.goals.currencyLabel}
            </label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover border border-telegram-border dark:border-telegram-dark-border text-telegram-text dark:text-telegram-dark-text disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || generatingRoadmap}
            >
              <option value="RUB">₽ RUB</option>
              <option value="USD">$ USD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
              {t.goals.targetDateLabel}
            </label>
            <input
              type="date"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover border border-telegram-border dark:border-telegram-dark-border text-telegram-text dark:text-telegram-dark-text disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || generatingRoadmap}
            />
            {formData.target_date && new Date(formData.target_date) < new Date() && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                {t.goals.targetDatePastError}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
              {t.goals.descriptionLabel}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-telegram-hover dark:bg-telegram-dark-hover border border-telegram-border dark:border-telegram-dark-border text-telegram-text dark:text-telegram-dark-text resize-none overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
              rows={3}
              style={{ maxHeight: '120px', minHeight: '80px', resize: 'none' }}
              placeholder={t.goals.descriptionPlaceholder}
              disabled={loading || generatingRoadmap}
            />
          </div>

          {/* Roadmap Generation Status */}
          {(generatingRoadmap || roadmapStatus) && (
            <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-cyan-50 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                {generatingRoadmap && (
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400 flex-shrink-0 mt-0.5"></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 break-words">
                    {roadmapStatus || t.goals.generatingRoadmap}
                  </p>
                  {generatingRoadmap && (
                    <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                      ⏳ {t.goals.pleaseWait || 'Please wait. This may take some time...'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={loading || generatingRoadmap || !!amountError || !formData.name || !formData.target_amount}
            >
              {loading ? (generatingRoadmap ? roadmapStatus || t.goals.creating : t.goals.creating) : t.goals.createButton}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  // Render modal using portal to body to ensure it's above all content including VK header
  if (typeof window !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body)
  }
  
  return modalContent
}

// Helper functions
function parseRoadmap(roadmap?: string) {
  if (!roadmap) return null
  try {
    // Try to parse as JSON string
    const parsed = typeof roadmap === 'string' ? JSON.parse(roadmap) : roadmap
    
    // Ensure all expected fields exist
    if (parsed && typeof parsed === 'object') {
      return {
        roadmap_text: parsed.roadmap_text || '',
        monthly_plan: parsed.monthly_plan || [],
        recommendations: parsed.recommendations || [],
        monthly_savings_needed: parsed.monthly_savings_needed || 0,
        estimated_months: parsed.estimated_months || 0,
        feasibility: parsed.feasibility || 'feasible',
        savings_by_category: parsed.savings_by_category || {},
        goal_name: parsed.goal_name || '',
        target_amount: parsed.target_amount || 0,
        currency: parsed.currency || 'RUB'
      }
    }
    
    return parsed
  } catch (error) {
    console.error('Error parsing roadmap:', error, roadmap)
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

