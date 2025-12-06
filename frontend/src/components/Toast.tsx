import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

export function ToastItem({ toast, onClose }: ToastProps) {
  useEffect(() => {
    const duration = toast.duration || 5000
    const timer = setTimeout(() => {
      onClose(toast.id)
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onClose])

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      default:
        return 'ℹ️'
    }
  }

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-l-green-500 dark:border-l-green-400'
      case 'error':
        return 'border-l-red-500 dark:border-l-red-400'
      case 'warning':
        return 'border-l-yellow-500 dark:border-l-yellow-400'
      case 'info':
        return 'border-l-blue-500 dark:border-l-blue-400'
      default:
        return 'border-l-telegram-primary dark:border-l-telegram-dark-primary'
    }
  }

  return (
    <div
      className={`bg-telegram-surface dark:bg-telegram-dark-surface border border-telegram-border dark:border-telegram-dark-border border-l-4 ${getBorderColor()} rounded-telegram-lg px-4 py-3 mb-3 shadow-telegram flex items-start gap-3 animate-slide-down min-w-[280px] max-w-[400px]`}
      role="alert"
    >
      <span className="text-xl flex-shrink-0 mt-0.5">{getIcon()}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-telegram-text dark:text-telegram-dark-text break-words">{toast.message}</p>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text transition-colors p-1 rounded-full hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover"
        aria-label="Закрыть"
      >
        <span className="text-lg leading-none">×</span>
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div 
      className="fixed right-4 z-[9999] flex flex-col items-end pointer-events-none lg:top-4 top-28"
      style={{
        position: 'fixed',
        right: '1rem',
        zIndex: 9999,
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  )
}

