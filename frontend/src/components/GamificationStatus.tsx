import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export function GamificationStatus() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['gamification-status'],
    queryFn: () => api.getGamificationStatus(),
    staleTime: 30000, // 30 seconds
  })

  if (isLoading) {
    return (
      <div className="gamification-status loading">
        <div className="skeleton">Загрузка...</div>
      </div>
    )
  }

  if (!status) {
    return null
  }

  const { profile } = status
  const xpPercentage = profile.xp_to_next_level > 0 
    ? (profile.xp / (profile.xp + profile.xp_to_next_level)) * 100 
    : 100

  return (
    <div className="gamification-status">
      <div className="gamification-header">
        <div className="level-badge">
          <span className="level-number">{profile.level}</span>
          <span className="level-label">Уровень</span>
        </div>
        <div className="streak-badge">
          <span className="streak-icon">🔥</span>
          <span className="streak-days">{profile.streak_days}</span>
          <span className="streak-label">дней</span>
        </div>
        <div className="heart-badge">
          <span className="heart-icon">❤️</span>
          <span className="heart-level">{profile.heart_level}/100</span>
        </div>
      </div>
      
      <div className="xp-progress">
        <div className="xp-info">
          <span>{profile.xp} XP</span>
          <span>До следующего уровня: {profile.xp_to_next_level} XP</span>
        </div>
        <div className="xp-bar">
          <div 
            className="xp-bar-fill" 
            style={{ width: `${xpPercentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

