import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../services/api'
import { isTelegramWebApp, waitForInitData } from '../utils/telegram'
import { isVKWebApp, getVKLaunchParams, initVKWebApp, getVKUser } from '../utils/vk'
import { storageSync } from '../utils/storage'
import { useToast } from '../contexts/ToastContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

export function Login() {
  const { showError } = useToast()
  const [authMethod, setAuthMethod] = useState<'select' | 'telegram' | 'vk' | 'email'>('select')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  
  // Определяем платформу
  const isTelegram = isTelegramWebApp()
  const isVK = isVKWebApp()
  
  // Debug: логируем определение платформы
  useEffect(() => {
    console.log('[Login] Platform detection:', {
      isTelegram,
      isVK,
      url: window.location.href,
      search: window.location.search
    })
  }, [isTelegram, isVK])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
           try {
             await api.login(email, password)
             // Tokens are already stored by api.login method
             
             // Помечаем, что пользователь только что вошел
             sessionStorage.setItem('justLoggedIn', 'true')
             
             // Проверяем онбординг - Layout перенаправит на онбординг если нужно
             navigate('/')
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleTelegramLogin = async () => {
    setIsLoading(true)

    if (!isTelegramWebApp()) {
      showError('Telegram авторизация доступна только в Telegram Mini App')
      setIsLoading(false)
      return
    }

    // Ждем, пока Telegram WebApp будет готов и initData станет доступен
    const initData = await waitForInitData(5000) // Ждем до 5 секунд для полной инициализации
    if (!initData || initData.length === 0) {
      showError('Не удалось получить данные Telegram. Убедитесь, что открыто через Telegram Mini App.')
      setIsLoading(false)
      return
    }

    try {
      // Try to get current token for account linking
      const currentToken = storageSync.getItem('token')
      const response = await api.loginTelegram(initData, currentToken)
      console.log('[Login] Telegram login response:', {
        hasAccessToken: !!response.access_token,
        accessTokenLength: response.access_token?.length || 0,
        userId: response.user?.id
      })
      
      // Tokens are already stored by api.loginTelegram method
      // Wait a bit for async storage operations
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Проверяем, что токен действительно сохранен
      const savedToken = storageSync.getItem('token')
      if (!savedToken || savedToken !== response.access_token) {
        console.error('[Login] Token was not saved correctly!', {
          expected: response.access_token,
          saved: savedToken
        })
        showError('Ошибка сохранения токена авторизации')
        setIsLoading(false)
        return
      }
      
      console.log('[Login] Token saved successfully, length:', savedToken.length)
      
      // Отслеживаем успешный логин
      try {
        await api.trackEvent('miniapp_action', 'vk_login_success', {
          userId: response.user?.id
        })
      } catch (error) {
        // Игнорируем ошибки аналитики
      }
      
      // Помечаем, что пользователь только что вошел
      sessionStorage.setItem('justLoggedIn', 'true')
      
      // Проверяем онбординг - Layout перенаправит на онбординг если нужно
      navigate('/')
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
      setIsLoading(false)
    }
  }

  const handleVKLogin = async () => {
    setIsLoading(true)

    if (!isVKWebApp()) {
      showError('VK авторизация доступна только в VK Mini App')
      setIsLoading(false)
      return
    }

    // Инициализируем VK Bridge
    await initVKWebApp()

    const launchParams = await getVKLaunchParams()
    if (!launchParams || launchParams.length === 0) {
      showError('Не удалось получить данные VK. Убедитесь, что открыто через VK Mini App.')
      setIsLoading(false)
      return
    }

    // Получаем данные пользователя из VK для имени
    let firstName: string | null = null
    let lastName: string | null = null
    try {
      const vkUser = getVKUser()
      if (vkUser) {
        firstName = vkUser.first_name || null
        lastName = vkUser.last_name || null
        console.log('[Login] Got VK user info:', { firstName, lastName })
      }
    } catch (error) {
      console.warn('[Login] Failed to get VK user info:', error)
    }

    try {
      // Try to get current token for account linking
      const currentToken = storageSync.getItem('token')
      const response = await api.loginVK(launchParams, currentToken, firstName, lastName)
      console.log('[Login] VK login response:', {
        hasAccessToken: !!response.access_token,
        accessTokenLength: response.access_token?.length || 0,
        userId: response.user?.id
      })
      
      // Tokens are already stored by api.loginVK method
      // Wait a bit for async storage operations
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Проверяем, что токен действительно сохранен
      const savedToken = storageSync.getItem('token')
      if (!savedToken || savedToken !== response.access_token) {
        console.error('[Login] Token was not saved correctly!', {
          expected: response.access_token,
          saved: savedToken
        })
        showError('Ошибка сохранения токена авторизации')
        setIsLoading(false)
        return
      }
      
      console.log('[Login] Token saved successfully, length:', savedToken.length)
      
      // Отслеживаем успешный логин
      try {
        await api.trackEvent('miniapp_action', 'vk_login_success', {
          userId: response.user?.id
        })
      } catch (error) {
        // Игнорируем ошибки аналитики
      }
      
      // Помечаем, что пользователь только что вошел
      sessionStorage.setItem('justLoggedIn', 'true')
      
      // Проверяем онбординг - Layout перенаправит на онбординг если нужно
      navigate('/')
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
      setIsLoading(false)
    }
  }

  // Auto-login via Telegram or VK if in Mini App (atomic auth)
  useEffect(() => {
    // PRIORITY: Проверяем платформу еще раз для надежности
    const currentIsVK = isVKWebApp()
    const currentIsTelegram = isTelegramWebApp()
    
    console.log('[Login] Platform check in useEffect:', {
      isTelegram: currentIsTelegram,
      isVK: currentIsVK,
      url: window.location.href
    })
    
    // PRIORITY: Если это VK, НЕ запускаем Telegram авторизацию
    if (currentIsVK) {
      console.log('[Login] VK detected, skipping Telegram auth')
      return
    }
    
    // In Telegram Mini App - only Telegram auth, no choice
    if (currentIsTelegram && !currentIsVK) {
      if (authMethod === 'select') {
        console.log('[Login] Starting Telegram auto-login...')
        
        // Дополнительная проверка: убеждаемся, что это действительно Telegram
        if (!window.Telegram?.WebApp) {
          console.error('[Login] Telegram SDK not loaded!')
          console.error('[Login] Debug info:', {
            hasWindow: typeof window !== 'undefined',
            hasTelegram: !!window.Telegram,
            hasWebApp: !!window.Telegram?.WebApp,
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer,
            isVK: currentIsVK,
            isTelegram: currentIsTelegram
          })
          
          // Ждем немного для загрузки SDK
          const checkSDK = async () => {
            let waited = 0
            const maxWait = 3000
            const checkInterval = 100
            
            while (!window.Telegram?.WebApp && waited < maxWait) {
              // Проверяем, не изменилась ли платформа во время ожидания
              const stillIsVK = isVKWebApp()
              if (stillIsVK) {
                console.log('[Login] VK detected during SDK wait, aborting Telegram auth')
                setIsLoading(false)
                return
              }
              
              await new Promise(resolve => setTimeout(resolve, checkInterval))
              waited += checkInterval
            }
            
            // Финальная проверка платформы перед продолжением
            const finalIsVK = isVKWebApp()
            const finalIsTelegram = isTelegramWebApp()
            
            if (finalIsVK) {
              console.log('[Login] VK detected after SDK wait, aborting Telegram auth')
              setIsLoading(false)
              return
            }
            
            if (!window.Telegram?.WebApp || !finalIsTelegram) {
              const errorMsg = 'Telegram Mini App SDK не загрузился. Проверьте подключение к интернету и попробуйте обновить страницу.'
              console.error('[Login]', errorMsg)
              showError(errorMsg)
              setIsLoading(false)
              return
            }
            
            // SDK загрузился, продолжаем
            console.log('[Login] Telegram SDK loaded after waiting', waited, 'ms')
            proceedWithTelegramAuth()
          }
          
          checkSDK()
        } else {
          // Дополнительная проверка перед вызовом proceedWithTelegramAuth
          const doubleCheckIsVK = isVKWebApp()
          if (doubleCheckIsVK) {
            console.log('[Login] VK detected before proceedWithTelegramAuth, aborting')
            setIsLoading(false)
            return
          }
          proceedWithTelegramAuth()
        }
        
        function proceedWithTelegramAuth() {
          // Финальная проверка перед ожиданием initData
          const finalCheckIsVK = isVKWebApp()
          const finalCheckIsTelegram = isTelegramWebApp()
          
          if (finalCheckIsVK || !finalCheckIsTelegram) {
            console.log('[Login] Platform changed, aborting Telegram auth', {
              isVK: finalCheckIsVK,
              isTelegram: finalCheckIsTelegram
            })
            setIsLoading(false)
            return
          }
          
          // Ждем, пока Telegram WebApp будет готов и initData станет доступен
          // Увеличено время ожидания до 8 секунд для медленных устройств
          waitForInitData(8000).then((initData) => {
            // Проверяем платформу еще раз после получения initData
            const afterCheckIsVK = isVKWebApp()
            if (afterCheckIsVK) {
              console.log('[Login] VK detected after waitForInitData, aborting')
              setIsLoading(false)
              return
            }
            
            console.log('[Login] waitForInitData result:', {
              hasInitData: !!initData,
              initDataLength: initData?.length || 0
            })
            
            // Проверяем, что initData валиден (содержит user= или hash=)
            const isValidInitData = initData && initData.length > 0 && (initData.includes('user=') || initData.includes('hash='))
            
            if (isValidInitData) {
              handleTelegramLogin()
            } else {
              // ПРОВЕРКА: Если мы в ВК, не показываем ошибку Telegram
              const finalVKCheck = isVKWebApp()
              if (finalVKCheck) {
                console.log('[Login] VK detected when no initData, this is normal - not showing Telegram error')
                setIsLoading(false)
                return
              }
              
              // Только если мы действительно в Telegram, показываем ошибку
              const isTelegram = isTelegramWebApp()
              if (!isTelegram) {
                console.log('[Login] Not in Telegram and no initData, this is normal - not showing error')
                setIsLoading(false)
                return
              }
              
              // Если initData пустой или невалидный, но мы в Telegram, это может быть временная проблема
              // Показываем более мягкое сообщение и даем возможность попробовать снова
              const errorMsg = 'Не удалось получить данные авторизации Telegram. Попробуйте обновить страницу или откройте приложение через Telegram Mini App.'
              console.warn('[Login]', errorMsg)
              console.warn('[Login] Debug info:', {
                hasWebApp: !!window.Telegram?.WebApp,
                initData: window.Telegram?.WebApp?.initData || 'empty',
                initDataLength: window.Telegram?.WebApp?.initData?.length || 0,
                initDataUnsafe: window.Telegram?.WebApp?.initDataUnsafe || null,
                isVK: finalVKCheck,
                isTelegram: isTelegram,
                url: window.location.href
              })
              showError(errorMsg)
              setIsLoading(false)
            }
          }).catch((error) => {
            // Проверяем, не изменилась ли платформа во время ожидания
            const catchVKCheck = isVKWebApp()
            if (catchVKCheck) {
              console.log('[Login] VK detected in catch block, this is normal - not showing Telegram error')
              setIsLoading(false)
              return
            }
            
            console.error('[Login] Failed to wait for Telegram initData:', error)
            console.error('[Login] Error details:', {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : 'No stack'
            })
            
            // Только если мы действительно в Telegram, показываем ошибку
            const isTelegram = isTelegramWebApp()
            if (isTelegram) {
              const errorMsg = 'Ошибка инициализации Telegram Mini App. Попробуйте обновить страницу или обратитесь в поддержку.'
              showError(errorMsg)
            }
            setIsLoading(false)
          })
        }
      }
    }
    // In VK Mini App - only VK auth, no choice
    else if (currentIsVK && !currentIsTelegram) {
      if (authMethod === 'select') {
        initVKWebApp().then(async () => {
          const launchParams = await getVKLaunchParams()
          if (launchParams && launchParams.length > 0) {
            handleVKLogin()
          } else {
            showError('Не удалось получить данные VK. Убедитесь, что открыто через VK Mini App.')
            setIsLoading(false)
          }
        }).catch((error) => {
          console.error('[Login] Failed to initialize VK:', error)
          showError('Ошибка инициализации VK Mini App')
          setIsLoading(false)
        })
      }
    }
    // In web version - show selection screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show loading state while auto-logging in via Telegram or VK
  // Don't show selection screen for Mini Apps - they should auto-auth
  if ((isTelegram || isVK) && (authMethod === 'select' || isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-telegram-bg dark:bg-telegram-dark-bg p-4">
        <LoadingSpinner fullScreen={false} size="md" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-telegram-bg p-4 animate-fade-in safe-area-inset">
          <div className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        {/* Logo/Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-telegram-primary to-telegram-primaryLight mb-3 md:mb-4 shadow-telegram-lg overflow-hidden">
            <img src="/1.png" alt="Люся.Бюджет" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-telegram-primary via-purple-500 to-telegram-primaryLight bg-clip-text text-transparent">
                Люся.Бюджет
              </span>
            </h1>
            <p className="text-xs md:text-sm text-telegram-textSecondary font-medium tracking-wide">
              Все посчитала
            </p>
          </div>
        </div>

        {/* Method Selection Screen - Only for web version */}
        {authMethod === 'select' && !isTelegram && !isVK && (
          <div className="card p-4 md:p-5 space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-2">
                Выберите способ входа
              </h2>
              <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                Выберите удобный для вас способ авторизации
              </p>
            </div>

            {/* Email/Password Login Button (Secondary) - Only for web version */}
            {!isTelegram && !isVK && (
              <>
                <button
                  onClick={() => setAuthMethod('email')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 p-4 md:p-5 rounded-telegram-lg bg-telegram-surface dark:bg-telegram-dark-surface border-2 border-telegram-border dark:border-telegram-dark-border text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl">📧</span>
                  <div className="text-left">
                    <div className="text-base md:text-lg font-medium">Войти через Email</div>
                    <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">Email и пароль</div>
                  </div>
                </button>
              </>
            )}

            <div className="text-center pt-4">
              <p className="text-xs md:text-sm text-telegram-textSecondary">
                Нет аккаунта?{' '}
                <Link to="/register" className="text-telegram-primary active:underline font-medium">
                  Зарегистрироваться
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Email/Password Login Form */}
        {authMethod === 'email' && (
          <div className="card p-4 md:p-5">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => {
                  setAuthMethod('select')
                  setEmail('')
                  setPassword('')
                }}
                className="text-telegram-textSecondary hover:text-telegram-text transition-colors"
              >
                ←
              </button>
              <h2 className="text-xl font-semibold text-telegram-text">
                Вход через Email
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
              
              <div>
                <label className="block text-xs md:text-sm font-medium text-telegram-text mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input text-sm md:text-base"
                  placeholder="your@email.com"
                  required
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-xs md:text-sm font-medium text-telegram-text mb-2">
                  Пароль
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input text-sm md:text-base"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="w-full btn-primary text-sm md:text-base py-2.5 md:py-3"
                disabled={isLoading}
              >
                {isLoading ? 'Вход...' : 'Войти'}
              </button>
            </form>
            
            <div className="text-center mt-4">
              <p className="text-xs md:text-sm text-telegram-textSecondary">
                Нет аккаунта?{' '}
                <Link to="/register" className="text-telegram-primary active:underline font-medium">
                  Зарегистрироваться
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

