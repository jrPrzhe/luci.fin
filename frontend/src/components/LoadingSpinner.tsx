import { useI18n } from '../contexts/I18nContext'

interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
}

export function LoadingSpinner({ message, size = 'md', fullScreen = false }: LoadingSpinnerProps) {
  const { t } = useI18n()
  
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  }

  const spinner = (
    <div className="text-center">
      <div className={`inline-block animate-spin rounded-full ${sizeClasses[size]} border-b-2 border-telegram-primary dark:border-telegram-dark-primary mb-4`}></div>
      <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
        {message || t.common.loading}
      </p>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen p-4 md:p-6 flex items-center justify-center">
        {spinner}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {spinner}
    </div>
  )
}

