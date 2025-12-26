import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useTheme } from '../hooks/useTheme'
import { useNewYearTheme } from '../contexts/NewYearContext'
import { useI18n } from '../contexts/I18nContext'
import { useToast } from '../contexts/ToastContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

export function Profile() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showError, showSuccess } = useToast()
  const [firstName, setFirstName] = useState('')
  const [defaultCurrency, setDefaultCurrency] = useState('RUB')
  const [initialCurrency, setInitialCurrency] = useState('RUB')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { isEnabled: newYearEnabled, toggle: toggleNewYear } = useNewYearTheme()
  const { language, setLanguage, t } = useI18n()

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const userData = await api.getCurrentUser()
        console.log('[Profile] User data loaded:', { 
          id: userData?.id, 
          email: userData?.email, 
          telegram_id: userData?.telegram_id,
          is_admin: userData?.is_admin 
        })
        
        // Синхронизируем статус админа для всех пользователей (не только Telegram)
        if (userData && !userData.is_admin) {
          try {
            console.log('[Profile] Attempting to sync admin status...')
            const syncResponse = await api.syncAdminStatus()
            console.log('[Profile] Sync response:', syncResponse)
            if (syncResponse?.is_admin) {
              // Обновляем данные пользователя после синхронизации
              const updatedUser = { ...userData, is_admin: true }
              queryClient.setQueryData(['currentUser'], updatedUser)
              console.log('[Profile] Admin status updated to true')
              return updatedUser
            }
          } catch (syncError) {
            // Игнорируем ошибки синхронизации, но логируем
            console.log('[Profile] Admin sync failed:', syncError)
          }
        }
        
        console.log('[Profile] Returning user data:', { is_admin: userData?.is_admin })
        return userData
      } catch (error) {
        console.error('[Profile] Error loading user:', error)
        return null
      }
    },
  })

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '')
      const userCurrency = user.default_currency || 'RUB'
      setDefaultCurrency(userCurrency)
      setInitialCurrency(userCurrency) // Обновляем initialCurrency при загрузке данных пользователя
      
      // Синхронизируем тему из профиля пользователя
      if (user.theme && (user.theme === 'light' || user.theme === 'dark')) {
        // Тема будет загружена через useTheme, но мы можем принудительно обновить, если нужно
        // useTheme уже загружает тему из профиля при монтировании
      }
    }
  }, [user])

  const updateMutation = useMutation({
    mutationFn: api.updateUser,
    onSuccess: () => {
      // Обновляем исходное значение после успешного сохранения
      setInitialCurrency(defaultCurrency)
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      showSuccess(t.profile.saved)
    },
    onError: async (error: any) => {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(error))
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    updateMutation.mutate({
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
      showSuccess(t.profile.saved)
      setShowResetConfirm(false)
    },
    onError: async (error: any) => {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(error))
      setShowResetConfirm(false)
    },
  })

  const handleResetConfirm = () => {
    resetMutation.mutate()
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen={true} size="md" />
  }

  return (
    <div className="min-h-screen p-4 md:p-6 animate-fade-in max-w-2xl mx-auto w-full">
      <h1 className="text-xl md:text-2xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-4 md:mb-6">
        {t.profile.title}
      </h1>
      
      <div className="card p-4 md:p-5 space-y-4 md:space-y-6">

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {/* Telegram Username (readonly, если есть) */}
          {user?.telegram_username && (
            <div>
              <label className="block text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                {t.profile.telegramUsername}
              </label>
              <input
                type="text"
                value={`@${user.telegram_username}`}
                disabled
                className="input bg-telegram-bg dark:bg-telegram-dark-bg cursor-not-allowed opacity-60"
              />
              <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                {t.profile.telegramUsernameDesc}
              </p>
            </div>
          )}

          {/* Имя (только для отображения) */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
              {t.profile.firstName}
            </label>
            <input
              type="text"
              value={firstName}
              disabled
              className="input bg-telegram-bg dark:bg-telegram-dark-bg cursor-not-allowed opacity-60 text-sm md:text-base"
            />
            <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
              {t.profile.firstNameDesc}
            </p>
          </div>

          {/* Валюта по умолчанию */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
              {t.profile.defaultCurrency}
            </label>
            <select
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
              className="input text-sm md:text-base"
            >
              <option value="RUB">₽ RUB - {t.profile.currencyRUB}</option>
              <option value="USD">$ USD - {t.profile.currencyUSD}</option>
            </select>
          </div>
          
          <button
            type="submit"
            disabled={updateMutation.isPending || defaultCurrency === initialCurrency}
            className="w-full btn-primary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? t.profile.saving : t.common.save}
          </button>
        </form>
      </div>

      {/* Additional Settings */}
      <div className="card p-4 md:p-5 mt-4 md:mt-6">
        <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
          {t.profile.settings}
        </h2>
        <div className="space-y-3">
          {/* Отладочная информация (можно удалить после проверки) */}
          {import.meta.env.DEV && (
            <div className="text-xs text-gray-500 p-2 bg-gray-100 dark:bg-gray-800 rounded">
              Debug: is_admin = {String(user?.is_admin)}, user_id = {user?.id}
            </div>
          )}
          
          {user?.is_admin && (
            <button
              onClick={() => navigate('/analytics?tab=users')}
              className="w-full flex items-center justify-between p-4 rounded-telegram bg-telegram-primary/10 dark:bg-telegram-dark-primary/10 hover:bg-telegram-primary/20 dark:hover:bg-telegram-dark-primary/20 transition-colors text-left border border-telegram-primary/20 dark:border-telegram-dark-primary/20"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="font-semibold text-telegram-text dark:text-telegram-dark-text">Статистика пользователей</p>
                  <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    Просмотр статистики всех пользователей системы
                  </p>
                </div>
              </div>
              <span className="text-telegram-primary dark:text-telegram-dark-primary text-xl">→</span>
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
              <div>
                <p className="font-medium text-telegram-text dark:text-telegram-dark-text">{t.profile.darkTheme}</p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {theme === 'dark' ? t.profile.darkThemeEnabled : t.profile.darkThemeDisabled}
                </p>
              </div>
            </div>
            <div className={`relative w-12 h-6 rounded-full transition-colors ${
              theme === 'dark' 
                ? 'bg-telegram-primary dark:bg-telegram-dark-primary' 
                : 'bg-telegram-border dark:bg-telegram-dark-border'
            }`}>
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
                <p className="font-medium text-telegram-text dark:text-telegram-dark-text">{t.profile.newYearMode}</p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {newYearEnabled ? t.profile.newYearModeEnabled : t.profile.newYearModeDisabled}
                </p>
              </div>
            </div>
            <div className={`relative w-12 h-6 rounded-full transition-colors ${
              newYearEnabled 
                ? 'bg-telegram-primary dark:bg-telegram-dark-primary' 
                : 'bg-telegram-border dark:bg-telegram-dark-border'
            }`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                newYearEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}></div>
            </div>
          </button>
          <div className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors overflow-hidden max-w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
              <span className="text-2xl flex-shrink-0">🌍</span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="font-medium text-telegram-text dark:text-telegram-dark-text truncate">{t.profile.language}</p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary truncate">
                  {language === 'ru' ? 'Русский' : 'English'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0 ml-2">
              <button
                onClick={() => setLanguage('ru')}
                className={`min-w-[3.5rem] max-w-[3.5rem] px-3 py-1.5 rounded-telegram text-sm font-medium transition-colors whitespace-nowrap overflow-hidden flex items-center justify-center ${
                  language === 'ru'
                    ? 'bg-telegram-primary text-white dark:bg-telegram-dark-primary'
                    : 'bg-telegram-border hover:bg-telegram-hover dark:bg-telegram-dark-border dark:hover:bg-telegram-dark-hover'
                }`}
              >
                🇷🇺 RU
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`min-w-[3.5rem] max-w-[3.5rem] px-3 py-1.5 rounded-telegram text-sm font-medium transition-colors whitespace-nowrap overflow-hidden flex items-center justify-center ${
                  language === 'en'
                    ? 'bg-telegram-primary text-white dark:bg-telegram-dark-primary'
                    : 'bg-telegram-border hover:bg-telegram-hover dark:bg-telegram-dark-border dark:hover:bg-telegram-dark-hover'
                }`}
              >
                🇬🇧 EN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Information Section */}
      {user?.is_premium && (
        <div className="card p-4 md:p-5 mt-4 md:mt-6">
          <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
            {t.profile.info}
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/import')}
              className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📥</span>
                <div>
                  <p className="font-medium text-telegram-text dark:text-telegram-dark-text">{t.profile.importData}</p>
                  <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.profile.importDataDesc}</p>
                </div>
              </div>
              <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Reset Account Section */}
      <div className="card p-4 md:p-5 mt-4 md:mt-6 border-2 border-red-200 dark:border-red-800">
        <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4 text-red-600 dark:text-red-400">
          {t.profile.dangerZone}
        </h2>
        
        {!showResetConfirm ? (
          <div>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
              {t.profile.resetAccountDesc}
            </p>
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={resetMutation.isPending}
              className="w-full btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 border-red-300 dark:border-red-700 text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.profile.resetAccount}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
              {t.profile.resetConfirm}
            </p>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
              {t.profile.resetConfirmDesc}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleResetConfirm}
                disabled={resetMutation.isPending}
                className="flex-1 btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 border-red-300 dark:border-red-700 text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetMutation.isPending ? t.common.loading : t.profile.resetButton}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetMutation.isPending}
                className="flex-1 btn-secondary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
