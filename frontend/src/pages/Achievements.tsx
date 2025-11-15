import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export function Achievements() {
  const { data: achievements, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.getAchievements(),
    staleTime: 300000, // 5 minutes
  })

  if (isLoading) {
    return (
      <div className="achievements-page loading">
        <h1>Достижения</h1>
        <div className="skeleton">Загрузка...</div>
      </div>
    )
  }

  if (!achievements) {
    return null
  }

  const unlocked = achievements.filter(a => a.is_unlocked)
  const locked = achievements.filter(a => !a.is_unlocked)

  const rarityColors: Record<string, string> = {
    common: '#9e9e9e',
    rare: '#2196f3',
    epic: '#9c27b0',
    legendary: '#ff9800',
  }

  return (
    <div className="achievements-page">
      <h1>Достижения</h1>
      
      {unlocked.length > 0 && (
        <div className="achievements-section">
          <h2>Разблокировано ({unlocked.length})</h2>
          <div className="achievements-grid">
            {unlocked.map((achievement) => (
              <div 
                key={achievement.id} 
                className="achievement-card unlocked"
                style={{ borderColor: rarityColors[achievement.rarity] || rarityColors.common }}
              >
                <div className="achievement-icon">{achievement.icon || '🏆'}</div>
                <div className="achievement-title">{achievement.title}</div>
                {achievement.description && (
                  <div className="achievement-description">{achievement.description}</div>
                )}
                <div className="achievement-reward">+{achievement.xp_reward} XP</div>
                {achievement.unlocked_at && (
                  <div className="achievement-date">
                    Разблокировано: {new Date(achievement.unlocked_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div className="achievements-section">
          <h2>Заблокировано ({locked.length})</h2>
          <div className="achievements-grid">
            {locked.map((achievement) => (
              <div 
                key={achievement.id} 
                className="achievement-card locked"
              >
                <div className="achievement-icon">🔒</div>
                <div className="achievement-title">{achievement.title}</div>
                {achievement.description && (
                  <div className="achievement-description">{achievement.description}</div>
                )}
                <div className="achievement-reward">+{achievement.xp_reward} XP</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

