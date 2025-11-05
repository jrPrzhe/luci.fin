import { useEffect, useState, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Accounts } from './pages/Accounts'
import { Reports } from './pages/Reports'
import { SharedBudgets } from './pages/SharedBudgets'
import { Categories } from './pages/Categories'
import { Goals } from './pages/Goals'
import { Profile } from './pages/Profile'
import { About } from './pages/About'
import { Import } from './pages/Import'
import { Onboarding } from './pages/Onboarding'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { isTelegramWebApp, getInitData, getTelegramUser } from './utils/telegram'
import { api } from './services/api'
import { NewYearProvider } from './contexts/NewYearContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

function TelegramAuthHandler() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)
  const hasAttemptedAuth = useRef(false)

  useEffect(() => {
    let mounted = true
    let timeoutId: ReturnType<typeof setTimeout>

    const checkTelegramAuth = async () => {
      try {
        // Timeout after 3 seconds
        timeoutId = setTimeout(() => {
          if (mounted) {
            setIsChecking(false)
          }
        }, 3000)

        // Если не в Telegram Mini App, пропускаем проверку
        if (!isTelegramWebApp()) {
          if (mounted) setIsChecking(false)
          return
        }

        // На страницах логина/регистрации показываем загрузку
        // На других страницах просто проверяем в фоне

        // Если уже есть токен, проверяем его валидность
        const token = localStorage.getItem('token')
        if (token) {
          try {
            const user = await api.getCurrentUser()
            if (mounted && user) {
              // Токен валиден, но если это Mini App, проверяем, что пользователь совпадает с Telegram
              if (isTelegramWebApp()) {
                const tgUser = getTelegramUser()
                if (tgUser && tgUser.id) {
                  // Проверяем, что токен принадлежит текущему Telegram пользователю
                  // Если telegram_id не совпадает, очищаем токен и авторизуемся заново
                  const telegramId = tgUser.id.toString()
                  // Получаем telegram_id из ответа API (если есть)
                  // Если user.telegram_id не совпадает с текущим Telegram ID, очищаем токен
                  if (user.telegram_id && user.telegram_id !== telegramId) {
                    console.warn('Token belongs to different Telegram user, clearing and re-authenticating')
                    localStorage.removeItem('token')
                    api.setToken(null)
                    // Продолжаем авторизацию через Telegram
                  } else {
                    // Токен валиден и принадлежит текущему пользователю
                    clearTimeout(timeoutId)
                    setIsChecking(false)
                    // Если на странице логина/регистрации, перенаправляем
                    if (location.pathname === '/login' || location.pathname === '/register') {
                      const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/'
                      navigate(returnTo)
                    }
                    return
                  }
                } else {
                  // Нет данных Telegram, но токен есть - оставляем как есть
                  clearTimeout(timeoutId)
                  setIsChecking(false)
                  if (location.pathname === '/login' || location.pathname === '/register') {
                    const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/'
                    navigate(returnTo)
                  }
                  return
                }
              } else {
                // Не Mini App, токен валиден
                clearTimeout(timeoutId)
                setIsChecking(false)
                if (location.pathname === '/login' || location.pathname === '/register') {
                  const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/'
                  navigate(returnTo)
                }
                return
              }
            }
          } catch (error) {
            // Токен невалиден, удаляем его и продолжаем авторизацию
            console.warn('Token invalid, will re-authenticate via Telegram')
            localStorage.removeItem('token')
            api.setToken(null)
          }
        }

        // Не делаем повторные попытки авторизации
        if (hasAttemptedAuth.current) {
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
          }
          return
        }

        // Автоматическая авторизация через Telegram Mini App
        const initData = getInitData()
        console.log('Telegram auto-auth check:', { 
          hasInitData: !!initData, 
          initDataLength: initData?.length || 0,
          isMiniApp: isTelegramWebApp(),
          currentPath: location.pathname
        })
        
        if (initData && initData.length > 0) {
          hasAttemptedAuth.current = true
          try {
            console.log('Attempting automatic Telegram login...')
            const response = await api.loginTelegram(initData)
            console.log('Telegram auto-login successful:', { 
              userId: response.user?.id,
              hasAccessToken: !!response.access_token,
              accessTokenLength: response.access_token?.length || 0
            })
            
            if (mounted) {
              // Tokens are already stored by api.loginTelegram method
              // Проверяем, что токен действительно сохранен
              const savedToken = localStorage.getItem('token')
              if (!savedToken || savedToken !== response.access_token) {
                console.error('[TelegramAuthHandler] Token was not saved correctly!')
                clearTimeout(timeoutId)
                setIsChecking(false)
                return
              }
              
              console.log('[TelegramAuthHandler] Token saved successfully')
              
              // Помечаем, что пользователь только что вошел
              sessionStorage.setItem('justLoggedIn', 'true')
              clearTimeout(timeoutId)
              setIsChecking(false)
              
              // Проверяем онбординг - Layout перенаправит на онбординг если нужно
              navigate('/', { replace: true })
            }
          } catch (error: any) {
            console.error('Telegram auto-auth failed:', error)
            if (mounted) {
              clearTimeout(timeoutId)
              setIsChecking(false)
              // Если авторизация не удалась, редиректим на логин
              if (location.pathname !== '/login' && location.pathname !== '/register') {
                navigate('/login')
              }
            }
          }
        } else {
          // Нет initData - возможно, Mini App еще не инициализирован
          console.warn('No initData available for Telegram auto-auth')
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
          }
        }
      } catch (error) {
        console.error('Auth check error:', error)
        if (mounted) {
          clearTimeout(timeoutId)
          setIsChecking(false)
        }
      }
    }

    // Запускаем проверку
    checkTelegramAuth()

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [navigate, location.pathname])

  // Показываем загрузку только на страницах логина/регистрации и если проверяем
  if (isChecking && (location.pathname === '/login' || location.pathname === '/register')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-telegram-bg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary mb-4"></div>
          <p className="text-telegram-textSecondary">Загрузка...</p>
        </div>
      </div>
    )
  }

  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NewYearProvider>
        <Router>
          <TelegramAuthHandler />
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="categories" element={<Categories />} />
            <Route path="goals" element={<Goals />} />
            <Route path="reports" element={<Reports />} />
            <Route path="shared-budgets" element={<SharedBudgets />} />
            <Route path="profile" element={<Profile />} />
            <Route path="import" element={<Import />} />
            <Route path="about" element={<About />} />
          </Route>
        </Routes>
      </Router>
      </NewYearProvider>
    </QueryClientProvider>
  )
}

export default App

