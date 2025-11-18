import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '../contexts/ToastContext'

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

export function Analytics() {
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
      
      const response = await fetch(`/api/v1/analytics/stats?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Доступ запрещен. Требуются права администратора.')
        }
        throw new Error('Ошибка загрузки статистики')
      }
      
      return response.json()
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Аналитика</h1>
        <p className="text-gray-600">Статистика использования бота и мини-приложения</p>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата начала
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата окончания
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Платформа
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Всего событий</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.total_events.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Уникальных пользователей</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.unique_users.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Среднее событий на пользователя</h3>
          <p className="text-3xl font-bold text-gray-900">
            {stats.unique_users > 0 
              ? (stats.total_events / stats.unique_users).toFixed(1)
              : '0'}
          </p>
        </div>
      </div>

      {/* События по платформам */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">События по платформам</h2>
        <div className="space-y-2">
          {Object.entries(stats.events_by_platform)
            .sort(([, a], [, b]) => b - a)
            .map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between py-2 border-b">
                <span className="font-medium text-gray-700">{platform}</span>
                <span className="text-gray-900">{count.toLocaleString()}</span>
              </div>
            ))}
        </div>
      </div>

      {/* События по типам */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">События по типам</h2>
        <div className="space-y-2">
          {Object.entries(stats.events_by_type)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <div key={type} className="flex items-center justify-between py-2 border-b">
                <span className="font-medium text-gray-700">{type}</span>
                <span className="text-gray-900">{count.toLocaleString()}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Топ событий */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Топ событий</h2>
        <div className="space-y-2">
          {Object.entries(stats.events_by_name)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([name, count]) => (
              <div key={name} className="flex items-center justify-between py-2 border-b">
                <span className="font-medium text-gray-700">{name}</span>
                <span className="text-gray-900">{count.toLocaleString()}</span>
              </div>
            ))}
        </div>
      </div>

      {/* События по часам */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Активность по часам</h2>
        <div className="grid grid-cols-12 gap-2">
          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
            <div key={hour} className="text-center">
              <div className="text-xs text-gray-500 mb-1">{hour}:00</div>
              <div className="bg-blue-100 rounded h-20 flex items-end justify-center">
                <div
                  className="bg-blue-600 rounded-t w-full"
                  style={{
                    height: `${stats.events_by_hour[hour] 
                      ? (stats.events_by_hour[hour] / Math.max(...Object.values(stats.events_by_hour))) * 100 
                      : 0}%`,
                    minHeight: stats.events_by_hour[hour] ? '4px' : '0',
                  }}
                  title={`${stats.events_by_hour[hour] || 0} событий`}
                />
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {stats.events_by_hour[hour] || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Топ пользователей */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Топ пользователей</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VK ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telegram ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Событий</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.top_users.map((user) => (
                <tr key={user.user_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.user_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.vk_id || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.telegram_id || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.event_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Последние события */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Последние события</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Время</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Платформа</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Событие</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Пользователь</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.recent_events.map((event) => (
                <tr key={event.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(event.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.platform}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.event_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.event_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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

