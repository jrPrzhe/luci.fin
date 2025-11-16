import { useEffect } from 'react'

interface LevelUpModalProps {
  newLevel: number
  onClose: () => void
}

export function LevelUpModal({ newLevel, onClose }: LevelUpModalProps) {
  useEffect(() => {
    // Автоматически закрываем через 5 секунд
    const timer = setTimeout(() => {
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div 
      className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-3xl p-8 max-w-md w-full shadow-[0_0_40px_rgba(251,191,36,0.6)] transform transition-all duration-500 scale-100 hover:scale-105"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {/* Animated level number */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-40 h-40 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transform animate-pulse">
                <div className="text-8xl font-bold text-white drop-shadow-2xl">
                  {newLevel}
                </div>
              </div>
              {/* Sparkles */}
              <div className="absolute -top-2 -right-2 text-4xl animate-bounce">✨</div>
              <div className="absolute -bottom-2 -left-2 text-4xl animate-bounce" style={{ animationDelay: '0.2s' }}>⭐</div>
              <div className="absolute top-1/2 -left-4 text-3xl animate-bounce" style={{ animationDelay: '0.4s' }}>💫</div>
              <div className="absolute top-1/2 -right-4 text-3xl animate-bounce" style={{ animationDelay: '0.6s' }}>🌟</div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-4xl font-bold text-white text-center mb-4 drop-shadow-lg">
            🎉 Уровень повышен!
          </h2>

          {/* Level message */}
          <p className="text-2xl font-bold text-white text-center mb-6 drop-shadow-lg">
            Теперь ты на уровне {newLevel}!
          </p>

          {/* Congratulations message */}
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-6">
            <p className="text-white text-center text-lg font-semibold drop-shadow-md mb-2">
              Поздравляем! 🎊
            </p>
            <p className="text-white/90 text-center text-base drop-shadow-md">
              Ты становишься лучше с каждым днём!
            </p>
          </div>

          {/* Motivational message */}
          <p className="text-white/90 text-center text-lg font-semibold drop-shadow-md mb-6">
            Так держать! Продолжай в том же духе! 🚀
          </p>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold py-3 px-6 rounded-xl transition-all duration-300"
          >
            Продолжить
          </button>
        </div>
      </div>
    </div>
  )
}


