import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useI18n } from '../contexts/I18nContext'

interface QuestNotificationsProps {
  variant?: 'header' | 'dashboard'
}

export function QuestNotifications({ variant = 'header' }: QuestNotificationsProps) {
  const { t } = useI18n()
  const navigate = useNavigate()

  const { data: quests, isLoading } = useQuery({
    queryKey: ['daily-quests'],
    queryFn: () => api.getDailyQuests(),
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  })

  const activeQuests = quests?.filter(q => q.status === 'pending') || []
  const activeCount = activeQuests.length

  const handleClick = () => {
    // Всегда переходим на страницу заданий, не открываем модальное окно
    navigate('/quests')
  }

  const getQuestIcon = (questType: string) => {
    switch (questType) {
      case 'record_expense': return '💸'
      case 'record_income': return '💰'
      case 'review_transactions': return '📊'
      case 'check_balance': return '💳'
      case 'ask_lucy': return '💬'
      case 'save_money': return '💎'
      default: return '📋'
    }
  }

  if (variant === 'header') {
    return (
      <button
        onClick={handleClick}
        className="btn-icon w-10 h-10 flex items-center justify-center bg-telegram-hover dark:bg-telegram-dark-hover hover:bg-telegram-border dark:hover:bg-telegram-dark-border relative"
        title={t.quests.questNotifications}
      >
        <span className="text-xl">🎯</span>
        {!isLoading && activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-telegram-bg dark:border-telegram-dark-bg">
            {activeCount > 9 ? '9+' : activeCount}
          </span>
        )}
      </button>
    )
  }

  // Dashboard variant - кнопка с бейджем
  return (
    <button
      onClick={handleClick}
      className="relative inline-flex items-center justify-center p-2 rounded-xl bg-telegram-hover dark:bg-telegram-dark-hover hover:bg-telegram-border dark:hover:bg-telegram-dark-border transition-colors"
      title={t.quests.questNotifications}
    >
      <span className="text-2xl">🎯</span>
      {!isLoading && activeCount > 0 && (
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-telegram-surface dark:border-telegram-dark-surface">
          {activeCount > 9 ? '9+' : activeCount}
        </span>
      )}
    </button>
  )
}








