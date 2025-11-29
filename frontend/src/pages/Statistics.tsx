import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

export function Statistics() {
  const queryClient = useQueryClient()
  const [resetUserId, setResetUserId] = useState<number | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => api.getAdminUsers(),
    retry: false,
  })

  const resetMutation = useMutation({
    mutationFn: (userId: number) => api.resetUserSettings(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      setShowResetConfirm(false)
      setResetUserId(null)
    },
  })

  const premiumMutation = useMutation({
    mutationFn: ({ userId, isPremium }: { userId: number; isPremium: boolean }) => 
      api.updateUserPremium(userId, isPremium),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
    },
  })

  const handlePremiumToggle = (userId: number, currentValue: boolean) => {
    premiumMutation.mutate({ userId, isPremium: !currentValue })
  }

  const handleResetClick = (userId: number) => {
    setResetUserId(userId)
    setShowResetConfirm(true)
  }

  const handleResetConfirm = () => {
    if (resetUserId) {
      resetMutation.mutate(resetUserId)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Никогда'
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActivityLevel = (lastLogin: string | null) => {
    if (!lastLogin) return { level: 'Неактивен', color: 'text-gray-500' }
    
    const daysSinceLogin = Math.floor(
      (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysSinceLogin <= 1) {
      return { level: 'Очень активен', color: 'text-green-500' }
    } else if (daysSinceLogin <= 7) {
      return { level: 'Активен', color: 'text-blue-500' }
    } else if (daysSinceLogin <= 30) {
      return { level: 'Умеренно активен', color: 'text-yellow-500' }
    } else {
      return { level: 'Неактивен', color: 'text-gray-500' }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary dark:border-telegram-dark-primary mb-4"></div>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Ошибка загрузки данных</p>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary text-sm">
            У вас нет прав администратора
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-6 animate-fade-in max-w-6xl mx-auto w-full">
      <h1 className="text-xl md:text-2xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-4 md:mb-6">
        📊 Статистика пользователей
      </h1>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              Подтверждение сброса
            </h2>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6">
              Вы уверены, что хотите сбросить настройки этого пользователя до заводских? 
              Это действие удалит все данные пользователя и вернет настройки к первоначальному состоянию.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleResetConfirm}
                disabled={resetMutation.isPending}
                className="flex-1 btn-primary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetMutation.isPending ? 'Сброс...' : 'Да, сбросить'}
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false)
                  setResetUserId(null)
                }}
                disabled={resetMutation.isPending}
                className="flex-1 btn-secondary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4 md:p-5">
        {users && users.length === 0 ? (
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary text-center py-8">
            Пользователи не найдены
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-telegram-border dark:border-telegram-dark-border">
                  <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Имя
                  </th>
                  <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Дата регистрации
                  </th>
                  <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Последний вход
                  </th>
                  <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Активность
                  </th>
                  <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Статистика
                  </th>
                  <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Подписка
                  </th>
                  <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {users?.map((user) => {
                  const activity = getActivityLevel(user.last_login)
                  const userName = user.first_name && user.last_name
                    ? `${user.first_name} ${user.last_name}`
                    : user.first_name || user.last_name || user.username || user.email.split('@')[0]
                  
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-telegram-border dark:border-telegram-dark-border hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors"
                    >
                      <td className="py-3 px-2">
                        <div>
                          <div className="font-medium text-telegram-text dark:text-telegram-dark-text text-xs md:text-sm">
                            {userName}
                          </div>
                          {user.telegram_username && (
                            <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                              @{user.telegram_username}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="py-3 px-2 text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        {formatDate(user.last_login)}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`text-xs md:text-sm font-medium ${activity.color}`}>
                          {activity.level}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                          <div>Транзакций: {user.transaction_count}</div>
                          <div>Счетов: {user.account_count}</div>
                          <div>Категорий: {user.category_count}</div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={user.is_premium || false}
                            onChange={() => handlePremiumToggle(user.id, user.is_premium || false)}
                            disabled={premiumMutation.isPending}
                            className="w-4 h-4 text-telegram-primary bg-telegram-surface border-telegram-border rounded focus:ring-telegram-primary focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <span className={`text-xs md:text-sm ${user.is_premium ? 'text-telegram-primary font-semibold' : 'text-telegram-textSecondary dark:text-telegram-dark-textSecondary'}`}>
                            {user.is_premium ? '⭐ Премиум' : 'Базовый'}
                          </span>
                        </label>
                      </td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => handleResetClick(user.id)}
                          disabled={resetMutation.isPending}
                          className="text-xs md:text-sm btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 border-red-300 dark:border-red-700 py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Сбросить
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


