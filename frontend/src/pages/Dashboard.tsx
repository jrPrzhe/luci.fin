import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { api } from '../services/api'
import { useI18n } from '../contexts/I18nContext'
import { AchievementModal } from '../components/AchievementModal'
import { LevelUpModal } from '../components/LevelUpModal'
import { UserStatsModal } from '../components/UserStatsModal'
import { useToast } from '../contexts/ToastContext'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useValentineTheme } from '../contexts/ValentineContext'
import { storageSync, default as storage, isTelegramWebApp } from '../utils/storage'

// Available colors and emojis for categories (same as Categories page)
const AVAILABLE_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4',
  '#FFEB3B', '#795548', '#607D8B', '#E91E63', '#3F51B5', '#009688',
  '#FF5722', '#8BC34A', '#FFC107', '#673AB7',
]

const AVAILABLE_EMOJIS = [
  '📦', '💰', '💸', '💵', '💳', '💴', '💶', '💷', '💎', '💍',
  '🍔', '🍕', '🍟', '🌮', '🌯', '🥗', '🍱', '🍜', '🍝', '🍛',
  '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
  '🛍️', '🛒', '🛏️', '🛋️', '🪑', '🚪', '🪟', '🪞', '🛁',
  '🎮', '🎯', '🎲', '🃏', '🀄', '🎴', '🎭', '🎨', '🖼️',
  '🏃', '🏃‍♂️', '🏃‍♀️', '🚶', '🚶‍♂️', '🚶‍♀️', '🧍', '🧍‍♂️', '🧍‍♀️', '🧎',
  '📚', '📖', '📗', '📘', '📙', '📕', '📓', '📔', '📒', '📃',
  '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿',
  '🏠', '🏡', '🏘️', '🏚️', '💒', '🗼', '🗽', '⛲', '⛺', '🌁',
  '🎁', '🎀', '🎃', '🎄', '🎅', '🎆', '🎇', '🎈',
]

