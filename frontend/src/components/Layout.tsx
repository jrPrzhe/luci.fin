import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isTelegramWebApp } from '../utils/telegram'
import { isVKWebApp } from '../utils/vk'
import { api } from '../services/api'
import { storageSync } from '../utils/storage'
import { Welcome } from './Welcome'
import { Stories } from './Stories'
import { HeartEffect } from './HeartEffect'
import { Garland } from './Garland'
import { CRTNoise } from './CRTNoise'
import { useValentineTheme } from '../contexts/ValentineContext'
import { useStrangerThingsTheme } from '../contexts/StrangerThingsContext'
import { useTheme } from '../hooks/useTheme'
import { useI18n } from '../contexts/I18nContext'
import { QuestNotifications } from './QuestNotifications'
import { hasInteractedWithBot, openVKBot } from '../utils/vk'
import { OnboardingWizard } from './OnboardingWizard'
import { AppLoadingScreen } from './AppLoadingScreen'
import { TelegramLoadingScreen } from './TelegramLoadingScreen'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [userName, setUserName] = useState<string>()
  const [isCheckingAuth, setIsCheckingAuth] = useState(false)
  const [showStories, setShowStories] = useState(false)
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false)
  const [isAppReady, setIsAppReady] = useState(false)
  const [telegramLoadingComplete, setTelegramLoadingComplete] = useState(false)
  const isMiniApp = isTelegramWebApp()
  const isVK = isVKWebApp()
  const { isEnabled: valentineEnabled } = useValentineTheme()
  const { isEnabled: strangerThingsEnabled, setIsElevenMode } = useStrangerThingsTheme()
  const { theme, toggleTheme } = useTheme()
  const { t, language, setLanguage } = useI18n()
  
  // Пасхалка: 11 быстрых кликов на название "Люся.Бюджет" активирует режим Одиннадцать
  const [titleClickCount, setTitleClickCount] = useState(0)
  const [titleClickTimeout, setTitleClickTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
  
  // Цвета для изменения названия при каждом клике (11 цветов для 11 кликов)
  const titleColors = [
    '#ffffff', // 0 - белый (начальный)
    '#ff0055', // 1 - розовый
    '#00f0ff', // 2 - циан
    '#ff0055', // 3 - розовый
    '#00f0ff', // 4 - циан
    '#ff0055', // 5 - розовый
    '#00f0ff', // 6 - циан
    '#ff0055', // 7 - розовый
    '#00f0ff', // 8 - циан
    '#ff0055', // 9 - розовый
    '#39ff14', // 10 - зелёный (Upside Down)
    '#ff0055', // 11 - финальный розовый (режим Одиннадцать)
  ]
  
  const getTitleColor = () => {
    if (!strangerThingsEnabled) return undefined
    if (titleClickCount === 0) return undefined
    return titleColors[Math.min(titleClickCount, 11)]
  }

  const handleTitleClick = () => {
    if (!strangerThingsEnabled) return
    
    if (titleClickTimeout) {
      clearTimeout(titleClickTimeout)
    }
    
    const newCount = titleClickCount + 1
    setTitleClickCount(newCount)
    
    if (newCount >= 11) {
      setIsElevenMode(true)
      setTitleClickCount(0)
      
      // Эффект "Изнанки" - переворот на 180 градусов на 5 секунд
      document.documentElement.classList.add('upside-down-flip')
      document.body.classList.add('upside-down-flip')
      
      setTimeout(() => {
        document.documentElement.classList.remove('upside-down-flip')
        document.body.classList.remove('upside-down-flip')
      }, 5000) // Убираем поворот через 5 секунд
    } else {
      const timeout = setTimeout(() => {
        setTitleClickCount(0)
      }, 2000) // Сбрасываем счетчик через 2 секунды бездействия
      setTitleClickTimeout(timeout)
    }
  }

  // Получаем данные пользователя для проверки админ-статуса
  // ВАЖНО: enabled только если авторизован И есть токен
  const hasToken = storageSync.getItem('token')
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.getCurrentUser(),
    enabled: isAuthorized === true && !!hasToken,
    retry: false, // Не повторяем запрос при ошибке авторизации
  })

  // Группы меню - автоматически открываем группу с активным элементом
  const getExpandedGroupsForPath = useCallback((path: string) => {
    const groups: Record<string, boolean> = {
      finance: false,
      planning: false,
      settings: false,
    }
    
    // Определяем, какая группа должна быть открыта по текущему пути
    if (path === '/' || path === '/transactions' || path === '/accounts' || 
        path === '/categories' || path === '/reports') {
      groups.finance = true
    } else if (path === '/biography' || path === '/quests' || path === '/achievements' || 
               path === '/goals' || path === '/shared-budgets') {
      groups.planning = true
    } else if (path === '/profile' || path === '/about' || path === '/analytics') {
      groups.settings = true
    } else {
      // По умолчанию открыта первая группа
      groups.finance = true
    }
    
    return groups
  }, [])

  // ВАЖНО: Безопасное получение currentPath для предотвращения React error #300
  const currentPath = (location && typeof location === 'object' && location.pathname && typeof location.pathname === 'string') 
    ? location.pathname 
    : '/'
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => 
    getExpandedGroupsForPath(currentPath)
  )

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }))
  }, [])

  // Обновляем открытые группы при изменении пути
  useEffect(() => {
    // ВАЖНО: Строгая проверка location перед доступом к pathname
    if (location && typeof location === 'object' && location.pathname && typeof location.pathname === 'string') {
      const newExpanded = getExpandedGroupsForPath(location.pathname)
      setExpandedGroups(newExpanded)
    }
  }, [location, getExpandedGroupsForPath])

  // Мемоизируем navGroups, чтобы избежать пересоздания при каждом рендере
  // Используем стабильные зависимости - только примитивные значения
  const isAdmin = user?.is_admin ?? false
  
  // Проверяем готовность всех необходимых переводов
  const translationsReady = useMemo(() => {
    try {
      return !!(
        t?.nav?.dashboard &&
        t?.nav?.transactions &&
        t?.nav?.accounts &&
        t?.nav?.categories &&
        t?.nav?.reports &&
        t?.nav?.biography &&
        t?.nav?.quests &&
        t?.nav?.achievements &&
        t?.nav?.goals &&
        t?.nav?.budgets &&
        t?.nav?.profile &&
        t?.nav?.analytics &&
        t?.profile?.about
      )
    } catch {
      return false
    }
  }, [t])
  
  const navGroups = useMemo(() => {
    // Защита от выполнения до готовности переводов
    if (!translationsReady) {
      return []
    }
    
    try {
      const settingsItems = [
        { path: '/profile', label: t.nav.profile || 'Профиль', icon: '⚙️' },
        { path: '/about', label: t.profile.about || 'О приложении', icon: '📚' },
      ]
      
      // Добавляем analytics только если пользователь админ
      if (isAdmin) {
        settingsItems.push({ path: '/analytics', label: t.nav.analytics || 'Аналитика', icon: '📊' })
      }
      
      return [
        {
          key: 'finance',
          label: 'Финансы',
          icon: '💰',
          items: [
            { path: '/', label: t.nav.dashboard || 'Дашборд', icon: '📊' },
            { path: '/transactions', label: t.nav.transactions || 'Транзакции', icon: '💸' },
            { path: '/accounts', label: t.nav.accounts || 'Счета', icon: '💳' },
            { path: '/categories', label: t.nav.categories || 'Категории', icon: '📦' },
            { path: '/reports', label: t.nav.reports || 'Отчеты', icon: '📈' },
          ]
        },
        {
          key: 'planning',
          label: 'Планирование',
          icon: '🎯',
          items: [
            { path: '/biography', label: t.nav.biography || 'Биография', icon: '📝' },
            { path: '/quests', label: t.nav.quests || 'Задания', icon: '🎯' },
            { path: '/achievements', label: t.nav.achievements || 'Достижения', icon: '🏆' },
            { path: '/goals', label: t.nav.goals || 'Цели', icon: '🎯' },
            { path: '/shared-budgets', label: t.nav.budgets || 'Бюджеты', icon: '👥' },
          ]
        },
        {
          key: 'settings',
          label: 'Настройки',
          icon: '⚙️',
          items: settingsItems,
        }
      ]
    } catch (error) {
      console.error('Error creating navGroups:', error)
      return []
    }
  }, [
    translationsReady,
    t?.nav?.dashboard,
    t?.nav?.transactions,
    t?.nav?.accounts,
    t?.nav?.categories,
    t?.nav?.reports,
    t?.nav?.biography,
    t?.nav?.quests,
    t?.nav?.achievements,
    t?.nav?.goals,
    t?.nav?.budgets,
    t?.nav?.profile,
    t?.nav?.analytics,
    t?.profile?.about,
    isAdmin
  ])

  // Плоский список для мобильной навигации (старый формат)
  const navItems = useMemo(() => {
    if (!navGroups || !Array.isArray(navGroups) || navGroups.length === 0) return []
    return navGroups
      .filter((group: any) => {
        // ВАЖНО: Строгие проверки для предотвращения React error #300
        return group && typeof group === 'object' && group.items && Array.isArray(group.items) && group.items.length > 0
      })
      .flatMap((group: any) => group.items)
      .filter((item: any) => {
        // ВАЖНО: Строгие проверки для каждого item
        return item && typeof item === 'object' && item.path && typeof item.path === 'string'
      })
  }, [navGroups])

  // Определяем критические шаги загрузки
  // ВАЖНО: Для Telegram мобильной версии нужно убедиться, что ВСЕ критические данные готовы
  const loadingSteps = useMemo(() => {
    const steps: Array<{
      key: string
      label: string
      checkReady?: () => boolean
      isReady?: boolean
      queryKey?: string[]
    }> = [
      {
        key: 'translations',
        label: 'Загрузка переводов...',
        checkReady: () => translationsReady && !!t,
      },
      {
        key: 'location',
        label: 'Инициализация роутинга...',
        checkReady: () => {
          // ВАЖНО: Строгая проверка location для Telegram мобильной версии
          return !!(location && typeof location === 'object' && location.pathname && typeof location.pathname === 'string')
        },
      },
    ]

    // Для страниц логина/регистрации/онбординга не нужна авторизация
    const isPublicPage = location?.pathname === '/login' || 
                        location?.pathname === '/register' || 
                        location?.pathname === '/onboarding'

    if (!isPublicPage) {
      steps.push({
        key: 'auth',
        label: 'Проверка авторизации...',
        checkReady: () => {
          // Для Telegram мобильной версии требуем, чтобы авторизация была определена
          if (isMiniApp) {
            return isAuthorized !== null
          }
          // Для других платформ разрешаем, если авторизация определена или идет проверка
          return isAuthorized !== null || isCheckingAuth
        },
      })

      // Если авторизован, добавляем шаг загрузки данных пользователя
      if (isAuthorized === true) {
        steps.push({
          key: 'user',
          label: 'Загрузка данных пользователя...',
          checkReady: () => {
            // Для Telegram мобильной версии требуем успешную загрузку пользователя
            if (isMiniApp) {
              const queryState = queryClient.getQueryState(['currentUser'])
              return queryState?.status === 'success' && !!user
            }
            // Для других платформ разрешаем, если данные загружены или запрос в процессе
            const queryState = queryClient.getQueryState(['currentUser'])
            return queryState?.status === 'success' || !!user || queryState !== undefined
          },
        })
      }
    }

    // ВАЖНО: Добавляем шаг загрузки навигации - это критично для предотвращения React error #300
    // Навигация должна быть полностью готова перед рендерингом
    steps.push({
      key: 'navigation',
      label: 'Инициализация навигации...',
      checkReady: () => {
        // ВАЖНО: Строгая проверка готовности navGroups
        // navGroups должен быть не пустым массивом и содержать валидные группы
        if (!navGroups || !Array.isArray(navGroups) || navGroups.length === 0) {
          return false
        }
        
        // ВАЖНО: Проверяем, что каждый group имеет все необходимые свойства
        const allGroupsValid = navGroups.every((group: any) => {
          return group && 
                 typeof group === 'object' && 
                 group.key && 
                 typeof group.key === 'string' && 
                 group.items && 
                 Array.isArray(group.items) && 
                 group.items.length > 0 &&
                 group.label &&
                 typeof group.label === 'string' &&
                 group.icon &&
                 typeof group.icon === 'string'
        })
        
        return allGroupsValid
      },
    })

    return steps
  }, [location, isAuthorized, translationsReady, t, user, queryClient, isCheckingAuth, navGroups, isMiniApp])

  // Проверяем готовность всех шагов загрузки
  // ВАЖНО: Для предотвращения React error #300 нужно убедиться, что ВСЕ критические данные готовы
  const allStepsReady = useMemo(() => {
    // Если нет шагов, считаем готовым
    if (loadingSteps.length === 0) return true
    
    // ВАЖНО: Проверяем, что navGroups полностью готов (не пустой массив)
    // navGroups может быть пустым массивом [], что технически проходит проверку, но означает, что данные еще не готовы
    const navGroupsReady = navGroups && Array.isArray(navGroups) && navGroups.length > 0
    
    // Проверяем базовые шаги (переводы и location) - они ДОЛЖНЫ быть готовы
    const basicSteps = loadingSteps.filter(step => step.key === 'translations' || step.key === 'location')
    const basicStepsReady = basicSteps.length === 0 || basicSteps.every(step => {
      if ('checkReady' in step && typeof step.checkReady === 'function') {
        return step.checkReady()
      }
      return false
    })
    
    // ВАЖНО: Разрешаем рендеринг ТОЛЬКО если базовые шаги готовы И navGroups готов
    // Это предотвращает попытки рендеринга навигации до полной инициализации
    if (basicStepsReady && navGroupsReady) {
      return true
    }
    
    // Если базовые шаги не готовы, проверяем все шаги
    const allStepsReadyCheck = loadingSteps.every(step => {
      if ('checkReady' in step && typeof step.checkReady === 'function') {
        return step.checkReady()
      }
      if ('isReady' in step && step.isReady !== undefined) {
        return step.isReady
      }
      if ('queryKey' in step && step.queryKey && Array.isArray(step.queryKey)) {
        const queryState = queryClient.getQueryState(step.queryKey)
        return queryState?.status === 'success' || queryState?.data !== undefined
      }
      return false
    })
    
    // ВАЖНО: Даже если все шаги готовы, проверяем navGroups
    return allStepsReadyCheck && navGroupsReady
  }, [loadingSteps, queryClient, navGroups])

  // Таймаут для загрузочного экрана
  // ВАЖНО: Для Telegram мобильной версии увеличиваем таймаут, чтобы дать время всем данным загрузиться
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  
  useEffect(() => {
    // Для Telegram мобильной версии таймаут 10 секунд, для других - 5 секунд
    const timeoutDuration = isMiniApp ? 10000 : 5000
    const timer = setTimeout(() => {
      setLoadingTimeout(true)
      // ВАЖНО: Для Telegram мобильной версии не принудительно разрешаем рендеринг
      // Пусть все шаги загрузки завершатся естественным образом
      if (!isMiniApp) {
        setIsAppReady(true) // Для других платформ принудительно разрешаем рендеринг после таймаута
      }
    }, timeoutDuration)
    
    return () => clearTimeout(timer)
  }, [isMiniApp])

  // Автоматически устанавливаем готовность, когда все шаги готовы
  // ВАЖНО: Добавляем дополнительную задержку для Telegram мобильной версии
  // Это дает время всем данным полностью инициализироваться перед рендерингом
  useEffect(() => {
    if (allStepsReady && !isAppReady && loadingSteps.length > 0) {
      // ВАЖНО: Для Telegram мобильной версии добавляем дополнительную задержку
      // Это предотвращает React error #300 при быстром использовании приложения
      const delay = isMiniApp ? 500 : 300 // 500мс для Telegram, 300мс для других
      const timer = setTimeout(() => {
        // Дополнительная проверка перед установкой isAppReady
        // Убеждаемся, что navGroups все еще готов
        if (navGroups && Array.isArray(navGroups) && navGroups.length > 0) {
          setIsAppReady(true)
        }
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [allStepsReady, isAppReady, loadingSteps.length, navGroups, isMiniApp])

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

  // Слушаем событие завершения авторизации от UnifiedAuthHandler
  useEffect(() => {
    const handleAuthCompleted = (event: CustomEvent) => {
      const { token, user } = (event as CustomEvent<{ token: string | null; user?: any }>).detail || {}
      if (token) {
        console.log('[Layout] Auth completed event received, updating authorization status')
        // Устанавливаем токен в API клиенте
        api.setToken(token)
        // Обновляем состояние авторизации
        setIsAuthorized(true)
        setIsCheckingAuth(false)
        // Если есть данные пользователя, обновляем кэш
        if (user) {
          queryClient.setQueryData(['currentUser'], user)
        }
      }
    }

    window.addEventListener('authCompleted', handleAuthCompleted as EventListener)
    return () => {
      window.removeEventListener('authCompleted', handleAuthCompleted as EventListener)
    }
  }, [queryClient])

  // ВАЖНО: Для Telegram Mini App проверяем токен при монтировании
  // Если токен уже есть, но isAuthorized еще null, обновляем состояние
  // Это предотвращает бесконечный цикл загрузки
  useEffect(() => {
    // Только для Telegram Mini App и только если авторизация еще не определена
    if (isMiniApp && isAuthorized === null && !isCheckingAuth) {
      const checkExistingToken = async () => {
        // Проверяем токен синхронно
        let token = storageSync.getItem('token')
        
        // Если не нашли синхронно, пробуем асинхронно
        if (!token) {
          try {
            const { default: storage } = await import('../utils/storage')
            token = await Promise.race([
              storage.getItem('token'),
              new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 500))
            ])
          } catch (error) {
            console.warn('[Layout] Failed to get token from Cloud Storage:', error)
          }
        }
        
        // Если токен найден, проверяем его валидность
        if (token) {
          try {
            const user = await api.getCurrentUser()
            if (user) {
              console.log('[Layout] Token found, user authenticated, updating authorization status')
              api.setToken(token)
              setIsAuthorized(true)
              setIsCheckingAuth(false)
              queryClient.setQueryData(['currentUser'], user)
            } else {
              // Токен невалидный
              setIsAuthorized(false)
              setIsCheckingAuth(false)
            }
          } catch (error) {
            // Токен невалидный или ошибка сети
            console.warn('[Layout] Token validation failed:', error)
            setIsAuthorized(false)
            setIsCheckingAuth(false)
          }
        } else {
          // Токена нет, но это нормально для первого запуска - UnifiedAuthHandler обработает
          // Не устанавливаем isAuthorized в false, чтобы не блокировать авторизацию
        }
      }
      
      // Небольшая задержка, чтобы дать UnifiedAuthHandler время на запуск
      const timeoutId = setTimeout(() => {
        checkExistingToken()
      }, 1000)
      
      return () => clearTimeout(timeoutId)
    }
  }, [isMiniApp, isAuthorized, isCheckingAuth, queryClient])

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
      let token = storageSync.getItem('token')
      
      // Если не нашли синхронно и это Telegram/VK, пробуем асинхронно (с коротким таймаутом)
      const isMiniApp = isTelegramWebApp() || isVKWebApp()
      if (!token && isMiniApp) {
        try {
          const { default: storage } = await import('../utils/storage')
          token = await Promise.race([
            storage.getItem('token'),
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 500)) // Таймаут 500мс
          ])
        } catch (error) {
          console.warn('[Layout] Failed to get token from Cloud Storage:', error)
        }
      }
      
      if (!token) {
        // Проверяем, не завершена ли авторизация через VK
        // Если да, даем больше времени на сохранение токена
        const vkAuthCompleted = sessionStorage.getItem('vkAuthCompleted') === 'true'
        
        // КРИТИЧЕСКИ ВАЖНО: Для VK Mini App при первом запуске параметры могут загружаться с задержкой
        // Проверяем еще раз, может быть мы в VK Mini App, но еще не определили это
        // Проверяем наличие VK Bridge или параметров в URL
        const mightBeVK = (window as any).vkBridge || 
                          window.location.search.includes('vk_') ||
                          window.location.hash.includes('vk_') ||
                          sessionStorage.getItem('isVKWebApp') === 'true'
        
        // Если возможно, что мы в VK Mini App, даем больше времени на определение
        const isLikelyVK = isMiniApp || mightBeVK
        
        // Для Web версии (не Mini App и не похоже на VK) сразу редиректим на логин
        if (!isLikelyVK && !vkAuthCompleted) {
          setIsAuthorized(false)
          setIsCheckingAuth(false)
          navigate('/login')
          return
        }
        
        // Для Mini App или возможного VK даем время на авторизацию
        // Сохраняем текущий путь для редиректа после авторизации
        const returnTo = location.pathname
        // Если VK авторизация завершена или возможно, что мы в VK, даем больше времени (5 секунд)
        // Иначе стандартное время (2 секунды)
        const waitTime = (vkAuthCompleted || isLikelyVK) ? 5000 : 2000
        // Даем время на авторизацию через Mini App (Telegram/VK)
        // Если через waitTime токен не появился, редиректим на логин
        setTimeout(() => {
          // Проверяем еще раз, может быть VK параметры загрузились
          const finalIsVK = isVKWebApp() || isTelegramWebApp()
          const finalToken = storageSync.getItem('token')
          
          if (!finalToken) {
            // Если VK авторизация была завершена, но токен все еще не найден,
            // очищаем флаг и редиректим на логин
            if (vkAuthCompleted) {
              sessionStorage.removeItem('vkAuthCompleted')
            }
            
            // Если мы все еще в VK Mini App, НЕ редиректим на логин - даем больше времени
            // VKAuthHandler должен обработать авторизацию
            if (finalIsVK) {
              console.log('[Layout] Still in VK Mini App without token, waiting for VKAuthHandler...')
              setIsCheckingAuth(false)
              return
            }
            
            setIsAuthorized(false)
            setIsCheckingAuth(false)
            navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)
          } else {
            // Токен появился, проверяем его
            // Очищаем флаг VK авторизации, так как токен найден
            if (vkAuthCompleted) {
              sessionStorage.removeItem('vkAuthCompleted')
            }
            checkAuth()
          }
        }, waitTime)
        return
      }

      try {
        const user = await api.getCurrentUser()
        if (user) {
          // Проверяем статус new_user для показа визарда биографии
          try {
            const newUserStatus = await api.getNewUserStatus()
            if (newUserStatus?.new_user && !newUserStatus?.has_biography) {
              // Показываем визард анкетирования для новых пользователей
              setShowOnboardingWizard(true)
            }
          } catch (error) {
            console.error('Error checking new user status:', error)
          }
          
          // Сразу проверяем флаг justLoggedIn после успешной авторизации (до установки isAuthorized)
          const justLoggedIn = sessionStorage.getItem('justLoggedIn') === 'true'
          if (justLoggedIn) {
            // Проверяем, является ли пользователь новым или существующим
            const accounts = await api.getAccounts().catch(() => [])
            const hasAccounts = Array.isArray(accounts) && accounts.length > 0
            const isExistingUser = hasAccounts
            
            if (isExistingUser) {
              // Для существующих пользователей - только приветствие, без онбординга
              // Для ВК миниаппа не показываем приветствие
              storageSync.setItem('onboarding_completed', 'true')
              setUserName(user?.first_name || user?.username || 'Пользователь')
              if (!isVK) {
                setShowWelcome(true)
              }
              sessionStorage.removeItem('justLoggedIn')
            } else {
              // Для новых пользователей проверяем флаг онбординга
              const onboardingCompleted = storageSync.getItem('onboarding_completed') === 'true'
              if (!onboardingCompleted) {
                // Показываем онбординг для новых пользователей
                sessionStorage.removeItem('justLoggedIn')
                setIsCheckingAuth(false)
                navigate('/onboarding')
                return
              } else {
                setUserName(user?.first_name || user?.username || 'Пользователь')
                // Для ВК миниаппа не показываем приветствие
                if (!isVK) {
                  setShowWelcome(true)
                }
                sessionStorage.removeItem('justLoggedIn')
              }
            }
          }
          // Устанавливаем авторизацию после проверки приветствия
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

  // Проверяем флаг justLoggedIn сразу после авторизации (до рендеринга Layout)
  // Проверка justLoggedIn теперь происходит сразу после успешной авторизации в checkAuth
  // Это обеспечивает показ приветствия сразу после загрузки, до главного меню

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
      const isMiniApp = isTelegramWebApp() || isVKWebApp()
      if (!token && isMiniApp) {
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
      
      // Для Web версии (не Mini App) без токена сразу редиректим на логин
      if (!token && !isMiniApp && isAuthorized === null) {
        if (checkCount >= 2) { // Быстрее для Web версии
          setIsAuthorized(false)
          navigate('/login')
        }
        return
      }
      
      if (token && (isAuthorized === false || isAuthorized === null)) {
        // Токен появился, проверяем авторизацию
        setIsCheckingAuth(true)
        try {
          const user = await api.getCurrentUser()
          if (user) {
            // Сразу проверяем флаг justLoggedIn после успешной авторизации (до установки isAuthorized)
            const justLoggedIn = sessionStorage.getItem('justLoggedIn') === 'true'
            if (justLoggedIn && !showWelcome) {
              // Проверяем, является ли пользователь новым или существующим
              const accounts = await api.getAccounts().catch(() => [])
              const hasAccounts = Array.isArray(accounts) && accounts.length > 0
              const isExistingUser = hasAccounts
              
              if (isExistingUser) {
                // Для существующих пользователей - только приветствие, без онбординга
                // Для ВК миниаппа не показываем приветствие
                storageSync.setItem('onboarding_completed', 'true')
                setUserName(user?.first_name || user?.username || 'Пользователь')
                if (!isVK) {
                  setShowWelcome(true)
                }
                sessionStorage.removeItem('justLoggedIn')
              } else {
                // Для новых пользователей проверяем флаг онбординга
                const onboardingCompleted = storageSync.getItem('onboarding_completed') === 'true'
                if (!onboardingCompleted) {
                  // Показываем онбординг для новых пользователей
                  sessionStorage.removeItem('justLoggedIn')
                  setIsCheckingAuth(false)
                  navigate('/onboarding')
                  return
                } else {
                  setUserName(user?.first_name || user?.username || 'Пользователь')
                  // Для ВК миниаппа не показываем приветствие
                  if (!isVK) {
                    setShowWelcome(true)
                  }
                  sessionStorage.removeItem('justLoggedIn')
                }
              }
            }
            // Устанавливаем авторизацию после проверки приветствия
            setIsAuthorized(true)
            setIsCheckingAuth(false)
          } else {
            setIsCheckingAuth(false)
            setIsAuthorized(false)
          }
        } catch (error) {
          console.error('Failed to verify token:', error)
          setIsCheckingAuth(false)
          setIsAuthorized(false)
          // Если токен невалиден, удаляем его
          storageSync.removeItem('token')
          api.setToken(null)
        }
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
  // НО только если проверка активно идет (isCheckingAuth), а не просто isAuthorized === null
  // Это предотвращает бесконечную загрузку, если что-то пошло не так
  // Также добавляем таймаут - не показываем загрузку дольше 2 секунд
  const [showAuthLoading, setShowAuthLoading] = useState(true)
  
  useEffect(() => {
    if (isCheckingAuth && isAuthorized !== true) {
      // Показываем загрузку максимум 2 секунды
      const timer = setTimeout(() => {
        setShowAuthLoading(false)
      }, 2000)
      
      return () => clearTimeout(timer)
    } else {
      setShowAuthLoading(false)
    }
  }, [isCheckingAuth, isAuthorized])
  
  // Показываем загрузку во время проверки авторизации
  const shouldShowAuthLoading = showAuthLoading && (isCheckingAuth && isAuthorized !== true) && 
    location?.pathname !== '/onboarding' && 
    location?.pathname !== '/login' && 
    location?.pathname !== '/register'
  
  // Если авторизация неизвестна, но проверка не идет - не блокируем, пусть Layout рендерится
  // Это важно для Telegram Mini App, где авторизация происходит асинхронно через auth handlers

  // Если на странице онбординга и не авторизован, показываем онбординг
  const shouldShowOnboarding = location?.pathname === '/onboarding' && !isAuthorized

  // Определяем публичные страницы - для них не нужна авторизация
  // ВАЖНО: Определяем ДО проверок авторизации, чтобы использовать в условиях
  const isPublicPage = location?.pathname === '/login' || 
                      location?.pathname === '/register' || 
                      location?.pathname === '/onboarding'

  // Показываем приветствие сразу после авторизации (до главного меню)
  // Приоритет: приветствие показывается перед Layout
  // Для ВК миниаппа не показываем приветствие
  const onboardingCompleted = storageSync.getItem('onboarding_completed') === 'true'
  const shouldShowWelcome = showWelcome && isAuthorized === true && !isVK && onboardingCompleted

  // КРИТИЧЕСКИ ВАЖНО: Не блокируем рендеринг, если авторизация еще не определена
  // Для Telegram/VK Mini App авторизация происходит асинхронно через auth handlers
  // Если мы вернем null здесь, приложение будет показывать пустой экран
  // Вместо этого даем время на авторизацию и редиректим только если точно не авторизованы
  const shouldBlockUnauthorized = isAuthorized === false &&
    location?.pathname &&
    location.pathname !== '/login' &&
    location.pathname !== '/register'

  // ВАЖНО: Для Telegram Mini App используем специальный экран загрузки
  // который проверяет токен и предзагружает данные для основных вкладок
  // Это предотвращает проблемы с hooks, так как Layout монтируется только после завершения загрузки
  const shouldShowTelegramLoading = isAuthorized === null && !isPublicPage && isMiniApp && !telegramLoadingComplete
  
  if (isAuthorized === null) {
    console.log('[Layout] Authorization status unknown, allowing render to continue (Mini App auth in progress)')
    // Продолжаем рендеринг - не блокируем UI (для веб-версии)
  }

  // Защита от рендеринга меню до инициализации данных
  // ВАЖНО: Строгие проверки для предотвращения React error #300
  // Проверяем, что location инициализирован, navGroups создан и НЕ пустой, и переводы готовы
  const isDataReady = useMemo(() => {
    // Проверяем location
    if (!location || typeof location !== 'object' || !location.pathname || typeof location.pathname !== 'string') {
      return false
    }
    
    // Проверяем переводы
    if (!translationsReady || !t) {
      return false
    }
    
    // ВАЖНО: Проверяем, что navGroups не только существует, но и содержит элементы
    // Пустой массив [] технически проходит проверку navGroups.length === 0, но означает, что данные еще не готовы
    if (!navGroups || !Array.isArray(navGroups) || navGroups.length === 0) {
      return false
    }
    
    // ВАЖНО: Дополнительная проверка - убеждаемся, что каждый group имеет все необходимые свойства
    const allGroupsValid = navGroups.every((group: any) => {
      return group && 
             typeof group === 'object' && 
             group.key && 
             typeof group.key === 'string' && 
             group.items && 
             Array.isArray(group.items) && 
             group.items.length > 0
    })
    
    if (!allGroupsValid) {
      return false
    }
    
    return true
  }, [location, translationsReady, navGroups, t])

  // Для публичных страниц проверяем только базовые данные
  const basicDataReady = translationsReady && !!t && !!location?.pathname

  // ВАЖНО: Для Telegram мобильной версии проверяем готовность ВСЕХ критичных данных
  // Для других платформ достаточно базовых данных
  const allCriticalDataReady = useMemo(() => {
    if (isPublicPage) {
      return basicDataReady
    }
    
    // Для Telegram мобильной версии требуем готовность всех шагов загрузки
    if (isMiniApp) {
      return allStepsReady && isDataReady
    }
    
    // Для других платформ достаточно базовых данных
    return basicDataReady
  }, [isPublicPage, basicDataReady, isMiniApp, allStepsReady, isDataReady])

  // Устанавливаем готовность приложения
  // ВАЖНО: Для Telegram мобильной версии не устанавливаем isAppReady автоматически
  // Пусть AppLoadingScreen сам установит готовность через onComplete
  useEffect(() => {
    // Для публичных страниц или если не Telegram мобильная версия
    if (isPublicPage || !isMiniApp) {
      if (basicDataReady || loadingTimeout) {
        if (!isAppReady) {
          setIsAppReady(true)
        }
      }
    }
    // Для Telegram мобильной версии isAppReady устанавливается через AppLoadingScreen.onComplete
  }, [basicDataReady, loadingTimeout, isAppReady, isPublicPage, isMiniApp])

  // Для публичных страниц НЕ показываем загрузочный экран
  // Разрешаем рендеринг сразу, даже если данные еще не готовы
  const shouldShowAppLoadingScreen = !isPublicPage && (
    isMiniApp
      ? (!allCriticalDataReady && !isAppReady)
      : (!basicDataReady && !loadingTimeout && !isAppReady)
  )

  // ВАЖНО: Не рендерим навигацию, если данные не готовы
  // Это критично для предотвращения React error #300 при быстром использовании приложения
  // ВАЖНО: Для Telegram Mini App данные уже загружены через TelegramLoadingScreen
  // Используем useMemo для стабильности проверки, чтобы избежать React error #310
  const shouldShowShellLoading = useMemo(() => {
    // Для Telegram Mini App не показываем loading, если загрузка уже завершена
    if (isMiniApp && telegramLoadingComplete) {
      return false
    }
    return !isDataReady || !isAppReady
  }, [isDataReady, isAppReady, isMiniApp, telegramLoadingComplete])


  if (shouldShowAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-telegram-bg dark:bg-telegram-dark-bg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary dark:border-telegram-dark-primary mb-4"></div>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t?.common?.loading || 'Загрузка...'}</p>
        </div>
      </div>
    )
  }

  if (shouldShowOnboarding) {
    return null
  }

  if (shouldShowWelcome) {
    return <Welcome userName={userName} onComplete={handleWelcomeComplete} />
  }

  if (shouldBlockUnauthorized) {
    console.log('[Layout] User not authorized, redirecting to login')
    return null
  }

  if (shouldShowTelegramLoading) {
    return (
      <TelegramLoadingScreen
        onComplete={() => {
          console.log('[Layout] Telegram loading complete, updating authorization status')
          // После завершения загрузки разрешаем рендеринг Layout
          setTelegramLoadingComplete(true)
        }}
      />
    )
  }

  if (shouldShowAppLoadingScreen) {
    return (
      <AppLoadingScreen
        steps={loadingSteps}
        onComplete={() => {
          // ВАЖНО: Устанавливаем isAppReady только после полной готовности всех данных
          setIsAppReady(true)
        }}
      />
    )
  }

  if (shouldShowShellLoading) {
    return (
      <div className={`min-h-screen flex flex-col xl:flex-row bg-telegram-bg dark:bg-telegram-dark-bg ${valentineEnabled ? 'valentine-mode' : ''} ${strangerThingsEnabled ? 'theme-stranger-things' : ''}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary dark:border-telegram-dark-primary mb-4"></div>
            <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t?.common?.loading || 'Загрузка...'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col xl:flex-row bg-telegram-bg dark:bg-telegram-dark-bg ${valentineEnabled ? 'valentine-mode' : ''} ${strangerThingsEnabled ? 'theme-stranger-things' : ''}`}>
      {/* Сердца для Дня святого Валентина */}
      {valentineEnabled && !strangerThingsEnabled && <HeartEffect />}
      
      {/* Гирлянда в верхнем меню */}
      {valentineEnabled && !strangerThingsEnabled && <Garland />}
      
      {/* CRT помехи для темы Stranger Things */}
      {strangerThingsEnabled && <CRTNoise />}
      
      {/* Desktop Sidebar - скрыт на мобильных и планшетах, показывается только на больших экранах (xl: 1280px+) */}
      <aside className="hidden xl:flex w-64 flex-col bg-telegram-surface dark:bg-telegram-dark-surface border-r border-telegram-border dark:border-telegram-dark-border flex-shrink-0 relative z-20">
        <div className="p-4 border-b border-telegram-border dark:border-telegram-dark-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowStories(true)}
              className="relative group cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-full ${valentineEnabled ? 'bg-gradient-to-br from-pink-400 to-pink-600 dark:from-pink-500 dark:to-pink-700' : 'bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight'} flex items-center justify-center overflow-hidden relative z-30 transform transition-transform duration-300 group-hover:scale-110 shadow-lg`}>
                <img src="/1.png" alt="Люся.Бюджет" className="w-full h-full object-cover" />
              </div>
              {/* Пульсирующее кольцо - анимация как в Instagram Stories */}
              <div className={`absolute inset-0 rounded-full ${valentineEnabled ? 'bg-gradient-to-br from-pink-400 to-pink-600 dark:from-pink-500 dark:to-pink-700' : 'bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight'} opacity-60 animate-ping`} style={{ animationDuration: '2s' }}></div>
              <div className={`absolute -inset-1 rounded-full border-2 ${valentineEnabled ? 'border-pink-400 dark:border-pink-500' : 'border-telegram-primary dark:border-telegram-dark-primary'} opacity-40 animate-pulse`} style={{ animationDuration: '1.5s' }}></div>
            </button>
            <div className="flex-1 min-w-0">
              <h1 
                className="text-base font-extrabold tracking-tight cursor-pointer select-none"
                onClick={handleTitleClick}
                style={getTitleColor() ? { 
                  color: getTitleColor(),
                  textShadow: `0 0 10px ${getTitleColor()}, 0 0 20px ${getTitleColor()}`,
                  transition: 'color 0.3s ease, text-shadow 0.3s ease'
                } : {}}
              >
                <span className={!getTitleColor() ? (valentineEnabled ? "valentine-title" : "bg-gradient-to-r from-telegram-primary dark:from-telegram-dark-primary via-purple-500 to-telegram-primaryLight dark:to-telegram-dark-primaryLight bg-clip-text text-transparent") : ""}>
                  {strangerThingsEnabled ? '' : valentineEnabled ? '💝 ' : ''}Люся.Бюджет{strangerThingsEnabled ? '' : valentineEnabled ? ' ❤️' : ''}
                </span>
              </h1>
              <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary font-medium tracking-wide">
                {strangerThingsEnabled 
                  ? 'Добро пожаловать в Хокинс' 
                  : valentineEnabled 
                    ? 'С Днём святого Валентина! 💕' 
                    : 'Все посчитала'}
              </p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navGroups && Array.isArray(navGroups) && navGroups.length > 0 ? navGroups.map((group) => {
            // ВАЖНО: Строгие проверки для предотвращения React error #300
            if (!group || typeof group !== 'object' || !group.key || typeof group.key !== 'string') return null
            if (!group.items || !Array.isArray(group.items) || group.items.length === 0) return null
            
            // ВАЖНО: Проверяем, что expandedGroups существует и является объектом
            const expandedGroupsSafe = expandedGroups && typeof expandedGroups === 'object' ? expandedGroups : {}
            const isExpanded = expandedGroupsSafe[group.key] ?? false
            
            // ВАЖНО: Проверяем location перед доступом к pathname
            const currentPath = (location && typeof location === 'object' && location.pathname) ? location.pathname : '/'
            
            // ВАЖНО: Безопасная проверка активного элемента
            const hasActiveItem = group.items.some((item: any) => {
              return item && typeof item === 'object' && item.path && typeof item.path === 'string' && currentPath === item.path
            })
            
            // ВАЖНО: Проверяем наличие icon и label перед рендерингом
            const groupIcon = (group.icon && typeof group.icon === 'string') ? group.icon : ''
            const groupLabel = (group.label && typeof group.label === 'string') ? group.label : ''
            
            if (!groupIcon && !groupLabel) return null // Не рендерим группу без иконки и метки
            
            return (
              <div key={group.key} className="space-y-1">
                {/* Группа заголовок */}
                <button
                  onClick={() => {
                    if (group.key && typeof group.key === 'string') {
                      toggleGroup(group.key)
                    }
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors ${
                    hasActiveItem ? 'bg-telegram-primary/10 dark:bg-telegram-dark-primary/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {groupIcon && <span className="text-lg">{groupIcon}</span>}
                    {groupLabel && (
                      <span className="font-semibold text-sm text-telegram-text dark:text-telegram-dark-text">
                        {groupLabel}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                
                {/* Подменю группы */}
                {isExpanded && group.items && Array.isArray(group.items) && group.items.length > 0 && (
                  <div className="ml-4 space-y-0.5">
                    {group.items.map((item: any) => {
                      // ВАЖНО: Строгие проверки для каждого item
                      if (!item || typeof item !== 'object' || !item.path || typeof item.path !== 'string') return null
                      
                      const isActive = currentPath === item.path
                      const itemIcon = (item.icon && typeof item.icon === 'string') ? item.icon : ''
                      const itemLabel = (item.label && typeof item.label === 'string') ? item.label : ''
                      
                      // Предзагрузка данных при наведении
                      const handleMouseEnter = () => {
                        if (item.path === '/transactions') {
                          queryClient.prefetchQuery({
                            queryKey: ['accounts'],
                            queryFn: () => api.getAccounts(),
                            staleTime: 60000,
                          })
                        } else if (item.path === '/accounts') {
                          queryClient.prefetchQuery({
                            queryKey: ['accounts'],
                            queryFn: () => api.getAccounts(),
                            staleTime: 60000,
                          })
                        } else if (item.path === '/reports') {
                          queryClient.prefetchQuery({
                            queryKey: ['analytics', 'month'],
                            queryFn: () => api.getAnalytics('month'),
                            staleTime: 60000,
                          })
                        } else if (item.path === '/') {
                          queryClient.prefetchQuery({
                            queryKey: ['balance'],
                            queryFn: () => api.getBalance(),
                            staleTime: 30000,
                          })
                          queryClient.prefetchQuery({
                            queryKey: ['accounts'],
                            queryFn: () => api.getAccounts(),
                            staleTime: 60000,
                          })
                        }
                      }
                      
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`nav-item ${isActive ? 'active' : ''} pl-8`}
                          onMouseEnter={handleMouseEnter}
                        >
                          {itemIcon && <span className="text-base">{itemIcon}</span>}
                          {itemLabel && <span className="font-medium text-sm">{itemLabel}</span>}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }) : (
            // Показываем загрузку, если navGroups еще не готовы
            <div className="flex items-center justify-center p-4">
              <div className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                Загрузка меню...
              </div>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-telegram-border dark:border-telegram-dark-border space-y-2 overflow-hidden">
          {/* VK Bot Button - только для VK пользователей, которые еще не общались с ботом */}
          {isVK && !hasInteractedWithBot() && isAuthorized && (
            <button
              onClick={async () => {
                try {
                  await openVKBot('232802016')
                  // Отслеживаем событие
                  try {
                    await api.trackEvent('miniapp_action', 'vk_bot_button_clicked', {
                      action: 'open_bot_from_sidebar'
                    })
                  } catch (error) {
                    // Игнорируем ошибки аналитики
                  }
                } catch (error) {
                  console.error('Failed to open VK bot:', error)
                }
              }}
              className="w-full p-3 rounded-telegram bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 mb-2"
              title="Написать боту"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Написать боту</span>
            </button>
          )}
          {/* Language Toggle */}
          <div className="w-full p-2 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors overflow-hidden">
            {/* Первая строка: смайлик планеты, флаги RU и EN */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-xl flex-shrink-0">🌍</span>
              <button
                onClick={() => setLanguage('ru')}
                className={`flex items-center justify-center px-2 py-1 rounded-telegram transition-colors flex-shrink-0 ${
                  language === 'ru'
                    ? 'bg-telegram-primary dark:bg-telegram-dark-primary'
                    : 'bg-telegram-border hover:bg-telegram-hover dark:bg-telegram-dark-border dark:hover:bg-telegram-dark-hover'
                }`}
              >
                <span className="text-xl">🇷🇺</span>
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`flex items-center justify-center px-2 py-1 rounded-telegram transition-colors flex-shrink-0 ${
                  language === 'en'
                    ? 'bg-telegram-primary dark:bg-telegram-dark-primary'
                    : 'bg-telegram-border hover:bg-telegram-hover dark:bg-telegram-dark-border dark:hover:bg-telegram-dark-hover'
                }`}
              >
                <span className="text-xl">🇬🇧</span>
              </button>
            </div>
            {/* Вторая строка: "Язык Русский" / "Language English" */}
            <div className="text-center">
              <p className="text-xs font-medium text-telegram-text dark:text-telegram-dark-text">
                {language === 'ru' ? 'Язык Русский' : 'Language English'}
              </p>
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
                <p className="font-medium text-sm text-telegram-text dark:text-telegram-dark-text">{t?.profile?.darkTheme || 'Темная тема'}</p>
                <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {theme === 'dark' ? (t?.profile?.darkThemeEnabled || 'Включена') : (t?.profile?.darkThemeDisabled || 'Выключена')}
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
              {t?.common?.logout || 'Выйти'}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile/Tablet Header - скрыт на больших экранах (xl+) */}
      <header className="xl:hidden bg-telegram-surface dark:bg-telegram-dark-surface border-b border-telegram-border dark:border-telegram-dark-border px-4 py-3 flex items-center justify-between sticky top-0 z-50 relative gap-2 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => setShowStories(true)}
            className="relative group flex-shrink-0"
          >
            <div className={`w-8 h-8 rounded-full ${valentineEnabled ? 'bg-gradient-to-br from-pink-400 to-pink-600 dark:from-pink-500 dark:to-pink-700' : 'bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight'} flex items-center justify-center overflow-hidden relative z-10 transform transition-transform duration-300 group-active:scale-110 shadow-lg`}>
              <img src="/1.png" alt="Люся.Бюджет" className="w-full h-full object-cover" />
            </div>
            {/* Пульсирующее кольцо - анимация как в Instagram Stories */}
            <div className={`absolute inset-0 rounded-full ${valentineEnabled ? 'bg-gradient-to-br from-pink-400 to-pink-600 dark:from-pink-500 dark:to-pink-700' : 'bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight'} opacity-60 animate-ping`} style={{ animationDuration: '2s' }}></div>
            <div className={`absolute -inset-1 rounded-full border-2 ${valentineEnabled ? 'border-pink-400 dark:border-pink-500' : 'border-telegram-primary dark:border-telegram-dark-primary'} opacity-40 animate-pulse`} style={{ animationDuration: '1.5s' }}></div>
          </button>
          <h1 
            className="text-sm sm:text-base font-extrabold tracking-tight min-w-0 truncate cursor-pointer select-none"
            onClick={handleTitleClick}
            style={getTitleColor() ? { 
              color: getTitleColor(),
              textShadow: `0 0 10px ${getTitleColor()}, 0 0 20px ${getTitleColor()}`,
              transition: 'color 0.3s ease, text-shadow 0.3s ease'
            } : {}}
          >
            <span className={!getTitleColor() ? (valentineEnabled ? "valentine-title" : "bg-gradient-to-r from-telegram-primary dark:from-telegram-dark-primary via-purple-500 to-telegram-primaryLight dark:to-telegram-dark-primaryLight bg-clip-text text-transparent") : ""}>
              {strangerThingsEnabled ? '' : valentineEnabled ? '💝 ' : ''}Люся.Бюджет{strangerThingsEnabled ? '' : valentineEnabled ? ' ❤️' : ''}
            </span>
          </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* VK Bot Button - только для VK пользователей, которые еще не общались с ботом */}
            {isVK && !hasInteractedWithBot() && isAuthorized && (
              <button
                onClick={async () => {
                  try {
                    await openVKBot('232802016')
                    // Отслеживаем событие
                    try {
                      await api.trackEvent('miniapp_action', 'vk_bot_button_clicked', {
                        action: 'open_bot_from_header'
                      })
                    } catch (error) {
                      // Игнорируем ошибки аналитики
                    }
                  } catch (error) {
                    console.error('Failed to open VK bot:', error)
                  }
                }}
                className="btn-icon w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                title="Написать боту"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
            )}
            {/* Quest Notifications */}
            <QuestNotifications variant="header" />
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn-icon w-10 h-10 flex items-center justify-center bg-telegram-hover dark:bg-telegram-dark-hover hover:bg-telegram-border dark:hover:bg-telegram-dark-border"
              title={theme === 'dark' ? (t?.profile?.darkThemeDisabled || 'Выключить темную тему') : (t?.profile?.darkThemeEnabled || 'Включить темную тему')}
            >
              <span className="text-xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
            </button>
          </div>
        </header>

      {/* Mobile/Tablet Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="xl:hidden fixed inset-0 bg-black/50 z-20"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="bg-telegram-surface dark:bg-telegram-dark-surface h-full w-64 shadow-lg overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-telegram-border dark:border-telegram-dark-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full ${valentineEnabled ? 'bg-gradient-to-br from-pink-400 to-pink-600 dark:from-pink-500 dark:to-pink-700' : 'bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight'} flex items-center justify-center overflow-hidden`}>
                    <img src="/1.png" alt="Люся.Бюджет" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-telegram-text dark:text-telegram-dark-text">
                      {valentineEnabled ? `💝 ${t?.nav?.menu || 'Меню'}` : (t?.nav?.menu || 'Меню')}
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
              {navGroups && Array.isArray(navGroups) && navGroups.length > 0 ? navGroups.map((group) => {
                // ВАЖНО: Строгие проверки для предотвращения React error #300
                if (!group || typeof group !== 'object' || !group.key || typeof group.key !== 'string') return null
                if (!group.items || !Array.isArray(group.items) || group.items.length === 0) return null
                
                // ВАЖНО: Проверяем, что expandedGroups существует и является объектом
                const expandedGroupsSafe = expandedGroups && typeof expandedGroups === 'object' ? expandedGroups : {}
                const isExpanded = expandedGroupsSafe[group.key] ?? false
                
                // ВАЖНО: Проверяем location перед доступом к pathname
                const currentPath = (location && typeof location === 'object' && location.pathname) ? location.pathname : '/'
                
                // ВАЖНО: Безопасная проверка активного элемента
                const hasActiveItem = group.items.some((item: any) => {
                  return item && typeof item === 'object' && item.path && typeof item.path === 'string' && currentPath === item.path
                })
                
                // ВАЖНО: Проверяем наличие icon и label перед рендерингом
                const groupIcon = (group.icon && typeof group.icon === 'string') ? group.icon : ''
                const groupLabel = (group.label && typeof group.label === 'string') ? group.label : ''
                
                if (!groupIcon && !groupLabel) return null // Не рендерим группу без иконки и метки
                
                return (
                  <div key={group.key} className="space-y-1">
                    {/* Группа заголовок */}
                    <button
                      onClick={() => {
                        if (group.key && typeof group.key === 'string') {
                          toggleGroup(group.key)
                        }
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors ${
                        hasActiveItem ? 'bg-telegram-primary/10 dark:bg-telegram-dark-primary/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {groupIcon && <span className="text-lg">{groupIcon}</span>}
                        {groupLabel && (
                          <span className="font-semibold text-sm text-telegram-text dark:text-telegram-dark-text">
                            {groupLabel}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>
                    
                    {/* Подменю группы */}
                    {isExpanded && group.items && Array.isArray(group.items) && group.items.length > 0 && (
                      <div className="ml-4 space-y-0.5">
                        {group.items.map((item: any) => {
                          // ВАЖНО: Строгие проверки для каждого item
                          if (!item || typeof item !== 'object' || !item.path || typeof item.path !== 'string') return null
                          
                          const isActive = currentPath === item.path
                          const itemIcon = (item.icon && typeof item.icon === 'string') ? item.icon : ''
                          const itemLabel = (item.label && typeof item.label === 'string') ? item.label : ''
                          
                          // Предзагрузка данных при наведении
                          const handleMouseEnter = () => {
                            if (item.path === '/transactions') {
                              queryClient.prefetchQuery({
                                queryKey: ['accounts'],
                                queryFn: () => api.getAccounts(),
                                staleTime: 60000,
                              })
                            } else if (item.path === '/accounts') {
                              queryClient.prefetchQuery({
                                queryKey: ['accounts'],
                                queryFn: () => api.getAccounts(),
                                staleTime: 60000,
                              })
                            } else if (item.path === '/reports') {
                              queryClient.prefetchQuery({
                                queryKey: ['analytics', 'month'],
                                queryFn: () => api.getAnalytics('month'),
                                staleTime: 60000,
                              })
                            } else if (item.path === '/') {
                              queryClient.prefetchQuery({
                                queryKey: ['balance'],
                                queryFn: () => api.getBalance(),
                                staleTime: 30000,
                              })
                              queryClient.prefetchQuery({
                                queryKey: ['accounts'],
                                queryFn: () => api.getAccounts(),
                                staleTime: 60000,
                              })
                            }
                          }
                          
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`nav-item ${isActive ? 'active' : ''} pl-8`}
                              onMouseEnter={handleMouseEnter}
                            >
                              {itemIcon && <span className="text-base">{itemIcon}</span>}
                              {itemLabel && <span className="font-medium text-sm">{itemLabel}</span>}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }) : (
                // Показываем загрузку, если navGroups еще не готовы
                <div className="flex items-center justify-center p-4">
                  <div className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    Загрузка меню...
                  </div>
                </div>
              )}
            </nav>
            
            <div className="p-3 border-t border-telegram-border dark:border-telegram-dark-border mt-auto space-y-2">
              {/* Language Toggle */}
              <div className="w-full flex items-center justify-between p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🌍</span>
                  <div>
                    <p className="font-medium text-sm text-telegram-text dark:text-telegram-dark-text">{t?.profile?.language || 'Язык'}</p>
                    <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      {language === 'ru' ? 'Русский' : 'English'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLanguage('ru')}
                    className={`w-[3.5rem] px-2 py-1 rounded-telegram text-xs font-medium transition-colors whitespace-nowrap ${
                      language === 'ru'
                        ? 'bg-telegram-primary text-white dark:bg-telegram-dark-primary'
                        : 'bg-telegram-border hover:bg-telegram-hover dark:bg-telegram-dark-border dark:hover:bg-telegram-dark-hover'
                    }`}
                  >
                    🇷🇺 RU
                  </button>
                  <button
                    onClick={() => setLanguage('en')}
                    className={`w-[3.5rem] px-2 py-1 rounded-telegram text-xs font-medium transition-colors whitespace-nowrap ${
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
                  {t?.common?.logout || 'Выйти'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 xl:pb-0 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 w-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation - только в Mini App на мобильных */}
      {isMiniApp && (
        <nav className="xl:hidden fixed bottom-0 left-0 right-0 bg-telegram-surface dark:bg-telegram-dark-surface border-t border-telegram-border dark:border-telegram-dark-border px-2 py-2 safe-area-inset-bottom z-10">
          <div className="flex items-center justify-around">
            {/* Дашборд, Транзакции, Счета, Отчеты */}
            {Array.isArray(navItems) && navItems.length > 0 ? navItems.filter((item: any) => {
              // ВАЖНО: Строгие проверки для предотвращения React error #300
              return item && typeof item === 'object' && item.path && typeof item.path === 'string' && (
                item.path === '/' || 
                item.path === '/transactions' || 
                item.path === '/accounts' || 
                item.path === '/reports'
              )
            }).map((item: any) => {
              // ВАЖНО: Проверяем location перед доступом к pathname
              const currentPath = (location && typeof location === 'object' && location.pathname) ? location.pathname : '/'
              const isActive = currentPath === item.path
              const itemIcon = (item.icon && typeof item.icon === 'string') ? item.icon : ''
              const itemLabel = (item.label && typeof item.label === 'string') ? item.label : ''
              
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
                  {itemIcon && <span className="text-xl">{itemIcon}</span>}
                  {itemLabel && <span className="text-[10px] font-medium">{itemLabel}</span>}
                </Link>
              )
            }) : null}
            {/* Кнопка Меню - открывает боковое меню со всеми пунктами */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-telegram min-w-[60px] transition-all ${
                mobileMenuOpen 
                  ? 'text-telegram-primary dark:text-telegram-dark-primary bg-telegram-primary/10 dark:bg-telegram-dark-primary/10' 
                  : 'text-telegram-textSecondary dark:text-telegram-dark-textSecondary'
              }`}
              aria-label={t?.nav?.menu || 'Меню'}
            >
              <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
              <span className="text-[10px] font-medium">{t?.nav?.menu || 'Меню'}</span>
            </button>
          </div>
        </nav>
      )}

      {/* Mobile Bottom Navigation - для всех мобильных устройств (не только Mini App) */}
      {!isMiniApp && (
        <nav className="xl:hidden fixed bottom-0 left-0 right-0 bg-telegram-surface dark:bg-telegram-dark-surface border-t border-telegram-border dark:border-telegram-dark-border px-2 py-2 safe-area-inset-bottom z-10 shadow-lg">
          <div className="flex items-center justify-around">
            {/* Дашборд, Транзакции, Счета, Отчеты */}
            {Array.isArray(navItems) && navItems.filter(item => 
              item && item.path && (
                item.path === '/' || 
                item.path === '/transactions' || 
                item.path === '/accounts' || 
                item.path === '/reports'
              )
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
              aria-label={t?.nav?.menu || 'Меню'}
            >
              <span className="text-xl">{mobileMenuOpen ? '✕' : '☰'}</span>
              <span className="text-[10px] font-medium">{t?.nav?.menu || 'Меню'}</span>
            </button>
          </div>
        </nav>
      )}

      {/* Stories Modal */}
      <Stories isOpen={showStories} onClose={() => setShowStories(false)} />

      {/* Onboarding Wizard */}
      {showOnboardingWizard && (
        <OnboardingWizard
          onComplete={() => {
            setShowOnboardingWizard(false)
            // Обновляем данные пользователя после завершения анкетирования
            window.location.reload()
          }}
          onSkip={() => {
            setShowOnboardingWizard(false)
          }}
        />
      )}
    </div>
  )
}

