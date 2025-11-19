import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../services/api'
import { isTelegramWebApp, getInitData } from '../utils/telegram'
import { isVKWebApp, getVKLaunchParams, initVKWebApp, getVKUser } from '../utils/vk'
import { useToast } from '../contexts/ToastContext'

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

    const initData = getInitData()
    if (!initData || initData.length === 0) {
      showError('Не удалось получить данные Telegram. Убедитесь, что открыто через Telegram Mini App.')
      setIsLoading(false)
      return
    }

    try {
      // Try to get current token for account linking
      const { storageSync } = await import('../utils/storage')
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
      const savedToken = storageSync.getItem('token') || localStorage.getItem('token')
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
      const { storageSync } = await import('../utils/storage')
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
      const savedToken = storageSync.getItem('token') || localStorage.getItem('token')
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
    // In Telegram Mini App - only Telegram auth, no choice
    if (isTelegram && !isVK) {
      if (authMethod === 'select') {
        const initData = getInitData()
        if (initData && initData.length > 0) {
          handleTelegramLogin()
        } else {
          showError('Не удалось получить данные Telegram. Убедитесь, что открыто через Telegram Mini App.')
          setIsLoading(false)
        }
      }
    }
    // In VK Mini App - only VK auth, no choice
    else if (isVK && !isTelegram) {
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
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary dark:border-telegram-dark-primary mb-4"></div>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            Загрузка...
          </p>
        </div>
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

