import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

export function DailyQuestsCompact() {
  const navigate = useNavigate()
  const { data: quests, isLoading } = useQuery({
    queryKey: ['daily-quests'],
    queryFn: () => api.getDailyQuests(),
    staleTime: 60000, // 1 minute
  })

  if (isLoading) {
    return (
      <div className="daily-quests-compact bg-telegram-surface dark:bg-telegram-dark-surface rounded-xl p-3 shadow-telegram">
        <div className="animate-pulse">
          <div className="h-4 bg-telegram-border dark:bg-telegram-dark-border rounded w-24 mb-2"></div>
          <div className="h-3 bg-telegram-border dark:bg-telegram-dark-border rounded w-32"></div>
        </div>
      </div>
    )
  }

  if (!quests || quests.length === 0) {
    return (
      <div 
        className="daily-quests-compact bg-telegram-surface dark:bg-telegram-dark-surface rounded-xl p-3 shadow-telegram cursor-pointer hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors"
        onClick={() => navigate('/quests')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <div>
              <div className="text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                Ежедневный ритуал
              </div>
              <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                На сегодня квестов нет
              </div>
            </div>
          </div>
          <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">→</span>
        </div>
      </div>
    )
  }

  const activeQuests = quests.filter(q => q.status === 'pending')
  const completedQuests = quests.filter(q => q.status === 'completed')
  const totalQuests = quests.length
  const completedCount = completedQuests.length

  const getQuestIcon = (questType: string) => {
    switch (questType) {
      case 'record_expense': return '💸'
      case 'record_income': return '💰'
      case 'review_transactions': return '📊'
      case 'check_balance': return '💳'
      default: return '📋'
    }
  }

  return (
    <div 
      className="daily-quests-compact bg-telegram-surface dark:bg-telegram-dark-surface rounded-xl p-3 shadow-telegram cursor-pointer hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors"
      onClick={() => navigate('/quests')}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <span className="text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
            Ежедневный ритуал
          </span>
        </div>
        <span className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
          {completedCount}/{totalQuests}
        </span>
      </div>
      
      {activeQuests.length > 0 ? (
        <div className="space-y-2">
          {activeQuests.slice(0, 2).map((quest) => (
            <div 
              key={quest.id}
              className="flex items-center gap-2 bg-telegram-bg dark:bg-telegram-dark-bg rounded-lg p-2"
            >
              <span className="text-lg">{getQuestIcon(quest.quest_type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-telegram-text dark:text-telegram-dark-text truncate">
                  {quest.title}
                </div>
                <div className="h-1.5 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${quest.progress}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                +{quest.xp_reward}
              </span>
            </div>
          ))}
          {activeQuests.length > 2 && (
            <div className="text-xs text-center text-telegram-textSecondary dark:text-telegram-dark-textSecondary pt-1">
              +{activeQuests.length - 2} ещё заданий
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
          Все задания выполнены! 🎉
        </div>
      )}
      
      <div className="mt-2 pt-2 border-t border-telegram-border dark:border-telegram-dark-border">
        <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary text-center">
          Нажмите, чтобы открыть все задания →
        </div>
      </div>
    </div>
  )
}









