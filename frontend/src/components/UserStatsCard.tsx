import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { UserStatsModal } from './UserStatsModal'

export function UserStatsCard() {
  const [showModal, setShowModal] = useState(false)

  const { data: status, isLoading } = useQuery({
    queryKey: ['gamification-status'],
    queryFn: () => api.getGamificationStatus(),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  })

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowModal(false)
  }, [])

  if (isLoading) {
    return (
      <div className="card p-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-telegram-border dark:bg-telegram-dark-border"></div>
          <div className="flex-1">
            <div className="h-4 bg-telegram-border dark:bg-telegram-dark-border rounded w-20 mb-2"></div>
            <div className="h-3 bg-telegram-border dark:bg-telegram-dark-border rounded w-32"></div>
          </div>
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

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="card p-3 md:p-4 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer w-full text-left"
      >
        <div className="flex items-center gap-3 md:gap-4">
          {/* Level Badge */}
          <div className="flex-shrink-0">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex flex-col items-center justify-center shadow-md">
              <span className="text-lg md:text-xl font-bold text-white">{profile.level}</span>
              <span className="text-[8px] md:text-[10px] text-white/90 font-medium">LVL</span>
            </div>
          </div>

          {/* Stats Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 md:gap-4 mb-2">
              {/* Streak */}
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-lg md:text-xl">🔥</span>
                <div className="flex flex-col">
                  <span className="text-sm md:text-base font-bold text-orange-600 dark:text-orange-400">
                    {profile.streak_days}
                  </span>
                  <span className="text-[10px] md:text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    дней
                  </span>
                </div>
              </div>

              {/* Hearts */}
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-lg md:text-xl">❤️</span>
                <div className="flex flex-col">
                  <span className="text-sm md:text-base font-bold text-pink-600 dark:text-pink-400">
                    {profile.heart_level}
                  </span>
                  <span className="text-[10px] md:text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    /100
                  </span>
                </div>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] md:text-xs font-medium text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {profile.xp} XP
                </span>
                <span className="text-[10px] md:text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                  {profile.xp_to_next_level} до {profile.level + 1}
                </span>
              </div>
              <div className="h-1.5 md:h-2 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500" 
                  style={{ width: `${xpPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex-shrink-0 text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            →
          </div>
        </div>
      </button>

      {/* Modal */}
      {showModal && status && (
        <UserStatsModal
          status={status}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}







