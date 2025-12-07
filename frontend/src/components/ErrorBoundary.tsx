import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen p-4 md:p-6 flex items-center justify-center">
          <div className="card p-6 max-w-md w-full text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
              Произошла ошибка
            </h2>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
              {this.state.error?.message || 'Неизвестная ошибка'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null })
                window.location.reload()
              }}
              className="px-4 py-2 bg-telegram-primary text-white rounded-lg font-medium hover:bg-telegram-primary/90 transition-all"
            >
              Перезагрузить страницу
            </button>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  Детали ошибки
                </summary>
                <pre className="mt-2 text-xs bg-telegram-surface dark:bg-telegram-dark-surface p-2 rounded overflow-auto max-h-40">
                  {this.state.error?.stack}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

