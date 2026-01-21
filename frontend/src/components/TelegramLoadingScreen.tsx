import { useEffect, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { storageSync } from '../utils/storage'
import { isTelegramWebApp } from '../utils/telegram'

interface TelegramLoadingScreenProps {
  onComplete: () => void
}

export function TelegramLoadingScreen({ onComplete }: TelegramLoadingScreenProps) {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('Проверка авторизации...')
  const [hasToken, setHasToken] = useState(false)

  // Проверка токена
  const checkToken = useCallback(async () => {
    // Сначала проверяем синхронно
    let token = storageSync.getItem('token')
    
    // Если не нашли и это Telegram, пробуем асинхронно
    if (!token && isTelegramWebApp()) {
      try {
        const { default: storage } = await import('../utils/storage')
        token = await Promise.race([
          storage.getItem('token'),
          new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 500))
        ])
      } catch (error) {
        console.warn('[TelegramLoadingScreen] Failed to get token:', error)
      }
    }
    
    if (token) {
      // Проверяем валидность токена
      try {
        api.setToken(token)
        const user = await api.getCurrentUser()
        if (user) {
          setHasToken(true)
          setProgress(20) // 20% - токен найден
          setCurrentStep('Авторизация подтверждена')
          return true
        }
      } catch (error) {
        console.warn('[TelegramLoadingScreen] Token validation failed:', error)
      }
    }
    
    return false
  }, [])

  // Загрузка данных после нахождения токена
  const loadInitialData = useCallback(async () => {
    if (!hasToken) return

    try {
      setCurrentStep('Загрузка баланса...')
      setProgress(40)
      
      // Загружаем баланс
      await queryClient.prefetchQuery({
        queryKey: ['balance'],
        queryFn: async () => {
          try {
            return await api.getBalance()
          } catch (error) {
            console.error('Error fetching balance:', error)
            return { total: 0, currency: 'RUB', accounts: [] }
          }
        },
        staleTime: 30000,
      })

      setCurrentStep('Загрузка счетов...')
      setProgress(60)
      
      // Загружаем счета
      await queryClient.prefetchQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
          try {
            return await api.getAccounts()
          } catch (error) {
            console.error('Error fetching accounts:', error)
            return []
          }
        },
        staleTime: 60000,
      })

      setCurrentStep('Загрузка транзакций...')
      setProgress(80)
      
      // Загружаем последние транзакции
      await queryClient.prefetchQuery({
        queryKey: ['recent-transactions'],
        queryFn: async () => {
          try {
            return await api.getTransactions(10)
          } catch (error) {
            console.error('Error fetching transactions:', error)
            return []
          }
        },
        staleTime: 30000,
      })

      setCurrentStep('Загрузка профиля...')
      setProgress(90)
      
      // Загружаем профиль пользователя
      await queryClient.prefetchQuery({
        queryKey: ['currentUser'],
        queryFn: () => api.getCurrentUser(),
        staleTime: 300000,
      })

      setProgress(100)
      setCurrentStep('Готово!')
      
      // Небольшая задержка для плавного перехода
      setTimeout(() => {
        onComplete()
      }, 300)
    } catch (error) {
      console.error('[TelegramLoadingScreen] Error loading data:', error)
      // Даже при ошибке продолжаем
      setTimeout(() => {
        onComplete()
      }, 300)
    }
  }, [hasToken, queryClient, onComplete])

  // Основной эффект - проверка токена
  useEffect(() => {
    let mounted = true
    let checkCount = 0
    const maxChecks = 20 // Максимум 10 секунд (20 * 500ms)
    
    const checkTokenInterval = setInterval(async () => {
      if (!mounted) return
      
      checkCount++
      const tokenFound = await checkToken()
      
      if (tokenFound) {
        clearInterval(checkTokenInterval)
        // Токен найден, начинаем загрузку данных
        loadInitialData()
      } else if (checkCount >= maxChecks) {
        // Таймаут - продолжаем без токена (для первого запуска)
        clearInterval(checkTokenInterval)
        console.warn('[TelegramLoadingScreen] Token check timeout, continuing...')
        setProgress(100)
        setCurrentStep('Продолжаем...')
        setTimeout(() => {
          onComplete()
        }, 500)
      } else {
        // Обновляем прогресс проверки токена (0-20%)
        const tokenProgress = Math.min((checkCount / maxChecks) * 20, 20)
        setProgress(tokenProgress)
      }
    }, 500) // Проверяем каждые 500мс
    
    // Первая проверка сразу
    checkToken().then((found) => {
      if (found && mounted) {
        clearInterval(checkTokenInterval)
        loadInitialData()
      }
    })
    
    return () => {
      mounted = false
      clearInterval(checkTokenInterval)
    }
  }, [checkToken, loadInitialData])

  // Анимация прогресса для плавности
  const [animatedProgress, setAnimatedProgress] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress)
    }, 50)
    return () => clearTimeout(timer)
  }, [progress])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-telegram-bg dark:bg-telegram-dark-bg">
      <div className="w-full max-w-md px-8">
        {/* Логотип/Иконка */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight flex items-center justify-center overflow-hidden shadow-lg">
              <img src="/1.png" alt="Люся.Бюджет" className="w-full h-full object-cover" />
            </div>
            {/* Пульсирующее кольцо */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight opacity-60 animate-ping"></div>
          </div>
        </div>

        {/* Название приложения */}
        <h1 className="text-2xl font-extrabold text-center mb-8 bg-gradient-to-r from-telegram-primary dark:from-telegram-dark-primary via-purple-500 to-telegram-primaryLight dark:to-telegram-dark-primaryLight bg-clip-text text-transparent">
          Люся.Бюджет
        </h1>

        {/* Прогресс-бар */}
        <div className="mb-4">
          <div className="w-full bg-telegram-border dark:bg-telegram-dark-border rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight transition-all duration-300 ease-out rounded-full"
              style={{ width: `${animatedProgress}%` }}
            />
          </div>
        </div>

        {/* Процент и текущий шаг */}
        <div className="text-center">
          <p className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-2">
            {Math.round(animatedProgress)}%
          </p>
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            {currentStep}
          </p>
        </div>
      </div>
    </div>
  )
}
