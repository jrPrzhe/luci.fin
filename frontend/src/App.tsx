import { useEffect, useState, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { storageSync, initStorage } from './utils/storage'
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
import { NewYearProvider } from './contexts/NewYearContext'
import { I18nProvider } from './contexts/I18nContext'
import { ToastProvider } from './contexts/ToastContext'
import { LoadingSpinner } from './components/LoadingSpinner'
import { ErrorBoundary } from './components/ErrorBoundary'

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
      console.log('[TelegramAuthHandler] Starting auth check...', {
        pathname: location.pathname,
        url: window.location.href,
        hasTelegramSDK: !!window.Telegram?.WebApp,
        timestamp: new Date().toISOString()
      })

      try {
        // КРИТИЧЕСКИ ВАЖНО: Проверяем ВК ПЕРВЫМ ДЕЛОМ, ДО любых других операций
        // Это предотвращает попытки авторизации через Telegram для ВК пользователей
        const isVK = isVKWebApp()
        if (isVK) {
          console.log('[TelegramAuthHandler] VK detected in checkTelegramAuth (PRIORITY CHECK), skipping Telegram auth check')
          if (mounted) {
            setIsChecking(false)
          }
          return
        }
        
        // Timeout after 5 seconds (увеличено для Telegram, так как SDK может загружаться)
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn('[TelegramAuthHandler] Auth check timeout after 5 seconds')
            setIsChecking(false)
          }
        }, 5000)

        // PRIORITY: Если уже есть валидный токен И мы НЕ в Telegram, НЕ пытаемся авторизоваться через Telegram
        // Это предотвращает повторные попытки авторизации после успешной авторизации через ВК
        const existingToken = storageSync.getItem('token')
        if (existingToken) {
          try {
            // Быстрая проверка токена - если он валиден, не пытаемся авторизоваться
            const user = await api.getCurrentUser()
            if (user && mounted) {
              // Дополнительная проверка: если мы в ВК, точно не пытаемся авторизоваться через Telegram
              const stillIsVK = isVKWebApp()
              if (stillIsVK) {
                console.log('[TelegramAuthHandler] VK detected with valid token, skipping Telegram auth check')
                clearTimeout(timeoutId)
                setIsChecking(false)
                return
              }
              
              // Если токен валиден и мы не в ВК, но и не в Telegram, тоже не пытаемся
              const stillIsTelegram = isTelegramWebApp()
              if (!stillIsTelegram) {
                console.log('[TelegramAuthHandler] Valid token exists and not in Telegram, skipping Telegram auth check')
                clearTimeout(timeoutId)
                setIsChecking(false)
                return
              }
              
              // Если токен валиден и мы в Telegram, продолжаем проверку (может быть другой пользователь)
              console.log('[TelegramAuthHandler] Valid token exists but in Telegram, will verify user match')
            }
          } catch (error) {
            // Токен невалиден, продолжаем проверку
            console.log('[TelegramAuthHandler] Existing token invalid, will check Telegram auth')
          }
        }

        // Проверяем, находимся ли мы в Telegram Mini App
        // Используем улучшенную функцию определения
        const isTelegram = isTelegramWebApp()
        console.log('[TelegramAuthHandler] isTelegramWebApp() returned:', isTelegram)
        
        if (!isTelegram) {
          console.log('[TelegramAuthHandler] Not in Telegram Mini App, skipping auth check')
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
          }
          return
        }

        // Если мы в Telegram, но SDK еще не загрузился, ждем немного
        if (!window.Telegram?.WebApp) {
          console.warn('[TelegramAuthHandler] In Telegram but SDK not loaded yet, waiting...')
          // Ждем до 2 секунд для загрузки SDK
          let waited = 0
          const maxWait = 2000
          const checkInterval = 100
          
          while (!window.Telegram?.WebApp && waited < maxWait && mounted) {
            await new Promise(resolve => setTimeout(resolve, checkInterval))
            waited += checkInterval
          }
          
          if (!window.Telegram?.WebApp) {
            console.error('[TelegramAuthHandler] Telegram SDK still not loaded after waiting')
            console.error('[TelegramAuthHandler] This is a critical error - Telegram Mini App may not work correctly')
            if (mounted) {
              clearTimeout(timeoutId)
              setIsChecking(false)
              // Показываем ошибку пользователю на странице логина
              if (location.pathname === '/login' || location.pathname === '/register') {
                // Ошибка будет показана через Login компонент
              }
            }
            return
          } else {
            console.log('[TelegramAuthHandler] Telegram SDK loaded after waiting', waited, 'ms')
          }
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

        // КРИТИЧЕСКАЯ ПРОВЕРКА: Если мы в ВК, НЕ пытаемся авторизоваться через Telegram
        // Это предотвращает попытки авторизации через Telegram после успешной авторизации через ВК
        const checkIsVKBeforeWait = isVKWebApp()
        if (checkIsVKBeforeWait) {
          console.log('[TelegramAuthHandler] VK detected before waitForInitData, aborting Telegram auth check')
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
          }
          return
        }

        // Автоматическая авторизация через Telegram Mini App
        // Ждем, пока Telegram WebApp будет готов и initData станет доступен
        console.log('[TelegramAuthHandler] Telegram auto-auth check: waiting for initData...')
        // Увеличено время ожидания до 8 секунд для медленных устройств или медленного интернета
        const initData = await waitForInitData(8000) // Ждем до 8 секунд для полной инициализации
        
        // ПРОВЕРКА ПОСЛЕ waitForInitData: Если мы в ВК, НЕ продолжаем
        const checkIsVKAfterWait = isVKWebApp()
        if (checkIsVKAfterWait) {
          console.log('[TelegramAuthHandler] VK detected after waitForInitData, aborting Telegram auth check')
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
          }
          return
        }
        
        console.log('[TelegramAuthHandler] Telegram auto-auth check result:', { 
          hasInitData: !!initData, 
          initDataLength: initData?.length || 0,
          initDataPreview: initData ? initData.substring(0, 100) + '...' : null,
          isMiniApp: isTelegramWebApp(),
          currentPath: location.pathname,
          hasToken: !!token,
          webAppVersion: window.Telegram?.WebApp?.version,
          webAppPlatform: window.Telegram?.WebApp?.platform
        })
        
        // Проверяем, что initData валиден (содержит user= или hash=)
        const isValidInitData = initData && initData.length > 0 && (initData.includes('user=') || initData.includes('hash='))
        
        if (isValidInitData) {
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
            // Проверяем, не изменилась ли платформа во время авторизации
            const errorVKCheck = isVKWebApp()
            if (errorVKCheck) {
              console.log('[TelegramAuthHandler] VK detected after Telegram auth error, this is normal - not redirecting')
              if (mounted) {
                clearTimeout(timeoutId)
                setIsChecking(false)
              }
              return
            }
            
            // Проверяем тип ошибки - если это ошибка из-за пустого initData, не показываем общую ошибку
            const errorMessage = error?.message || String(error) || ''
            const errorLower = errorMessage.toLowerCase()
            const isInitDataError = errorLower.includes('initdata') || 
                                   errorLower.includes('не получены данные') ||
                                   errorLower.includes('empty initdata') ||
                                   !initData || initData.length === 0
            
            if (mounted) {
              clearTimeout(timeoutId)
              setIsChecking(false)
              
              // Если это ошибка из-за пустого initData, не показываем общую ошибку
              // Пользователь может попробовать обновить страницу
              if (isInitDataError) {
                console.log('[TelegramAuthHandler] InitData error - not showing error message, user can retry')
                // Только редиректим на логин, если не на странице логина/регистрации
                if (location.pathname !== '/login' && location.pathname !== '/register') {
                  navigate('/login')
                }
                return
              }
              
              // Для других ошибок редиректим на логин
              if (location.pathname !== '/login' && location.pathname !== '/register') {
                navigate('/login')
              }
            }
          }
        } else {
          // Нет initData - возможно, Mini App еще не инициализирован
          // НО: Если мы в ВК, это нормально - не показываем ошибку
          const finalVKCheck = isVKWebApp()
          if (finalVKCheck) {
            console.log('[TelegramAuthHandler] VK detected in else block (no initData), this is normal - not showing error')
            if (mounted) {
              clearTimeout(timeoutId)
              setIsChecking(false)
            }
            return
          }
          
          // Только если мы действительно в Telegram, проверяем ситуацию
          const finalIsTelegram = isTelegramWebApp()
          console.warn('[TelegramAuthHandler] No initData available for Telegram auto-auth after waiting')
          console.warn('[TelegramAuthHandler] Debug info:', {
            hasWebApp: !!window.Telegram?.WebApp,
            initData: window.Telegram?.WebApp?.initData || 'empty',
            initDataLength: window.Telegram?.WebApp?.initData?.length || 0,
            initDataUnsafe: window.Telegram?.WebApp?.initDataUnsafe || null,
            webAppVersion: window.Telegram?.WebApp?.version,
            webAppPlatform: window.Telegram?.WebApp?.platform,
            isVK: finalVKCheck,
            isTelegram: finalIsTelegram,
            url: window.location.href
          })
          
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
            
            // Если мы в Telegram, но initData не получен, это может быть временная проблема
            // Не показываем ошибку сразу - возможно, пользователь может попробовать обновить страницу
            // Только редиректим на логин, если не на странице логина/регистрации
            // На странице логина пользователь может попробовать авторизоваться вручную
            if (location.pathname !== '/login' && location.pathname !== '/register') {
              navigate('/login')
            }
            // НЕ показываем ошибку здесь - пусть Login компонент обработает это
            // Это предотвращает показ ошибки при временных проблемах с получением initData
          }
        }
      } catch (error) {
        console.error('[TelegramAuthHandler] Auth check error:', error)
        console.error('[TelegramAuthHandler] Error stack:', error instanceof Error ? error.stack : 'No stack')
        console.error('[TelegramAuthHandler] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Unknown',
          hasWebApp: !!window.Telegram?.WebApp,
          url: window.location.href
        })
        if (mounted) {
          clearTimeout(timeoutId)
          setIsChecking(false)
          // При ошибке на других страницах редиректим на логин
          if (location.pathname !== '/login' && location.pathname !== '/register') {
            navigate('/login')
          }
        }
      } finally {
        // Гарантируем, что isChecking всегда устанавливается в false
        if (mounted) {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          setIsChecking(false)
        }
        console.log('[TelegramAuthHandler] Auth check completed, isChecking:', false)
      }
    }

    // PRIORITY: Проверяем платформу ПЕРЕД запуском проверки
    // Это предотвращает повторные попытки авторизации после успешной авторизации через ВК
    // КРИТИЧЕСКИ ВАЖНО: Проверяем ВК МНОЖЕСТВЕННО на разных этапах
    
    // Проверка 1: Синхронная проверка ВК в начале
    const isVK = isVKWebApp()
    if (isVK) {
      console.log('[TelegramAuthHandler] VK detected in useEffect (check 1), skipping Telegram auth check completely')
      if (mounted) {
        setIsChecking(false)
      }
      return
    }
    
    // Проверка 2: Если есть токен, проверяем ВК еще раз
    const existingToken = storageSync.getItem('token')
    if (existingToken) {
      const checkIsVK = isVKWebApp()
      if (checkIsVK) {
        console.log('[TelegramAuthHandler] VK detected with existing token (check 2), skipping Telegram auth check')
        if (mounted) {
          setIsChecking(false)
        }
        return
      }
      
      // Проверка 3: Если мы не в Telegram, не запускаем
      const isTelegram = isTelegramWebApp()
      if (!isTelegram) {
        console.log('[TelegramAuthHandler] Valid token exists and not in Telegram (check 3), skipping Telegram auth check')
        if (mounted) {
          setIsChecking(false)
        }
        return
      }
      
      // Если токен есть и мы в Telegram, запускаем проверку (но внутри checkTelegramAuth будет еще проверка ВК)
      checkTelegramAuth()
    } else {
      // Нет токена - проверяем, что мы в Telegram перед запуском
      const isTelegram = isTelegramWebApp()
      if (isTelegram) {
        checkTelegramAuth()
      } else {
        console.log('[TelegramAuthHandler] No token and not in Telegram, skipping check')
        if (mounted) {
          setIsChecking(false)
        }
      }
    }

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [navigate, location.pathname])

  // Показываем загрузку только на страницах логина/регистрации и если проверяем
  // НО с таймаутом - не показываем загрузку дольше 3 секунд
  // ВАЖНО: Не блокируем рендеринг на других страницах
  if (isChecking && (location.pathname === '/login' || location.pathname === '/register')) {
    // Логируем состояние загрузки для отладки
    console.log('[TelegramAuthHandler] Showing loading spinner on', location.pathname)
    return (
      <div className="min-h-screen flex items-center justify-center bg-telegram-bg dark:bg-telegram-dark-bg">
        <LoadingSpinner fullScreen={false} size="md" />
      </div>
    )
  }

  // На других страницах не блокируем рендеринг - проверка идет в фоне
  // Это критически важно - иначе приложение будет показывать пустой экран
  if (isChecking && location.pathname !== '/login' && location.pathname !== '/register') {
    console.log('[TelegramAuthHandler] Auth check in progress, but not blocking render on', location.pathname)
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
      console.log('[VKAuthHandler] Starting auth check...', {
        pathname: location.pathname,
        url: window.location.href,
        isVK: isVKWebApp(),
        isTelegram: isTelegramWebApp(),
        timestamp: new Date().toISOString()
      })

      try {
        // Timeout after 3 seconds
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn('[VKAuthHandler] Auth check timeout')
            setIsChecking(false)
          }
        }, 3000)

        // PRIORITY: Если мы в Telegram, НЕ запускаем VK auth handler
        if (isTelegramWebApp()) {
          console.log('[VKAuthHandler] Telegram detected, skipping VK auth check')
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
          }
          return
        }

        // Если не в VK Mini App, пропускаем проверку
        if (!isVKWebApp()) {
          console.log('[VKAuthHandler] Not in VK Mini App, skipping auth check')
          if (mounted) {
            clearTimeout(timeoutId)
            setIsChecking(false)
          }
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
        // КРИТИЧЕСКИ ВАЖНО: При первом запуске VK параметры могут загружаться с задержкой
        // Даем дополнительное время на загрузку параметров
        let launchParams = await getVKLaunchParams()
        
        // Если параметры не найдены сразу, ждем немного и проверяем еще раз
        if (!launchParams || launchParams.length === 0) {
          console.log('[VKAuthHandler] Launch params not found immediately, waiting...')
          await new Promise(resolve => setTimeout(resolve, 500))
          launchParams = await getVKLaunchParams()
        }
        
        console.log('VK auto-auth check:', { 
          hasLaunchParams: !!launchParams, 
          launchParamsLength: launchParams?.length || 0,
          isMiniApp: isVKWebApp(),
          currentPath: location.pathname,
          url: window.location.href
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
              // Даем время на сохранение токена (setToken сохраняет асинхронно)
              await new Promise(resolve => setTimeout(resolve, 200))
              
              // Проверяем, что токен действительно сохранен
              let savedToken = storageSync.getItem('token')
              
              // Если не нашли синхронно, пробуем асинхронно (для VK Storage)
              if (!savedToken || savedToken !== response.access_token) {
                try {
                  const { default: storage } = await import('./utils/storage')
                  savedToken = await Promise.race([
                    storage.getItem('token'),
                    new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 300))
                  ])
                } catch (error) {
                  console.warn('[VKAuthHandler] Failed to get token from storage:', error)
                }
              }
              
              if (!savedToken || savedToken !== response.access_token) {
                console.error('[VKAuthHandler] Token was not saved correctly!', {
                  expected: response.access_token,
                  saved: savedToken,
                  savedLength: savedToken?.length || 0,
                  expectedLength: response.access_token?.length || 0
                })
                // Не прерываем процесс - токен может сохраниться позже
                // Просто логируем ошибку и продолжаем
              } else {
                console.log('[VKAuthHandler] Token saved successfully')
              }
              
              // Помечаем, что пользователь только что вошел
              sessionStorage.setItem('justLoggedIn', 'true')
              // Помечаем, что авторизация через VK завершена (предотвращает редирект на /login)
              sessionStorage.setItem('vkAuthCompleted', 'true')
              
              // Даем время на сохранение токена и обновление состояния
              clearTimeout(timeoutId)
              setIsChecking(false)
              // Проверяем онбординг - Layout перенаправит на онбординг если нужно
              // Используем replace: true чтобы предотвратить возврат на /login
              navigate('/', { replace: true })
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
  // Логируем инициализацию приложения и загружаем настройки из storage
  useEffect(() => {
    const isTelegram = isTelegramWebApp()
    const isVK = isVKWebApp()
    
    console.log('[App] Initializing...', {
      isTelegram,
      isVK,
      url: window.location.href,
      pathname: window.location.pathname,
      hasTelegramSDK: !!window.Telegram?.WebApp,
      hasVKParams: new URLSearchParams(window.location.search).has('vk_user_id')
    })
    
    // Предупреждение, если оба определены (не должно происходить после исправления)
    if (isTelegram && isVK) {
      console.warn('[App] WARNING: Both Telegram and VK detected! This should not happen.')
      console.warn('[App] Telegram will take priority.')
    }
    
    // Инициализируем storage и загружаем настройки (тема, новогодний режим и т.д.)
    initStorage().catch(console.error)
  }, [])

  console.log('[App] Rendering App component...', {
    timestamp: new Date().toISOString(),
    pathname: window.location.pathname
  })

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <I18nProvider>
            <ErrorBoundary>
              <NewYearProvider>
                <ErrorBoundary>
                  <ToastProvider>
                    <ErrorBoundary>
                      <Router>
                        <ErrorBoundary>
                          <TelegramAuthHandler />
                        </ErrorBoundary>
                        <ErrorBoundary>
                          <VKAuthHandler />
                        </ErrorBoundary>
                        <ErrorBoundary>
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
                              <Route path="reports" element={
                                <ErrorBoundary>
                                  <Reports />
                                </ErrorBoundary>
                              } />
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
                        </ErrorBoundary>
                      </Router>
                    </ErrorBoundary>
                  </ToastProvider>
                </ErrorBoundary>
              </NewYearProvider>
            </ErrorBoundary>
          </I18nProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App





