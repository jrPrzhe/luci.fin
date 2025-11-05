import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../services/api'

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

export function Reports() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  
  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['analytics', period],
    queryFn: () => api.getAnalytics(period),
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  })

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
    return (
      <div className="min-h-screen p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary mb-4"></div>
          <p className="text-telegram-textSecondary">Загрузка аналитики...</p>
        </div>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="card p-6 text-center">
          <p className="text-red-500">Ошибка загрузки данных</p>
        </div>
      </div>
    )
  }

  // Prepare data for charts
  const dailyFlowData = analytics.daily_flow.map(item => ({
    date: formatDate(item.date),
    dateFull: item.date,
    Доходы: item.income,
    Расходы: item.expense,
  }))

  const monthlyData = analytics.monthly_comparison.map(item => ({
    month: item.month_short,
    Доходы: item.income,
    Расходы: item.expense,
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
        <div className="bg-white p-3 rounded-lg shadow-lg border border-telegram-border">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-telegram-text mb-4 md:mb-0">
          Финансовая аналитика
        </h1>
        
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
            Неделя
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-telegram text-sm font-medium transition-all ${
              period === 'month'
                ? 'bg-telegram-primary text-white'
                : 'bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
            }`}
          >
            Месяц
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-4 py-2 rounded-telegram text-sm font-medium transition-all ${
              period === 'year'
                ? 'bg-telegram-primary text-white'
                : 'bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
            }`}
          >
            Год
          </button>
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
              <p className="text-sm text-telegram-textSecondary">Доходы</p>
              <p className="text-xl font-bold text-green-600">
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
              <p className="text-sm text-telegram-textSecondary">Расходы</p>
              <p className="text-xl font-bold text-red-600">
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
              <p className="text-sm text-telegram-textSecondary">Итого</p>
              <p className={`text-xl font-bold ${
                analytics.totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'
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
          <h2 className="text-lg font-semibold text-telegram-text mb-4 flex items-center gap-2">
            <span>🎯</span> Прогресс по целям
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
                      <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">За период:</span>
                      <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                        +{Math.round(goal.saved_in_period).toLocaleString()} {goal.currency}
                      </span>
                    </div>
                    <div>
                      <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">Осталось:</span>
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
          <h2 className="text-lg font-semibold text-telegram-text mb-4 flex items-center gap-2">
            <span>💡</span> Интересные факты
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analytics.facts.map((fact, index) => (
              <div
                key={index}
                className={`p-4 rounded-telegram flex items-start gap-3 ${
                  fact.type === 'positive' ? 'bg-green-50 border border-green-200' :
                  fact.type === 'warning' ? 'bg-orange-50 border border-orange-200' :
                  fact.type === 'trend' ? 'bg-blue-50 border border-blue-200' :
                  'bg-telegram-surface border border-telegram-border'
                }`}
              >
                <span className="text-2xl">{fact.icon}</span>
                <p className="text-sm text-telegram-text flex-1">{fact.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Flow Chart */}
      {dailyFlowData.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-lg font-semibold text-telegram-text mb-4">
            Динамика доходов и расходов
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis 
                dataKey="date" 
                stroke="#707579"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#707579"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="Доходы" 
                stroke="#4CAF50" 
                strokeWidth={2}
                dot={{ fill: '#4CAF50', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="Расходы" 
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
          <h2 className="text-lg font-semibold text-telegram-text mb-4">
            Сравнение по месяцам
          </h2>
          <ResponsiveContainer width="100%" height={period === 'year' ? 350 : 300}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: period === 'year' ? 60 : 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis 
                dataKey="month" 
                stroke="#707579"
                style={{ fontSize: '12px' }}
                angle={period === 'year' ? -45 : 0}
                textAnchor={period === 'year' ? 'end' : 'middle'}
                height={period === 'year' ? 60 : 30}
              />
              <YAxis 
                stroke="#707579"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="Доходы" fill="#4CAF50" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Расходы" fill="#F44336" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Expense Categories */}
        {analytics.top_expense_categories.length > 0 && (
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-telegram-text mb-4">
              Расходы по категориям
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
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E5E5' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Category List */}
            <div className="mt-4 space-y-2">
              {analytics.top_expense_categories.slice(0, 5).map((cat, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-telegram hover:bg-telegram-hover">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <span className="text-sm text-telegram-text">{cat.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-telegram-text">
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
            <h2 className="text-lg font-semibold text-telegram-text mb-4">
              Топ категорий расходов
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
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis 
                  type="number"
                  stroke="#707579"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <YAxis 
                  type="category" 
                  dataKey="name"
                  stroke="#707579"
                  style={{ fontSize: '12px' }}
                  width={120}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E5E5' }}
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
