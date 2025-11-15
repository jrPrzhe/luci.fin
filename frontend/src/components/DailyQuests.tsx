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
      <div className="daily-quests empty">
        <p>На сегодня квестов нет</p>
      </div>
    )
  }

  return (
    <div className="daily-quests">
      <h3>Ежедневный ритуал</h3>
      <div className="quests-list">
        {quests.map((quest) => (
          <div 
            key={quest.id} 
            className={`quest-item ${quest.status === 'completed' ? 'completed' : ''}`}
          >
            <div className="quest-icon">
              {quest.status === 'completed' ? '✅' : '📋'}
            </div>
            <div className="quest-content">
              <div className="quest-title">{quest.title}</div>
              {quest.description && (
                <div className="quest-description">{quest.description}</div>
              )}
              <div className="quest-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${quest.progress}%` }}
                  />
                </div>
                <span className="progress-text">{quest.progress}%</span>
              </div>
            </div>
            <div className="quest-reward">
              <span className="xp-badge">+{quest.xp_reward} XP</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

