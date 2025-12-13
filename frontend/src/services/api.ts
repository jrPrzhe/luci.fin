// Use relative URL for API when running in production/ngrok (vite proxy handles it)
// Use full URL only when explicitly set via env variable
// When running through ngrok, relative paths work through Vite proxy
// If backend is also on ngrok, set VITE_API_URL to the backend ngrok URL
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || ''

export interface ApiResponse<T> {
  data?: T
  error?: string
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private refreshToken: string | null = null
  private isRefreshing: boolean = false
  private refreshPromise: Promise<string | null> | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    // Инициализация токенов
    // Для VK и Telegram используем их хранилища (привязаны к user_id)
    // Для обычного веба используем localStorage (привязан к браузеру)
    import('../utils/storage').then(({ storageSync, default: storage, isVKWebApp }) => {
      // Пытаемся получить токены синхронно (из кэша или localStorage)
      this.token = storageSync.getItem('token')
      this.refreshToken = storageSync.getItem('refresh_token')
      
      // Для VK и Telegram также загружаем асинхронно из их хранилищ
      // Это гарантирует, что мы получим актуальные данные
      if (isVKWebApp()) {
        // Для VK используем только VK Storage, не localStorage
        storage.getItem('token').then(token => {
          if (token) {
            this.token = token
          }
        }).catch(console.error)
        
        storage.getItem('refresh_token').then(refreshToken => {
          if (refreshToken) {
            this.refreshToken = refreshToken
          }
        }).catch(console.error)
      }
    }).catch(() => {
      // Fallback: если не удалось загрузить модуль storage, используем localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        this.token = localStorage.getItem('token')
        this.refreshToken = localStorage.getItem('refresh_token')
      }
    })
  }

  setToken(token: string | null, refreshToken?: string | null) {
    this.token = token
    
    // Используем storage вместо прямого localStorage
    // Для VK и Telegram данные сохраняются в их хранилищах (привязаны к user_id)
    // Для обычного веба - в localStorage (привязан к браузеру)
    import('../utils/storage').then(async ({ default: storage, storageSync, isVKWebApp, isTelegramWebApp }) => {
      // Для Telegram и VK используем асинхронное сохранение (без блокирующего ожидания)
      if (isTelegramWebApp() || isVKWebApp()) {
        // Сначала обновляем кэш для синхронного доступа (мгновенно)
        if (token) {
          storageSync.setItem('token', token)
          // Затем сохраняем асинхронно в фоне (не ждем)
          storage.setItem('token', token).catch(error => {
            console.warn('[ApiClient] Failed to save token to Cloud Storage:', error)
          })
        } else {
          storageSync.removeItem('token')
          storage.removeItem('token').catch(console.error)
          this.token = null
        }
        
        if (refreshToken !== undefined) {
          this.refreshToken = refreshToken
          if (refreshToken) {
            storageSync.setItem('refresh_token', refreshToken)
            storage.setItem('refresh_token', refreshToken).catch(console.error)
          } else {
            storageSync.removeItem('refresh_token')
            storage.removeItem('refresh_token').catch(console.error)
            this.refreshToken = null
          }
        }
      } else {
        // Для обычного веба используем синхронное сохранение
        if (token) {
          storageSync.setItem('token', token)
          // Также сохраняем асинхронно для надежности
          storage.setItem('token', token).catch(console.error)
        } else {
          storageSync.removeItem('token')
          storage.removeItem('token').catch(console.error)
          this.token = null
        }
        
        if (refreshToken !== undefined) {
          this.refreshToken = refreshToken
          if (refreshToken) {
            storageSync.setItem('refresh_token', refreshToken)
            storage.setItem('refresh_token', refreshToken).catch(console.error)
          } else {
            storageSync.removeItem('refresh_token')
            storage.removeItem('refresh_token').catch(console.error)
            this.refreshToken = null
          }
        }
      }
      
      // ВАЖНО: Для VK и Telegram НЕ используем localStorage
      // Данные должны храниться только в их хранилищах
      // Для обычного веба storageSync уже использует localStorage
      if (!isVKWebApp() && !isTelegramWebApp()) {
        // Для обычного веба также сохраняем в localStorage напрямую для совместимости
        if (typeof window !== 'undefined' && window.localStorage) {
          if (token) {
            localStorage.setItem('token', token)
          } else {
            localStorage.removeItem('token')
          }
          
          if (refreshToken !== undefined) {
            if (refreshToken) {
              localStorage.setItem('refresh_token', refreshToken)
            } else {
              localStorage.removeItem('refresh_token')
            }
          }
        }
      }
    }).catch(() => {
      // Fallback: если не удалось загрузить модуль storage, используем localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        if (token) {
          localStorage.setItem('token', token)
        } else {
          localStorage.removeItem('token')
          this.token = null
        }
        
        if (refreshToken !== undefined) {
          this.refreshToken = refreshToken
          if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken)
          } else {
            localStorage.removeItem('refresh_token')
            this.refreshToken = null
          }
        }
      }
    })
  }

  private async refreshAccessToken(): Promise<string | null> {
    // If already refreshing, return the existing promise
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise
    }

    if (!this.refreshToken) {
      return null
    }

    this.isRefreshing = true
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
        })

        if (!response.ok) {
          // Refresh token is invalid, clear all tokens
          this.setToken(null, null)
          return null
        }

        const data = await response.json()
        this.setToken(data.access_token, data.refresh_token)
        return data.access_token
      } catch (error) {
        console.error('Failed to refresh token:', error)
        this.setToken(null, null)
        return null
      } finally {
        this.isRefreshing = false
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }
    
    // Prevent caching for critical endpoints (auth, data fetching)
    if (endpoint.includes('/auth/') || endpoint.includes('/transactions') || 
        endpoint.includes('/accounts') || endpoint.includes('/categories') ||
        endpoint.includes('/shared-budgets') || endpoint.includes('/balance') ||
        endpoint.includes('/reports/analytics')) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
      headers['Pragma'] = 'no-cache'
      headers['Expires'] = '0'
    }

    // Всегда читаем токен из storage перед каждым запросом
    // чтобы гарантировать, что используется актуальный токен
    // Для VK и Telegram используем их хранилища, для веба - localStorage
    // Используем синхронный доступ через storageSync
    const { storageSync, default: storage, isVKWebApp, isTelegramWebApp } = await import('../utils/storage')
    let token = storageSync.getItem('token') || this.token
    
    // Fallback: для веба также проверяем localStorage напрямую
    if (!token && typeof window !== 'undefined' && window.localStorage) {
      token = localStorage.getItem('token') || this.token
    }
    
    // Для VK и Telegram: если токен не найден синхронно, пробуем асинхронно
    // Это важно, так как VK Storage может сохранять токен асинхронно
    if (!token && (isVKWebApp() || isTelegramWebApp())) {
      try {
        // Пытаемся получить токен асинхронно с таймаутом
        const asyncToken = await Promise.race([
          storage.getItem('token'),
          new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 100))
        ])
        if (asyncToken) {
          token = asyncToken
          // Обновляем кэш для следующих запросов
          storageSync.setItem('token', asyncToken)
        }
      } catch (error) {
        // Игнорируем ошибки чтения из async storage
        console.debug('[API] Failed to read token from async storage:', error)
      }
    }
    
    // Обновляем this.token для синхронизации
    if (token) {
      this.token = token
    } else {
      this.token = null
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
      // Обновляем this.token для синхронизации
      this.token = token
    } else {
      // Если токена нет в localStorage, но есть в this.token, удаляем из this.token
      this.token = null
    }

    // Отладка для проверки отправки токена
    if (endpoint.includes('/auth/me')) {
      console.log('[API] Request to /auth/me:', {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'none',
        authorizationHeader: headers['Authorization'],
        url,
        allHeaders: Object.keys(headers)
      })
    }

    // Add timeout to requests using Promise.race
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Превышено время ожидания ответа от сервера. Пожалуйста, попробуйте позже.')), 10000) // 10 seconds
      })

    try {
      // Создаем Headers объект для правильной передачи заголовков
      const fetchHeaders = new Headers()
      for (const [key, value] of Object.entries(headers)) {
        fetchHeaders.append(key, value)
      }
      
      const fetchPromise = fetch(url, {
        ...options,
        headers: fetchHeaders,
        cache: 'no-store', // Prevent browser caching
      })

      const response = await Promise.race([fetchPromise, timeoutPromise])

      // Handle 304 Not Modified - return empty object/array based on endpoint
      if (response.status === 304) {
        // For GET requests, return empty array or object based on context
        const endpoint = url.toLowerCase()
        if (endpoint.includes('/transactions') || endpoint.includes('/accounts') || endpoint.includes('/categories') || endpoint.includes('/shared-budgets')) {
          return [] as T
        }
        return {} as T
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T
      }

      if (!response.ok) {
        // Handle 401 Unauthorized - try to refresh token
        if (response.status === 401 && this.refreshToken && !endpoint.includes('/auth/refresh')) {
          // Try to refresh the token
          const newToken = await this.refreshAccessToken()
          if (newToken) {
            // Retry the request with new token
            headers['Authorization'] = `Bearer ${newToken}`
            const fetchHeaders = new Headers()
            for (const [key, value] of Object.entries(headers)) {
              fetchHeaders.append(key, value)
            }
            
            const retryResponse = await fetch(url, {
              ...options,
              headers: fetchHeaders,
              cache: 'no-store',
            })
            
            if (retryResponse.ok) {
              // Handle successful retry
              if (retryResponse.status === 304) {
                const endpoint = url.toLowerCase()
                if (endpoint.includes('/transactions') || endpoint.includes('/accounts') || endpoint.includes('/categories') || endpoint.includes('/shared-budgets')) {
                  return [] as T
                }
                return {} as T
              }
              
              if (retryResponse.status === 204) {
                return {} as T
              }
              
              const contentType = retryResponse.headers.get('content-type')
              if (contentType && contentType.includes('application/json')) {
                const text = await retryResponse.text()
                if (!text || text.trim() === '') {
                  const endpoint = url.toLowerCase()
                  if (endpoint.includes('/transactions') || endpoint.includes('/accounts') || endpoint.includes('/categories') || endpoint.includes('/shared-budgets')) {
                    return [] as T
                  }
                  return {} as T
                }
                try {
                  return JSON.parse(text)
                } catch (e) {
                  return {} as T
                }
              }
              return {} as T
            }
          } else {
            // Refresh failed, clear tokens
            this.setToken(null, null)
            // Redirect to login if we're in a browser environment
            if (typeof window !== 'undefined') {
              window.location.href = '/'
            }
          }
        } else if (response.status === 401) {
          // No refresh token or refresh failed, clear tokens
          this.setToken(null, null)
        }
        const error = await response.json().catch(() => ({ detail: 'Ошибка запроса' }))
        
        // Обработка ошибок валидации Pydantic (массив ошибок)
        let errorMessage: string
        if (Array.isArray(error)) {
          // Это массив ошибок валидации Pydantic
          const validationErrors = error.map((err: any) => {
            if (err.loc && err.msg) {
              const field = err.loc[err.loc.length - 1] // Последний элемент - название поля
              // Переводим название поля на русский для лучшего UX
              const fieldName = field === 'description' ? 'описание' : 
                               field === 'name' ? 'название' : 
                               field
              // Извлекаем понятное сообщение об ошибке
              let msg = err.msg
              if (err.type === 'string_too_long' || err.msg?.includes('ensure this value has at most')) {
                const maxLengthMatch = err.msg?.match(/(\d+)/)
                if (maxLengthMatch) {
                  msg = `не может превышать ${maxLengthMatch[1]} символов`
                } else {
                  msg = 'превышает максимальную длину'
                }
              }
              return `${fieldName}: ${msg}`
            }
            return err.msg || JSON.stringify(err)
          })
          errorMessage = validationErrors.join('; ')
        } else if (error.detail) {
          // Проверяем, не является ли detail массивом ошибок валидации
          if (Array.isArray(error.detail)) {
            const validationErrors = error.detail.map((err: any) => {
              if (err.loc && err.msg) {
                const field = err.loc[err.loc.length - 1]
                const fieldName = field === 'description' ? 'описание' : 
                                 field === 'name' ? 'название' : 
                                 field
                let msg = err.msg
                if (err.type === 'string_too_long' || err.msg?.includes('ensure this value has at most')) {
                  const maxLengthMatch = err.msg?.match(/(\d+)/)
                  if (maxLengthMatch) {
                    msg = `не может превышать ${maxLengthMatch[1]} символов`
                  } else {
                    msg = 'превышает максимальную длину'
                  }
                }
                return `${fieldName}: ${msg}`
              }
              return err.msg || JSON.stringify(err)
            })
            errorMessage = validationErrors.join('; ')
          } else {
            errorMessage = error.detail
          }
        } else {
          errorMessage = error.message || `HTTP error! status: ${response.status}`
        }
        
        // Импортируем функцию перевода ошибок
        const { translateError } = await import('../utils/errorMessages')
        const errorObj = new Error(translateError(errorMessage || error))
        // Сохраняем статус ответа и оригинальную ошибку для проверки на фронтенде
        ;(errorObj as any).response = { status: response.status, data: error }
        throw errorObj
      }

      // Check if response has content
      const contentType = response.headers.get('content-type')
      const text = await response.text().catch(() => '')
      
      // Check if it's HTML (backend error page or frontend fallback)
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(`Backend вернул HTML вместо JSON. Возможно, сервис недоступен или endpoint не существует. Статус: ${response.status}`)
      }
      
      if (contentType && contentType.includes('application/json')) {
        if (!text || text.trim() === '') {
          // Empty response - return appropriate default based on endpoint
          const endpoint = url.toLowerCase()
          if (endpoint.includes('/transactions') || endpoint.includes('/accounts') || endpoint.includes('/categories') || endpoint.includes('/shared-budgets')) {
            return [] as T
          }
          return {} as T
        }
        try {
          return JSON.parse(text)
        } catch (e) {
          // Invalid JSON - throw error for critical endpoints
          const endpoint = url.toLowerCase()
          if (endpoint.includes('/analytics') || endpoint.includes('/admin')) {
            throw new Error(`Неверный формат JSON от сервера: ${text.substring(0, 100)}`)
          }
          return {} as T
        }
      }

      // No JSON content type - return empty object
      return {} as T
    } catch (error: any) {
      // Импортируем функцию перевода ошибок
      const { translateError } = await import('../utils/errorMessages')
      const translatedError = translateError(error)
      throw new Error(translatedError)
    }
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.request<{ access_token: string; refresh_token: string; user: any }>(
      '/api/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    )
    // Store tokens after successful login
    if (response.access_token) {
      this.setToken(response.access_token, response.refresh_token)
    }
    return response
  }

  async register(userData: {
    email: string
    password: string
    username?: string
    first_name?: string
    last_name?: string
  }) {
    const response = await this.request<{ access_token: string; refresh_token: string; user: any }>(
      '/api/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(userData),
      }
    )
    // Store tokens after successful registration
    if (response.access_token) {
      this.setToken(response.access_token, response.refresh_token)
    }
    return response
  }

  async syncAdminStatus() {
    return this.request<{
      is_admin: boolean
      email: string
      telegram_id: string | null
      in_admin_list: boolean
      admin_list: string[] | null
    }>('/api/v1/admin/sync-admin-status', {
      method: 'POST',
    })
  }

  updateUser = async (userData: {
    first_name?: string
    last_name?: string
    timezone?: string
    default_currency?: string
    language?: string
    theme?: string
    new_year_theme?: boolean
  }) => {
    return this.request<any>('/api/v1/auth/me', {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  }

  resetAccount = async (): Promise<any> => {
    return await this.request<any>('/api/v1/auth/reset-account', {
      method: 'POST',
    })
  }

  async loginTelegram(initData: string, currentToken?: string | null) {
    const response = await this.request<{ access_token: string; refresh_token: string; user: any }>(
      '/api/v1/auth/telegram',
      {
        method: 'POST',
        body: JSON.stringify({ 
          init_data: initData,
          current_token: currentToken || null
        }),
      }
    )
    // Store tokens after successful Telegram login
    if (response.access_token) {
      this.setToken(response.access_token, response.refresh_token)
    }
    return response
  }

  async loginVK(launchParams: string, currentToken?: string | null, firstName?: string | null, lastName?: string | null) {
    const response = await this.request<{ access_token: string; refresh_token: string; user: any }>(
      '/api/v1/auth/vk',
      {
        method: 'POST',
        body: JSON.stringify({ 
          launch_params: launchParams,
          current_token: currentToken || null,
          first_name: firstName || null,
          last_name: lastName || null
        }),
      }
    )
    // Store tokens after successful VK login
    if (response.access_token) {
      this.setToken(response.access_token, response.refresh_token)
      
      // Для VK и Telegram ждем завершения сохранения токена
      // чтобы гарантировать, что токен будет доступен для следующих запросов
      try {
        const { isVKWebApp, isTelegramWebApp, default: storage } = await import('../utils/storage')
        if (isVKWebApp() || isTelegramWebApp()) {
          // Ждем завершения сохранения в async storage
          await Promise.race([
            storage.setItem('token', response.access_token),
            new Promise<void>((resolve) => setTimeout(() => resolve(), 500))
          ])
          if (response.refresh_token) {
            await Promise.race([
              storage.setItem('refresh_token', response.refresh_token),
              new Promise<void>((resolve) => setTimeout(() => resolve(), 500))
            ])
          }
        }
      } catch (error) {
        // Игнорируем ошибки сохранения - токен уже в кэше
        console.debug('[ApiClient] Failed to wait for token save:', error)
      }
    }
    return response
  }

  // Accounts
  async getAccounts() {
    return this.request<any[]>('/api/v1/accounts/')
  }

  async getBalance() {
    return this.request<{ total: number; currency: string; accounts: any[] }>(
      '/api/v1/accounts/balance'
    )
  }

  async createAccount(data: {
    name: string
    account_type: string
    currency?: string
    initial_balance?: number
    description?: string
    shared_budget_id?: number
  }) {
    return this.request<any>('/api/v1/accounts/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAccount(accountId: number, data: {
    name?: string
    account_type?: string
    currency?: string
    description?: string
    is_active?: boolean
  }) {
    return this.request<any>(`/api/v1/accounts/${accountId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteAccount(accountId: number) {
    return this.request<any>(`/api/v1/accounts/${accountId}`, {
      method: 'DELETE',
    })
  }

  async getAccountTransactionCount(accountId: number): Promise<{
    account_id: number
    transaction_count: number
    source_transactions: number
    destination_transactions: number
  }> {
    return this.request(`/api/v1/accounts/${accountId}/transaction-count`)
  }

  // Transactions
  async getTransactions(
    limit = 50, 
    offset = 0, 
    accountId?: number, 
    filterType?: string,
    transactionType?: string,
    startDate?: string,
    endDate?: string
  ) {
    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    params.append('offset', offset.toString())
    if (accountId) params.append('account_id', accountId.toString())
    if (filterType) params.append('filter_type', filterType)
    if (transactionType) params.append('transaction_type', transactionType)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    
    return this.request<any[]>(`/api/v1/transactions/?${params.toString()}`)
  }

  async createTransaction(transaction: {
    account_id: number
    transaction_type: 'income' | 'expense' | 'transfer'
    amount: number
    currency?: string
    category_id?: number
    description?: string
    transaction_date?: string
    to_account_id?: number
    goal_id?: number
  }) {
    return this.request<any>('/api/v1/transactions/', {
      method: 'POST',
      body: JSON.stringify(transaction),
    })
  }

  async updateTransaction(transactionId: number, transaction: {
    account_id?: number
    transaction_type?: 'income' | 'expense' | 'transfer'
    amount?: number
    currency?: string
    category_id?: number
    description?: string
    transaction_date?: string
    to_account_id?: number
    goal_id?: number
  }) {
    return this.request<any>(`/api/v1/transactions/${transactionId}`, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    })
  }

  async deleteTransaction(transactionId: number) {
    return this.request<void>(`/api/v1/transactions/${transactionId}`, {
      method: 'DELETE',
    })
  }

  // Shared Budgets
  async getSharedBudgets() {
    return this.request<any[]>('/api/v1/shared-budgets/')
  }

  async getSharedBudget(budgetId: number) {
    return this.request<any>(`/api/v1/shared-budgets/${budgetId}`)
  }

  async createSharedBudget(data: {
    name: string
    description?: string
    currency?: string
  }) {
    return this.request<any>('/api/v1/shared-budgets/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateSharedBudget(budgetId: number, data: {
    name?: string
    description?: string
    is_active?: boolean
  }) {
    return this.request<any>(`/api/v1/shared-budgets/${budgetId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getBudgetMembers(budgetId: number) {
    return this.request<any[]>(`/api/v1/shared-budgets/${budgetId}/members`)
  }

  async inviteMember(budgetId: number, data: {
    email?: string
    telegram_id?: string
    role?: string
  }) {
    return this.request<any>(`/api/v1/shared-budgets/${budgetId}/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async removeMember(budgetId: number, userId: number) {
    return this.request<void>(`/api/v1/shared-budgets/${budgetId}/members/${userId}`, {
      method: 'DELETE',
    })
  }

  async updateMemberRole(budgetId: number, userId: number, role: 'admin' | 'member'): Promise<any> {
    return this.request(`/api/v1/shared-budgets/${budgetId}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ new_role: role }),
    })
  }

  async getPendingInvitations() {
    return this.request<any[]>('/api/v1/shared-budgets/invitations/pending')
  }

  async acceptInvitation(token?: string, inviteCode?: string) {
    return this.request<any>('/api/v1/shared-budgets/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token, invite_code: inviteCode }),
    })
  }

  async getInviteCode(budgetId: number) {
    return this.request<{ invite_code: string; budget_name: string }>(
      `/api/v1/shared-budgets/${budgetId}/invite-code`
    )
  }

  async regenerateInviteCode(budgetId: number) {
    return this.request<{ invite_code: string; budget_name: string }>(
      `/api/v1/shared-budgets/${budgetId}/regenerate-invite-code`,
      { method: 'POST' }
    )
  }


  async addProgressToGoal(goalId: number, amount: number) {
    return this.request<any>(`/api/v1/goals/${goalId}/add-progress`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    })
  }

  async checkGoalProgress(goalId: number) {
    return this.request<any>(`/api/v1/goals/${goalId}/check-progress`, {
      method: 'POST',
    })
  }

  async declineInvitation(invitationId: number) {
    return this.request<void>(`/api/v1/shared-budgets/invitations/${invitationId}/decline`, {
      method: 'POST',
    })
  }

  async leaveBudget(budgetId: number) {
    return this.request<void>(`/api/v1/shared-budgets/${budgetId}/leave`, {
      method: 'POST',
    })
  }

  // Categories API
  async getCategories(transactionType?: string, favoritesOnly?: boolean, includeShared: boolean = true): Promise<any[]> {
    const params = new URLSearchParams()
    if (transactionType) params.append('transaction_type', transactionType)
    if (favoritesOnly) params.append('favorites_only', 'true')
    if (!includeShared) params.append('include_shared', 'false')
    
    return this.request(`/api/v1/categories/?${params.toString()}`)
  }

  async getCategory(categoryId: number): Promise<any> {
    return this.request(`/api/v1/categories/${categoryId}`)
  }

  async createCategory(category: any): Promise<any> {
    return this.request('/api/v1/categories/', {
      method: 'POST',
      body: JSON.stringify(category),
    })
  }

  async updateCategory(categoryId: number, category: any): Promise<any> {
    return this.request(`/api/v1/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(category),
    })
  }

  async deleteCategory(categoryId: number): Promise<void> {
    await this.request(`/api/v1/categories/${categoryId}`, {
      method: 'DELETE',
    })
  }

  async setCategoryFavorite(categoryId: number, isFavorite: boolean): Promise<any> {
    return this.request(`/api/v1/categories/${categoryId}/favorite`, {
      method: 'PATCH',
      body: JSON.stringify({ is_favorite: isFavorite }),
    })
  }

  // Goals API
  async getGoals(statusFilter?: string): Promise<any[]> {
    const params = new URLSearchParams()
    if (statusFilter) params.append('status_filter', statusFilter)
    const queryString = params.toString()
    return this.request(`/api/v1/goals${queryString ? `?${queryString}` : ''}`)
  }

  async getGoal(goalId: number): Promise<any> {
    return this.request(`/api/v1/goals/${goalId}`)
  }

  async createGoal(data: {
    name: string
    description?: string
    target_amount: number
    currency?: string
    target_date?: string
    roadmap?: string
    category_id?: number
    goal_type?: string
  }): Promise<any> {
    return this.request('/api/v1/goals/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateGoal(goalId: number, data: {
    name?: string
    description?: string
    target_amount?: number
    currency?: string
    target_date?: string
    current_amount?: number
    status?: string
    roadmap?: string
    category_id?: number
  }): Promise<any> {
    return this.request(`/api/v1/goals/${goalId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteGoal(goalId: number): Promise<void> {
    return this.request(`/api/v1/goals/${goalId}`, {
      method: 'DELETE',
    })
  }

  async generateRoadmap(data: {
    goal_name: string
    target_amount: number
    currency: string
    transactions?: any[]
    balance?: number
    income_total?: number
    expense_total?: number
  }): Promise<{ roadmap: string; monthly_savings_needed: number; feasibility: string; recommendations: string[]; savings_by_category: Record<string, number>; estimated_months: number }> {
    return this.request('/api/v1/goals/generate-roadmap', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Reports/Analytics API
  async getAnalytics(period: 'week' | 'month' | 'year' = 'month'): Promise<any> {
    return this.request(`/api/v1/reports/analytics?period=${period}`)
  }

  async downloadPremiumReport(
    format: 'pdf' | 'excel' = 'pdf',
    period?: 'week' | 'month' | 'year',
    startDate?: string,
    endDate?: string
  ): Promise<Blob> {
    const params = new URLSearchParams()
    params.append('format', format)
    if (period) params.append('period', period)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    
    // Получаем актуальный токен из storage
    const { storageSync } = await import('../utils/storage')
    let token = storageSync.getItem('token') || this.token
    
    if (!token && typeof window !== 'undefined' && window.localStorage) {
      token = localStorage.getItem('token') || this.token
    }
    
    const response = await fetch(`${this.baseUrl}/api/v1/reports/premium/export?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    
    if (!response.ok) {
      // Для 403 ошибки сохраняем статус в объекте ошибки для правильной обработки
      const error: any = await response.json().catch(() => ({ detail: 'Ошибка загрузки отчета' }))
      const errorObj = new Error(error.detail || 'Ошибка загрузки отчета')
      // Добавляем статус ответа для проверки на фронтенде
      ;(errorObj as any).response = { status: response.status }
      throw errorObj
    }
    
    return response.blob()
  }

  async sendReportViaBot(
    format: 'pdf' | 'excel' = 'pdf',
    period?: 'week' | 'month' | 'year',
    startDate?: string,
    endDate?: string
  ): Promise<{ status: string; message: string; platform: string }> {
    const params = new URLSearchParams()
    params.append('format', format)
    if (period) params.append('period', period)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    
    return this.request(`/api/v1/reports/premium/send-via-bot?${params.toString()}`, {
      method: 'POST',
    })
  }

  async getCurrentUser(): Promise<{
    id: number
    email: string
    username: string | null
    first_name: string | null
    last_name: string | null
    telegram_id: string | null
    telegram_username: string | null
    vk_id: string | null
    default_currency: string
    language: string
    theme: string
    new_year_theme: boolean
    is_premium: boolean
    is_admin: boolean
  }> {
    return this.request('/api/v1/auth/me')
  }

  // Admin API
  async getAdminUsers(): Promise<Array<{
    id: number
    email: string
    username: string | null
    first_name: string | null
    last_name: string | null
    telegram_id: string | null
    telegram_username: string | null
    created_at: string
    last_login: string | null
    transaction_count: number
    account_count: number
    category_count: number
    is_active: boolean
    is_verified: boolean
    is_premium: boolean
  }>> {
    return this.request('/api/v1/admin/users')
  }

  async resetUserSettings(userId: number): Promise<any> {
    return this.request(`/api/v1/admin/users/${userId}/reset`, {
      method: 'POST',
    })
  }

  async updateUserPremium(userId: number, isPremium: boolean): Promise<any> {
    return this.request(`/api/v1/admin/users/${userId}/premium`, {
      method: 'PATCH',
      body: JSON.stringify({ is_premium: isPremium }),
    })
  }

  // Import API
  async getImportSources(): Promise<Array<{ id: string; name: string; description: string }>> {
    return this.request('/api/v1/import/sources')
  }

  async importData(source: string, file: File): Promise<{
    message: string
    accounts_imported: number
    transactions_imported: number
    categories_imported: number
    categories_created: number
  }> {
    const formData = new FormData()
    formData.append('file', file)

    const token = localStorage.getItem('token')
    const url = `${this.baseUrl}/api/v1/import/?source=${encodeURIComponent(source)}`
    
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    // Не устанавливаем Content-Type - браузер сам установит с boundary для FormData

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(error.detail || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  // Gamification API
  async getGamificationStatus(): Promise<{
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
    daily_quests: Array<{
      id: number
      quest_type: string
      title: string
      description: string | null
      xp_reward: number
      status: string
      progress: number
      target_value: number | null
      quest_date: string
    }>
    recent_achievements: Array<{
      id: number
      achievement_type: string
      title: string
      description: string | null
      icon: string | null
      xp_reward: number
      rarity: string
      unlocked_at: string | null
      is_unlocked: boolean
    }>
    next_level_xp: number
  }> {
    return this.request('/api/v1/gamification/status')
  }

  async getDailyQuests(): Promise<Array<{
    id: number
    quest_type: string
    title: string
    description: string | null
    xp_reward: number
    status: string
    progress: number
    target_value: number | null
    quest_date: string
  }>> {
    return this.request('/api/v1/gamification/quests')
  }

  async completeQuest(questId: number, progress?: number): Promise<{
    id: number
    quest_type: string
    title: string
    description: string | null
    xp_reward: number
    status: string
    progress: number
    target_value: number | null
    quest_date: string
  }> {
    return this.request(`/api/v1/gamification/quests/${questId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ progress }),
    })
  }

  async getAchievements(): Promise<Array<{
    id: number
    achievement_type: string
    title: string
    description: string | null
    icon: string | null
    xp_reward: number
    rarity: string
    unlocked_at: string | null
    is_unlocked: boolean
  }>> {
    return this.request('/api/v1/gamification/achievements')
  }

  async getGamificationMessage(event: string, userData?: Record<string, any>): Promise<{
    message: string
    emotion: string
  }> {
    return this.request('/api/v1/ai/gamification-message', {
      method: 'POST',
      body: JSON.stringify({ event, user_data: userData }),
    })
  }

  // Analytics tracking
  async trackEvent(
    eventType: string,
    eventName: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.request('/api/v1/analytics/track', {
        method: 'POST',
        body: JSON.stringify({
          event_type: eventType,
          event_name: eventName,
          platform: this.detectPlatform(),
          metadata: metadata || {},
        }),
      })
    } catch (error) {
      // Не логируем ошибки аналитики, чтобы не засорять консоль
      console.debug('Failed to track analytics event:', error)
    }
  }

  private detectPlatform(): string {
    // Определяем платформу
    if (typeof window !== 'undefined') {
      const url = window.location.href
      if (url.includes('vk.com') || url.includes('vk.ru')) {
        return 'vk_miniapp'
      }
      // Проверяем наличие Telegram WebApp
      if ((window as any).Telegram?.WebApp) {
        return 'telegram_miniapp'
      }
    }
    return 'web'
  }
}

export const api = new ApiClient(API_URL)

