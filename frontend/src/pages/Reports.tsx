import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
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

// Функция для локализации названия месяца (использует текущую локаль)
const localizeMonth = (monthStr: string, locale: string = 'ru-RU'): string => {
  if (!monthStr) return monthStr
  
  // Если локаль английская, возвращаем как есть (месяцы уже на английском)
  if (locale === 'en-US') {
    return monthStr
  }
  
  // Для русской локали - переводим месяцы
  if (locale === 'ru-RU') {
    // Если уже на русском, возвращаем как есть
    if (monthStr.match(/[А-Яа-я]/)) {
      return monthStr
    }
    
    // Убираем лишние пробелы
    const trimmed = monthStr.trim()
    
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
        const localized = date.toLocaleDateString('ru-RU', { month: 'short' })
        return localized.replace(/\.$/, '')
      }
    } catch (e) {
      // Игнорируем ошибки
    }
  }
  
  // Если ничего не помогло, возвращаем как есть
  return monthStr
}

export function Reports() {
  const { t, language } = useI18n()
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const locale = language === 'ru' ? 'ru-RU' : 'en-US'
  
  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['analytics', period],
    queryFn: () => api.getAnalytics(period),
    staleTime: 0, // Always consider data stale to allow immediate updates
    refetchOnWindowFocus: false,
    refetchOnMount: 'always', // Always refetch when component mounts
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
          errorMessage.includes('403') || 
          errorMessage.includes('Forbidden') ||
          (error.response && error.response.status === 403)) {
        setShowPremiumModal(true)
      } else {
        alert(`❌ Ошибка: ${errorMessage || 'Не удалось отправить отчет'}`)
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
        alert('✅ Отчет успешно скачан')
      }
    } catch (error: any) {
      setIsDownloading(false)
      // Проверяем ошибку от бэкенда - если это 403 или сообщение о премиум, показываем модальное окно
      const errorMessage = error.message || ''
      if (errorMessage.includes('премиум') || 
          errorMessage.includes('403') || 
          errorMessage.includes('Forbidden') ||
          (error.response && error.response.status === 403)) {
        setShowPremiumModal(true)
      } else {
        alert(`❌ Ошибка: ${errorMessage || 'Не удалось скачать отчет'}`)
      }
    }
  }

  const formatCurrency = (amount: number) => {
    const currency = analytics?.totals.currency || 'RUB'
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (period === 'week') {
      return date.toLocaleDateString('ru-RU', { weekday: 'short' })
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

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

  // Prepare data for charts
  const dailyFlowData = analytics.daily_flow.map(item => ({
    date: formatDate(item.date),
    dateFull: item.date,
    [t.reports.income]: item.income,
    [t.reports.expenses]: item.expense,
  }))

  const monthlyData = analytics.monthly_comparison.map(item => ({
    month: localizeMonth(item.month_short, locale),
    [t.reports.income]: item.income,
    [t.reports.expenses]: item.expense,
  }))

  const expensePieData = analytics.top_expense_categories.slice(0, 5).map(cat => ({
    name: cat.name,
    value: cat.amount,
    icon: cat.icon,
    color: cat.color,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-telegram-dark-surface p-3 rounded-lg shadow-lg border border-telegram-border dark:border-telegram-dark-border">
          <p className="font-semibold mb-2 text-telegram-text dark:text-telegram-dark-text">{localizeMonth(label, locale)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm text-telegram-text dark:text-telegram-dark-text" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

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
                {formatCurrency(analytics.totals.income)}
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
                {formatCurrency(analytics.totals.expense)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              analytics.totals.net >= 0 ? 'bg-blue-100' : 'bg-orange-100'
            }`}>
              <span className="text-xl">📊</span>
            </div>
            <div>
              <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.reports.total}</p>
              <p className={`text-xl font-bold ${
                analytics.totals.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'
              }`}>
                {formatCurrency(analytics.totals.net)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Goals Section */}
      {analytics.goals && analytics.goals.length > 0 && (
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
                        Накоплено: {Math.round(goal.current_amount).toLocaleString()} / {Math.round(goal.target_amount).toLocaleString()} {goal.currency}
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
      {analytics.facts.length > 0 && (
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
                }`}>{fact.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Flow Chart */}
      {dailyFlowData.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
            {t.reports.dailyFlow}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyFlowData}>
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
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={t.reports.income} 
                stroke="#4CAF50" 
                strokeWidth={2}
                dot={{ fill: '#4CAF50', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey={t.reports.expenses} 
                stroke="#F44336" 
                strokeWidth={2}
                dot={{ fill: '#F44336', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly Comparison */}
      {monthlyData.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
            {t.reports.monthlyComparison}
          </h2>
          <ResponsiveContainer width="100%" height={period === 'year' ? 350 : 300}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: period === 'year' ? 60 : 20 }}>
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
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey={t.reports.income} fill="#4CAF50" radius={[8, 8, 0, 0]} />
              <Bar dataKey={t.reports.expenses} fill="#F44336" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Expense Categories */}
        {analytics.top_expense_categories.length > 0 && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              {t.reports.expenseCategories}
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={expensePieData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  label={({ icon, percent }) => 
                    `${icon} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expensePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E5E5', backgroundColor: 'var(--tw-telegram-surface, white)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Category List */}
            <div className="mt-4 space-y-2">
              {analytics.top_expense_categories.slice(0, 5).map((cat, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-telegram hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <span className="text-sm text-telegram-text dark:text-telegram-dark-text">{cat.name}</span>
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
        {analytics.top_expense_categories.length > 0 && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              {t.reports.topExpenseCategories}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart 
                data={analytics.top_expense_categories.slice(0, 5).map(cat => ({
                  name: cat.icon + ' ' + cat.name,
                  amount: cat.amount,
                  color: cat.color,
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
                  width={120}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-telegram-dark-surface p-3 rounded-lg shadow-lg border border-telegram-border dark:border-telegram-dark-border">
                          {payload.map((entry: any, index: number) => (
                            <p key={index} className="text-sm text-telegram-text dark:text-telegram-dark-text">
                              <span className="font-semibold">{entry.name || 'Категория'}:</span>{' '}
                              <span className="font-bold">{formatCurrency(entry.value)}</span>
                            </p>
                          ))}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar 
                  dataKey="amount" 
                  radius={[0, 8, 8, 0]}
                >
                  {analytics.top_expense_categories.slice(0, 5).map((cat, index) => (
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
