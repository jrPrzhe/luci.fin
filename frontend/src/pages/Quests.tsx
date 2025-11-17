import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export function Quests() {
  const { data: quests, isLoading } = useQuery({
    queryKey: ['daily-quests'],
    queryFn: () => api.getDailyQuests(),
    staleTime: 60000, // 1 minute
  })

  if (isLoading) {
    return (
      <div className="quests-page loading p-4">
        <h1 className="text-2xl font-bold mb-4">Задания</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-20 bg-telegram-border dark:bg-telegram-dark-border rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!quests || quests.length === 0) {
    return (
      <div className="quests-page empty p-4">
        <h1 className="text-2xl font-bold mb-4 text-telegram-text dark:text-telegram-dark-text">
          Задания
        </h1>
        <div className="card p-8 text-center">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-lg font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
            На сегодня квестов нет
          </p>
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
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

  const activeQuests = quests.filter(q => q.status === 'pending')
  const completedQuests = quests.filter(q => q.status === 'completed')

  return (
    <div className="quests-page p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-4 text-telegram-text dark:text-telegram-dark-text">
        Задания
      </h1>

      {activeQuests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-3">
            Активные задания ({activeQuests.length})
          </h2>
          <div className="space-y-3">
            {activeQuests.map((quest) => (
              <div 
                key={quest.id} 
                className={`quest-item bg-gradient-to-br ${getQuestColor(quest.quest_type)} rounded-xl p-4 border transition-all duration-300 hover:scale-[1.02] shadow-md hover:shadow-lg`}
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
                          className="progress-fill h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-purple-500"
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
      )}

      {completedQuests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-3">
            Выполненные задания ({completedQuests.length})
          </h2>
          <div className="space-y-3">
            {completedQuests.map((quest) => (
              <div 
                key={quest.id} 
                className={`quest-item bg-gradient-to-br ${getQuestColor(quest.quest_type)} rounded-xl p-4 border opacity-75`}
              >
                <div className="flex items-start gap-3">
                  <div className="quest-icon text-3xl flex-shrink-0">
                    {getQuestIcon(quest.quest_type, quest.status)}
                  </div>
                  <div className="quest-content flex-1 min-w-0">
                    <div className="quest-title font-bold text-base text-telegram-text dark:text-telegram-dark-text mb-1 line-through">
                      {quest.title}
                    </div>
                    {quest.description && (
                      <div className="quest-description text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-3 line-through">
                        {quest.description}
                      </div>
                    )}
                    <div className="quest-progress">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                          Выполнено
                        </span>
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">
                          100%
                        </span>
                      </div>
                      <div className="progress-bar h-2 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
                        <div 
                          className="progress-fill h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="quest-reward flex-shrink-0">
                    <span className="xp-badge bg-gradient-to-br from-green-500 to-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-md">
                      +{quest.xp_reward} XP
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}



