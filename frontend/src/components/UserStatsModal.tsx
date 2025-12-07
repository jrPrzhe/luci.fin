import { useEffect, useMemo, memo } from 'react'

interface UserStatsModalProps {
  status: {
    profile: {
      level: number
      xp: number
      xp_to_next_level: number
      streak_days: number
      heart_level: number
      total_xp_earned: number
      total_quests_completed: number
      last_entry_date: string | null
    }
    next_level_xp: number
  }
  onClose: () => void
}

export const UserStatsModal = memo(function UserStatsModal({ status, onClose }: UserStatsModalProps) {
  useEffect(() => {
    // Save current scroll position
    const scrollY = window.scrollY
    
    // Save original styles for body and html
    const originalBodyOverflow = document.body.style.overflow
    const originalBodyPosition = document.body.style.position
    const originalBodyTop = document.body.style.top
    const originalBodyWidth = document.body.style.width
    const originalBodyTouchAction = document.body.style.touchAction
    
    const originalHtmlOverflow = document.documentElement.style.overflow
    const originalHtmlPosition = document.documentElement.style.position
    const originalHtmlTop = document.documentElement.style.top
    const originalHtmlWidth = document.documentElement.style.width
    const originalHtmlTouchAction = document.documentElement.style.touchAction
    
    // Apply styles to prevent scrolling on both body and html
    const preventScrollStyles = {
      overflow: 'hidden',
      position: 'fixed',
      top: `-${scrollY}px`,
      width: '100%',
      touchAction: 'none',
    }
    
    Object.assign(document.body.style, preventScrollStyles)
    Object.assign(document.documentElement.style, preventScrollStyles)
    
    // Prevent scroll events with event listeners
    const preventDefault = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    
    const preventWheel = (e: WheelEvent) => {
      // Allow scrolling inside modal content
      const target = e.target as HTMLElement
      const modalContent = target.closest('.modal-content-scrollable')
      if (!modalContent) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }
    
    const preventTouchMove = (e: TouchEvent) => {
      // Allow scrolling inside modal content
      const target = e.target as HTMLElement
      const modalContent = target.closest('.modal-content-scrollable')
      if (!modalContent) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }
    
    // Add event listeners with passive: false to allow preventDefault
    document.addEventListener('wheel', preventWheel, { passive: false, capture: true })
    document.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true })
    document.addEventListener('scroll', preventDefault, { passive: false, capture: true })
    
    return () => {
      // Remove event listeners
      document.removeEventListener('wheel', preventWheel, { capture: true } as EventListenerOptions)
      document.removeEventListener('touchmove', preventTouchMove, { capture: true } as EventListenerOptions)
      document.removeEventListener('scroll', preventDefault, { capture: true } as EventListenerOptions)
      
      // Restore original styles
      document.body.style.overflow = originalBodyOverflow
      document.body.style.position = originalBodyPosition
      document.body.style.top = originalBodyTop
      document.body.style.width = originalBodyWidth
      document.body.style.touchAction = originalBodyTouchAction
      
      document.documentElement.style.overflow = originalHtmlOverflow
      document.documentElement.style.position = originalHtmlPosition
      document.documentElement.style.top = originalHtmlTop
      document.documentElement.style.width = originalHtmlWidth
      document.documentElement.style.touchAction = originalHtmlTouchAction
      
      // Restore scroll position
      window.scrollTo(0, scrollY)
    }
  }, [])

  // Мемоизируем вычисления для предотвращения лишних перерисовок
  const { profile, next_level_xp } = status
  
  const xpPercentage = useMemo(() => {
    return profile.xp_to_next_level > 0 
      ? (profile.xp / (profile.xp + profile.xp_to_next_level)) * 100 
      : 100
  }, [profile.xp, profile.xp_to_next_level])

  // Calculate heart cooldown (if heart_level < 100, show when it will regenerate)
  const heartCooldown = useMemo(() => {
    return profile.heart_level < 100 
      ? 'Сердце восстанавливается при выполнении заданий'
      : 'Сердце на максимуме! ❤️'
  }, [profile.heart_level])

  // Calculate next level info
  const currentLevelXP = profile.xp
  const nextLevelXP = next_level_xp
  const xpNeeded = profile.xp_to_next_level

  // Calculate streak info
  const streakInfo = useMemo(() => {
    return profile.streak_days > 0
      ? `Выполняйте задания каждый день, чтобы увеличить серию!`
      : 'Начните выполнять задания, чтобы создать серию!'
  }, [profile.streak_days])

  return (
    <div 
      className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-telegram-surface dark:bg-telegram-dark-surface rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden relative z-[10000]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-telegram-border dark:border-telegram-dark-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-telegram-text dark:text-telegram-dark-text">
              📊 Статистика
            </h2>
            <button
              onClick={onClose}
              className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-5 overflow-y-auto max-h-[calc(85vh-80px)] modal-content-scrollable">
          <div className="space-y-4 md:space-y-5">
            {/* Level Section */}
            <div className="card p-4 bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-pink-500/10 dark:from-purple-600/20 dark:via-blue-600/20 dark:to-pink-600/20 border border-purple-200/20 dark:border-purple-700/30">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex flex-col items-center justify-center shadow-lg">
                  <span className="text-2xl md:text-3xl font-bold text-white">{profile.level}</span>
                  <span className="text-xs md:text-sm text-white/90 font-medium">Уровень</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base md:text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-1">
                    Текущий уровень
                  </h3>
                  <p className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    {currentLevelXP} / {nextLevelXP} XP
                  </p>
                </div>
              </div>
              
              <div className="mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-telegram-text dark:text-telegram-dark-text">
                    Прогресс до уровня {profile.level + 1}
                  </span>
                  <span className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    {xpNeeded} XP осталось
                  </span>
                </div>
                <div className="h-3 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 shadow-md" 
                    style={{ width: `${xpPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Streak Section */}
            <div className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl md:text-3xl">🔥</span>
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Серия дней
                  </h3>
                  <p className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    {streakInfo}
                  </p>
                </div>
              </div>
              <div className="bg-orange-500/10 dark:bg-orange-500/20 rounded-xl p-3 text-center">
                <div className="text-3xl md:text-4xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                  {profile.streak_days}
                </div>
                <div className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  дней подряд
                </div>
              </div>
            </div>

            {/* Heart Section */}
            <div className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl md:text-3xl">❤️</span>
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                    Сердце Люси
                  </h3>
                  <p className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    {heartCooldown}
                  </p>
                </div>
              </div>
              <div className="bg-pink-500/10 dark:bg-pink-500/20 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-telegram-text dark:text-telegram-dark-text">
                    Текущий уровень
                  </span>
                  <span className="text-sm font-bold text-pink-600 dark:text-pink-400">
                    {profile.heart_level} / 100
                  </span>
                </div>
                <div className="h-3 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-500 to-red-500 rounded-full transition-all duration-500" 
                    style={{ width: `${profile.heart_level}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3 text-center">
                <div className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-1">
                  {profile.total_xp_earned}
                </div>
                <div className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  Всего XP заработано
                </div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-1">
                  {profile.total_quests_completed}
                </div>
                <div className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  Заданий выполнено
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

