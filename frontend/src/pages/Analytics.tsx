import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { api } from '../services/api'
import { useI18n } from '../contexts/I18nContext'

interface AnalyticsStats {
  total_events: number
  unique_users: number
  events_by_platform: Record<string, number>
  events_by_type: Record<string, number>
  events_by_name: Record<string, number>
  events_by_hour: Record<number, number>
  events_by_date: Record<string, number>
  top_users: Array<{
    user_id: number
    email: string
    username: string | null
    vk_id: string | null
    telegram_id: string | null
    event_count: number
  }>
  recent_events: Array<{
    id: number
    user_id: number | null
    vk_id: string | null
    telegram_id: string | null
    event_type: string
    event_name: string
    platform: string
    event_metadata: Record<string, any> | null
    created_at: string
  }>
}

// Компонент для таба "Аналитика"
function AnalyticsTab() {
  const { showError } = useToast()
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [platform, setPlatform] = useState<string>('')

  const { data: stats, isLoading, error, refetch } = useQuery<AnalyticsStats>({
    queryKey: ['analytics', startDate, endDate, platform],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (platform) params.append('platform', platform)
      
      try {
        return await api.request<AnalyticsStats>(`/api/v1/analytics/stats?${params.toString()}`)
      } catch (err: any) {
        const errorMessage = err.message || String(err)
        
        if (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('<html')) {
          throw new Error('Backend недоступен. Проверьте статус сервиса в Railway.')
        }
        
        if (errorMessage.includes('403') || errorMessage.includes('Admin access required') || errorMessage.includes('Forbidden')) {
          throw new Error('Доступ запрещен. Требуются права администратора.')
        }
        if (errorMessage.includes('401') || errorMessage.includes('Not authenticated') || errorMessage.includes('Unauthorized')) {
          throw new Error('Необходима авторизация. Пожалуйста, войдите снова.')
        }
        if (errorMessage.includes('timeout') || errorMessage.includes('Failed to fetch')) {
          throw new Error('Не удалось подключиться к серверу. Проверьте подключение к интернету.')
        }
        
        throw new Error(errorMessage || 'Ошибка загрузки статистики')
      }
    },
    retry: false,
  })

  useEffect(() => {
    if (error) {
      showError((error as Error).message)
    }
  }, [error, showError])

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Загрузка статистики...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-telegram-dark-textSecondary mb-1">
              Дата начала
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-telegram-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-telegram-dark-surface text-gray-900 dark:text-telegram-dark-text"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-telegram-dark-textSecondary mb-1">
              Дата окончания
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-telegram-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-telegram-dark-surface text-gray-900 dark:text-telegram-dark-text"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-telegram-dark-textSecondary mb-1">
              Платформа
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-telegram-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-telegram-dark-surface text-gray-900 dark:text-telegram-dark-text"
            >
              <option value="">Все платформы</option>
              <option value="vk_bot">VK Бот</option>
              <option value="vk_miniapp">VK Мини-приложение</option>
              <option value="telegram_bot">Telegram Бот</option>
              <option value="telegram_miniapp">Telegram Мини-приложение</option>
              <option value="web">Веб</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Обновить
            </button>
          </div>
        </div>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-telegram-dark-textSecondary mb-2">Всего событий</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-telegram-dark-text">{stats.total_events.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-telegram-dark-textSecondary mb-2">Уникальных пользователей</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-telegram-dark-text">{stats.unique_users.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-telegram-dark-textSecondary mb-2">Среднее событий на пользователя</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-telegram-dark-text">
            {stats.unique_users > 0 
              ? (stats.total_events / stats.unique_users).toFixed(1)
              : '0'}
          </p>
        </div>
      </div>

      {/* События по платформам */}
      <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-telegram-dark-text mb-4">События по платформам</h2>
        <div className="space-y-2">
          {Object.entries(stats.events_by_platform)
            .sort(([, a], [, b]) => b - a)
            .map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-telegram-dark-border">
                <span className="font-medium text-gray-700 dark:text-telegram-dark-text">{platform}</span>
                <span className="text-gray-900 dark:text-telegram-dark-text">{count.toLocaleString()}</span>
              </div>
            ))}
        </div>
      </div>

      {/* События по типам */}
      <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-telegram-dark-text mb-4">События по типам</h2>
        <div className="space-y-2">
          {Object.entries(stats.events_by_type)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <div key={type} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-telegram-dark-border">
                <span className="font-medium text-gray-700 dark:text-telegram-dark-text">{type}</span>
                <span className="text-gray-900 dark:text-telegram-dark-text">{count.toLocaleString()}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Топ событий */}
      <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-telegram-dark-text mb-4">Топ событий</h2>
        <div className="space-y-2">
          {Object.entries(stats.events_by_name)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([name, count]) => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-telegram-dark-border">
                <span className="font-medium text-gray-700 dark:text-telegram-dark-text">{name}</span>
                <span className="text-gray-900 dark:text-telegram-dark-text">{count.toLocaleString()}</span>
              </div>
            ))}
        </div>
      </div>

      {/* События по часам */}
      <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-telegram-dark-text mb-4">Активность по часам</h2>
        <div className="grid grid-cols-12 gap-2">
          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
            <div key={hour} className="text-center">
              <div className="text-xs text-gray-500 dark:text-telegram-dark-textSecondary mb-1">{hour}:00</div>
              <div className="bg-blue-100 dark:bg-blue-900/30 rounded h-20 flex items-end justify-center">
                <div
                  className="bg-blue-600 dark:bg-blue-500 rounded-t w-full"
                  style={{
                    height: `${stats.events_by_hour[hour] 
                      ? (stats.events_by_hour[hour] / Math.max(...Object.values(stats.events_by_hour))) * 100 
                      : 0}%`,
                    minHeight: stats.events_by_hour[hour] ? '4px' : '0',
                  }}
                  title={`${stats.events_by_hour[hour] || 0} событий`}
                />
              </div>
              <div className="text-xs text-gray-600 dark:text-telegram-dark-textSecondary mt-1">
                {stats.events_by_hour[hour] || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Топ пользователей */}
      <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-telegram-dark-text mb-4">Топ пользователей</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-telegram-dark-border">
            <thead className="bg-gray-50 dark:bg-telegram-dark-hover">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-telegram-dark-textSecondary uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-telegram-dark-textSecondary uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-telegram-dark-textSecondary uppercase">VK ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-telegram-dark-textSecondary uppercase">Telegram ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-telegram-dark-textSecondary uppercase">Событий</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-telegram-dark-surface divide-y divide-gray-200 dark:divide-telegram-dark-border">
              {stats.top_users.map((user) => (
                <tr key={user.user_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-telegram-dark-text">{user.user_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-telegram-dark-text">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-telegram-dark-text">{user.vk_id || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-telegram-dark-text">{user.telegram_id || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-telegram-dark-text">{user.event_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Последние события */}
      <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-telegram-dark-text mb-4">Последние события</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-telegram-dark-border">
            <thead className="bg-gray-50 dark:bg-telegram-dark-hover">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-telegram-dark-textSecondary uppercase">Время</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-telegram-dark-textSecondary uppercase">Платформа</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-telegram-dark-textSecondary uppercase">Тип</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-telegram-dark-textSecondary uppercase">Событие</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-telegram-dark-textSecondary uppercase">Пользователь</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-telegram-dark-surface divide-y divide-gray-200 dark:divide-telegram-dark-border">
              {stats.recent_events.map((event) => (
                <tr key={event.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-telegram-dark-text">
                    {new Date(event.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-telegram-dark-text">{event.platform}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-telegram-dark-text">{event.event_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-telegram-dark-text">{event.event_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-telegram-dark-text">
                    {event.vk_id ? `VK: ${event.vk_id}` : event.telegram_id ? `TG: ${event.telegram_id}` : event.user_id || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Компонент для таба "Статистика пользователей"
function UsersStatsTab() {
  const queryClient = useQueryClient()
  const { t } = useI18n()
  const { showError } = useToast()
  const [resetUserId, setResetUserId] = useState<number | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      try {
        return await api.getAdminUsers()
      } catch (err: any) {
        const errorMessage = err.message || String(err)
        
        // Проверяем на HTML ответ (признак того, что backend не отвечает)
        if (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('<html')) {
          throw new Error('Backend недоступен. Проверьте статус сервиса в Railway.')
        }
        
        if (errorMessage.includes('403') || errorMessage.includes('Admin access required') || errorMessage.includes('Forbidden') || errorMessage.includes('Требуется доступ администратора')) {
          throw new Error('Доступ запрещен. Требуются права администратора.')
        }
        if (errorMessage.includes('401') || errorMessage.includes('Not authenticated') || errorMessage.includes('Unauthorized')) {
          throw new Error('Необходима авторизация. Пожалуйста, войдите снова.')
        }
        if (errorMessage.includes('timeout') || errorMessage.includes('Failed to fetch')) {
          throw new Error('Не удалось подключиться к серверу. Проверьте подключение к интернету.')
        }
        
        throw new Error(errorMessage || 'Ошибка загрузки данных')
      }
    },
    retry: false,
  })

  useEffect(() => {
    if (error) {
      showError((error as Error).message)
    }
  }, [error, showError])

  const resetMutation = useMutation({
    mutationFn: (userId: number) => api.resetUserSettings(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      setShowResetConfirm(false)
      setResetUserId(null)
    },
  })

  const premiumMutation = useMutation({
    mutationFn: ({ userId, isPremium }: { userId: number; isPremium: boolean }) => {
      console.log('[Statistics] Updating premium status:', { userId, isPremium })
      return api.updateUserPremium(userId, isPremium)
    },
    onMutate: async ({ userId, isPremium }) => {
      await queryClient.cancelQueries({ queryKey: ['adminUsers'] })
      const previousUsers = queryClient.getQueryData(['adminUsers'])
      queryClient.setQueryData(['adminUsers'], (old: any) => {
        if (!old) return old
        return old.map((user: any) => 
          user.id === userId ? { ...user, is_premium: isPremium } : user
        )
      })
      return { previousUsers }
    },
    onSuccess: (updatedUser, variables) => {
      console.log('[Statistics] Premium update successful:', { updatedUser, variables })
      queryClient.setQueryData(['adminUsers'], (old: any) => {
        if (!old) return old
        return old.map((user: any) => 
          user.id === variables.userId ? { ...user, is_premium: updatedUser.is_premium } : user
        )
      })
      const currentUser = queryClient.getQueryData(['currentUser']) as any
      if (currentUser && currentUser.id === variables.userId) {
        queryClient.setQueryData(['currentUser'], { ...currentUser, is_premium: updatedUser.is_premium })
        queryClient.refetchQueries({ queryKey: ['currentUser'] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      }
    },
    onError: (error, variables, context) => {
      console.error('[Statistics] Premium update failed:', error, variables)
      if (context?.previousUsers) {
        queryClient.setQueryData(['adminUsers'], context.previousUsers)
      }
    },
  })

  const handlePremiumToggle = (userId: number, currentValue: boolean) => {
    const newValue = !currentValue
    console.log('[Statistics] Toggling premium:', { userId, currentValue, newValue })
    premiumMutation.mutate({ userId, isPremium: newValue })
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
    if (!dateString) return t.goals.stats.never
    const date = new Date(dateString)
    const systemLocale = navigator.language || 'en-US'
    return date.toLocaleDateString(systemLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActivityLevel = (lastLogin: string | null) => {
    if (!lastLogin) return { level: t.goals.stats.inactive, color: 'text-gray-500' }
    
    const daysSinceLogin = Math.floor(
      (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysSinceLogin <= 1) {
      return { level: t.goals.stats.veryActive, color: 'text-green-500' }
    } else if (daysSinceLogin <= 7) {
      return { level: t.goals.stats.active, color: 'text-blue-500' }
    } else if (daysSinceLogin <= 30) {
      return { level: t.goals.stats.moderatelyActive, color: 'text-yellow-500' }
    } else {
      return { level: t.goals.stats.inactive, color: 'text-gray-500' }
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 dark:text-telegram-dark-textSecondary">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              {t.common.confirm}
            </h2>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6">
              {t.goals.stats.resetConfirmText}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleResetConfirm}
                disabled={resetMutation.isPending}
                className="flex-1 btn-primary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetMutation.isPending ? t.goals.stats.resetting : t.goals.stats.resetConfirm}
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false)
                  setResetUserId(null)
                }}
                disabled={resetMutation.isPending}
                className="flex-1 btn-secondary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.common.cancel}
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
                            {user.is_premium ? `⭐ ${t.goals.stats.premium}` : t.goals.stats.basic}
                          </span>
                        </label>
                      </td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => handleResetClick(user.id)}
                          disabled={resetMutation.isPending}
                          className="text-xs md:text-sm btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 border-red-300 dark:border-red-700 py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t.goals.stats.reset}
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

// Основной компонент Analytics с табами
export function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'analytics'

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab })
  }

  return (
    <div className="min-h-screen p-4 md:p-6 animate-fade-in max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-2">
          📊 Аналитика
        </h1>
        <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
          Статистика использования бота и мини-приложения
        </p>
      </div>

      {/* Табы */}
      <div className="flex gap-2 mb-6 border-b border-telegram-border dark:border-telegram-dark-border">
        <button
          onClick={() => handleTabChange('analytics')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'analytics'
              ? 'text-telegram-primary dark:text-telegram-dark-primary border-b-2 border-telegram-primary dark:border-telegram-dark-primary'
              : 'text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text'
          }`}
        >
          Аналитика
        </button>
        <button
          onClick={() => handleTabChange('users')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-telegram-primary dark:text-telegram-dark-primary border-b-2 border-telegram-primary dark:border-telegram-dark-primary'
              : 'text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text'
          }`}
        >
          Статистика пользователей
        </button>
      </div>

      {/* Контент табов */}
      <div>
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'users' && <UsersStatsTab />}
      </div>
    </div>
  )
}
