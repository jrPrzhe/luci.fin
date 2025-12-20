import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../services/api'
import { PremiumSubscriptionModal } from '../components/PremiumSubscriptionModal'
import { useI18n } from '../contexts/I18nContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface AnalyticsData {
  period: string
  totals: {
    income: number
    expense: number
    net: number
    currency: string
  }
  top_expense_categories: Array<{
    name: string
    icon: string
    amount: number
    color: string
  }>
  top_income_categories: Array<{
    name: string
    icon: string
    amount: number
    color: string
  }>
  daily_flow: Array<{
    date: string
    income: number
    expense: number
  }>
  monthly_comparison: Array<{
    month: string
    month_short: string
    income: number
    expense: number
    net: number
  }>
  facts: Array<{
    icon: string
    text: string
    type: 'stat' | 'positive' | 'warning' | 'info' | 'trend'
  }>
  transaction_count: number
  goals?: Array<{
    id: number
    name: string
    target_amount: number
    current_amount: number
    progress_percentage: number
    currency: string
    saved_in_period: number
    remaining: number
  }>
}

const COLORS = ['#3390EC', '#6CC3F2', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#FFC107', '#607D8B', '#E91E63']

// Маппинг английских названий месяцев на русские
const MONTH_MAPPING: Record<string, string> = {
  'Jan': 'Янв', 'Feb': 'Фев', 'Mar': 'Мар', 'Apr': 'Апр',
  'May': 'Май', 'Jun': 'Июн', 'Jul': 'Июл', 'Aug': 'Авг',
  'Sep': 'Сен', 'Oct': 'Окт', 'Nov': 'Ноя', 'Dec': 'Дек',
  'January': 'Январь', 'February': 'Февраль', 'March': 'Март', 'April': 'Апрель',
  'June': 'Июнь', 'July': 'Июль', 'August': 'Август',
  'September': 'Сентябрь', 'October': 'Октябрь', 'November': 'Ноябрь', 'December': 'Декабрь'
}

// Reverse mapping: Russian to English
const REVERSE_MONTH_MAPPING: Record<string, string> = {
  'Янв': 'Jan', 'Фев': 'Feb', 'Мар': 'Mar', 'Апр': 'Apr',
  'Май': 'May', 'Июн': 'Jun', 'Июл': 'Jul', 'Авг': 'Aug',
  'Сен': 'Sep', 'Окт': 'Oct', 'Ноя': 'Nov', 'Дек': 'Dec',
  'Январь': 'January', 'Февраль': 'February', 'Март': 'March', 'Апрель': 'April',
  'Июнь': 'June', 'Июль': 'July', 'Август': 'August',
  'Сентябрь': 'September', 'Октябрь': 'October', 'Ноябрь': 'November', 'Декабрь': 'December'
}

// Функция для локализации названия месяца (использует локаль из i18n)
const localizeMonth = (monthStr: string, language: 'ru' | 'en', currentLocale: string = 'en-US'): string => {
  if (!monthStr) return monthStr
  
  const trimmed = monthStr.trim()
  
  // Если локаль английская, переводим с русского на английский
  if (language === 'en' || currentLocale.startsWith('en')) {
    // Если уже на английском, возвращаем как есть
    if (!trimmed.match(/[А-Яа-я]/)) {
      return trimmed
    }
    
    // Переводим с русского на английский
    if (REVERSE_MONTH_MAPPING[trimmed]) {
      return REVERSE_MONTH_MAPPING[trimmed]
    }
    
    // Пробуем найти русский месяц в строке
    for (const [ruMonth, enMonth] of Object.entries(REVERSE_MONTH_MAPPING)) {
      if (trimmed.includes(ruMonth)) {
        return trimmed.replace(ruMonth, enMonth)
      }
    }
    
    // Если не нашли, возвращаем как есть
    return trimmed
  }
  
  // Для русской локали - переводим месяцы с английского на русский
  if (language === 'ru' || currentLocale.startsWith('ru')) {
    // Если уже на русском, возвращаем как есть
    if (trimmed.match(/[А-Яа-я]/)) {
      return trimmed
    }
    
    // Пробуем найти точное совпадение в маппинге
    if (MONTH_MAPPING[trimmed]) {
      return MONTH_MAPPING[trimmed]
    }
    
    // Пробуем найти месяц в строке
    const monthMatch = trimmed.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\b/i)
    if (monthMatch) {
      const englishMonth = monthMatch[1]
      const capitalized = englishMonth.charAt(0).toUpperCase() + englishMonth.slice(1).toLowerCase()
      if (MONTH_MAPPING[capitalized]) {
        return trimmed.replace(monthMatch[1], MONTH_MAPPING[capitalized])
      }
    }
    
    // Пробуем распарсить как дату
    try {
      const date = new Date(trimmed + ' 1, 2024')
      if (!isNaN(date.getTime())) {
        const localized = date.toLocaleDateString(currentLocale, { month: 'short' })
        return localized.replace(/\.$/, '')
      }
    } catch (e) {
      // Игнорируем ошибки
    }
  }
  
  // Если ничего не помогло, возвращаем как есть
  return trimmed
}

