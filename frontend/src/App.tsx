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
import { Statistics } from './pages/Statistics'
import { Achievements } from './pages/Achievements'
import { Quests } from './pages/Quests'
import { Analytics } from './pages/Analytics'
import { isTelegramWebApp, getTelegramUser, waitForInitData } from './utils/telegram'
import { isVKWebApp, getVKLaunchParams, getVKUserId, initVKWebApp, getVKUser } from './utils/vk'
import { api } from './services/api'
import { storageSync } from './utils/storage'
import { NewYearProvider } from './contexts/NewYearContext'
import { I18nProvider } from './contexts/I18nContext'
import { ToastProvider } from './contexts/ToastContext'
import { LoadingSpinner } from './components/LoadingSpinner'

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
        // Timeout after 5 seconds (достаточно для авторизации)
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn('[TelegramAuthHandler] Auth check timeout')
            setIsChecking(false)
          }
        }, 5000)

        // Если не в Telegram Mini App, пропускаем проверку
        if (!isTelegramWebApp()) {
          if (mounted) setIsChecking(false)
          return
        }

        // На страницах логина/регистрации показываем загрузку
        // На других страницах просто проверяем в фоне

        // Для Telegram используем асинхронный доступ к storage
        // Сначала пытаемся загрузить токен из Cloud Storage (одна попытка, быстро)
        let token: string | null = null
        
        try {
          // Сначала пробуем синхронный доступ (из кэша) - быстрее
          token = storageSync.getItem('token')
          
          // Если не нашли в кэше, пробуем асинхронный доступ (только одна попытка)
          if (!token) {
            try {
              const { default: storage } = await import('./utils/storage')
              token = await Promise.race([
                storage.getItem('token'),
                new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 500)) // Таймаут 500мс
              ])
            } catch (error) {
              console.warn('[TelegramAuthHandler] Storage access failed:', error)
            }
          }
        } catch (error) {
          console.warn('[TelegramAuthHandler] Token loading error:', error)
        }
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
                    storageSync.removeItem('token')
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
            storageSync.removeItem('token')
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
        // Ждем, пока Telegram WebApp будет готов и initData станет доступен
        console.log('Telegram auto-auth check: waiting for initData...')
        const initData = await waitForInitData(5000) // Ждем до 5 секунд для полной инициализации
        console.log('Telegram auto-auth check:', { 
          hasInitData: !!initData, 
          initDataLength: initData?.length || 0,
          isMiniApp: isTelegramWebApp(),
          currentPath: location.pathname,
          hasToken: !!token
        })
        
        if (initData && initData.length > 0) {
          hasAttemptedAuth.current = true
          try {
            console.log('Attempting automatic Telegram login...')
            // Get current token for account linking (if user is already logged in via VK)
            // Используем токен, который мы уже загрузили выше
            const currentToken = token
            const response = await api.loginTelegram(initData, currentToken)
            console.log('Telegram auto-login successful:', { 
              userId: response.user?.id,
              hasAccessToken: !!response.access_token,
              accessTokenLength: response.access_token?.length || 0
            })
            
            if (mounted) {
              // Tokens are already stored by api.loginTelegram method
              // Проверяем токен быстро (одна попытка)
              let savedToken: string | null = storageSync.getItem('token')
              
              // Если не нашли синхронно, пробуем асинхронно (с таймаутом)
              if (!savedToken || savedToken !== response.access_token) {
                try {
                  const { default: storage } = await import('./utils/storage')
                  savedToken = await Promise.race([
                    storage.getItem('token'),
                    new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 300))
                  ])
                } catch (error) {
                  console.warn('[TelegramAuthHandler] Token verification failed:', error)
                }
              }
              
              if (savedToken && savedToken === response.access_token) {
                console.log('[TelegramAuthHandler] Token saved and verified successfully')
              } else {
                console.warn('[TelegramAuthHandler] Token verification incomplete, but continuing...')
              }
              
              // Помечаем, что пользователь только что вошел
              sessionStorage.setItem('justLoggedIn', 'true')
              
              // Сразу переходим (не ждем) - токен уже сохранен
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
          console.warn('No initData available for Telegram auto-auth after waiting')
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
            // Если на странице логина/регистрации, остаемся там (пользователь может попробовать снова)
            // На других страницах редиректим на логин
            if (location.pathname !== '/login' && location.pathname !== '/register') {
              navigate('/login')
            }
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
        <LoadingSpinner fullScreen={false} size="md" />
      </div>
    )
  }

  return null
}

