import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export function DailyQuests() {
  const { data: quests, isLoading } = useQuery({
    queryKey: ['daily-quests'],
    queryFn: () => api.getDailyQuests(),
    staleTime: 60000, // 1 minute
  })

  if (isLoading) {
    return (
      <div className="daily-quests loading">
        <div className="skeleton">Загрузка квестов...</div>
      </div>
    )
  }

  if (!quests || quests.length === 0) {
    return (
      <div className="daily-quests empty bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary font-medium">
            На сегодня квестов нет
          </p>
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
            Задания появятся завтра
          </p>
        </div>
      </div>
    )
  }

  const getQuestIcon = (questType: string, status: string) => {
    if (status === 'completed') return '✅'
    switch (questType) {
      case 'record_expense': return '💸'
      case 'record_income': return '💰'
      case 'review_transactions': return '📊'
      case 'check_balance': return '💳'
      default: return '📋'
    }
  }

  const getQuestColor = (questType: string) => {
    switch (questType) {
      case 'record_expense': return 'from-red-500/20 to-orange-500/20 dark:from-red-600/30 dark:to-orange-600/30 border-red-300/30 dark:border-red-700/30'
      case 'record_income': return 'from-green-500/20 to-emerald-500/20 dark:from-green-600/30 dark:to-emerald-600/30 border-green-300/30 dark:border-green-700/30'
      case 'review_transactions': return 'from-blue-500/20 to-cyan-500/20 dark:from-blue-600/30 dark:to-cyan-600/30 border-blue-300/30 dark:border-blue-700/30'
      case 'check_balance': return 'from-purple-500/20 to-pink-500/20 dark:from-purple-600/30 dark:to-pink-600/30 border-purple-300/30 dark:border-purple-700/30'
      default: return 'from-gray-500/20 to-slate-500/20 dark:from-gray-600/30 dark:to-slate-600/30 border-gray-300/30 dark:border-gray-700/30'
    }
  }

  return (
    <div className="daily-quests bg-telegram-surface dark:bg-telegram-dark-surface rounded-2xl p-4 md:p-5 shadow-telegram">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎯</span>
        <h3 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text">
          Ежедневный ритуал
        </h3>
      </div>
      <div className="quests-list space-y-3">
        {quests.map((quest) => (
          <div 
            key={quest.id} 
            className={`quest-item bg-gradient-to-br ${getQuestColor(quest.quest_type)} rounded-xl p-4 border transition-all duration-300 ${
              quest.status === 'completed' 
                ? 'opacity-75 scale-[0.98]' 
                : 'hover:scale-[1.02] shadow-md hover:shadow-lg'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="quest-icon text-3xl flex-shrink-0">
                {getQuestIcon(quest.quest_type, quest.status)}
              </div>
              <div className="quest-content flex-1 min-w-0">
                <div className="quest-title font-bold text-base text-telegram-text dark:text-telegram-dark-text mb-1">
                  {quest.title}
                </div>
                {quest.description && (
                  <div className="quest-description text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-3">
                    {quest.description}
                  </div>
                )}
                <div className="quest-progress">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      Прогресс
                    </span>
                    <span className="text-xs font-bold text-telegram-text dark:text-telegram-dark-text">
                      {quest.progress}%
                    </span>
                  </div>
                  <div className="progress-bar h-2 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
                    <div 
                      className={`progress-fill h-full rounded-full transition-all duration-500 ${
                        quest.status === 'completed'
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500'
                      }`}
                      style={{ width: `${quest.progress}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="quest-reward flex-shrink-0">
                <span className="xp-badge bg-gradient-to-br from-yellow-400 to-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-md">
                  +{quest.xp_reward} XP
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