export function Reports() {
  const { t, language, translateCategoryName } = useI18n()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const locale = language === 'ru' ? 'ru-RU' : 'en-US'
  
  // Prefetch data when period changes (but don't invalidate - use cache if available)
  useEffect(() => {
    console.log(`[Reports] Period changed to: ${period}, prefetching if needed`)
    queryClient.prefetchQuery({
      queryKey: ['analytics', period],
      queryFn: () => api.getAnalytics(period),
      staleTime: 60000,
    })
  }, [period, queryClient])
  
  // Function to translate Interesting Facts texts
  const translateFactText = (text: string): string => {
    if (language === 'ru') return text
    
    // Pattern-based translations for common fact texts
    const factTranslations: Record<string, string> = {
      'Средний расход в день:': 'Average daily expense:',
      'Накопления:': 'Savings:',
      'от дохода': 'of income',
      'Расходы превышают доходы на': 'Expenses exceed income by',
      'Больше всего тратите на': 'You spend the most on',
      'Средний чек:': 'Average transaction:',
      'Расходы снизились на': 'Expenses decreased by',
      'Расходы выросли на': 'Expenses increased by',
      'по сравнению с предыдущим месяцем': 'compared to the previous month',
    }
    
    // Try to translate known patterns
    let translatedText = text
    for (const [ruPattern, enPattern] of Object.entries(factTranslations)) {
      if (translatedText.includes(ruPattern)) {
        translatedText = translatedText.replace(ruPattern, enPattern)
      }
    }
    
    // Translate category names in facts (pattern: "на CategoryName:")
    const categoryMatch = translatedText.match(/на ([^:]+):/)
    if (categoryMatch) {
      const categoryName = categoryMatch[1].trim()
      const translatedCategory = translateCategoryName(categoryName)
      translatedText = translatedText.replace(categoryName, translatedCategory)
    }
    
    return translatedText
  }
  
  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['analytics', period],
    queryFn: async () => {
      try {
        console.log(`[Reports] Fetching analytics for period: ${period}`)
        const data = await api.getAnalytics(period)
        console.log(`[Reports] Analytics data received:`, {
          income: data?.totals?.income,
          expense: data?.totals?.expense,
          net: data?.totals?.net,
          transaction_count: data?.transaction_count
        })
        // Validate response structure
        if (!data || typeof data !== 'object') {
          throw new Error(t.reports.error)
        }
        return data
      } catch (err: any) {
        // Log error for debugging
        console.error('Error fetching analytics:', err)
        throw err
      }
    },
    staleTime: 60000, // Cache for 1 minute - data is fresh for 1 minute
    refetchOnWindowFocus: false, // Don't refetch on window focus to improve performance
    refetchOnMount: false, // Use cached data if available
    refetchInterval: false, // Don't auto-refetch on interval
    retry: 1, // Retry once on failure
    gcTime: 300000, // Keep in cache for 5 minutes (formerly cacheTime)
  })

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.getCurrentUser(),
    staleTime: 300000, // 5 minutes
  })

  const sendReportMutation = useMutation({
    mutationFn: (format: 'pdf' | 'excel') => 
      api.sendReportViaBot(format, period),
    onSuccess: (data) => {
      setIsDownloading(false)
      alert(`✅ ${data.message}`)
    },
    onError: (error: any) => {
      setIsDownloading(false)
      const errorMessage = error.message || ''
      // Проверяем ошибку от бэкенда - если это 403 или сообщение о премиум, показываем модальное окно
      if (errorMessage.includes('премиум') || 
          errorMessage.includes('premium') ||
          errorMessage.includes('403') || 
          errorMessage.includes('Forbidden') ||
          (error.response && error.response.status === 403)) {
        setShowPremiumModal(true)
      } else {
        alert(`❌ ${t.reports.downloadError}: ${errorMessage || t.reports.downloadFailed}`)
      }
    },
  })

  const handleDownload = async (format: 'pdf' | 'excel' = 'pdf') => {
    setIsDownloading(true)
    
    try {
      // Проверяем, есть ли Telegram или VK ID
      if (user?.telegram_id || user?.vk_id) {
        // Отправляем через бота
        await sendReportMutation.mutateAsync(format)
      } else {
        // Скачиваем напрямую
        // Полагаемся на проверку премиум статуса на бэкенде
        const blob = await api.downloadPremiumReport(format, period)
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `financial_report_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        setIsDownloading(false)
        alert(`✅ ${t.reports.downloadSuccess}`)
      }
    } catch (error: any) {
      setIsDownloading(false)
      // Проверяем ошибку от бэкенда - если это 403 или сообщение о премиум, показываем модальное окно
      const errorMessage = error.message || ''
      if (errorMessage.includes('премиум') || 
          errorMessage.includes('premium') ||
          errorMessage.includes('403') || 
          errorMessage.includes('Forbidden') ||
          (error.response && error.response.status === 403)) {
        setShowPremiumModal(true)
      } else {
        alert(`❌ ${t.reports.downloadError}: ${errorMessage || t.reports.downloadFailed}`)
      }
    }
  }

  // All hooks must be called before any conditional returns
  // This is critical to avoid React error #310 (hooks order violation)
  
  const formatCurrency = useCallback((amount: number) => {
    const currency = analytics?.totals?.currency || 'RUB'
    const currentLocale = language === 'en' ? 'en-US' : 'ru-RU'
    return new Intl.NumberFormat(currentLocale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount || 0))
  }, [analytics?.totals?.currency, language])

  const formatDate = useCallback((dateString: string) => {
    try {
      if (!dateString) return ''
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString // Return original if invalid date
      const currentLocale = language === 'en' ? 'en-US' : 'ru-RU'
      if (period === 'week') {
        return date.toLocaleDateString(currentLocale, { weekday: 'short' })
      }
      return date.toLocaleDateString(currentLocale, { day: 'numeric', month: 'short' })
    } catch (error) {
      console.error('Error formatting date:', error)
      return dateString || ''
    }
  }, [period, language])

  // Memoize CustomTooltip to prevent re-renders and jittering
  // Create a stable component reference that only changes when locale changes
  const CustomTooltip = useMemo(() => {
    const TooltipComponent = ({ active, payload, label }: any) => {
      try {
        if (active && payload && Array.isArray(payload) && payload.length > 0) {
          const currency = analytics?.totals?.currency || 'RUB'
          const formatValue = (value: number) => {
            const currentLocale = language === 'en' ? 'en-US' : 'ru-RU'
            return new Intl.NumberFormat(currentLocale, {
              style: 'currency',
              currency: currency,
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(Math.round(value || 0))
          }
          return (
            <div className="bg-white dark:bg-telegram-dark-surface p-3 rounded-lg shadow-lg border border-telegram-border dark:border-telegram-dark-border pointer-events-none">
              <p className="font-semibold mb-2 text-telegram-text dark:text-telegram-dark-text">
                {label ? (() => {
                  const currentLocale = language === 'en' ? 'en-US' : 'ru-RU'
                  const labelStr = String(label)
                  // Если это дата, форматируем её согласно текущей локали
                  if (labelStr.match(/^\d{4}-\d{2}-\d{2}/)) {
                    try {
                      const date = new Date(labelStr)
                      if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString(currentLocale, { day: 'numeric', month: 'short' })
                      }
                    } catch (e) {}
                  }
                  return localizeMonth(labelStr, language, currentLocale)
                })() : ''}
              </p>
              {payload.map((entry: any, index: number) => (
                <p key={index} className="text-sm text-telegram-text dark:text-telegram-dark-text" style={{ color: entry.color || '#000' }}>
                  {entry.name || ''}: {formatValue(entry.value || 0)}
                </p>
              ))}
            </div>
          )
        }
        return null
      } catch (error) {
        console.error('Error rendering tooltip:', error)
        return null
      }
    }
    return TooltipComponent
  }, [locale, language, analytics?.totals?.currency])

  // Custom Tooltip for PieChart with dark theme support
  const PieChartTooltip = useMemo(() => {
    const TooltipComponent = ({ active, payload }: any) => {
      try {
        if (active && payload && Array.isArray(payload) && payload.length > 0) {
          const entry = payload[0]
          const currency = analytics?.totals?.currency || 'RUB'
          const formatValue = (value: number) => {
            const systemLocale = navigator.language || 'en-US'
            return new Intl.NumberFormat(systemLocale, {
              style: 'currency',
              currency: currency,
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(Math.round(value || 0))
          }
          return (
            <div className="bg-white dark:bg-telegram-dark-surface p-3 rounded-lg shadow-lg border border-telegram-border dark:border-telegram-dark-border pointer-events-none">
              <p className="text-sm font-semibold mb-1 text-telegram-text dark:text-telegram-dark-text">
                {entry.payload?.icon || ''} {entry.payload?.name || entry.name || ''}
              </p>
              <p className="text-sm text-telegram-text dark:text-telegram-dark-text">
                {formatValue(entry.value || 0)}
              </p>
            </div>
          )
        }
        return null
      } catch (error) {
        console.error('Error rendering pie chart tooltip:', error)
        return null
      }
    }
    return TooltipComponent
  }, [analytics?.totals?.currency])

  // Now we can do conditional returns after all hooks
  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="card p-6 text-center">
          <p className="text-red-500">{t.reports.error}</p>
        </div>
      </div>
    )
  }

  // Validate analytics data structure
  if (!analytics.totals || !analytics.daily_flow || !analytics.monthly_comparison || !analytics.top_expense_categories) {
    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="card p-6 text-center">
          <p className="text-red-500">Ошибка: неверный формат данных аналитики</p>
        </div>
      </div>
    )
  }

  // Prepare data for charts with safe defaults
  const dailyFlowData = (analytics.daily_flow || []).map(item => ({
    date: formatDate(item.date || ''),
    dateFull: item.date || '',
    [t.reports.income]: item.income || 0,
    [t.reports.expenses]: item.expense || 0,
  }))

  const monthlyData = (analytics.monthly_comparison || []).map(item => {
    // Форматируем месяц с использованием локали из i18n
    const currentLocale = language === 'en' ? 'en-US' : 'ru-RU'
    let monthLabel = item.month_short || ''
    if (monthLabel && !monthLabel.match(/[А-Яа-я]/)) {
      // Если месяц на английском, форматируем его согласно текущей локали
      try {
        const date = new Date(`2000-${monthLabel}-01`)
        if (!isNaN(date.getTime())) {
          monthLabel = date.toLocaleDateString(currentLocale, { month: 'short' })
        }
      } catch (e) {
        // Если не удалось, используем оригинальное значение
      }
    }
    // Ensure both income and expense are numbers, not null or undefined
    const incomeValue = typeof item.income === 'number' ? item.income : (parseFloat(item.income) || 0)
    const expenseValue = typeof item.expense === 'number' ? item.expense : (parseFloat(item.expense) || 0)
    return {
      month: localizeMonth(monthLabel, language, currentLocale),
      // Use static keys for data to avoid issues on mobile devices
      income: incomeValue,
      expense: expenseValue,
    }
  })

  const expensePieData = (analytics.top_expense_categories || []).slice(0, 5).map(cat => ({
    name: translateCategoryName(cat.name || 'Без названия'),
    value: cat.amount || 0,
    icon: cat.icon || '📦',
    color: cat.color || '#607D8B',
  }))

  return (
    <div className="min-h-screen p-4 md:p-6 animate-fade-in max-w-7xl mx-auto w-full">
      {showPremiumModal && (
        <PremiumSubscriptionModal onClose={() => setShowPremiumModal(false)} />
      )}
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-telegram-text dark:text-telegram-dark-text mb-4 md:mb-0">
          {t.reports.title}
        </h1>
        
        <div className="flex items-center gap-3">
          {/* Download Button - только для Premium пользователей */}
          {user?.is_premium && (
            <div className="relative group">
              <button
                onClick={() => handleDownload('pdf')}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2 bg-telegram-primary text-white rounded-lg font-medium hover:bg-telegram-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={t.reports.downloadReport}
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="hidden md:inline">{t.reports.downloading}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="hidden md:inline">{t.reports.download}</span>
                  </>
                )}
              </button>
              
              {/* Format dropdown - показываем при наведении на десктопе */}
              {!isDownloading && (
                <div className="absolute right-0 top-full mt-1 bg-telegram-surface dark:bg-telegram-dark-surface border border-telegram-border dark:border-telegram-dark-border rounded-lg shadow-lg overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                  <button
                    onClick={() => handleDownload('pdf')}
                    className="block w-full px-4 py-2 text-left text-sm text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover"
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={() => handleDownload('excel')}
                    className="block w-full px-4 py-2 text-left text-sm text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover"
                  >
                    📊 Excel
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Period Selector */}
          <div className="flex gap-2">
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-telegram text-sm font-medium transition-all ${
              period === 'week'
                ? 'bg-telegram-primary text-white'
                : 'bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
            }`}
          >
            {t.reports.week}
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-telegram text-sm font-medium transition-all ${
              period === 'month'
                ? 'bg-telegram-primary text-white'
                : 'bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
            }`}
          >
            {t.reports.month}
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-4 py-2 rounded-telegram text-sm font-medium transition-all ${
              period === 'year'
                ? 'bg-telegram-primary text-white'
                : 'bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
            }`}
          >
            {t.reports.year}
          </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-xl">💰</span>
            </div>
            <div>
              <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.reports.income}</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(analytics.totals?.income || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-xl">💸</span>
            </div>
            <div>
              <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.reports.expenses}</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(analytics.totals?.expense || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              (analytics.totals?.net || 0) >= 0 ? 'bg-blue-100' : 'bg-orange-100'
            }`}>
              <span className="text-xl">📊</span>
            </div>
            <div>
              <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.reports.total}</p>
              <p className={`text-xl font-bold ${
                (analytics.totals?.net || 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
              }`}>
                {formatCurrency(analytics.totals?.net || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Goals Section */}
      {analytics.goals && Array.isArray(analytics.goals) && analytics.goals.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4 flex items-center gap-2">
            <span>🎯</span> {t.reports.goalsProgress}
          </h2>
          <div className="space-y-4">
            {analytics.goals.map((goal) => {
              const progressColor = goal.progress_percentage >= 75 ? 'from-green-500 to-emerald-600' :
                                   goal.progress_percentage >= 50 ? 'from-blue-500 to-cyan-600' :
                                   goal.progress_percentage >= 25 ? 'from-yellow-500 to-orange-600' :
                                   'from-pink-500 to-rose-600'
              
              return (
                <div
                  key={goal.id}
                  className="bg-telegram-surface dark:bg-telegram-dark-surface border border-telegram-border dark:border-telegram-dark-border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-base font-bold text-telegram-text dark:text-telegram-dark-text mb-1">
                        {goal.name}
                      </h3>
                      <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        {t.reports.saved} {Math.round(goal.current_amount).toLocaleString()} / {Math.round(goal.target_amount).toLocaleString()} {goal.currency}
                      </p>
                    </div>
                    <span className="text-lg font-bold bg-gradient-to-r from-telegram-primary to-telegram-primaryLight bg-clip-text text-transparent">
                      {goal.progress_percentage}%
                    </span>
                  </div>
                  
                  <div className="relative h-4 bg-telegram-border dark:bg-telegram-dark-border rounded-full overflow-hidden mb-2">
                    <div
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r ${progressColor} transition-all duration-500 ease-out rounded-full`}
                      style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.reports.savedInPeriod}</span>
                      <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                        +{Math.round(goal.saved_in_period).toLocaleString()} {goal.currency}
                      </span>
                    </div>
                    <div>
                      <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.reports.remaining}</span>
                      <span className="ml-2 font-semibold text-telegram-text dark:text-telegram-dark-text">
                        {Math.round(goal.remaining).toLocaleString()} {goal.currency}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Interesting Facts */}
      {analytics.facts && Array.isArray(analytics.facts) && analytics.facts.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4 flex items-center gap-2">
            <span>💡</span> {t.reports.interestingFacts}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analytics.facts.map((fact, index) => (
              <div
                key={index}
                className={`p-4 rounded-telegram flex items-start gap-3 ${
                  fact.type === 'positive' 
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
                  fact.type === 'warning' 
                    ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800' :
                  fact.type === 'trend' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' :
                  'bg-telegram-surface dark:bg-telegram-dark-surface border border-telegram-border dark:border-telegram-dark-border'
                }`}
              >
                <span className="text-2xl">{fact.icon}</span>
                <p className={`text-sm flex-1 ${
                  fact.type === 'positive' 
                    ? 'text-green-900 dark:text-green-200' :
                  fact.type === 'warning' 
                    ? 'text-orange-900 dark:text-orange-200' :
                  fact.type === 'trend' 
                    ? 'text-blue-900 dark:text-blue-200' :
                  'text-telegram-text dark:text-telegram-dark-text'
                }`}>{translateFactText(fact.text)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Flow Chart */}
      {dailyFlowData && Array.isArray(dailyFlowData) && dailyFlowData.length > 0 && (
        <div className="card p-5 mb-6" style={{ overflow: 'visible' }}>
          <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
            {t.reports.dailyFlow}
          </h2>
          <div style={{ width: '100%', height: 300, overflow: 'visible', padding: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={dailyFlowData}
                margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" className="dark:stroke-telegram-dark-border" />
                <XAxis 
                  dataKey="date" 
                  stroke="#707579"
                  className="dark:stroke-telegram-dark-textSecondary"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#707579"
                  className="dark:stroke-telegram-dark-textSecondary"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={CustomTooltip} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey={t.reports.income} 
                  stroke="#4CAF50" 
                  strokeWidth={2}
                  dot={{ fill: '#4CAF50', r: 4 }}
                  activeDot={{ r: 8, stroke: '#4CAF50', strokeWidth: 2, fill: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey={t.reports.expenses} 
                  stroke="#F44336" 
                  strokeWidth={2}
                  dot={{ fill: '#F44336', r: 4 }}
                  activeDot={{ r: 8, stroke: '#F44336', strokeWidth: 2, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly Comparison */}
      {monthlyData && Array.isArray(monthlyData) && monthlyData.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
            {t.reports.monthlyComparison}
          </h2>
          <div className="w-full" style={{ minHeight: '300px', minWidth: '100%' }}>
            <ResponsiveContainer width="100%" height={period === 'year' ? 350 : 300} minHeight={300}>
              <BarChart 
                data={monthlyData} 
                margin={{ 
                  top: 30, 
                  right: 10, 
                  left: 10, 
                  bottom: period === 'year' ? 60 : 30 
                }}
                barCategoryGap="30%"
                barGap={10}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" className="dark:stroke-telegram-dark-border" />
                <XAxis 
                  dataKey="month" 
                  stroke="#707579"
                  className="dark:stroke-telegram-dark-textSecondary"
                  style={{ fontSize: '12px' }}
                  angle={period === 'year' ? -45 : 0}
                  textAnchor={period === 'year' ? 'end' : 'middle'}
                  height={period === 'year' ? 60 : 30}
                />
                <YAxis 
                  stroke="#707579"
                  className="dark:stroke-telegram-dark-textSecondary"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  width={50}
                />
                <Tooltip 
                  content={CustomTooltip}
                  cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                  animationDuration={0}
                  allowEscapeViewBox={{ x: false, y: false }}
                  wrapperStyle={{ pointerEvents: 'none' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px', paddingBottom: '10px' }}
                  iconSize={14}
                  fontSize={12}
                  verticalAlign="top"
                />
                <Bar 
                  dataKey="income" 
                  fill="#4CAF50" 
                  radius={[8, 8, 0, 0]}
                  name={t.reports.income}
                  isAnimationActive={false}
                />
                <Bar 
                  dataKey="expense" 
                  fill="#F44336" 
                  radius={[8, 8, 0, 0]}
                  name={t.reports.expenses}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Expense Categories */}
        {analytics.top_expense_categories && Array.isArray(analytics.top_expense_categories) && analytics.top_expense_categories.length > 0 && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              {t.reports.expenseCategories}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <Pie
                  data={expensePieData && Array.isArray(expensePieData) ? expensePieData : []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ icon, percent }) => 
                    `${icon} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={75}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(expensePieData && Array.isArray(expensePieData) ? expensePieData : []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  content={PieChartTooltip}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Category List */}
            <div className="mt-4 space-y-2">
              {(analytics.top_expense_categories && Array.isArray(analytics.top_expense_categories) ? analytics.top_expense_categories.slice(0, 5) : []).map((cat, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <span className="text-sm text-telegram-text dark:text-telegram-dark-text">{translateCategoryName(cat.name)}</span>
                  </div>
                  <span className="text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Expense Categories Bar Chart */}
        {analytics.top_expense_categories && Array.isArray(analytics.top_expense_categories) && analytics.top_expense_categories.length > 0 && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              {t.reports.topExpenseCategories}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={(analytics.top_expense_categories && Array.isArray(analytics.top_expense_categories) ? analytics.top_expense_categories.slice(0, 5) : []).map(cat => ({
                  name: (cat.icon || '📦') + ' ' + translateCategoryName(cat.name || 'Без названия'),
                  originalName: cat.name || 'Без названия',
                  amount: cat.amount || 0,
                  color: cat.color || '#607D8B',
                }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" className="dark:stroke-telegram-dark-border" />
                <XAxis 
                  type="number"
                  stroke="#707579"
                  className="dark:stroke-telegram-dark-textSecondary"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <YAxis 
                  type="category" 
                  dataKey="name"
                  stroke="#707579"
                  className="dark:stroke-telegram-dark-textSecondary"
                  style={{ fontSize: '12px' }}
                  width={150}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    try {
                      if (active && payload && Array.isArray(payload) && payload.length > 0) {
                        return (
                          <div className="bg-white dark:bg-telegram-dark-surface p-3 rounded-lg shadow-lg border border-telegram-border dark:border-telegram-dark-border">
                            {payload.map((entry: any, index: number) => {
                              // Extract category name from entry.name (format: "icon translatedName")
                              // entry.name already contains translated name, but we need to extract it without icon
                              const categoryName = entry.payload?.originalName 
                                ? translateCategoryName(entry.payload.originalName)
                                : (entry.name ? entry.name.replace(/^[^\s]+\s/, '') : (language === 'ru' ? 'Категория' : 'Category'))
                              return (
                                <p key={index} className="text-sm text-telegram-text dark:text-telegram-dark-text">
                                  <span className="font-semibold">{categoryName || 'Категория'}:</span>{' '}
                                  <span className="font-bold">{formatCurrency(entry.value || 0)}</span>
                                </p>
                              )
                            })}
                          </div>
                        )
                      }
                      return null
                    } catch (error) {
                      console.error('Error rendering tooltip:', error)
                      return null
                    }
                  }}
                />
                <Bar 
                  dataKey="amount" 
                  radius={[0, 8, 8, 0]}
                >
                  {(analytics.top_expense_categories && Array.isArray(analytics.top_expense_categories) ? analytics.top_expense_categories.slice(0, 5) : []).map((cat, index) => (
                    <Cell key={`cell-${index}`} fill={cat.color || COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