function VKAuthHandler() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)
  const hasAttemptedAuth = useRef(false)

  useEffect(() => {
    let mounted = true
    let timeoutId: ReturnType<typeof setTimeout>

    const checkVKAuth = async () => {
      try {
        // Timeout after 3 seconds
        timeoutId = setTimeout(() => {
          if (mounted) {
            setIsChecking(false)
          }
        }, 3000)

        // Если не в VK Mini App, пропускаем проверку
        if (!isVKWebApp()) {
          if (mounted) setIsChecking(false)
          return
        }

        // Инициализируем VK Bridge
        await initVKWebApp()

        // Отслеживаем открытие мини-приложения
        try {
          await api.trackEvent('miniapp_open', 'vk_miniapp_launch', {
            path: location.pathname,
            hasToken: !!storageSync.getItem('token')
          })
        } catch (error) {
          // Игнорируем ошибки аналитики
        }

        // Если уже есть токен, проверяем его валидность
        const token = storageSync.getItem('token')
        if (token) {
          try {
            const user = await api.getCurrentUser()
            if (mounted && user) {
              // Токен валиден, но если это Mini App, проверяем, что пользователь совпадает с VK
              if (isVKWebApp()) {
                const vkUserId = getVKUserId()
                if (vkUserId) {
                  // Проверяем, что токен принадлежит текущему VK пользователю
                  const vkId = vkUserId.toString()
                  // Получаем vk_id из ответа API (если есть)
                  // Если user.vk_id не совпадает с текущим VK ID, очищаем токен
                  if (user.vk_id && user.vk_id !== vkId) {
                    console.warn('Token belongs to different VK user, clearing and re-authenticating')
                    storageSync.removeItem('token')
                    api.setToken(null)
                    // Продолжаем авторизацию через VK
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
                  // Нет данных VK, но токен есть - оставляем как есть
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
            console.warn('Token invalid, will re-authenticate via VK')
            storageSync.removeItem('token')
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

        // Автоматическая авторизация через VK Mini App
        const launchParams = await getVKLaunchParams()
        console.log('VK auto-auth check:', { 
          hasLaunchParams: !!launchParams, 
          launchParamsLength: launchParams?.length || 0,
          isMiniApp: isVKWebApp(),
          currentPath: location.pathname
        })
        
        if (launchParams && launchParams.length > 0) {
          hasAttemptedAuth.current = true
          try {
            console.log('Attempting automatic VK login...')
            
            // Получаем данные пользователя из VK для имени
            let firstName: string | null = null
            let lastName: string | null = null
            try {
              const vkUser = getVKUser()
              if (vkUser) {
                firstName = vkUser.first_name || null
                lastName = vkUser.last_name || null
                console.log('VK user info for auto-login:', { firstName, lastName })
              }
            } catch (error) {
              console.warn('Failed to get VK user info for auto-login:', error)
            }
            
            // Get current token for account linking (if user is already logged in via Telegram)
            const { storageSync } = await import('./utils/storage')
            const currentToken = storageSync.getItem('token')
            const response = await api.loginVK(launchParams, currentToken, firstName, lastName)
            console.log('VK auto-login successful:', { 
              userId: response.user?.id,
              hasAccessToken: !!response.access_token,
              accessTokenLength: response.access_token?.length || 0
            })
            
            if (mounted) {
              // Tokens are already stored by api.loginVK method
              // Проверяем, что токен действительно сохранен
              const savedToken = storageSync.getItem('token')
              if (!savedToken || savedToken !== response.access_token) {
                console.error('[VKAuthHandler] Token was not saved correctly!')
                clearTimeout(timeoutId)
                setIsChecking(false)
                return
              }
              
              console.log('[VKAuthHandler] Token saved successfully')
              
              // Помечаем, что пользователь только что вошел
              sessionStorage.setItem('justLoggedIn', 'true')
              
              // Даем время на сохранение токена и обновление состояния
              setTimeout(() => {
                if (mounted) {
                  clearTimeout(timeoutId)
                  setIsChecking(false)
                  // Проверяем онбординг - Layout перенаправит на онбординг если нужно
                  navigate('/', { replace: true })
                }
              }, 100)
            }
          } catch (error: any) {
            console.error('VK auto-auth failed:', error)
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
          // Нет launch params - возможно, Mini App еще не инициализирован
          console.warn('No launch params available for VK auto-auth')
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
    checkVKAuth()

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [navigate, location.pathname])

  // Показываем загрузку только на страницах логина/регистрации и если проверяем
  if (isChecking && (location.pathname === '/login' || location.pathname === '/register')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-telegram-bg">
        <LoadingSpinner fullScreen={false} size="md" />
      </div>
    )
  }

  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <NewYearProvider>
          <ToastProvider>
            <Router>
            <TelegramAuthHandler />
            <VKAuthHandler />
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
              <Route path="statistics" element={<Statistics />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="import" element={<Import />} />
              <Route path="about" element={<About />} />
              <Route path="achievements" element={<Achievements />} />
              <Route path="quests" element={<Quests />} />
            </Route>
          </Routes>
        </Router>
          </ToastProvider>
        </NewYearProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}

export default App

