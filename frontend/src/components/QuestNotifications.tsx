import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'

interface QuestNotificationsProps {
  variant?: 'header' | 'dashboard'
}

export function QuestNotifications({ variant = 'header' }: QuestNotificationsProps) {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  const { data: quests, isLoading } = useQuery({
    queryKey: ['daily-quests'],
    queryFn: () => api.getDailyQuests(),
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  })

  const activeQuests = quests?.filter(q => q.status === 'pending') || []
  const activeCount = activeQuests.length

  // Check theme when modal opens to prevent flickering
  useEffect(() => {
    if (showModal) {
      const checkTheme = () => {
        setIsDarkMode(document.documentElement.classList.contains('dark'))
      }
      checkTheme()
      // Also listen for theme changes
      const observer = new MutationObserver(checkTheme)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })
      return () => observer.disconnect()
    }
  }, [showModal])

  const handleClick = () => {
    if (variant === 'header') {
      // Check theme immediately before opening modal
      setIsDarkMode(document.documentElement.classList.contains('dark'))
      setShowModal(true)
    } else {
      navigate('/quests')
    }
  }

  const getQuestIcon = (questType: string) => {
    switch (questType) {
      case 'record_expense': return '💸'
      case 'record_income': return '💰'
      case 'review_transactions': return '📊'
      case 'check_balance': return '💳'
      case 'ask_lucy': return '💬'
      case 'save_money': return '💎'
      default: return '📋'
    }
  }

  if (variant === 'header') {
    return (
      <>
        <button
          onClick={handleClick}
          className="btn-icon w-10 h-10 flex items-center justify-center bg-telegram-hover dark:bg-telegram-dark-hover hover:bg-telegram-border dark:hover:bg-telegram-dark-border relative"
          title="Уведомления по задачам"
        >
          <span className="text-xl">🎯</span>
          {!isLoading && activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-telegram-bg dark:border-telegram-dark-bg">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </button>

        {/* Modal для отображения квестов */}
        {showModal && (
          <div 
            className="fixed inset-0 bg-black/50 dark:bg-black/70 z-[9999] flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <div 
              className={`rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden relative z-[10000] ${
                isDarkMode ? 'bg-telegram-dark-surface' : 'bg-telegram-surface'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-telegram-border dark:border-telegram-dark-border flex items-center justify-between">
                <h2 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text">
                  🎯 Ежедневные задания
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-pulse text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      Загрузка заданий...
                    </div>
                  </div>
                ) : !quests || quests.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">📝</div>
                    <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary font-medium">
                      На сегодня заданий нет
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quests.map((quest) => (
                      <div
                        key={quest.id}
                        className={`p-3 rounded-xl border ${
                          quest.status === 'completed'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-telegram-bg dark:bg-telegram-dark-bg border-telegram-border dark:border-telegram-dark-border'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{getQuestIcon(quest.quest_type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className={`font-semibold text-sm ${
                                quest.status === 'completed'
                                  ? 'text-green-700 dark:text-green-400'
                                  : 'text-telegram-text dark:text-telegram-dark-text'
                              }`}>
                                {quest.title}
                              </h3>
                              <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                                +{quest.xp_reward} XP
                              </span>
                            </div>
                            {quest.description && (
                              <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-2">
                                {quest.description}
                              </p>
                            )}
                            {quest.status === 'pending' && (
                              <div className="mt-2">
                                <div className="h-2 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(quest.progress, 100)}%` }}
                                  />
                                </div>
                                <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                                  Прогресс: {quest.progress}%
                                </div>
                              </div>
                            )}
                            {quest.status === 'completed' && (
                              <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                                ✅ Выполнено
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-telegram-border dark:border-telegram-dark-border">
                <button
                  onClick={() => {
                    setShowModal(false)
                    navigate('/quests')
                  }}
                  className="w-full py-2 px-4 bg-telegram-primary dark:bg-telegram-dark-primary text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  Открыть все задания →
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Dashboard variant - кнопка с бейджем
  return (
    <button
      onClick={handleClick}
      className="relative inline-flex items-center justify-center p-2 rounded-xl bg-telegram-hover dark:bg-telegram-dark-hover hover:bg-telegram-border dark:hover:bg-telegram-dark-border transition-colors"
      title="Уведомления по задачам"
    >
      <span className="text-2xl">🎯</span>
      {!isLoading && activeCount > 0 && (
        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-telegram-surface dark:border-telegram-dark-surface">
          {activeCount > 9 ? '9+' : activeCount}
        </span>
      )}
    </button>
  )
}








