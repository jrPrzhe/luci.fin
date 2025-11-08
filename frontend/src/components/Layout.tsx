import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { isTelegramWebApp } from '../utils/telegram'
import { api } from '../services/api'
import { Welcome } from './Welcome'
import { Stories } from './Stories'
import { SnowEffect } from './SnowEffect'
import { Garland } from './Garland'
import { Icicles } from './Icicles'
import { useNewYearTheme } from '../contexts/NewYearContext'
import { useTheme } from '../hooks/useTheme'

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
  const { isEnabled: newYearEnabled } = useNewYearTheme()
  const { theme, toggleTheme } = useTheme()

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
      
      const token = localStorage.getItem('token')
      
      if (!token) {
        // Сохраняем текущий путь для редиректа после авторизации
        const returnTo = location.pathname
        setIsAuthorized(false)
        setIsCheckingAuth(false)
        navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)
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
        localStorage.removeItem('token')
        api.setToken(null)
        navigate('/login')
      } finally {
        setIsCheckingAuth(false)
      }
    }

    // Проверяем авторизацию если статус неизвестен или false
    if (isAuthorized === null || (isAuthorized === false && localStorage.getItem('token'))) {
      checkAuth()
    }
  }, [navigate, location.pathname, showWelcome, isCheckingAuth, isAuthorized])

  // Проверяем флаг justLoggedIn отдельно
  useEffect(() => {
    if (isAuthorized && !showWelcome) {
      const justLoggedIn = sessionStorage.getItem('justLoggedIn') === 'true'
      if (justLoggedIn) {
        api.getCurrentUser().then(user => {
          if (user) {
            setUserName(user.first_name || user.username || 'Пользователь')
            // Проверяем, прошел ли пользователь онбординг
            const onboardingCompleted = localStorage.getItem('onboarding_completed') === 'true'
            if (!onboardingCompleted) {
              // Показываем онбординг для новых пользователей
              navigate('/onboarding')
              sessionStorage.removeItem('justLoggedIn')
            } else {
              setShowWelcome(true)
              sessionStorage.removeItem('justLoggedIn')
            }
          }
        }).catch(console.error)
      }
    }
  }, [isAuthorized, showWelcome, navigate])

  // Отслеживаем появление токена для обновления авторизации (особенно важно для Mini App)
  useEffect(() => {
    // Работаем только на защищенных страницах
    if (location.pathname === '/login' || location.pathname === '/register') {
      return
    }

    // Если уже авторизованы и показываем приветствие, не проверяем
    if (isAuthorized === true) {
      return
    }

    // Периодически проверяем токен, если авторизация неизвестна или false
    const checkTokenPeriodically = () => {
      // Пропускаем, если идет проверка
      if (isCheckingAuth) return

      const token = localStorage.getItem('token')
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
            }
          })
          .catch(error => {
            console.error('Failed to verify token:', error)
            setIsCheckingAuth(false)
          })
      }
    }

    // Проверяем сразу
    checkTokenPeriodically()

    // И затем каждые 500мс, пока не авторизованы
    const interval = setInterval(() => {
      if (!isAuthorized) {
        checkTokenPeriodically()
      } else {
        clearInterval(interval)
      }
    }, 500)

    // Останавливаем через 8 секунд
    const timeout = setTimeout(() => {
      clearInterval(interval)
    }, 8000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [isAuthorized, showWelcome, isCheckingAuth, location.pathname])


  const handleLogout = () => {
    localStorage.removeItem('token')
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
  // НЕ показываем загрузку на странице онбординга
  if ((isAuthorized === null || (isCheckingAuth && isAuthorized !== true)) && location.pathname !== '/onboarding') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-telegram-bg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary mb-4"></div>
          <p className="text-telegram-textSecondary">Загрузка...</p>
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
    { path: '/', label: 'Дашборд', icon: '📊' },
    { path: '/transactions', label: 'Транзакции', icon: '💸' },
    { path: '/accounts', label: 'Счета', icon: '💳' },
    { path: '/categories', label: 'Категории', icon: '📦' },
    { path: '/goals', label: 'Цели', icon: '🎯' },
    { path: '/shared-budgets', label: 'Бюджеты', icon: '👥' },
    { path: '/reports', label: 'Отчёты', icon: '📈' },
    { path: '/profile', label: 'Профиль', icon: '⚙️' },
  ]

  return (
    <div className={`min-h-screen flex flex-col bg-telegram-bg dark:bg-telegram-dark-bg ${newYearEnabled ? 'new-year-mode' : ''}`}>
      {/* Новогодний снег */}
      {newYearEnabled && <SnowEffect />}
      
      {/* Гирлянда в верхнем меню */}
      {newYearEnabled && <Garland />}
      
      {/* Сосульки в нижнем меню */}
      {newYearEnabled && <Icicles />}
      
      {/* Desktop Sidebar - скрыт на мобильных */}
      <aside className="hidden md:flex w-64 flex-col bg-telegram-surface dark:bg-telegram-dark-surface border-r border-telegram-border dark:border-telegram-dark-border">
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
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
              <div>
                <p className="font-medium text-sm text-telegram-text dark:text-telegram-dark-text">Темная тема</p>
                <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {theme === 'dark' ? 'Включена' : 'Выключена'}
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
            onClick={handleLogout}
            className="w-full btn-secondary text-telegram-danger dark:text-telegram-dark-danger hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-telegram-danger dark:hover:text-red-300 text-sm py-2"
          >
            Выход
          </button>
        </div>
      </aside>

      {/* Mobile Header - только на мобильных */}
      <header className="md:hidden bg-telegram-surface dark:bg-telegram-dark-surface border-b border-telegram-border dark:border-telegram-dark-border px-4 py-3 flex items-center justify-between sticky top-0 z-10 relative">
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
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn-icon w-10 h-10 flex items-center justify-center"
              title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
            >
              <span className="text-xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn-icon w-10 h-10"
            >
              <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-20"
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
                  <h2 className="text-base font-semibold text-telegram-text dark:text-telegram-dark-text">
                    {newYearEnabled ? '🎄 Меню' : 'Меню'}
                  </h2>
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
            
            <div className="p-3 border-t border-telegram-border dark:border-telegram-dark-border mt-auto">
              <button
                onClick={handleLogout}
                className="w-full btn-secondary text-telegram-danger dark:text-telegram-dark-danger hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-telegram-danger dark:hover:text-red-300 text-sm py-2"
              >
                Выход
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation - только в Mini App на мобильных */}
      {isMiniApp && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-telegram-surface dark:bg-telegram-dark-surface border-t border-telegram-border dark:border-telegram-dark-border px-2 py-2 safe-area-inset-bottom z-30">
          <div className="flex items-center justify-around relative">
            {/* Дашборд, Транзакции, Счета, Отчёты (вместо Категорий) */}
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
                      ? 'text-telegram-primary' 
                      : 'text-telegram-textSecondary'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              )
            })}
            <Link
              to="/profile"
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-telegram min-w-[60px] transition-all ${
                location.pathname === '/profile' 
                  ? 'text-telegram-primary' 
                  : 'text-telegram-textSecondary'
              }`}
            >
              <span className="text-xl">⚙️</span>
              <span className="text-[10px] font-medium">Профиль</span>
            </Link>
          </div>
        </nav>
      )}

      {/* Stories Modal */}
      <Stories isOpen={showStories} onClose={() => setShowStories(false)} />
    </div>
  )
}

