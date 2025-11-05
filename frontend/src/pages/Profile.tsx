import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { isTelegramWebApp } from '../utils/telegram'
import { useTheme } from '../hooks/useTheme'
import { useNewYearTheme } from '../contexts/NewYearContext'

export function Profile() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [defaultCurrency, setDefaultCurrency] = useState('RUB')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { isEnabled: newYearEnabled, toggle: toggleNewYear } = useNewYearTheme()

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        return await api.getCurrentUser()
      } catch {
        return null
      }
    },
  })

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '')
      setLastName(user.last_name || '')
      setDefaultCurrency(user.default_currency || 'RUB')
    }
  }, [user])

  const updateMutation = useMutation({
    mutationFn: api.updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      setSuccessMessage('Профиль успешно обновлен!')
      setErrorMessage('')
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (error: any) => {
      setErrorMessage(error.message || 'Ошибка при обновлении профиля')
      setSuccessMessage('')
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage('')
    setErrorMessage('')

    updateMutation.mutate({
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      default_currency: defaultCurrency,
    })
  }

  const resetMutation = useMutation({
    mutationFn: api.resetAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      setSuccessMessage('Все данные успешно сброшены!')
      setErrorMessage('')
      setShowResetConfirm(false)
      setTimeout(() => setSuccessMessage(''), 5000)
    },
    onError: (error: any) => {
      setErrorMessage(error.message || 'Ошибка при сбросе данных')
      setSuccessMessage('')
      setShowResetConfirm(false)
    },
  })

  const handleResetConfirm = () => {
    resetMutation.mutate()
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

  return (
    <div className="min-h-screen p-4 md:p-6 animate-fade-in max-w-2xl mx-auto w-full">
      <h1 className="text-xl md:text-2xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-4 md:mb-6">
        Профиль
      </h1>
      
      <div className="card p-4 md:p-5 space-y-4 md:space-y-6">
        {successMessage && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-telegram text-sm">
            {successMessage}
          </div>
        )}
        
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-telegram text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {/* Telegram Username (readonly, если есть) */}
          {user?.telegram_username && (
            <div>
              <label className="block text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Telegram username
              </label>
              <input
                type="text"
                value={`@${user.telegram_username}`}
                disabled
                className="input bg-telegram-bg dark:bg-telegram-dark-bg cursor-not-allowed opacity-60"
              />
              <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                Ваш Telegram username нельзя изменить
              </p>
            </div>
          )}

          {/* Имя (редактируемое) */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
              Имя {!user?.telegram_username && '(отображается как имя)'}
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input text-sm md:text-base"
              placeholder="Введите ваше имя"
            />
            <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
              {user?.telegram_username 
                ? 'Имя для отображения в приложении'
                : 'Это имя будет отображаться в приложении'}
            </p>
          </div>

          {/* Фамилия (опционально) */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
              Фамилия (опционально)
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input text-sm md:text-base"
              placeholder="Введите вашу фамилию"
            />
          </div>

          {/* Email (только для отображения, если Telegram пользователь) */}
          {user?.telegram_id && (
            <div>
              <label className="block text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="input bg-telegram-bg dark:bg-telegram-dark-bg cursor-not-allowed opacity-60"
              />
              <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                Email автоматически создан для Telegram аккаунта
              </p>
            </div>
          )}

          {/* Валюта по умолчанию */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
              Валюта по умолчанию
            </label>
            <select
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              className="input text-sm md:text-base"
            >
              <option value="RUB">RUB - Российский рубль</option>
              <option value="USD">USD - Доллар США</option>
              <option value="EUR">EUR - Евро</option>
              <option value="GBP">GBP - Фунт стерлингов</option>
              <option value="CNY">CNY - Китайский юань</option>
            </select>
          </div>
          
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full btn-primary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </form>
      </div>

      {/* Additional Settings */}
      <div className="card p-4 md:p-5 mt-4 md:mt-6">
        <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
          Настройки
        </h2>
        <div className="space-y-3">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
              <div>
                <p className="font-medium text-telegram-text dark:text-telegram-dark-text">Темная тема</p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {theme === 'dark' ? 'Темная тема включена' : 'Светлая тема включена'}
                </p>
              </div>
            </div>
            <div className="relative w-12 h-6 bg-telegram-border dark:bg-telegram-dark-border rounded-full transition-colors">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
              }`}></div>
            </div>
          </button>
          <button
            onClick={toggleNewYear}
            className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎄</span>
              <div>
                <p className="font-medium text-telegram-text dark:text-telegram-dark-text">Новогодний режим</p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {newYearEnabled ? 'Новогодний дизайн включен' : 'Новогодний дизайн выключен'}
                </p>
              </div>
            </div>
            <div className="relative w-12 h-6 bg-telegram-border dark:bg-telegram-dark-border rounded-full transition-colors">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                newYearEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}></div>
            </div>
          </button>
        </div>
      </div>

      {/* Information Section */}
      <div className="card p-4 md:p-5 mt-4 md:mt-6">
        <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
          Информация
        </h2>
        <div className="space-y-3">
          <button
            onClick={() => navigate('/import')}
            className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📥</span>
              <div>
                <p className="font-medium text-telegram-text dark:text-telegram-dark-text">Импорт данных</p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">Импорт из других приложений</p>
              </div>
            </div>
            <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">→</span>
          </button>
          <button
            onClick={() => navigate('/about')}
            className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📚</span>
              <div>
                <p className="font-medium text-telegram-text dark:text-telegram-dark-text">О приложении</p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">Подсказки и помощь</p>
              </div>
            </div>
            <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">→</span>
          </button>
        </div>
      </div>

      {/* Reset Account Section */}
      <div className="card p-4 md:p-5 mt-4 md:mt-6 border-2 border-red-200 dark:border-red-800">
        <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4 text-red-600 dark:text-red-400">
          Опасная зона
        </h2>
        
        {!showResetConfirm ? (
          <div>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
              Сброс всех данных вернет вашу учетную запись к заводским настройкам. 
              Будут удалены все счета, транзакции, категории, цели и отчеты. 
              Это действие нельзя отменить!
            </p>
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={resetMutation.isPending}
              className="w-full btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 border-red-300 dark:border-red-700 text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Сбросить все данные
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
              Вы уверены, что хотите сбросить все данные?
            </p>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
              Это действие удалит все ваши данные и вернет учетную запись к первоначальному состоянию. 
              Это действие необратимо!
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleResetConfirm}
                disabled={resetMutation.isPending}
                className="flex-1 btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 border-red-300 dark:border-red-700 text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetMutation.isPending ? 'Сброс...' : 'Да, сбросить'}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetMutation.isPending}
                className="flex-1 btn-secondary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

