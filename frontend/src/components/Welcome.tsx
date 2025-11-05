import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface WelcomeProps {
  userName?: string
  onComplete: () => void
}

export function Welcome({ userName, onComplete }: WelcomeProps) {
  const [displayName, setDisplayName] = useState(userName || 'Пользователь')
  
  useEffect(() => {
    // Загружаем данные пользователя для отображения имени
    const loadUser = async () => {
      try {
        const user = await api.getCurrentUser()
        if (user?.first_name) {
          setDisplayName(user.first_name)
        } else if (user?.username) {
          setDisplayName(user.username)
        }
      } catch (error) {
        console.error('Error loading user:', error)
      }
    }
    
    loadUser()
    
    // Автоматически переходим на целевую страницу через 2 секунды
    const timer = setTimeout(() => {
      onComplete()
    }, 2000)
    
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="min-h-screen flex items-center justify-center bg-telegram-bg p-4 animate-fade-in">
      <div className="text-center max-w-md w-full">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-telegram-primary to-telegram-primaryLight mb-4 shadow-telegram-lg animate-bounce">
            <span className="text-4xl md:text-5xl">👋</span>
          </div>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-semibold text-telegram-text mb-2">
          Привет, {displayName}!
        </h1>
        
        <p className="text-base md:text-lg text-telegram-textSecondary mb-6">
          Добро пожаловать в Люся.Бюджет
        </p>
        
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-telegram-primary animate-pulse"></div>
          <div className="w-2 h-2 rounded-full bg-telegram-primary animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 rounded-full bg-telegram-primary animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  )
}

