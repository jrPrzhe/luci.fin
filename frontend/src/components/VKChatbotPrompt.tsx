import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { isVKWebApp, openVKBot } from '../utils/vk'
import { useI18n } from '../contexts/I18nContext'
import { storageSync } from '../utils/storage'

const DISMISS_STORAGE_KEY = 'vk_chatbot_prompt_dismissed'

export function VKChatbotPrompt() {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const { t } = useI18n()
  const location = useLocation()
  const isVK = isVKWebApp()

  useEffect(() => {
    // Показываем только для VK пользователей
    if (!isVK) {
      return
    }

    // Не показываем на страницах логина/регистрации/онбординга
    const hidePages = ['/login', '/register', '/onboarding']
    if (hidePages.includes(location.pathname)) {
      return
    }

    // Проверяем, не был ли промпт уже отклонен
    const dismissed = storageSync.getItem(DISMISS_STORAGE_KEY) === 'true'
    if (dismissed) {
      setIsDismissed(true)
      return
    }

    // Показываем промпт с небольшой задержкой, чтобы не мешать загрузке
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 2000) // 2 секунды после загрузки

    return () => clearTimeout(timer)
  }, [isVK, location.pathname])

  const handleOpenBot = async () => {
    try {
      // Используем утилиту для открытия бота
      await openVKBot('144352158')
      
      // Отслеживаем событие
      try {
        const { api } = await import('../services/api')
        await api.trackEvent('miniapp_action', 'vk_chatbot_prompt_clicked', {
          action: 'open_bot'
        })
      } catch (error) {
        // Игнорируем ошибки аналитики
      }
    } catch (error) {
      console.error('Failed to open VK bot:', error)
    }
  }

  const handleDismiss = () => {
    storageSync.setItem(DISMISS_STORAGE_KEY, 'true')
    setIsDismissed(true)
    setIsVisible(false)
    
    // Отслеживаем событие
    import('../services/api').then(({ api }) => {
      api.trackEvent('miniapp_action', 'vk_chatbot_prompt_dismissed', {
        action: 'dismiss'
      }).catch(() => {})
    })
  }

  // Не показываем, если не VK или уже отклонен
  if (!isVK || isDismissed || !isVisible) {
    return null
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto animate-slide-up safe-area-inset-bottom">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 rounded-2xl shadow-2xl p-4 border border-blue-400/20">
        {/* Кнопка закрытия */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-white/80 hover:text-white transition-colors p-1"
          aria-label="Закрыть"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Иконка и заголовок */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg mb-1">
              💬 Начни диалог с ботом!
            </h3>
            <p className="text-white/90 text-sm mb-3">
              Получай ежедневные напоминания о транзакциях и получи <span className="font-bold">бонус 100 баллов</span> за первый диалог!
            </p>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-2">
          <button
            onClick={handleOpenBot}
            className="flex-1 bg-white text-blue-600 font-semibold py-2.5 px-4 rounded-xl hover:bg-white/90 transition-colors shadow-lg flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Написать боту
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 text-white/80 hover:text-white transition-colors rounded-xl text-sm"
          >
            Позже
          </button>
        </div>

        {/* Дополнительная информация */}
        <p className="text-white/70 text-xs mt-3 text-center">
          Бот поможет не забывать о важных транзакциях
        </p>
      </div>
    </div>
  )
}

