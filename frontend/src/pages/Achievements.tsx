import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useI18n } from '../contexts/I18nContext'

export function Achievements() {
  const { t } = useI18n()
  const { data: achievements, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.getAchievements(),
    staleTime: 300000, // 5 minutes
  })

  if (isLoading) {
    return (
      <div className="achievements-page p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
            {t.achievements.title}
          </h1>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            {t.achievements.subtitle}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-48 bg-telegram-border dark:bg-telegram-dark-border rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!achievements) {
    return null
  }

  const unlocked = achievements.filter(a => a.is_unlocked)
  const locked = achievements.filter(a => !a.is_unlocked)

  const getRarityStyle = (rarity: string, isUnlocked: boolean) => {
    if (!isUnlocked) {
      return {
        gradient: 'from-gray-400/10 to-gray-500/10 dark:from-gray-600/20 dark:to-gray-700/20',
        border: 'border-gray-300/30 dark:border-gray-600/30',
        glow: '',
        iconBg: 'bg-gray-200/50 dark:bg-gray-700/50',
      }
    }

    switch (rarity) {
      case 'legendary':
        return {
          gradient: 'from-yellow-400/20 via-orange-500/20 to-red-500/20 dark:from-yellow-500/30 dark:via-orange-600/30 dark:to-red-600/30',
          border: 'border-yellow-400/50 dark:border-yellow-500/50',
          glow: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
          iconBg: 'bg-gradient-to-br from-yellow-400 to-orange-500',
        }
      case 'epic':
        return {
          gradient: 'from-purple-400/20 via-pink-500/20 to-red-500/20 dark:from-purple-500/30 dark:via-pink-600/30 dark:to-red-600/30',
          border: 'border-purple-400/50 dark:border-purple-500/50',
          glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
          iconBg: 'bg-gradient-to-br from-purple-500 to-pink-500',
        }
      case 'rare':
        return {
          gradient: 'from-blue-400/20 via-cyan-500/20 to-teal-500/20 dark:from-blue-500/30 dark:via-cyan-600/30 dark:to-teal-600/30',
          border: 'border-blue-400/50 dark:border-blue-500/50',
          glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]',
          iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
        }
      default:
        return {
          gradient: 'from-gray-300/20 to-gray-400/20 dark:from-gray-500/30 dark:to-gray-600/30',
          border: 'border-gray-300/50 dark:border-gray-500/50',
          glow: 'shadow-[0_0_10px_rgba(156,163,175,0.2)]',
          iconBg: 'bg-gradient-to-br from-gray-400 to-gray-500',
        }
    }
  }

  const getRarityLabel = (rarity: string) => {
    return t.achievements.rarity[rarity as keyof typeof t.achievements.rarity] || rarity
  }

  return (
    <div className="achievements-page p-4 md:p-6 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">🏆</span>
          <div>
            <h1 className="text-3xl font-bold text-telegram-text dark:text-telegram-dark-text">
              {t.achievements.title}
            </h1>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
              {t.achievements.unlockedCount.replace('{unlocked}', unlocked.length.toString()).replace('{total}', achievements.length.toString())}
            </p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
              {t.achievements.progress}
            </span>
            <span className="text-xs font-bold text-telegram-text dark:text-telegram-dark-text">
              {Math.round((unlocked.length / achievements.length) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full transition-all duration-500"
              style={{ width: `${(unlocked.length / achievements.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Unlocked Achievements */}
      {unlocked.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">✨</span>
            <h2 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text">
              {t.achievements.unlocked} ({unlocked.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlocked.map((achievement) => {
              const style = getRarityStyle(achievement.rarity, true)
              return (
                <div 
                  key={achievement.id} 
                  className={`achievement-card bg-gradient-to-br ${style.gradient} rounded-2xl p-5 border-2 ${style.border} ${style.glow} transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden group`}
                >
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  
                  {/* Icon */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-16 h-16 ${style.iconBg} rounded-2xl flex items-center justify-center text-3xl shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                      {achievement.icon || '🏆'}
                    </div>
                    <div className="px-2 py-1 bg-black/20 dark:bg-white/20 rounded-lg backdrop-blur-sm">
                      <span className="text-xs font-bold text-white">
                        {getRarityLabel(achievement.rarity)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
                      {achievement.title}
                    </h3>
                    {achievement.description && (
                      <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4 leading-relaxed">
                        {achievement.description}
                      </p>
                    )}
                    
                    {/* Reward and Date */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/10 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                          {t.achievements.reward}
                        </span>
                        <span className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg text-sm font-bold shadow-md">
                          +{achievement.xp_reward} XP
                        </span>
                      </div>
                      {achievement.unlocked_at && (
                        <span className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                          {new Date(achievement.unlocked_at).toLocaleDateString('ru-RU', { 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Locked Achievements */}
      {locked.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🔒</span>
            <h2 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text">
              {t.achievements.locked} ({locked.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locked.map((achievement) => {
              const style = getRarityStyle(achievement.rarity, false)
              return (
                <div 
                  key={achievement.id} 
                  className={`achievement-card bg-gradient-to-br ${style.gradient} rounded-2xl p-5 border-2 ${style.border} opacity-60 relative overflow-hidden`}
                >
                  {/* Lock overlay */}
                  <div className="absolute inset-0 bg-black/20 dark:bg-black/40 rounded-2xl flex items-center justify-center z-20">
                    <div className="text-4xl opacity-50">🔒</div>
                  </div>
                  
                  {/* Icon */}
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className={`w-16 h-16 ${style.iconBg} rounded-2xl flex items-center justify-center text-3xl shadow-lg grayscale`}>
                      {achievement.icon || '🏆'}
                    </div>
                    <div className="px-2 py-1 bg-black/20 dark:bg-white/20 rounded-lg backdrop-blur-sm">
                      <span className="text-xs font-bold text-white">
                        {getRarityLabel(achievement.rarity)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text mb-2 line-through opacity-50">
                      {achievement.title}
                    </h3>
                    {achievement.description && (
                      <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4 leading-relaxed opacity-50">
                        {achievement.description}
                      </p>
                    )}
                    
                    {/* Reward */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/10 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary opacity-50">
                          {t.achievements.reward}
                        </span>
                        <span className="px-3 py-1 bg-gray-400 text-white rounded-lg text-sm font-bold opacity-50">
                          +{achievement.xp_reward} XP
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state if no achievements */}
      {achievements.length === 0 && (
        <div className="card p-12 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
            {t.achievements.noAchievements}
          </h3>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            {t.achievements.noAchievementsDesc}
          </p>
        </div>
      )}
    </div>
  )
}

