import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../services/api'
import { useI18n } from '../contexts/I18nContext'

interface QuestNotificationsProps {
  variant?: 'header' | 'dashboard'
}

export function QuestNotifications({ variant = 'header' }: QuestNotificationsProps) {
  const { t, translateQuest } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [showModal, setShowModal] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Закрываем модальное окно при изменении маршрута
  useEffect(() => {
    if (showModal) {
      // Закрываем модальное окно синхронно, чтобы cleanup функция успела выполниться
      setShowModal(false)
    }
  }, [location.pathname, showModal])

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

  // Prevent scroll and close modal on tab switch when modal is open
  useEffect(() => {
    if (!showModal) return

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
      const modalContent = target.closest('[class*="overflow-y-auto"]')
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
      const modalContent = target.closest('[class*="overflow-y-auto"]')
      if (!modalContent) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }
    
    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement
      const modalContent = target.closest('[class*="overflow-y-auto"]')
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
    
    // Закрываем модалку при переключении вкладки
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setShowModal(false)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      // Удаляем обработчики событий
      document.removeEventListener('wheel', preventWheel, { capture: true } as EventListenerOptions)
      document.removeEventListener('touchmove', preventTouchMove, { capture: true } as EventListenerOptions)
      document.removeEventListener('scroll', preventScroll, { capture: true } as EventListenerOptions)
      window.removeEventListener('scroll', preventScroll, { capture: true } as EventListenerOptions)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      // Восстанавливаем оригинальные стили
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
        document.body.style.removeProperty('touchAction')
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
        document.documentElement.style.removeProperty('touchAction')
      }
      
      // Восстанавливаем позицию прокрутки
      window.scrollTo(scrollX, scrollY)
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
          title={t.quests.questNotifications}
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
            className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              zIndex: 50,
              overflow: 'auto'
            }}
          >
            <div 
              className={`rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden relative ${
                isDarkMode ? 'bg-telegram-dark-surface' : 'bg-telegram-surface'
              }`}
              onClick={(e) => e.stopPropagation()}
              style={{ 
                maxHeight: '85vh', 
                margin: 'auto',
                position: 'relative',
                zIndex: 51
              }}
            >
              <div className="p-4 border-b border-telegram-border dark:border-telegram-dark-border flex items-center justify-between">
                <h2 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text">
                  🎯 {t.quests.dailyQuests}
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
                      {t.quests.loadingQuests}
                    </div>
                  </div>
                ) : !quests || quests.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">📝</div>
                    <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary font-medium">
                      {t.quests.noQuestsToday}
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
                                {translateQuest(quest.title, quest.description).title}
                              </h3>
                              <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                                +{quest.xp_reward} XP
                              </span>
                            </div>
                            {quest.description && (
                              <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-2">
                                {translateQuest(quest.title, quest.description).description || quest.description}
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
                                  {t.quests.progress}: {quest.progress}%
                                </div>
                              </div>
                            )}
                            {quest.status === 'completed' && (
                              <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                                ✅ {t.quests.completedStatus}
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
                  {t.quests.openAllQuests}
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
      title={t.quests.questNotifications}
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








