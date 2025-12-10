import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useI18n } from '../contexts/I18nContext'

export function GamificationStatus() {
  const { t } = useI18n()
  const { data: status, isLoading } = useQuery({
    queryKey: ['gamification-status'],
    queryFn: () => api.getGamificationStatus(),
    staleTime: 30000, // 30 seconds
  })

  if (isLoading) {
    return (
      <div className="gamification-status loading">
        <div className="skeleton">{t.goals.stats.loading}</div>
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
    <div className="gamification-status bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-pink-500/10 dark:from-purple-600/20 dark:via-blue-600/20 dark:to-pink-600/20 rounded-2xl p-4 md:p-5 border border-purple-200/20 dark:border-purple-700/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="level-badge bg-gradient-to-br from-yellow-400 to-orange-500 w-16 h-16 rounded-2xl flex flex-col items-center justify-center shadow-lg">
            <span className="level-number text-2xl font-bold text-white">{profile.level}</span>
            <span className="level-label text-xs text-white/90 font-medium">{t.goals.stats.level}</span>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="streak-badge flex items-center gap-2 bg-orange-500/20 dark:bg-orange-500/30 px-3 py-1.5 rounded-xl">
              <span className="streak-icon text-xl">🔥</span>
              <div className="flex flex-col">
                <span className="streak-days text-lg font-bold text-orange-600 dark:text-orange-400">{profile.streak_days}</span>
                <span className="streak-label text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.goals.stats.daysInRow}</span>
              </div>
            </div>
            
            <div className="heart-badge flex items-center gap-2 bg-pink-500/20 dark:bg-pink-500/30 px-3 py-1.5 rounded-xl">
              <span className="heart-icon text-xl">❤️</span>
              <div className="flex flex-col">
                <span className="heart-level text-lg font-bold text-pink-600 dark:text-pink-400">{profile.heart_level}/100</span>
                <span className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.goals.stats.lucyHeart}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="xp-progress mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
            {profile.xp} XP
          </span>
          <span className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            {t.goals.stats.progressToLevel} {profile.level + 1}: {profile.xp_to_next_level} XP
          </span>
        </div>
        <div className="xp-bar h-3 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
          <div 
            className="xp-bar-fill h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 shadow-lg" 
            style={{ width: `${xpPercentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}