// Add Category Form Component
function AddCategoryForm({
  transactionType,
  onCancel,
  onCreate,
  creating,
}: {
  transactionType: 'income' | 'expense'
  onCancel: () => void
  onCreate: (data: {
    name: string
    transaction_type: 'income' | 'expense' | 'both'
    icon: string
    color: string
    is_favorite: boolean
  }) => void
  creating: boolean
}) {
  const [formData, setFormData] = useState({
    name: '',
    transaction_type: transactionType as 'income' | 'expense' | 'both',
    icon: '📦',
    color: '#4CAF50',
    is_favorite: false,
  })
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
          Название категории <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="input w-full"
          placeholder="Введите название"
          maxLength={25}
          required
          disabled={creating}
          autoFocus
        />
        <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
          {formData.name.length}/25
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
          Иконка
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 border-telegram-border dark:border-telegram-dark-border hover:border-telegram-primary dark:hover:border-telegram-dark-primary transition-colors"
            style={{ backgroundColor: `${formData.color}20` }}
            disabled={creating}
          >
            {formData.icon}
          </button>
          {showEmojiPicker && (
            <div className="flex-1 max-h-32 overflow-y-auto border border-telegram-border dark:border-telegram-dark-border rounded-telegram p-2 grid grid-cols-8 gap-1">
              {AVAILABLE_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, icon: emoji })
                    setShowEmojiPicker(false)
                  }}
                  className="text-xl hover:scale-125 transition-transform p-1"
                  disabled={creating}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
          Цвет
        </label>
        <div className="grid grid-cols-8 gap-2">
          {AVAILABLE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, color })}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                formData.color === color
                  ? 'border-telegram-text dark:border-telegram-dark-text scale-110'
                  : 'border-telegram-border dark:border-telegram-dark-border hover:scale-110'
              }`}
              style={{ backgroundColor: color }}
              disabled={creating}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_favorite"
          checked={formData.is_favorite}
          onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
          className="w-4 h-4"
          disabled={creating}
        />
        <label htmlFor="is_favorite" className="text-sm text-telegram-text dark:text-telegram-dark-text">
          Добавить в избранное
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
          disabled={creating}
        >
          Отмена
        </button>
        <button
          type="submit"
          className="btn-primary flex-1 flex items-center justify-center gap-2"
          disabled={creating || !formData.name.trim()}
        >
          {creating ? (
            <>
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Создание...</span>
            </>
          ) : (
            'Создать'
          )}
        </button>
      </div>
    </form>
  )
}

interface Account {
  id: number
  name: string
  type: string
  currency: string
  balance: number
  is_active?: boolean
}

interface Category {
  id: number
  name: string
  icon?: string
  color?: string
  transaction_type: 'income' | 'expense' | 'both'
  is_favorite: boolean
}

export function Dashboard() {
  const { t, translateCategoryName } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { showError, showSuccess } = useToast()
  const { isEnabled: valentineEnabled } = useValentineTheme()
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [quickFormStep, setQuickFormStep] = useState<'category' | 'form'>('category')
  const [quickFormType, setQuickFormType] = useState<'income' | 'expense' | 'transfer' | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newAchievement, setNewAchievement] = useState<any>(null)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const descriptionInputRef = useRef<HTMLInputElement>(null)
  const formScrollContainerRef = useRef<HTMLDivElement>(null)

  // Helper function to format local datetime for datetime-local input
  const formatLocalDateTime = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Quick form state
  const [quickFormData, setQuickFormData] = useState({
    category_id: '',
    account_id: '',
    to_account_id: '',
    amount: '',
    description: '',
    goal_id: '',
    transaction_date: formatLocalDateTime(new Date()),
  })

  // Lock scroll when Quick Form Modal is open
  useEffect(() => {
    if (!showQuickForm) return

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
      
      // Восстанавливаем позицию прокрутки с помощью requestAnimationFrame для правильного рендеринга
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(scrollX, scrollY)
        })
      })
    }
  }, [showQuickForm])

  // Проверяем наличие токена перед запросами
  // ВАЖНО: Для Telegram мобильной версии токен загружается асинхронно
  const [hasToken, setHasToken] = useState(false)
  
  // Загружаем токен асинхронно для Telegram/VK
  useEffect(() => {
    let mounted = true
    
    const loadToken = async () => {
      // Сначала проверяем синхронно (для веба)
      let token = storageSync.getItem('token')
      
      // Если не нашли и это Telegram/VK, пробуем асинхронно
      if (!token && isTelegramWebApp()) {
        try {
          console.log('[Dashboard] Loading token asynchronously from Telegram Cloud Storage...')
          token = await storage.getItem('token')
          // Обновляем кэш для синхронного доступа
          if (token && mounted) {
            // Обновляем кэш через setItem для правильной синхронизации
            storageSync.setItem('token', token)
            console.log('[Dashboard] Token loaded and cached successfully')
          } else if (mounted) {
            console.log('[Dashboard] Token not found in Telegram Cloud Storage')
          }
        } catch (error) {
          console.warn('[Dashboard] Failed to load token asynchronously:', error)
        }
      }
      
      if (mounted) {
        const tokenExists = !!token
        setHasToken(tokenExists)
        if (tokenExists) {
          console.log('[Dashboard] Token available, enabling API requests')
        }
      }
    }
    
    // Загружаем токен сразу
    loadToken()
    
    // Также слушаем событие завершения авторизации
    const handleAuthCompleted = () => {
      if (mounted) {
        console.log('[Dashboard] Auth completed event received, reloading token...')
        loadToken()
      }
    }
    
    window.addEventListener('authCompleted', handleAuthCompleted)
    
    // Периодически проверяем токен (на случай, если он загрузится позже)
    // Максимум 10 проверок (5 секунд)
    let checkCount = 0
    const maxChecks = 10
    const interval = setInterval(() => {
      if (!hasToken && checkCount < maxChecks && mounted) {
        checkCount++
        loadToken()
      } else if (hasToken || checkCount >= maxChecks) {
        clearInterval(interval)
      }
    }, 500)
    
    return () => {
      mounted = false
      window.removeEventListener('authCompleted', handleAuthCompleted)
      clearInterval(interval)
    }
  }, []) // Пустой массив зависимостей - запускаем только один раз
  
  const { data: balance, isLoading: balanceLoading, isError: balanceError } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => {
      try {
        return await api.getBalance()
      } catch (error) {
        console.error('Error fetching balance:', error)
        return { total: 0, currency: 'RUB', accounts: [] }
      }
    },
    enabled: hasToken, // Запрос только если есть токен
    retry: 1,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: true, // ВАЖНО: для Telegram мобильной версии нужно загружать данные при монтировании
    gcTime: 300000, // 5 minutes - кэшируем для быстрого доступа
  })

  const { data: accounts, isLoading: accountsLoading, isError: accountsError } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      try {
        return await api.getAccounts()
      } catch (error) {
        console.error('Error fetching accounts:', error)
        return []
      }
    },
    enabled: hasToken, // Запрос только если есть токен
    retry: 1,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    refetchOnMount: true, // ВАЖНО: для Telegram мобильной версии нужно загружать данные при монтировании
    gcTime: 600000, // 10 minutes - кэшируем для быстрого доступа
  })

  const { data: recentTransactions, isLoading: transactionsLoading, isError: transactionsError } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      try {
        return await api.getTransactions(10)
      } catch (error) {
        console.error('Error fetching transactions:', error)
        return []
      }
    },
    enabled: hasToken, // Запрос только если есть токен
    retry: 1,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: true, // ВАЖНО: для Telegram мобильной версии нужно загружать данные при монтировании
    gcTime: 300000, // 5 minutes - кэшируем для быстрого доступа
  })

  // Получаем данные текущего пользователя для проверки премиум статуса
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.getCurrentUser(),
    enabled: hasToken, // Запрос только если есть токен
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true, // ВАЖНО: для Telegram мобильной версии нужно загружать данные при монтировании
    gcTime: 600000, // 10 minutes - кэшируем для быстрого доступа
  })

  // Получаем доходы и расходы за текущий месяц через аналитику (быстрее чем загрузка всех транзакций)
  const { data: monthlyStats, isLoading: monthlyStatsLoading, error: monthlyStatsError } = useQuery({
    queryKey: ['monthly-stats'],
    queryFn: async () => {
      try {
        console.log('[Dashboard] Fetching monthly stats...')
        const analytics = await api.getAnalytics('month')
        console.log('[Dashboard] Analytics response:', analytics)
        
        // API возвращает данные в формате { totals: { income, expense, ... } }
        const income = analytics?.totals?.income ?? analytics?.total_income ?? 0
        const expense = analytics?.totals?.expense ?? analytics?.total_expense ?? 0
        
        console.log('[Dashboard] Extracted values:', { 
          income, 
          expense, 
          incomeType: typeof income, 
          expenseType: typeof expense,
          totals: analytics?.totals 
        })
        
        // Преобразуем в числа, если это строки или другие типы
        const incomeNum = typeof income === 'number' ? income : (typeof income === 'string' ? parseFloat(income) : 0) || 0
        const expenseNum = typeof expense === 'number' ? expense : (typeof expense === 'string' ? parseFloat(expense) : 0) || 0
        
        console.log('[Dashboard] Final monthly stats:', { income: incomeNum, expense: expenseNum })
        
        return {
          income: incomeNum,
          expense: expenseNum
        }
      } catch (error) {
        console.error('[Dashboard] Error fetching monthly stats:', error)
        return { income: 0, expense: 0 }
      }
    },
    enabled: hasToken, // Запрос только если есть токен
    retry: 1,
    staleTime: 10000, // Уменьшено с 30 до 10 секунд для более частого обновления
    refetchOnWindowFocus: true, // Включено для обновления при возврате на вкладку
  })
  
  // Логируем ошибки загрузки статистики
  useEffect(() => {
    if (monthlyStatsError) {
      console.error('[Dashboard] Monthly stats query error:', monthlyStatsError)
    }
  }, [monthlyStatsError])

  // Получаем цели для выбора в форме дохода
  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.getGoals('active'),
    enabled: hasToken, // Запрос только если есть токен
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  // Получаем статус геймификации для прогресс-бара уровня
  const { data: gamificationStatus } = useQuery({
    queryKey: ['gamification-status'],
    queryFn: () => api.getGamificationStatus(),
    enabled: hasToken, // Запрос только если есть токен
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const loadCategories = async (transactionType: 'income' | 'expense'): Promise<void> => {
    console.log(`[loadCategories] Starting to load categories for ${transactionType}`)
    try {
      // Call API with Promise.race for timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          console.error('[loadCategories] Timeout after 8 seconds')
          reject(new Error(t.dashboard.form.retry))
        }, 8000)
      })
      
      // Call API: getCategories(transactionType?, favoritesOnly?, includeShared?)
      console.log(`[loadCategories] Calling API...`)
      const cats = await Promise.race([
        api.getCategories(transactionType, false, true),
        timeoutPromise
      ]) as any[]
      
      console.log(`[loadCategories] API response received:`, cats)
      
      // Ensure we have a valid array
      if (cats && Array.isArray(cats)) {
        console.log(`[loadCategories] Setting ${cats.length} categories`)
        setCategories(cats)
      } else {
        console.warn(`[loadCategories] Invalid response format:`, cats)
        setCategories([])
      }
      console.log(`[loadCategories] Successfully loaded categories`)
    } catch (err: any) {
      console.error('[loadCategories] Error loading categories:', err)
      showError(err.message || 'Ошибка загрузки категорий')
      setCategories([])
      throw err // Re-throw to handle in calling function
    }
  }

  const handleQuickAction = (type: 'income' | 'expense' | 'transfer') => {
    console.log(`[handleQuickAction] Starting for type: ${type}`)
    
    // Invalidate and refetch accounts to ensure we have the latest data
    queryClient.invalidateQueries({ queryKey: ['accounts'] })
    queryClient.refetchQueries({ queryKey: ['accounts'] })
    
    // Set form type and show modal immediately (synchronous operations)
    setQuickFormType(type)
    setShowQuickForm(true)
    setQuickFormStep(type === 'transfer' ? 'form' : 'category')
    
    // Reset categories and set loading state
    setCategories([])
    setCategoriesLoading(true)
    console.log(`[handleQuickAction] Set categoriesLoading = true`)
    
    // Reset form data
    // Filter active accounts only (use accounts directly from query)
    const accountsList = (accounts as Account[] || [])
    const activeAccounts = accountsList.filter(acc => acc.is_active !== false)
    
    // Load last selected account from localStorage
    let lastAccountId = ''
    try {
      const savedAccountId = localStorage.getItem('lastSelectedAccountId')
      if (savedAccountId) {
        // Verify that the saved account still exists and is active
        const savedAccount = activeAccounts.find(acc => acc.id.toString() === savedAccountId)
        if (savedAccount) {
          lastAccountId = savedAccountId
        }
      }
    } catch (e) {
      // Ignore localStorage errors (incognito mode, etc.)
      console.warn('Error loading last selected account:', e)
    }
    
    // Use last selected account if available, otherwise use first account
    const defaultAccountId = lastAccountId || (activeAccounts && activeAccounts.length > 0 ? activeAccounts[0].id.toString() : '')
    
    setQuickFormData({
      category_id: '',
      account_id: defaultAccountId,
      to_account_id: '',
      amount: '',
      description: '',
      goal_id: '',
      transaction_date: formatLocalDateTime(new Date()),
    })
    
    // Load categories asynchronously (non-blocking) for income/expense
    if (type === 'income' || type === 'expense') {
      // Use setTimeout to defer category loading, allowing modal to render first
      setTimeout(async () => {
        try {
          console.log(`[handleQuickAction] Loading categories for ${type}...`)
          await loadCategories(type)
          console.log(`[handleQuickAction] Categories loaded successfully`)
        } catch (err: any) {
          console.error('[handleQuickAction] Error loading categories:', err)
          showError(err.message || t.errors.networkError)
        } finally {
          // Always reset loading state
          console.log(`[handleQuickAction] Setting categoriesLoading = false`)
          setCategoriesLoading(false)
        }
      }, 0)
    } else {
      console.log(`[handleQuickAction] Transfer type, skipping categories`)
      setCategoriesLoading(false)
    }
    console.log(`[handleQuickAction] Completed`)
  }

  // Handle URL parameters for quick action (from quests)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const action = searchParams.get('action')
    
    if (action === 'expense' || action === 'income') {
      // Remove the query parameter from URL
      navigate(location.pathname, { replace: true })
      
      // Open the quick form modal (handleQuickAction handles accountsData internally)
      handleQuickAction(action as 'income' | 'expense')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, navigate, location.pathname])

  const handleCategorySelect = (categoryId: number) => {
    setQuickFormData({ ...quickFormData, category_id: categoryId.toString() })
    setQuickFormStep('form')
  }

  const handleCreateCategory = async (categoryData: {
    name: string
    transaction_type: 'income' | 'expense' | 'both'
    icon: string
    color: string
    is_favorite: boolean
  }) => {
    if (!categoryData.name.trim()) {
      showError('Название категории обязательно')
      return
    }

    const trimmedName = categoryData.name.trim()
    if (trimmedName.length > 25) {
      showError('Название категории не может превышать 25 символов')
      return
    }

    setCreatingCategory(true)
    try {
      const newCategory = await api.createCategory({
        ...categoryData,
        name: trimmedName
      })
      showSuccess('Категория создана')
      
      // Reload categories
      if (quickFormType === 'income' || quickFormType === 'expense') {
        await loadCategories(quickFormType)
      }
      
      // Close the add category form
      setShowAddCategoryForm(false)
      
      // Auto-select the newly created category
      if (newCategory && newCategory.id) {
        handleCategorySelect(newCategory.id)
      }
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
    } finally {
      setCreatingCategory(false)
    }
  }

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!quickFormData.account_id) {
      showError(t.dashboard.form.selectAccount)
      return
    }

    if (!quickFormData.amount || parseFloat(quickFormData.amount) <= 0) {
      showError(t.errors.required)
      return
    }

    // Validate amount: max 13 digits before decimal point (NUMERIC(15, 2) constraint)
    // Replace comma with dot for validation (Russian locale uses comma)
    const amountStr = quickFormData.amount.toString().replace(',', '.')
    const parts = amountStr.split('.')
    const integerPart = parts[0].replace(/[^0-9]/g, '') // Remove any non-digits
    if (integerPart.length > 13) {
      showError('Сумма слишком большая. Максимум 13 цифр перед запятой.')
      return
    }

    // Validate category for income/expense transactions
    if ((quickFormType === 'income' || quickFormType === 'expense') && !quickFormData.category_id) {
      showError(t.dashboard.form.selectCategory)
      return
    }

    if (quickFormType === 'transfer' && !quickFormData.to_account_id) {
      showError(t.dashboard.form.toAccount)
      return
    }

    setSubmitting(true)

    let submitData: any = null
    try {
      const account = (accountsData as Account[]).find(a => a.id === parseInt(quickFormData.account_id))
      if (!account) {
        showError(t.errors.notFound)
        setSubmitting(false)
        return
      }

      // Replace comma with dot for decimal separator (Russian locale uses comma)
      const amountValue = quickFormData.amount.toString().replace(',', '.')
      
      // Parse transaction_date from local datetime format (YYYY-MM-DDTHH:mm)
      const localDate = new Date(quickFormData.transaction_date)
      const transactionDateISO = localDate.toISOString()
      
      submitData = {
        account_id: parseInt(quickFormData.account_id),
        transaction_type: quickFormType,
        amount: parseFloat(amountValue),
        currency: account.currency,
        description: quickFormData.description || undefined,
        transaction_date: transactionDateISO,
      }

      // Add category_id for income/expense transactions (required)
      if (quickFormType === 'income' || quickFormType === 'expense') {
        const categoryId = quickFormData.category_id?.toString().trim()
        if (!categoryId || categoryId === '' || categoryId === '0') {
          console.error('[Dashboard] Category ID is missing:', { categoryId, quickFormData })
          showError(t.dashboard.form.selectCategory)
          setSubmitting(false)
          return
        }
        const parsedCategoryId = parseInt(categoryId)
        if (isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
          console.error('[Dashboard] Invalid category ID:', { categoryId, parsedCategoryId })
          showError(t.dashboard.form.selectCategory)
          setSubmitting(false)
          return
        }
        submitData.category_id = parsedCategoryId
        console.log('[Dashboard] Category ID added to transaction:', parsedCategoryId)
      }

      if (quickFormType === 'transfer') {
        submitData.to_account_id = parseInt(quickFormData.to_account_id)
      }

      // Add goal_id if specified (only for income transactions to add to goal)
      if (quickFormData.goal_id && quickFormType === 'income') {
        submitData.goal_id = parseInt(quickFormData.goal_id)
      }

      // Log transaction data before sending
      console.log('[Dashboard] Creating transaction with data:', submitData)
      
      // Create transaction
      const response = await api.createTransaction(submitData)
      
      // Save last selected account to localStorage
      try {
        localStorage.setItem('lastSelectedAccountId', quickFormData.account_id)
      } catch (e) {
        // Ignore localStorage errors (incognito mode, etc.)
        console.warn('Error saving last selected account:', e)
      }
      
      // Проверяем события геймификации
      if (response.gamification) {
        const gamification = response.gamification
        
        // Проверяем повышение уровня
        if (gamification.level_up && gamification.new_level) {
          setLevelUp(gamification.new_level)
        }
        
        // Проверяем новые достижения
        if (gamification.new_achievements && gamification.new_achievements.length > 0) {
          // Показываем первое достижение, остальные покажем после закрытия
          setNewAchievement(gamification.new_achievements[0])
        }
      }
      
      // Close form immediately (optimistic UI update)
      setShowQuickForm(false)
      setQuickFormType(null)
      setQuickFormStep('category')
      setQuickFormData({
        category_id: '',
        account_id: '',
        to_account_id: '',
        amount: '',
        description: '',
        goal_id: '',
        transaction_date: formatLocalDateTime(new Date()),
      })
      
      // Invalidate and immediately refetch critical data to ensure UI updates
      // Do this immediately without setTimeout to avoid delays
      try {
        // Invalidate all related queries first
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['balance'] }),
          queryClient.invalidateQueries({ queryKey: ['recent-transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['accounts'] }),
          queryClient.invalidateQueries({ queryKey: ['monthly-stats'] }),
          queryClient.invalidateQueries({ queryKey: ['goals'] }),
          queryClient.invalidateQueries({ queryKey: ['gamification-status'] }),
          queryClient.invalidateQueries({ queryKey: ['daily-quests'] }),
          queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false }),
          queryClient.invalidateQueries({ queryKey: ['biography'] }),
        ])
        
        console.log('[Dashboard] Cache invalidated after successful transaction creation')
        
        // Immediately refetch critical data to update UI
        await Promise.all([
          queryClient.refetchQueries({ 
            queryKey: ['balance'], 
            type: 'active'
          }),
          queryClient.refetchQueries({ 
            queryKey: ['recent-transactions'], 
            type: 'active'
          }),
          queryClient.refetchQueries({ 
            queryKey: ['monthly-stats'], 
            type: 'active'
          }),
          queryClient.refetchQueries({ 
            queryKey: ['goals'], 
            type: 'active'
          }),
        ])
        
        console.log('[Dashboard] Critical data refetched after transaction creation')
      } catch (refetchError) {
        console.error('[Dashboard] Error refetching data after transaction creation:', refetchError)
        // Don't block UI on refetch errors, but log them
      }
      
      showSuccess(t.dashboard.form.transactionAdded.replace('{type}', t.dashboard.quickActions[quickFormType || 'expense']))
      setSubmitting(false)
    } catch (err: any) {
      console.error('[Dashboard] Error creating transaction:', err)
      if (submitData) {
        console.error('[Dashboard] Transaction data:', submitData)
      }
      
      // Check if error is timeout and transaction might have been created
      const errorMessage = err?.message || String(err)
      const isTimeoutError = errorMessage.includes('Превышено время ожидания') || 
                            errorMessage.includes('timeout') ||
                            errorMessage.includes('Timeout')
      
      if (isTimeoutError) {
        // For timeout errors, check if transaction was actually created
        console.log('[Dashboard] Timeout error detected, checking for duplicate transaction...')
        try {
          // Reload recent transactions to check if the transaction was created
          const recentTransactions = await api.getTransactions(10)
          
          // Check if a transaction with matching data exists
          const duplicate = recentTransactions.find((t: any) => {
            const matches = 
              t.account_id === submitData.account_id &&
              t.transaction_type === submitData.transaction_type &&
              Math.abs(t.amount - submitData.amount) < 0.01 && // Allow small floating point differences
              t.currency === submitData.currency &&
              (!submitData.category_id || t.category_id === submitData.category_id) &&
              (!submitData.description || t.description === submitData.description)
            
            // Check if transaction was created in the last 30 seconds
            const transactionDate = new Date(t.transaction_date)
            const now = new Date()
            const timeDiff = (now.getTime() - transactionDate.getTime()) / 1000 // seconds
            return matches && timeDiff < 30
          })
          
          if (duplicate) {
            console.log('[Dashboard] Duplicate transaction found, transaction was created successfully:', duplicate)
            // Transaction was created, treat as success
            setShowQuickForm(false)
            setQuickFormType(null)
            setQuickFormStep('category')
            setQuickFormData({
              category_id: '',
              account_id: '',
              to_account_id: '',
              amount: '',
              description: '',
              goal_id: '',
              transaction_date: formatLocalDateTime(new Date()),
            })
            
            // Immediately invalidate and refetch data after duplicate transaction check
            try {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['balance'] }),
                queryClient.invalidateQueries({ queryKey: ['recent-transactions'] }),
                queryClient.invalidateQueries({ queryKey: ['accounts'] }),
                queryClient.invalidateQueries({ queryKey: ['monthly-stats'] }),
                queryClient.invalidateQueries({ queryKey: ['goals'] }),
                queryClient.invalidateQueries({ queryKey: ['gamification-status'] }),
                queryClient.invalidateQueries({ queryKey: ['daily-quests'] }),
                queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false }),
              ])
              
              // Refetch critical data immediately
              await Promise.all([
                queryClient.refetchQueries({ queryKey: ['balance'], type: 'active' }),
                queryClient.refetchQueries({ queryKey: ['recent-transactions'], type: 'active' }),
                queryClient.refetchQueries({ queryKey: ['monthly-stats'], type: 'active' }),
                queryClient.refetchQueries({ queryKey: ['goals'], type: 'active' }),
              ])
              
              console.log('[Dashboard] Cache invalidated and refetched after duplicate transaction check')
            } catch (refetchError) {
              console.error('[Dashboard] Error refetching data after duplicate check:', refetchError)
            }
            
            showSuccess(t.dashboard.form.transactionAdded.replace('{type}', t.dashboard.quickActions[quickFormType || 'expense']))
            setSubmitting(false)
            return
          }
        } catch (checkError) {
          console.error('[Dashboard] Error checking for duplicate transaction:', checkError)
          // If check fails, show original error
        }
      }
      
      const { translateError } = await import('../utils/errorMessages')
      const translatedErrorMessage = translateError(err)
      console.error('[Dashboard] Translated error:', translatedErrorMessage)
      showError(translatedErrorMessage)
      setSubmitting(false)
    }
  }

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'income': return t.dashboard.quickActions.income
      case 'expense': return t.dashboard.quickActions.expense
      case 'transfer': return t.dashboard.quickActions.transfer
      default: return type
    }
  }

  // Используем состояние для отслеживания таймаута загрузки
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  
  // Устанавливаем таймаут для загрузки - если загрузка длится больше 15 секунд, показываем контент
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (balanceLoading || accountsLoading || transactionsLoading) {
        console.warn('[Dashboard] Loading timeout - showing content with default values')
        setLoadingTimeout(true)
      }
    }, 15000) // 15 секунд таймаут
    
    return () => clearTimeout(timeoutId)
  }, [balanceLoading, accountsLoading, transactionsLoading])
  
  // Сбрасываем таймаут когда загрузка завершается
  useEffect(() => {
    if (!balanceLoading && !accountsLoading && !transactionsLoading) {
      setLoadingTimeout(false)
    }
  }, [balanceLoading, accountsLoading, transactionsLoading])

  // Очищаем кеш при ошибках таймаута, чтобы избежать проблем с кешем
  useEffect(() => {
    if (balanceError || accountsError || transactionsError) {
      console.warn('[Dashboard] Query error detected - clearing cache for failed queries')
      if (balanceError) {
        queryClient.removeQueries({ queryKey: ['balance'] })
      }
      if (accountsError) {
        queryClient.removeQueries({ queryKey: ['accounts'] })
      }
      if (transactionsError) {
        queryClient.removeQueries({ queryKey: ['recent-transactions'] })
      }
    }
  }, [balanceError, accountsError, transactionsError, queryClient])

  // Показываем общий LoadingSpinner при первой загрузке основных данных
  // НО только если нет ошибок и не истек таймаут
  // Это предотвращает бесконечную загрузку при проблемах с сетью
  // ВАЖНО: Не показываем загрузку, если токен еще не загружен (для Telegram мобильной версии)
  const isInitialLoading = hasToken && 
                           (balanceLoading || accountsLoading || transactionsLoading) && 
                           !loadingTimeout && 
                           !balanceError && 
                           !accountsError && 
                           !transactionsError

  if (isInitialLoading) {
    return <LoadingSpinner fullScreen={true} size="md" />
  }
  
  // Если токен еще не загружен, показываем загрузку токена
  if (!hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner fullScreen={false} size="md" />
      </div>
    )
  }

  // Обеспечиваем, что данные всегда доступны (даже при ошибках)
  // ВАЖНО: Проверяем, что balance - это объект, а не undefined/null
  const balanceData = (balance && typeof balance === 'object' && 'total' in balance) 
    ? balance 
    : { total: 0, currency: 'RUB', accounts: [] }
  // ВАЖНО: Проверяем, что accounts - это массив
  const accountsData = (Array.isArray(accounts)) ? accounts : []

  return (
    <div className="min-h-screen animate-fade-in w-full">
      {/* Header - скрыт на мобильных, так как есть в Layout */}
      <div className="mb-4 md:mb-6 hidden md:flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-1">
            {t.dashboard.title}
          </h1>
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            {t.dashboard.subtitle}
          </p>
        </div>
      </div>

      {/* Balance Card - Hero */}
      <div className={`card mb-4 md:mb-6 ${valentineEnabled ? 'valentine-balance-card' : 'bg-gradient-to-br from-telegram-primary dark:from-telegram-dark-primary to-telegram-primaryLight dark:to-telegram-dark-primaryLight'} text-white border-0 shadow-telegram-lg p-4 md:p-5 relative overflow-hidden`}>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {/* Premium Badge - перед "Общий баланс" */}
              {currentUser?.is_premium && (
                <div className="flex items-center gap-1.5 bg-yellow-400/20 backdrop-blur-sm border border-yellow-300/30 rounded-full px-2.5 py-1">
                  <span className="text-yellow-300 text-sm">⭐</span>
                  <span className="text-yellow-100 text-xs font-semibold">Премиум</span>
                </div>
              )}
              <p className="text-xs md:text-sm opacity-90">{t.dashboard.totalBalance}</p>
            </div>
            {balanceLoading && !loadingTimeout ? (
              <div className="h-8 md:h-10 w-24 md:w-32 bg-white/20 rounded-telegram animate-pulse"></div>
            ) : (
              <p className="text-2xl md:text-4xl font-bold break-all">
                {Math.round(balanceData.total || 0).toLocaleString('ru-RU')} {balanceData.currency || '₽'}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              if (gamificationStatus && gamificationStatus.profile) {
                setShowStatsModal(true)
              }
            }}
            className="w-12 h-12 md:w-16 md:h-16 ml-2 flex-shrink-0 relative cursor-pointer hover:scale-105 transition-transform active:scale-95 overflow-hidden"
            disabled={!gamificationStatus || !gamificationStatus.profile}
          >
            {gamificationStatus && gamificationStatus.profile ? (
              (() => {
                const profile = gamificationStatus.profile
                // ВАЖНО: Проверяем, что profile - это объект с нужными свойствами
                if (!profile || typeof profile !== 'object') {
                  return (
                    <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center text-xl md:text-2xl">
                      💰
                    </div>
                  )
                }
                const xp = typeof profile.xp === 'number' ? profile.xp : 0
                const xpToNextLevel = typeof profile.xp_to_next_level === 'number' ? profile.xp_to_next_level : 0
                const level = typeof profile.level === 'number' ? profile.level : 1
                const xpPercentage = xpToNextLevel > 0 
                  ? (xp / (xp + xpToNextLevel)) * 100 
                  : 100
                // Используем размер контейнера вместо фиксированного
                const size = 100 // 100% для адаптивности
                const strokeWidth = 8
                const radius = (size - strokeWidth) / 2
                const circumference = 2 * Math.PI * radius
                const offset = circumference - (xpPercentage / 100) * circumference
                return (
                  <div className="relative w-full h-full">
                    <svg
                      viewBox="0 0 100 100"
                      className="transform -rotate-90 w-full h-full"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {/* Фон внутри круга */}
                      <circle
                        cx="50"
                        cy="50"
                        r={radius - strokeWidth / 2}
                        fill="rgba(255, 255, 255, 0.15)"
                      />
                      {/* Background circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-white/30"
                      />
                      {/* Progress circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className="text-white transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm md:text-base font-bold text-white">
                        {level}
                      </span>
                      <span className="text-[8px] md:text-[10px] text-white/90 font-medium">
                        LVL
                      </span>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center text-xl md:text-2xl">
            💰
          </div>
            )}
          </button>
        </div>
        <div className="flex gap-2 md:gap-4 text-xs md:text-sm mb-3 md:mb-4">
          <div className="flex-1 bg-white/10 rounded-telegram p-2 md:p-3 backdrop-blur-sm">
            <p className="opacity-80 mb-1">{t.dashboard.income}</p>
            {monthlyStatsLoading ? (
              <div className="h-5 md:h-6 w-20 md:w-24 bg-white/20 rounded animate-pulse"></div>
            ) : (
              <p className="text-base md:text-lg font-semibold">
                {(() => {
                  const income = Math.round(monthlyStats?.income || 0)
                  return income === 0 
                    ? `${income.toLocaleString('ru-RU')} ${balanceData.currency || '₽'}`
                    : `+${income.toLocaleString('ru-RU')} ${balanceData.currency || '₽'}`
                })()}
              </p>
            )}
          </div>
          <div className="flex-1 bg-white/10 rounded-telegram p-2 md:p-3 backdrop-blur-sm">
            <p className="opacity-80 mb-1">{t.dashboard.expenses}</p>
            {monthlyStatsLoading ? (
              <div className="h-5 md:h-6 w-20 md:w-24 bg-white/20 rounded animate-pulse"></div>
            ) : (
              <p className="text-base md:text-lg font-semibold">
                {(() => {
                  // ВАЖНО: Проверяем, что monthlyStats - это объект
                  const monthlyStatsData = (monthlyStats && typeof monthlyStats === 'object' && 'expense' in monthlyStats) 
                    ? monthlyStats 
                    : { income: 0, expense: 0 }
                  const expense = Math.round(typeof monthlyStatsData.expense === 'number' ? monthlyStatsData.expense : 0)
                  const currency = (balanceData && typeof balanceData === 'object' && 'currency' in balanceData) 
                    ? balanceData.currency || '₽' 
                    : '₽'
                  return expense === 0 
                    ? `${expense.toLocaleString('ru-RU')} ${currency}`
                    : `-${expense.toLocaleString('ru-RU')} ${currency}`
                })()}
              </p>
            )}
          </div>
        </div>
        
        {/* Quick Actions - внутри блока баланса */}
        <div className="grid grid-cols-4 gap-2 md:gap-3 pt-2 md:pt-3 border-t border-white/20">
          <button 
            onClick={() => handleQuickAction('expense')}
            className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-3 rounded-telegram bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all group"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center text-lg md:text-xl group-active:bg-white/30 transition-colors">
              ➖
            </div>
            <span className="text-xs font-medium text-white/90">{t.dashboard.quickActions.expense}</span>
          </button>
          <button 
            onClick={() => handleQuickAction('income')}
            className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-3 rounded-telegram bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all group"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center text-lg md:text-xl group-active:bg-white/30 transition-colors">
              ➕
            </div>
            <span className="text-xs font-medium text-white/90">{t.dashboard.quickActions.income}</span>
          </button>
          <button 
            onClick={() => handleQuickAction('transfer')}
            className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-3 rounded-telegram bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all group"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center text-lg md:text-xl group-active:bg-white/30 transition-colors">
              🔄
            </div>
            <span className="text-xs font-medium text-white/90">{t.dashboard.quickActions.transfer}</span>
          </button>
          <button 
            onClick={() => navigate('/categories')}
            className="flex flex-col items-center gap-1 md:gap-1.5 p-2 md:p-3 rounded-telegram bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all group"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center text-lg md:text-xl group-active:bg-white/30 transition-colors">
              📦
            </div>
            <span className="text-xs font-medium text-white/90">{t.dashboard.quickActions.categories}</span>
          </button>
        </div>
      </div>

      {/* User Stats Card - скрыт, функциональность перенесена в баланс карту */}
      {/* <div className="mb-4 md:mb-6">
        <UserStatsCard />
      </div> */}

      {/* Achievement Modal */}
      {newAchievement && (
        <AchievementModal
          achievement={newAchievement}
          onClose={() => {
            setNewAchievement(null)
            // Можно добавить очередь для показа следующих достижений
          }}
        />
      )}

      {/* Level Up Modal */}
      {levelUp && (
        <LevelUpModal
          newLevel={levelUp}
          onClose={() => setLevelUp(null)}
        />
      )}

      {/* User Stats Modal */}
      {showStatsModal && gamificationStatus && (
        <UserStatsModal
          status={gamificationStatus}
          onClose={() => setShowStatsModal(false)}
        />
      )}

      {/* Quick Form Modal */}
      {showQuickForm && quickFormType && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4">
          <div className="card max-w-md sm:max-w-lg md:max-w-xl w-full max-h-[90vh] flex flex-col z-[10000]">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                {quickFormStep === 'category' && (
                  <button
                    onClick={() => {
                      if (showAddCategoryForm) {
                        setShowAddCategoryForm(false)
                      } else {
                      setShowQuickForm(false)
                      setQuickFormType(null)
                      setQuickFormStep('category')
                        setShowAddCategoryForm(false)
                      }
                    }}
                    className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-lg mr-2"
                  >
                    ←
                  </button>
                )}
                {quickFormStep === 'form' && quickFormType !== 'transfer' && (
                  <button
                    onClick={() => setQuickFormStep('category')}
                    className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-lg mr-2"
                  >
                    ←
                  </button>
                )}
                  <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
                  {quickFormStep === 'category' ? t.dashboard.form.selectCategory : getTransactionTypeLabel(quickFormType)}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowQuickForm(false)
                  setQuickFormType(null)
                  setQuickFormStep('category')
                  setShowAddCategoryForm(false)
                }}
                className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-xl"
              >
                ✕
              </button>
            </div>

            {/* Category Selection Step */}
            {quickFormStep === 'category' && quickFormType !== 'transfer' && (
              <div className="flex-1 overflow-y-auto min-h-0 modal-content-scrollable">
                {showAddCategoryForm ? (
                  <AddCategoryForm
                    transactionType={quickFormType}
                    onCancel={() => setShowAddCategoryForm(false)}
                    onCreate={handleCreateCategory}
                    creating={creatingCategory}
                  />
                ) : categoriesLoading ? (
                  <div className="text-center py-8">
                    <LoadingSpinner fullScreen={false} size="sm" />
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-4">
                      {t.dashboard.form.noCategories} {quickFormType === 'income' ? t.dashboard.incomeGenitive : t.dashboard.expensesGenitive}
                    </p>
                    <button
                      onClick={() => setShowAddCategoryForm(true)}
                      className="btn-primary flex items-center gap-2"
                    >
                      <span className="text-lg font-bold">➕</span>
                      <span>{t.dashboard.form.createCategory}</span>
                    </button>
                    <button
                      onClick={() => {
                        // Retry loading categories
                        if (quickFormType === 'income' || quickFormType === 'expense') {
                          loadCategories(quickFormType)
                        }
                      }}
                      className="btn-secondary mt-2"
                    >
                      {t.dashboard.form.retry}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      {t.dashboard.form.selectCategory} ({categories.length} {t.dashboard.form.available})
                    </p>
                      <button
                        onClick={() => setShowAddCategoryForm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-telegram-primary/15 dark:bg-telegram-dark-primary/20 text-telegram-primary dark:text-telegram-dark-primary hover:bg-telegram-primary/25 dark:hover:bg-telegram-dark-primary/30 border border-telegram-primary/30 dark:border-telegram-dark-primary/40 rounded-telegram transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                        title={t.dashboard.form.createCategory}
                      >
                        <span className="text-lg font-bold">➕</span>
                        <span className="hidden sm:inline">{t.dashboard.form.createCategory}</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 gap-2 sm:gap-3 max-h-[60vh] overflow-y-auto modal-content-scrollable">
                      {categories
                        .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0))
                        .map((category) => (
                          <button
                            key={category.id}
                            onClick={() => handleCategorySelect(category.id)}
                            className="card p-2 sm:p-4 text-left hover:shadow-lg transition-all active:scale-[0.98] min-w-0 overflow-hidden"
                            style={{
                              borderLeft: `4px solid ${category.color || '#4CAF50'}`,
                            }}
                          >
                            <div className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-0 w-full">
                              <div
                                className="w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-2xl flex-shrink-0"
                                style={{ backgroundColor: `${category.color || '#4CAF50'}20` }}
                              >
                                {category.icon || '📦'}
                              </div>
                              <span 
                                className="font-medium text-xs sm:text-sm text-telegram-text dark:text-telegram-dark-text text-center break-words overflow-wrap-anywhere w-full leading-tight"
                                style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                              >
                                {translateCategoryName(category.name)}
                              </span>
                              {category.is_favorite && (
                                <span className="text-xs text-yellow-500 flex-shrink-0">⭐</span>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Form Step */}
            {quickFormStep === 'form' && (
              <form onSubmit={handleQuickSubmit} className="flex flex-col flex-1 min-h-0">
                <div ref={formScrollContainerRef} className="space-y-3 flex-1 overflow-y-auto min-h-0 p-2 pb-20 modal-content-scrollable">
              {/* Show selected category - compact display */}
              {quickFormType !== 'transfer' && quickFormData.category_id && (
                <div className="bg-telegram-surface dark:bg-telegram-dark-surface p-2 rounded-telegram mb-2 flex items-center gap-2 min-w-0">
                  {(() => {
                    const selectedCategory = categories.find(c => c.id === parseInt(quickFormData.category_id))
                    return selectedCategory ? (
                      <>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                          style={{ backgroundColor: `${selectedCategory.color || '#4CAF50'}20` }}
                        >
                          {selectedCategory.icon || '📦'}
                        </div>
                        <span 
                          className="font-medium text-sm text-telegram-text dark:text-telegram-dark-text flex-1 min-w-0 break-words overflow-wrap-anywhere"
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        >
                          {selectedCategory.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickFormStep('category')
                            setQuickFormData({ ...quickFormData, category_id: '' })
                            // Don't reset transaction_date when changing category
                          }}
                          className="ml-auto text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text flex-shrink-0 whitespace-nowrap px-2 py-1"
                        >
                          {t.dashboard.form.change}
                        </button>
                      </>
                    ) : null
                  })()}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {quickFormType === 'transfer' ? t.dashboard.form.fromAccount : t.dashboard.form.account} <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <select
                    value={quickFormData.account_id}
                    onChange={(e) => setQuickFormData({ ...quickFormData, account_id: e.target.value })}
                    className="input text-sm py-2"
                    required
                    disabled={accountsLoading || submitting}
                  >
                    <option value="">{t.dashboard.form.selectAccount}</option>
                    {((accounts as Account[] || []).filter(acc => acc.is_active !== false)).map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({Math.round(account.balance).toLocaleString('ru-RU')} {account.currency})
                      </option>
                    ))}
                  </select>
                  {(!accounts || ((accounts as Account[]).filter(acc => acc.is_active !== false)).length === 0) && !accountsLoading && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                        💡 У вас пока нет счетов. Создайте счет, чтобы начать работу.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickForm(false)
                          navigate('/accounts')
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline font-medium"
                      >
                        ➕ Создать счет
                      </button>
                    </div>
                  )}
                </div>

                {quickFormType === 'transfer' ? (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                      {t.dashboard.form.toAccount} <span className="text-red-500 dark:text-red-400">*</span>
                    </label>
                    <select
                      value={quickFormData.to_account_id}
                      onChange={(e) => setQuickFormData({ ...quickFormData, to_account_id: e.target.value })}
                      className="input text-sm py-2"
                      required
                      disabled={accountsLoading || submitting}
                    >
                      <option value="">{t.dashboard.form.selectAccount}</option>
                      {((accounts as Account[] || [])
                        .filter(acc => acc.is_active !== false)
                        .filter(account => account.id !== parseInt(quickFormData.account_id || '0')))
                        .map(account => (
                          <option key={account.id} value={account.id}>
                            {account.name} ({Math.round(account.balance).toLocaleString('ru-RU')} {account.currency})
                          </option>
                        ))}
                    </select>
                    {(!accounts || (accounts as Account[]).length < 2) && !accountsLoading && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                          💡 {!accounts || (accounts as Account[]).length === 0 
                            ? t.dashboard.form.transferNoAccounts
                            : t.dashboard.form.transferMinAccounts}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickForm(false)
                            navigate('/accounts')
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline font-medium"
                        >
                          ➕ Создать счет
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {t.dashboard.form.amount} <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={quickFormData.amount}
                    onChange={(e) => {
                      // Allow both comma and dot as decimal separator
                      // Replace comma with dot for internal storage, but allow user to type comma
                      let value = e.target.value
                      // Replace comma with dot
                      value = value.replace(',', '.')
                      // Remove any non-numeric characters except dot
                      value = value.replace(/[^0-9.]/g, '')
                      // Ensure only one dot
                      const parts = value.split('.')
                      if (parts.length > 2) {
                        value = parts[0] + '.' + parts.slice(1).join('')
                      }
                      setQuickFormData({ ...quickFormData, amount: value })
                    }}
                    className="input text-lg font-semibold py-2"
                    placeholder="0"
                    required
                    autoFocus
                    disabled={submitting}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {t.dashboard.form.description}
                  </label>
                  <input
                    ref={descriptionInputRef}
                    type="text"
                    value={quickFormData.description}
                    onChange={(e) => setQuickFormData({ ...quickFormData, description: e.target.value })}
                    onFocus={(e) => {
                      // Scroll to description field when focused to prevent it from being hidden behind buttons
                      setTimeout(() => {
                        const input = e.target as HTMLInputElement
                        const container = formScrollContainerRef.current
                        if (input && container) {
                          const inputOffsetTop = input.offsetTop
                          const scrollPosition = inputOffsetTop - 20 // Add some padding
                          container.scrollTo({
                            top: scrollPosition,
                            behavior: 'smooth'
                          })
                        }
                      }, 100) // Small delay to ensure keyboard is shown
                    }}
                    className="input text-sm py-2"
                    placeholder={t.common.optional}
                    disabled={submitting}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {'Дата и время'} <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={quickFormData.transaction_date}
                    onChange={(e) => setQuickFormData({ ...quickFormData, transaction_date: e.target.value })}
                    className="input text-sm py-2"
                    max={formatLocalDateTime(new Date())}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              {quickFormType === 'income' && goals.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                    🎯 {t.dashboard.form.addToGoalOptional}
                  </label>
                  <select
                    value={quickFormData.goal_id}
                    onChange={(e) => setQuickFormData({ ...quickFormData, goal_id: e.target.value })}
                    className="input"
                    disabled={submitting}
                  >
                    <option value="">{t.dashboard.form.notAddToGoal}</option>
                    {goals.map((goal: any) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name} ({Math.round(goal.current_amount).toLocaleString()} / {Math.round(goal.target_amount).toLocaleString()} {goal.currency})
                      </option>
                    ))}
                  </select>
                  {quickFormData.goal_id && (
                    <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                      {t.dashboard.form.goalAmountNote}
                    </p>
                  )}
                </div>
              )}
                </div>
                
                <div className="flex gap-3 mt-4 pt-4 pb-2 border-t border-telegram-border dark:border-telegram-dark-border flex-shrink-0">
                  <button 
                    type="submit" 
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>{t.dashboard.form.processing}</span>
                      </>
                    ) : (
                      t.common.add
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickForm(false)
                      setQuickFormType(null)
                      setQuickFormStep('category')
                      setShowAddCategoryForm(false)
                      setSubmitting(false)
                    }}
                    className="btn-secondary"
                    disabled={submitting}
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card p-4 md:p-5">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-base md:text-lg font-semibold text-telegram-text dark:text-telegram-dark-text">
            {t.dashboard.recentTransactions}
          </h2>
          <button 
            onClick={() => navigate('/transactions')}
            className="text-xs md:text-sm text-telegram-primary dark:text-telegram-dark-primary active:underline"
          >
            {t.dashboard.viewAll}
          </button>
        </div>
        
        {transactionsLoading ? (
          <div className="space-y-2 md:space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-telegram bg-telegram-bg dark:bg-telegram-dark-bg animate-pulse">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-telegram-border dark:bg-telegram-dark-border flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="h-3 md:h-4 w-20 md:w-24 bg-telegram-border dark:bg-telegram-dark-border rounded mb-2"></div>
                  <div className="h-2 md:h-3 w-14 md:w-16 bg-telegram-border dark:bg-telegram-dark-border rounded"></div>
                </div>
                <div className="h-3 md:h-4 w-16 md:w-20 bg-telegram-border dark:bg-telegram-dark-border rounded flex-shrink-0"></div>
              </div>
            ))}
          </div>
        ) : (Array.isArray(recentTransactions) && recentTransactions.length > 0) ? (
          <div className="space-y-1 md:space-y-2">
            {recentTransactions
              .filter((transaction: any) => {
                // ВАЖНО: Проверяем, что transaction - это объект
                if (!transaction || typeof transaction !== 'object') {
                  return false
                }
                // Hide income transactions that are part of a transfer (they have parent_transaction_id)
                if (transaction.transaction_type === 'income' && transaction.parent_transaction_id) {
                  return false
                }
                // Also hide old transfer income transactions by description (for backward compatibility)
                if (transaction.transaction_type === 'income' && transaction.description) {
                  const descLower = transaction.description.toLowerCase().trim()
                  if (descLower.startsWith('перевод из')) {
                    return false
                  }
                }
                // ВАЖНО: Проверяем, что transaction имеет id
                if (!transaction.id) {
                  return false
                }
                return true
              })
              .map((transaction: any) => {
                const transactionType = transaction.transaction_type || 'expense'
                const categoryIcon = transaction.category_icon || ''
                const categoryName = transaction.category_name || ''
                const description = transaction.description || ''
                const transactionDate = transaction.transaction_date ? new Date(transaction.transaction_date) : new Date()
                const amount = typeof transaction.amount === 'number' ? transaction.amount : 0
                const currency = transaction.currency || '₽'
                
                return (
                  <div 
                    key={transaction.id} 
                    className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover active:bg-telegram-hover dark:active:bg-telegram-dark-hover transition-colors group"
                  >
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-base md:text-lg flex-shrink-0 ${
                      transactionType === 'income' 
                        ? 'bg-telegram-success/10' 
                        : transactionType === 'expense'
                        ? 'bg-telegram-danger/10'
                        : 'bg-telegram-primaryLight/20'
                    }`}>
                      {transactionType === 'income' ? '➕' : transactionType === 'expense' ? '➖' : '🔄'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {categoryIcon && (
                          <span className="text-base">{categoryIcon}</span>
                        )}
                        <p className="font-medium text-sm md:text-base text-telegram-text dark:text-telegram-dark-text truncate">
                          {categoryName || description || t.dashboard.form.category}
                        </p>
                      </div>
                      <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary truncate">
                        {transactionDate.toLocaleDateString('ru-RU')}
                        {description && categoryName && (
                          <span className="ml-2">• <span className="truncate">{description}</span></span>
                        )}
                      </p>
                    </div>
                    <p className={`font-semibold text-sm md:text-base whitespace-nowrap flex-shrink-0 ${
                      transactionType === 'income' 
                        ? 'text-telegram-success' 
                        : transactionType === 'expense'
                        ? 'text-telegram-danger'
                        : 'text-telegram-primary'
                    }`}>
                      {transactionType === 'income' ? '+' : transactionType === 'expense' ? '-' : '↔'}
                      {Math.round(amount).toLocaleString('ru-RU')} {currency}
                    </p>
                  </div>
                )
              })}
          </div>
        ) : (
          <div className="text-center py-8 md:py-12">
            <div className="text-4xl md:text-5xl mb-3 md:mb-4 opacity-30">💳</div>
            <p className="text-sm md:text-base text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-2">{t.dashboard.noTransactions}</p>
            <p className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary px-4">
              {t.dashboard.noTransactionsDesc}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

