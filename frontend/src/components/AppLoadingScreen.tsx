import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface LoadingStep {
  key: string
  label: string
  queryKey?: string[]
  isReady?: boolean
  checkReady?: () => boolean
}

interface AppLoadingScreenProps {
  steps: LoadingStep[]
  onComplete: () => void
}

export function AppLoadingScreen({ steps, onComplete }: AppLoadingScreenProps) {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState<string>('')

  useEffect(() => {
    const checkProgress = () => {
      let readyCount = 0
      let currentStepLabel = ''

      steps.forEach((step) => {
        let isReady = false

        // Проверяем готовность через кастомную функцию
        if (step.checkReady) {
          isReady = step.checkReady()
        }
        // Или через isReady флаг
        else if (step.isReady !== undefined) {
          isReady = step.isReady
        }
        // Или через query state
        else if (step.queryKey) {
          const queryState = queryClient.getQueryState(step.queryKey)
          isReady = queryState?.status === 'success' || queryState?.data !== undefined
        }

        if (isReady) {
          readyCount++
        } else if (!currentStepLabel) {
          currentStepLabel = step.label
        }
      })

      const newProgress = steps.length > 0 ? (readyCount / steps.length) * 100 : 0
      setProgress(Math.min(newProgress, 100))
      setCurrentStep(currentStepLabel || steps[steps.length - 1]?.label || '')

      // Если все шаги готовы, вызываем onComplete
      if (readyCount === steps.length && steps.length > 0) {
        // Небольшая задержка для плавного перехода
        setTimeout(() => {
          onComplete()
        }, 300)
      }
    }

    // Проверяем прогресс сразу
    checkProgress()

    // Проверяем прогресс каждые 100мс
    const interval = setInterval(checkProgress, 100)

    return () => clearInterval(interval)
  }, [steps, queryClient, onComplete])

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
            {currentStep || 'Загрузка...'}
          </p>
        </div>

        {/* Список шагов загрузки (опционально, для отладки) */}
        {import.meta.env.DEV && (
          <div className="mt-8 space-y-2 text-xs">
            {steps.map((step) => {
              let isReady = false

              if (step.checkReady) {
                isReady = step.checkReady()
              } else if (step.isReady !== undefined) {
                isReady = step.isReady
              } else if (step.queryKey) {
                const queryState = queryClient.getQueryState(step.queryKey)
                isReady = queryState?.status === 'success' || queryState?.data !== undefined
              }

              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-2 ${
                    isReady
                      ? 'text-telegram-primary dark:text-telegram-dark-primary'
                      : 'text-telegram-textSecondary dark:text-telegram-dark-textSecondary'
                  }`}
                >
                  <span>{isReady ? '✓' : '○'}</span>
                  <span>{step.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
