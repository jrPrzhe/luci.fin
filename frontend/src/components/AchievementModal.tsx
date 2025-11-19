import { useEffect } from 'react'

interface AchievementModalProps {
  achievement: {
    id: number
    title: string
    description?: string
    icon?: string
    xp_reward: number
    rarity: string
  }
  onClose: () => void
}

export function AchievementModal({ achievement, onClose }: AchievementModalProps) {
  useEffect(() => {
    // Автоматически закрываем через 5 секунд
    const timer = setTimeout(() => {
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  const getRarityStyle = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return {
          gradient: 'from-yellow-400 via-orange-500 to-red-500',
          glow: 'shadow-[0_0_30px_rgba(251,191,36,0.5)]',
          text: 'text-yellow-400'
        }
      case 'epic':
        return {
          gradient: 'from-purple-400 via-pink-500 to-red-500',
          glow: 'shadow-[0_0_30px_rgba(168,85,247,0.5)]',
          text: 'text-purple-400'
        }
      case 'rare':
        return {
          gradient: 'from-blue-400 via-cyan-500 to-teal-500',
          glow: 'shadow-[0_0_25px_rgba(59,130,246,0.5)]',
          text: 'text-blue-400'
        }
      default:
        return {
          gradient: 'from-gray-400 to-gray-500',
          glow: 'shadow-[0_0_20px_rgba(156,163,175,0.3)]',
          text: 'text-gray-400'
        }
    }
  }

  const style = getRarityStyle(achievement.rarity)

  return (
    <div 
      className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className={`bg-gradient-to-br ${style.gradient} rounded-3xl p-8 max-w-md w-full ${style.glow} transform transition-all duration-500 scale-100 hover:scale-105`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti effect area */}
        <div className="relative">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`w-32 h-32 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-6xl transform animate-bounce`}>
              {achievement.icon || '🏆'}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-white text-center mb-3 drop-shadow-lg">
            🎉 Достижение разблокировано!
          </h2>

          {/* Achievement name */}
          <h3 className="text-2xl font-bold text-white text-center mb-4 drop-shadow-lg">
            {achievement.title}
          </h3>

          {/* Description */}
          {achievement.description && (
            <p className="text-white/90 text-center mb-6 text-lg drop-shadow-md">
              {achievement.description}
            </p>
          )}

          {/* Reward */}
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-6">
            <div className="text-center">
              <div className="text-sm text-white/80 mb-1">Награда</div>
              <div className="text-2xl font-bold text-white">
                +{achievement.xp_reward} XP
              </div>
            </div>
          </div>

          {/* Rarity badge */}
          <div className="text-center mb-4">
            <span className={`px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-bold text-white ${style.text}`}>
              {achievement.rarity === 'legendary' ? 'Легендарное' :
               achievement.rarity === 'epic' ? 'Эпическое' :
               achievement.rarity === 'rare' ? 'Редкое' : 'Обычное'}
            </span>
          </div>

          {/* Message */}
          <p className="text-white/90 text-center text-lg font-semibold drop-shadow-md">
            Так держать! 🚀
          </p>

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-6 w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
          >
            Продолжить
          </button>
        </div>
      </div>
    </div>
  )
}







