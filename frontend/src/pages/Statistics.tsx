import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

type SortColumn = 'name' | 'created_at' | 'last_login'
type SortDirection = 'asc' | 'desc'

export function Statistics() {
  const queryClient = useQueryClient()
  const [resetUserId, setResetUserId] = useState<number | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const { data: usersResponse, isLoading, error } = useQuery({
    queryKey: ['adminUsers', currentPage, itemsPerPage, sortColumn, sortDirection],
    queryFn: async () => {
      try {
        return await api.getAdminUsers({
          page: currentPage,
          per_page: itemsPerPage,
          sort: sortColumn,
          direction: sortDirection,
        })
      } catch (err: any) {
        const errorMessage = err?.message || String(err)
        
        // Проверяем на таймаут
        if (errorMessage.includes('Превышено время ожидания') || 
            errorMessage.includes('timeout') ||
            errorMessage.includes('Timeout')) {
          throw new Error('Запрос выполняется слишком долго. Возможно, в системе много пользователей. Пожалуйста, попробуйте позже.')
        }
        
        // Проверяем на ошибки авторизации
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Not authenticated')) {
          throw new Error('Необходима авторизация. Пожалуйста, войдите снова.')
        }
        
        // Проверяем на ошибки доступа
        if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('Admin access required')) {
          throw new Error('У вас нет прав администратора для просмотра этой страницы.')
        }
        
        // Проверяем на сетевые ошибки
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
          throw new Error('Ошибка сети. Проверьте подключение к интернету и попробуйте снова.')
        }
        
        throw err
      }
    },
    retry: 1,
    retryDelay: 2000,
  })

  const resetMutation = useMutation({
    mutationFn: (userId: number) => api.resetUserSettings(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      setShowResetConfirm(false)
      setResetUserId(null)
    },
  })

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

  const users = usersResponse?.items || []
  const totalUsers = usersResponse?.total || 0
  const telegramUsers = usersResponse?.telegram_count || 0
  const vkUsers = usersResponse?.vk_count || 0
  const totalPages = Math.ceil(totalUsers / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + users.length, totalUsers)

  // Обработчик клика на заголовок колонки
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
    setCurrentPage(1) // Сбрасываем на первую страницу при изменении сортировки
  }

  // Иконка сортировки
  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <span className="ml-1 text-gray-400">↕️</span>
    }
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
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
    const errorMessage = (error as Error)?.message || 'Ошибка загрузки данных'
    const isTimeoutError = errorMessage.includes('выполняется слишком долго')
    const isAuthError = errorMessage.includes('авторизация') || errorMessage.includes('войдите')
    const isAccessError = errorMessage.includes('прав администратора') || errorMessage.includes('доступа')
    
    return (
      <div className="min-h-screen p-4 md:p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-500 dark:text-red-400 mb-2 font-semibold">Ошибка загрузки данных</p>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary text-sm mb-4">
            {errorMessage}
          </p>
          {isTimeoutError && (
            <button
              onClick={() => window.location.reload()}
              className="btn-primary text-sm py-2 px-4"
            >
              Обновить страницу
            </button>
          )}
          {(isAuthError || isAccessError) && (
            <button
              onClick={() => window.location.href = '/login'}
              className="btn-primary text-sm py-2 px-4"
            >
              Перейти на страницу входа
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-6 animate-fade-in max-w-6xl mx-auto w-full">
      <h1 className="text-xl md:text-2xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-4 md:mb-6">
        📊 Статистика пользователей
      </h1>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 md:p-5">
          <div className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
            {totalUsers}
          </div>
          <div className="text-sm md:text-base text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            Общее количество пользователей
          </div>
        </div>
        <div className="card p-4 md:p-5">
          <div className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
            {telegramUsers}
          </div>
          <div className="text-sm md:text-base text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            Из Telegram
          </div>
        </div>
        <div className="card p-4 md:p-5">
          <div className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
            {vkUsers}
          </div>
          <div className="text-sm md:text-base text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            Из ВКонтакте
          </div>
        </div>
      </div>

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
                    ФИО
                  </th>
                  <th 
                    className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text cursor-pointer hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors select-none"
                    onClick={() => handleSort('name')}
                  >
                    Имя <SortIcon column="name" />
                  </th>
                  <th 
                    className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text cursor-pointer hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors select-none"
                    onClick={() => handleSort('created_at')}
                  >
                    Дата регистрации <SortIcon column="created_at" />
                  </th>
                  <th 
                    className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text cursor-pointer hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors select-none"
                    onClick={() => handleSort('last_login')}
                  >
                    Последний вход <SortIcon column="last_login" />
                  </th>
                  <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Активность
                  </th>
                  <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Статистика
                  </th>
                  <th className="text-left py-3 px-2 text-xs md:text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
              {users.map((user) => {
                  const activity = getActivityLevel(user.last_login)
                  const fullName = user.first_name && user.last_name
                    ? `${user.last_name} ${user.first_name}`
                    : user.first_name || user.last_name || '-'
                  const userName = user.first_name && user.last_name
                    ? `${user.first_name} ${user.last_name}`
                    : user.first_name || user.last_name || user.username || user.email.split('@')[0]
                  
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-telegram-border dark:border-telegram-dark-border hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors"
                    >
                      <td className="py-3 px-2">
                        <div className="font-medium text-telegram-text dark:text-telegram-dark-text text-xs md:text-sm">
                          {fullName}
                        </div>
                      </td>
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

        {/* Пагинация */}
      {totalUsers > itemsPerPage && (
          <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            Показано {totalUsers === 0 ? 0 : startIndex + 1}-{endIndex} из {totalUsers}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs md:text-sm btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Предыдущая
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2 py-1 text-xs md:text-sm rounded ${
                        currentPage === pageNum
                          ? 'bg-telegram-primary text-white'
                          : 'btn-secondary'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
                className="px-3 py-1.5 text-xs md:text-sm btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Следующая →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



