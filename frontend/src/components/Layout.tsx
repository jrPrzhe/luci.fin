import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isTelegramWebApp } from '../utils/telegram'
import { isVKWebApp } from '../utils/vk'
import { api } from '../services/api'
import { storageSync } from '../utils/storage'
import { Welcome } from './Welcome'
import { Stories } from './Stories'
import { SnowEffect } from './SnowEffect'
import { Garland } from './Garland'
import { useNewYearTheme } from '../contexts/NewYearContext'
import { useTheme } from '../hooks/useTheme'
import { useI18n } from '../contexts/I18nContext'
import { QuestNotifications } from './QuestNotifications'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [userName, setUserName] = useState<string>()
  const [isCheckingAuth, setIsCheckingAuth] = useState(false)
  const [showStories, setShowStories] = useState(false)
  const isMiniApp = isTelegramWebApp()
  const isVK = isVKWebApp()
  const { isEnabled: newYearEnabled } = useNewYearTheme()
  const { theme, toggleTheme } = useTheme()
  const { t, language, setLanguage } = useI18n()

  // Получаем данные пользователя для проверки админ-статуса
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.getCurrentUser(),
    enabled: isAuthorized === true,
  })

  // Предзагрузка изображений для Stories при монтировании компонента
  useEffect(() => {
    const storyImages = ['/1.png', '/2.png', '/3.png', '/4.png', '/5.png']
    storyImages.forEach((src) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = src
      document.head.appendChild(link)
      
      // Также предзагружаем через Image объект для кэширования
      const img = new Image()
      img.src = src
    })
  }, [])

  // Проверяем авторизацию при изменении пути
  useEffect(() => {
    // НЕ проверяем авторизацию на страницах логина/регистрации/онбординга - они обрабатываются отдельно
    if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/onboarding') {
      return
    }

    // Не проверяем, если уже авторизованы и показываем приветствие
    if (isAuthorized === true && showWelcome) {
      return
    }

    // Пропускаем проверку только если уже идет проверка
    if (isCheckingAuth) return

    const checkAuth = async () => {
      setIsCheckingAuth(true)
      
      // Используем storageSync вместо прямого localStorage
      // Для VK и Telegram это будет работать через их хранилища
      const token = storageSync.getItem('token')
      
      if (!token) {
        // Сохраняем текущий путь для редиректа после авторизации
        const returnTo = location.pathname
        // Даем время на авторизацию через Mini App (Telegram/VK)
        // Если через 2 секунды токен не появился, редиректим на логин
        setTimeout(() => {
          if (!storageSync.getItem('token')) {
            setIsAuthorized(false)
            setIsCheckingAuth(false)
            navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)
          } else {
            // Токен появился, проверяем его
            checkAuth()
          }
        }, 2000)
        return
      }

      try {
        const user = await api.getCurrentUser()
        if (user) {
          setIsAuthorized(true)
        } else {
          setIsAuthorized(false)
          navigate('/login')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsAuthorized(false)
        storageSync.removeItem('token')
        api.setToken(null)
        navigate('/login')
      } finally {
        setIsCheckingAuth(false)
      }
    }

    // Проверяем авторизацию если статус неизвестен или false
    // Добавляем небольшую задержку для Mini App авторизации
    const timeout = setTimeout(() => {
      if (isAuthorized === null || (isAuthorized === false && storageSync.getItem('token'))) {
        checkAuth()
      }
    }, 500)

    return () => clearTimeout(timeout)
  }, [navigate, location.pathname, showWelcome, isCheckingAuth, isAuthorized])

  // Проверяем флаг justLoggedIn отдельно
  useEffect(() => {
    if (isAuthorized && !showWelcome) {
      const justLoggedIn = sessionStorage.getItem('justLoggedIn') === 'true'
      if (justLoggedIn) {
        // Проверяем, является ли пользователь новым или существующим
        Promise.all([
          api.getCurrentUser(),
          api.getAccounts().catch(() => []), // Если ошибка, считаем что нет счетов
        ]).then(([user, accounts]) => {
          if (user) {
            setUserName(user.first_name || user.username || 'Пользователь')
            
            // Проверяем, является ли пользователь существующим
            // Если есть счета (больше чем дефолтный), значит пользователь существующий
            const hasAccounts = Array.isArray(accounts) && accounts.length > 0
            const isExistingUser = hasAccounts
            
            if (isExistingUser) {
              // Для существующих пользователей - только приветствие, без онбординга
              // Устанавливаем флаг онбординга, чтобы больше не показывать
              storageSync.setItem('onboarding_completed', 'true')
              setShowWelcome(true)
              sessionStorage.removeItem('justLoggedIn')
            } else {
              // Для новых пользователей проверяем флаг онбординга
              const onboardingCompleted = storageSync.getItem('onboarding_completed') === 'true'
              if (!onboardingCompleted) {
                // Показываем онбординг для новых пользователей
                navigate('/onboarding')
                sessionStorage.removeItem('justLoggedIn')
              } else {
                setShowWelcome(true)
                sessionStorage.removeItem('justLoggedIn')
              }
            }
          }
        }).catch(console.error)
      }
    }
  }, [isAuthorized, showWelcome, navigate])

  // Отслеживаем появление токена для обновления авторизации (особенно важно для Mini App)
  useEffect(() => {
    // Работаем только на защищенных страницах
    if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/onboarding') {
      return
    }

    // Если уже авторизованы, не проверяем
    if (isAuthorized === true) {
      return
    }

    let checkCount = 0
    const maxChecks = 10 // Максимум 10 проверок (5 секунд при интервале 500мс)

    // Периодически проверяем токен, если авторизация неизвестна или false
    const checkTokenPeriodically = async () => {
      // Пропускаем, если идет проверка
      if (isCheckingAuth) return

      // Ограничиваем количество проверок
      checkCount++
      if (checkCount > maxChecks) {
        console.warn('[Layout] Max auth checks reached, stopping periodic check')
        return
      }

      // Для Telegram/VK используем быстрый доступ к storage
      let token: string | null = storageSync.getItem('token')
      
      // Если не нашли синхронно и это Telegram/VK, пробуем асинхронно (с таймаутом)
      if (!token && (isTelegramWebApp() || isVKWebApp())) {
        try {
          const { default: storage } = await import('../utils/storage')
          token = await Promise.race([
            storage.getItem('token'),
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 200)) // Таймаут 200мс
          ])
        } catch (error) {
          console.warn('[Layout] Failed to get token from Cloud Storage:', error)
        }
      }
      
      if (token && (isAuthorized === false || isAuthorized === null)) {
        // Токен появился, проверяем авторизацию
        setIsCheckingAuth(true)
        api.getCurrentUser()
          .then(user => {
            if (user) {
              setIsAuthorized(true)
              setIsCheckingAuth(false)
              const justLoggedIn = sessionStorage.getItem('justLoggedIn') === 'true'
              if (justLoggedIn && !showWelcome) {
                setUserName(user.first_name || user.username || 'Пользователь')
                setShowWelcome(true)
                sessionStorage.removeItem('justLoggedIn')
              }
            } else {
              setIsCheckingAuth(false)
              setIsAuthorized(false)
            }
          })
          .catch(error => {
            console.error('Failed to verify token:', error)
            setIsCheckingAuth(false)
            setIsAuthorized(false)
            // Если токен невалиден, удаляем его
            storageSync.removeItem('token')
            api.setToken(null)
          })
      } else if (!token && isAuthorized === null) {
        // Нет токена и статус неизвестен - устанавливаем false после нескольких проверок
        if (checkCount >= 3) {
          setIsAuthorized(false)
          navigate('/login')
        }
      }
    }

    // Проверяем сразу
    checkTokenPeriodically().catch(console.error)

    // И затем каждые 500мс, пока не авторизованы
    const interval = setInterval(() => {
      if (!isAuthorized && checkCount <= maxChecks) {
        checkTokenPeriodically().catch(console.error)
      } else {
        clearInterval(interval)
      }
    }, 500)

    // Останавливаем через 5 секунд
    const timeout = setTimeout(() => {
      clearInterval(interval)
      // Если после таймаута все еще не авторизованы и нет токена, редиректим на логин
      if (!isAuthorized && !storageSync.getItem('token')) {
        setIsAuthorized(false)
        if (location.pathname !== '/login' && location.pathname !== '/register') {
          navigate('/login')
        }
      }
    }, 5000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [isAuthorized, showWelcome, isCheckingAuth, location.pathname, navigate])


  const handleLogout = () => {
    storageSync.removeItem('token')
    api.setToken(null)
    navigate('/login')
  }

  const handleWelcomeComplete = () => {
    setShowWelcome(false)
    // Возвращаемся на сохраненный путь или на дашборд
    const params = new URLSearchParams(window.location.search)
    const returnTo = params.get('returnTo') || '/'
    if (returnTo && returnTo !== '/login' && returnTo !== '/register') {
      navigate(returnTo)
    } else {
      navigate('/')
    }
  }

  // Показываем загрузку во время проверки авторизации
  // НЕ показываем загрузку на странице онбординга и логина/регистрации
  if ((isAuthorized === null || (isCheckingAuth && isAuthorized !== true)) && 
      location.pathname !== '/onboarding' && 
      location.pathname !== '/login' && 
      location.pathname !== '/register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-telegram-bg dark:bg-telegram-dark-bg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary dark:border-telegram-dark-primary mb-4"></div>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.common.loading}</p>
        </div>
      </div>
    )
  }

  // Если на странице онбординга и не авторизован, показываем онбординг
  if (location.pathname === '/onboarding' && !isAuthorized) {
    return null // Онбординг сам обработает навигацию
  }

  // Показываем приветствие после авторизации (только если онбординг пройден)
  if (showWelcome) {
    const onboardingCompleted = localStorage.getItem('onboarding_completed') === 'true'
    if (onboardingCompleted) {
      return <Welcome userName={userName} onComplete={handleWelcomeComplete} />
    }
  }

  // Если не авторизован, редирект уже произошел, возвращаем null
  if (!isAuthorized) {
    return null
  }

  const navItems = [
    { path: '/', label: t.nav.dashboard, icon: '📊' },
    { path: '/transactions', label: t.nav.transactions, icon: '💸' },
    { path: '/accounts', label: t.nav.accounts, icon: '💳' },
    { path: '/quests', label: 'Задания', icon: '🎯' },
    { path: '/achievements', label: 'Достижения', icon: '🏆' },
    { path: '/categories', label: t.nav.categories, icon: '📦' },
    { path: '/goals', label: t.nav.goals, icon: '🎯' },
    { path: '/shared-budgets', label: t.nav.budgets, icon: '👥' },
    { path: '/reports', label: t.nav.reports, icon: '📈' },
    { path: '/profile', label: t.nav.profile, icon: '⚙️' },
    { path: '/about', label: t.profile.about, icon: '📚' },
    ...(user?.is_admin ? [{ path: '/analytics', label: 'Аналитика', icon: '📊' }] : []),
  ]

  return (
    <div className={`min-h-screen flex flex-col bg-telegram-bg dark:bg-telegram-dark-bg ${newYearEnabled ? 'new-year-mode' : ''}`}>
      {/* Новогодний снег */}
      {newYearEnabled && <SnowEffect />}
      
      {/* Гирлянда в верхнем меню */}
      {newYearEnabled && <Garland />}
      
      {/* Desktop Sidebar - скрыт на мобильных */}
      <aside className="hidden lg:flex w-64 flex-col bg-telegram-surface dark:bg-telegram-dark-surface border-r border-telegram-border dark:border-telegram-dark-border flex-shrink-0">
        <div className="p-4 border-b border-telegram-border dark:border-telegram-dark-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowStories(true)}
              className="relative group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight flex items-center justify-center overflow-hidden relative z-10 transform transition-transform duration-300 group-hover:scale-110 shadow-lg">
                <img src="/1.png" alt="Люся.Бюджет" className="w-full h-full object-cover" />
              </div>
              {/* Пульсирующее кольцо - анимация как в Instagram Stories */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight opacity-60 animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute -inset-1 rounded-full border-2 border-telegram-primary dark:border-telegram-dark-primary opacity-40 animate-pulse" style={{ animationDuration: '1.5s' }}></div>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-telegram-primary dark:from-telegram-dark-primary via-purple-500 to-telegram-primaryLight dark:to-telegram-dark-primaryLight bg-clip-text text-transparent">
                  {newYearEnabled ? '🎄 ' : ''}Люся.Бюджет{newYearEnabled ? ' ❄️' : ''}
                </span>
              </h1>
              <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary font-medium tracking-wide">
                {newYearEnabled ? 'С Новым годом! 🎉' : 'Все посчитала'}
              </p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            )
          })}
                </nav>

        <div className="p-3 border-t border-telegram-border dark:border-telegram-dark-border space-y-2">
          {/* Language Toggle */}
          <div className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌍</span>
              <div>
                <p className="font-medium text-sm text-telegram-text dark:text-telegram-dark-text">{t.profile.language}</p>
                <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {language === 'ru' ? 'Русский' : 'English'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('ru')}
                className={`px-2 py-1 rounded-telegram text-xs font-medium transition-colors ${
                  language === 'ru'
                    ? 'bg-telegram-primary text-white dark:bg-telegram-dark-primary'
                    : 'bg-telegram-border hover:bg-telegram-hover dark:bg-telegram-dark-border dark:hover:bg-telegram-dark-hover'
                }`}
              >
                🇷🇺 RU
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-telegram text-xs font-medium transition-colors ${
                  language === 'en'
                    ? 'bg-telegram-primary text-white dark:bg-telegram-dark-primary'
                    : 'bg-telegram-border hover:bg-telegram-hover dark:bg-telegram-dark-border dark:hover:bg-telegram-dark-hover'
                }`}
              >
                🇬🇧 EN
              </button>
            </div>
          </div>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
              <div>
                <p className="font-medium text-sm text-telegram-text dark:text-telegram-dark-text">{t.profile.darkTheme}</p>
                <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {theme === 'dark' ? t.profile.darkThemeEnabled : t.profile.darkThemeDisabled}
                </p>
              </div>
            </div>
            <div className="relative w-12 h-6 bg-telegram-border dark:bg-telegram-dark-border rounded-full transition-colors">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
              }`}></div>
            </div>
          </button>
          {/* Hide logout button in VK Mini App - users authorize via vk_user_id */}
          {!isVK && (
            <button
              onClick={handleLogout}
              className="w-full btn-secondary text-telegram-danger dark:text-telegram-dark-danger hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-telegram-danger dark:hover:text-red-300 text-sm py-2"
            >
              {t.common.logout}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile/Tablet Header - скрыт на desktop (lg+) */}
      <header className="lg:hidden bg-telegram-surface dark:bg-telegram-dark-surface border-b border-telegram-border dark:border-telegram-dark-border px-4 py-3 flex items-center justify-between sticky top-0 z-10 relative">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStories(true)}
            className="relative group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight flex items-center justify-center overflow-hidden relative z-10 transform transition-transform duration-300 group-active:scale-110 shadow-lg">
              <img src="/1.png" alt="Люся.Бюджет" className="w-full h-full object-cover" />
            </div>
            {/* Пульсирующее кольцо - анимация как в Instagram Stories */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight opacity-60 animate-ping" style={{ animationDuration: '2s' }}></div>
            <div className="absolute -inset-1 rounded-full border-2 border-telegram-primary dark:border-telegram-dark-primary opacity-40 animate-pulse" style={{ animationDuration: '1.5s' }}></div>
          </button>
          <h1 className="text-base font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-telegram-primary dark:from-telegram-dark-primary via-purple-500 to-telegram-primaryLight dark:to-telegram-dark-primaryLight bg-clip-text text-transparent">
              {newYearEnabled ? '🎄 ' : ''}Люся.Бюджет{newYearEnabled ? ' ❄️' : ''}
            </span>
          </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Quest Notifications */}
            <QuestNotifications variant="header" />
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn-icon w-10 h-10 flex items-center justify-center bg-telegram-hover dark:bg-telegram-dark-hover hover:bg-telegram-border dark:hover:bg-telegram-dark-border"
              title={theme === 'dark' ? t.profile.darkThemeDisabled : t.profile.darkThemeEnabled}
            >
              <span className="text-xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
            </button>
          </div>
        </header>

      {/* Mobile/Tablet Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-20"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="bg-telegram-surface dark:bg-telegram-dark-surface h-full w-64 shadow-lg overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-telegram-border dark:border-telegram-dark-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight flex items-center justify-center overflow-hidden">
                    <img src="/1.png" alt="Люся.Бюджет" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-telegram-text dark:text-telegram-dark-text">
                      {newYearEnabled ? '🎄 Меню' : 'Меню'}
                    </h2>
                    {/* Premium Badge в мобильном меню-оверлее */}
                    {user?.is_premium && (
                      <div className="flex items-center gap-1 bg-yellow-400/20 backdrop-blur-sm border border-yellow-300/30 rounded-full px-1.5 py-0.5">
                        <span className="text-yellow-300 text-[10px]">⭐</span>
                        <span className="text-yellow-100 text-[9px] font-semibold">Премиум</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-icon w-8 h-8"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <nav className="p-2 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-medium text-sm">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
            
            <div className="p-3 border-t border-telegram-border dark:border-telegram-dark-border mt-auto space-y-2">
              {/* Language Toggle */}
              <div className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🌍</span>
                  <div>
                    <p className="font-medium text-sm text-telegram-text dark:text-telegram-dark-text">{t.profile.language}</p>
                    <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      {language === 'ru' ? 'Русский' : 'English'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLanguage('ru')}
                    className={`px-2 py-1 rounded-telegram text-xs font-medium transition-colors ${
                      language === 'ru'
                        ? 'bg-telegram-primary text-white dark:bg-telegram-dark-primary'
                        : 'bg-telegram-border hover:bg-telegram-hover dark:bg-telegram-dark-border dark:hover:bg-telegram-dark-hover'
                    }`}
                  >
                    🇷🇺 RU
                  </button>
                  <button
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-1 rounded-telegram text-xs font-medium transition-colors ${
                      language === 'en'
                        ? 'bg-telegram-primary text-white dark:bg-telegram-dark-primary'
                        : 'bg-telegram-border hover:bg-telegram-hover dark:bg-telegram-dark-border dark:hover:bg-telegram-dark-hover'
                    }`}
                  >
                    🇬🇧 EN
                  </button>
                </div>
              </div>
              {/* Hide logout button in VK Mini App - users authorize via vk_user_id */}
              {!isVK && (
                <button
                  onClick={handleLogout}
                  className="w-full btn-secondary text-telegram-danger dark:text-telegram-dark-danger hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-telegram-danger dark:hover:text-red-300 text-sm py-2"
                >
                  {t.common.logout}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 w-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation - только в Mini App на мобильных */}
      {isMiniApp && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-telegram-surface dark:bg-telegram-dark-surface border-t border-telegram-border dark:border-telegram-dark-border px-2 py-2 safe-area-inset-bottom z-10">
          <div className="flex items-center justify-around">
            {/* Дашборд, Транзакции, Счета, Отчёты */}
            {navItems.filter(item => 
              item.path === '/' || 
              item.path === '/transactions' || 
              item.path === '/accounts' || 
              item.path === '/reports'
            ).map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-telegram min-w-[60px] transition-all ${
                    isActive 
                      ? 'text-telegram-primary dark:text-telegram-dark-primary' 
                      : 'text-telegram-textSecondary dark:text-telegram-dark-textSecondary'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              )
            })}
            {/* Кнопка Меню - открывает боковое меню со всеми пунктами */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-telegram min-w-[60px] transition-all ${
                mobileMenuOpen 
                  ? 'text-telegram-primary dark:text-telegram-dark-primary bg-telegram-primary/10 dark:bg-telegram-dark-primary/10' 
                  : 'text-telegram-textSecondary dark:text-telegram-dark-textSecondary'
              }`}
              aria-label="Меню"
            >
              <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
              <span className="text-[10px] font-medium">Меню</span>
            </button>
          </div>
        </nav>
      )}
      
      {/* Mobile Bottom Navigation - для всех мобильных устройств (не только Mini App) */}
      {!isMiniApp && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-telegram-surface dark:bg-telegram-dark-surface border-t border-telegram-border dark:border-telegram-dark-border px-2 py-2 safe-area-inset-bottom z-10 shadow-lg">
          <div className="flex items-center justify-around">
            {/* Дашборд, Транзакции, Счета, Отчёты */}
            {navItems.filter(item => 
              item.path === '/' || 
              item.path === '/transactions' || 
              item.path === '/accounts' || 
              item.path === '/reports'
            ).map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-telegram min-w-[60px] transition-all ${
                    isActive 
                      ? 'text-telegram-primary dark:text-telegram-dark-primary' 
                      : 'text-telegram-textSecondary dark:text-telegram-dark-textSecondary'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              )
            })}
            {/* Кнопка Меню - открывает боковое меню со всеми пунктами */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-telegram min-w-[60px] transition-all ${
                mobileMenuOpen 
                  ? 'text-telegram-primary dark:text-telegram-dark-primary bg-telegram-primary/10 dark:bg-telegram-dark-primary/10' 
                  : 'text-telegram-textSecondary dark:text-telegram-dark-textSecondary'
              }`}
              aria-label="Меню"
            >
              <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
              <span className="text-[10px] font-medium">Меню</span>
            </button>
          </div>
        </nav>
      )}

      {/* Stories Modal */}
      <Stories isOpen={showStories} onClose={() => setShowStories(false)} />
    </div>
  )
}

