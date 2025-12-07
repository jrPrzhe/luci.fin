import { useEffect, useMemo, memo, useState } from 'react'

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
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check theme immediately on component mount
    return document.documentElement.classList.contains('dark')
  })

  // Check theme when modal opens and listen for theme changes
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    
    // Check immediately
    checkTheme()
    
    // Listen for theme changes
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // Сохраняем текущую позицию прокрутки
    const scrollY = window.scrollY
    const scrollX = window.scrollX
    
    // Сохраняем оригинальные стили для body и html
    const originalBodyOverflow = document.body.style.overflow
    const originalBodyPosition = document.body.style.position
    const originalBodyTop = document.body.style.top
    const originalBodyLeft = document.body.style.left
    const originalBodyWidth = document.body.style.width
    const originalBodyHeight = document.body.style.height
    const originalBodyTouchAction = document.body.style.touchAction
    
    const originalHtmlOverflow = document.documentElement.style.overflow
    const originalHtmlPosition = document.documentElement.style.position
    const originalHtmlTop = document.documentElement.style.top
    const originalHtmlLeft = document.documentElement.style.left
    const originalHtmlWidth = document.documentElement.style.width
    const originalHtmlHeight = document.documentElement.style.height
    const originalHtmlTouchAction = document.documentElement.style.touchAction
    
    // Применяем стили для предотвращения прокрутки на body и html
    const preventScrollStyles = {
      overflow: 'hidden',
      position: 'fixed',
      top: `-${scrollY}px`,
      left: `-${scrollX}px`,
      width: '100%',
      height: '100%',
      touchAction: 'none',
    }
    
    Object.assign(document.body.style, preventScrollStyles)
    Object.assign(document.documentElement.style, preventScrollStyles)
    
    // Предотвращаем события прокрутки с помощью обработчиков событий
    const preventWheel = (e: WheelEvent) => {
      // Разрешаем прокрутку только внутри модального контента
      const target = e.target as HTMLElement
      const modalContent = target.closest('.modal-content-scrollable')
      if (!modalContent) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }
    
    const preventTouchMove = (e: TouchEvent) => {
      // Разрешаем прокрутку только внутри модального контента
      const target = e.target as HTMLElement
      const modalContent = target.closest('.modal-content-scrollable')
      if (!modalContent) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }
    
    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement
      const modalContent = target.closest('.modal-content-scrollable')
      if (!modalContent && target !== document.body && target !== document.documentElement) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }
    
    // Добавляем обработчики событий с passive: false для возможности preventDefault
    document.addEventListener('wheel', preventWheel, { passive: false, capture: true })
    document.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true })
    document.addEventListener('scroll', preventScroll, { passive: false, capture: true })
    window.addEventListener('scroll', preventScroll, { passive: false, capture: true })
    
    return () => {
      // Удаляем обработчики событий
      document.removeEventListener('wheel', preventWheel, { capture: true } as EventListenerOptions)
      document.removeEventListener('touchmove', preventTouchMove, { capture: true } as EventListenerOptions)
      document.removeEventListener('scroll', preventScroll, { capture: true } as EventListenerOptions)
      window.removeEventListener('scroll', preventScroll, { capture: true } as EventListenerOptions)
      
      // Восстанавливаем оригинальные стили
      // Если стиль был пустым, удаляем свойство полностью
      if (originalBodyOverflow) {
        document.body.style.overflow = originalBodyOverflow
      } else {
        document.body.style.removeProperty('overflow')
      }
      if (originalBodyPosition) {
        document.body.style.position = originalBodyPosition
      } else {
        document.body.style.removeProperty('position')
      }
      if (originalBodyTop) {
        document.body.style.top = originalBodyTop
      } else {
        document.body.style.removeProperty('top')
      }
      if (originalBodyLeft) {
        document.body.style.left = originalBodyLeft
      } else {
        document.body.style.removeProperty('left')
      }
      if (originalBodyWidth) {
        document.body.style.width = originalBodyWidth
      } else {
        document.body.style.removeProperty('width')
      }
      if (originalBodyHeight) {
        document.body.style.height = originalBodyHeight
      } else {
        document.body.style.removeProperty('height')
      }
      if (originalBodyTouchAction) {
        document.body.style.touchAction = originalBodyTouchAction
      } else {
        document.body.style.removeProperty('touch-action')
      }
      
      if (originalHtmlOverflow) {
        document.documentElement.style.overflow = originalHtmlOverflow
      } else {
        document.documentElement.style.removeProperty('overflow')
      }
      if (originalHtmlPosition) {
        document.documentElement.style.position = originalHtmlPosition
      } else {
        document.documentElement.style.removeProperty('position')
      }
      if (originalHtmlTop) {
        document.documentElement.style.top = originalHtmlTop
      } else {
        document.documentElement.style.removeProperty('top')
      }
      if (originalHtmlLeft) {
        document.documentElement.style.left = originalHtmlLeft
      } else {
        document.documentElement.style.removeProperty('left')
      }
      if (originalHtmlWidth) {
        document.documentElement.style.width = originalHtmlWidth
      } else {
        document.documentElement.style.removeProperty('width')
      }
      if (originalHtmlHeight) {
        document.documentElement.style.height = originalHtmlHeight
      } else {
        document.documentElement.style.removeProperty('height')
      }
      if (originalHtmlTouchAction) {
        document.documentElement.style.touchAction = originalHtmlTouchAction
      } else {
        document.documentElement.style.removeProperty('touch-action')
      }
      
      // Восстанавливаем позицию прокрутки после того, как браузер пересчитает layout
      // Используем requestAnimationFrame для гарантии, что стили применены
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(scrollX, scrollY)
        })
      })
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
        className={`rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden relative z-[10000] ${
          isDarkMode ? 'bg-telegram-dark-surface' : 'bg-telegram-surface'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 md:p-5 border-b ${
          isDarkMode ? 'border-telegram-dark-border' : 'border-telegram-border'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-lg md:text-xl font-bold ${
              isDarkMode ? 'text-telegram-dark-text' : 'text-telegram-text'
            }`}>
              📊 Статистика
            </h2>
            <button
              onClick={onClose}
              className={`text-xl ${
                isDarkMode 
                  ? 'text-telegram-dark-textSecondary hover:text-telegram-dark-text' 
                  : 'text-telegram-textSecondary hover:text-telegram-text'
              }`}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-5 overflow-y-auto max-h-[calc(85vh-80px)] modal-content-scrollable">
          <div className="space-y-4 md:space-y-5">
            {/* Level Section */}
            <div className={`card p-4 border ${
              isDarkMode
                ? 'bg-gradient-to-br from-purple-600/20 via-blue-600/20 to-pink-600/20 border-purple-700/30'
                : 'bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-pink-500/10 border-purple-200/20'
            }`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex flex-col items-center justify-center shadow-lg">
                  <span className="text-2xl md:text-3xl font-bold text-white">{profile.level}</span>
                  <span className="text-xs md:text-sm text-white/90 font-medium">Уровень</span>
                </div>
                <div className="flex-1">
                  <h3 className={`text-base md:text-lg font-semibold mb-1 ${
                    isDarkMode ? 'text-telegram-dark-text' : 'text-telegram-text'
                  }`}>
                    Текущий уровень
                  </h3>
                  <p className={`text-xs md:text-sm ${
                    isDarkMode ? 'text-telegram-dark-textSecondary' : 'text-telegram-textSecondary'
                  }`}>
                    {currentLevelXP} / {nextLevelXP} XP
                  </p>
                </div>
              </div>
              
              <div className="mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${
                    isDarkMode ? 'text-telegram-dark-text' : 'text-telegram-text'
                  }`}>
                    Прогресс до уровня {profile.level + 1}
                  </span>
                  <span className={`text-xs ${
                    isDarkMode ? 'text-telegram-dark-textSecondary' : 'text-telegram-textSecondary'
                  }`}>
                    {xpNeeded} XP осталось
                  </span>
                </div>
                <div className={`h-3 rounded-full overflow-hidden ${
                  isDarkMode 
                    ? 'bg-gray-700/50 border border-gray-600/50' 
                    : 'bg-telegram-border'
                }`}>
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
                  <h3 className={`text-base md:text-lg font-semibold ${
                    isDarkMode ? 'text-telegram-dark-text' : 'text-telegram-text'
                  }`}>
                    Серия дней
                  </h3>
                  <p className={`text-xs md:text-sm ${
                    isDarkMode ? 'text-telegram-dark-textSecondary' : 'text-telegram-textSecondary'
                  }`}>
                    {streakInfo}
                  </p>
                </div>
              </div>
              <div className={`rounded-xl p-3 text-center ${
                isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/10'
              }`}>
                <div className={`text-3xl md:text-4xl font-bold mb-1 ${
                  isDarkMode ? 'text-orange-400' : 'text-orange-600'
                }`}>
                  {profile.streak_days}
                </div>
                <div className={`text-xs md:text-sm ${
                  isDarkMode ? 'text-telegram-dark-textSecondary' : 'text-telegram-textSecondary'
                }`}>
                  дней подряд
                </div>
              </div>
            </div>

            {/* Heart Section */}
            <div className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl md:text-3xl">❤️</span>
                <div>
                  <h3 className={`text-base md:text-lg font-semibold ${
                    isDarkMode ? 'text-telegram-dark-text' : 'text-telegram-text'
                  }`}>
                    Сердце Люси
                  </h3>
                  <p className={`text-xs md:text-sm ${
                    isDarkMode ? 'text-telegram-dark-textSecondary' : 'text-telegram-textSecondary'
                  }`}>
                    {heartCooldown}
                  </p>
                </div>
              </div>
              <div className={`rounded-xl p-3 ${
                isDarkMode ? 'bg-pink-500/20' : 'bg-pink-500/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${
                    isDarkMode ? 'text-telegram-dark-text' : 'text-telegram-text'
                  }`}>
                    Текущий уровень
                  </span>
                  <span className={`text-sm font-bold ${
                    isDarkMode ? 'text-pink-400' : 'text-pink-600'
                  }`}>
                    {profile.heart_level} / 100
                  </span>
                </div>
                <div className={`h-3 rounded-full overflow-hidden ${
                  isDarkMode ? 'bg-telegram-dark-border' : 'bg-telegram-border'
                }`}>
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
                <div className={`text-2xl md:text-3xl font-bold mb-1 ${
                  isDarkMode ? 'text-telegram-dark-text' : 'text-telegram-text'
                }`}>
                  {profile.total_xp_earned}
                </div>
                <div className={`text-xs md:text-sm ${
                  isDarkMode ? 'text-telegram-dark-textSecondary' : 'text-telegram-textSecondary'
                }`}>
                  Всего XP заработано
                </div>
              </div>
              <div className="card p-3 text-center">
                <div className={`text-2xl md:text-3xl font-bold mb-1 ${
                  isDarkMode ? 'text-telegram-dark-text' : 'text-telegram-text'
                }`}>
                  {profile.total_quests_completed}
                </div>
                <div className={`text-xs md:text-sm ${
                  isDarkMode ? 'text-telegram-dark-textSecondary' : 'text-telegram-textSecondary'
                }`}>
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

