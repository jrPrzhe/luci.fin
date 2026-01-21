import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { UserStatsModal } from './UserStatsModal'
import { useI18n } from '../contexts/I18nContext'

export function UserStatsCard() {
  const { t } = useI18n()
  const [showModal, setShowModal] = useState(false)

  const { data: status, isLoading } = useQuery({
    queryKey: ['gamification-status'],
    queryFn: () => api.getGamificationStatus(),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowModal(false)
  }, [])

  // Мемоизируем статус для предотвращения лишних перерисовок модалки
  const memoizedStatus = useMemo(() => status, [status])

  if (isLoading) {
    return (
      <div className="card p-3 md:p-4 animate-pulse">
        <div className="flex items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-telegram-border dark:bg-telegram-dark-border"></div>
          <div className="w-6 h-6 rounded bg-telegram-border dark:bg-telegram-dark-border"></div>
        </div>
      </div>
    )
  }

  if (!status || !status.profile) {
    return null
  }

  const { profile } = status
  const xpPercentage = profile.xp_to_next_level > 0 
    ? (profile.xp / (profile.xp + profile.xp_to_next_level)) * 100 
    : 100

  // Размеры для кругового прогресс-бара
  const size = 64 // Размер SVG
  const strokeWidth = 6 // Толщина линии прогресса
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (xpPercentage / 100) * circumference

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="card p-3 md:p-4 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer w-full"
      >
        <div className="flex items-center justify-center gap-4">
          {/* Level Badge with Circular Progress */}
          <div className="relative flex-shrink-0">
            <svg
              width={size}
              height={size}
              className="transform -rotate-90"
            >
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-telegram-border dark:text-telegram-dark-border"
              />
              {/* Progress circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="url(#gradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="transition-all duration-500"
              />
              {/* Gradient definition */}
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            {/* Level number in center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl md:text-2xl font-bold text-telegram-text dark:text-telegram-dark-text">
                {profile.level}
                  </span>
              <span className="text-[10px] md:text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary font-medium">
                {t.goals.stats.level || 'Уровень'}
                </span>
            </div>
          </div>

        </div>
      </button>

      {/* Modal */}
      {showModal && memoizedStatus && (
        <UserStatsModal
          status={memoizedStatus}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}























