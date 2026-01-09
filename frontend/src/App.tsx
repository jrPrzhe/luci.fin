import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { initStorage } from './utils/storage'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Accounts } from './pages/Accounts'
import { Reports } from './pages/Reports'
import { SharedBudgets } from './pages/SharedBudgets'
import { Categories } from './pages/Categories'
import { Goals } from './pages/Goals'
import { Profile } from './pages/Profile'
import { About } from './pages/About'
import { Import } from './pages/Import'
import { Onboarding } from './pages/Onboarding'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Statistics } from './pages/Statistics'
import { Achievements } from './pages/Achievements'
import { Quests } from './pages/Quests'
import { Analytics } from './pages/Analytics'
import { detectPlatform } from './utils/platform'
import { UnifiedAuthHandler } from './components/UnifiedAuthHandler'
import { NewYearProvider } from './contexts/NewYearContext'
import { StrangerThingsProvider } from './contexts/StrangerThingsContext'
import { I18nProvider } from './contexts/I18nContext'
import { ToastProvider } from './contexts/ToastContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logger } from './utils/logger'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

// Old TelegramAuthHandler and VKAuthHandler removed - now using UnifiedAuthHandler
// See components/UnifiedAuthHandler.tsx for the unified implementation

function App() {
  // Логируем инициализацию приложения и загружаем настройки из storage
  useEffect(() => {
    const platform = detectPlatform()
    
    logger.log('[App] Initializing...', {
      platform,
      url: window.location.href,
      pathname: window.location.pathname,
      hasTelegramSDK: !!window.Telegram?.WebApp,
      hasVKParams: new URLSearchParams(window.location.search).has('vk_user_id')
    })
    
    // Инициализируем storage и загружаем настройки (тема, новогодний режим и т.д.)
    initStorage().catch(logger.error)
  }, [])

  logger.log('[App] Rendering App component...', {
    timestamp: new Date().toISOString(),
    pathname: window.location.pathname
  })

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <I18nProvider>
            <ErrorBoundary>
              <NewYearProvider>
                <ErrorBoundary>
                  <StrangerThingsProvider>
                    <ErrorBoundary>
                      <ToastProvider>
                    <ErrorBoundary>
                      <Router>
                        <ErrorBoundary>
                          <UnifiedAuthHandler />
                        </ErrorBoundary>
                        <ErrorBoundary>
                          <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/onboarding" element={<Onboarding />} />
                            <Route path="/" element={<Layout />}>
                              <Route index element={<Dashboard />} />
                              <Route path="transactions" element={<Transactions />} />
                              <Route path="accounts" element={<Accounts />} />
                              <Route path="categories" element={<Categories />} />
                              <Route path="goals" element={<Goals />} />
                              <Route path="reports" element={
                                <ErrorBoundary>
                                  <Reports />
                                </ErrorBoundary>
                              } />
                              <Route path="shared-budgets" element={<SharedBudgets />} />
                              <Route path="profile" element={<Profile />} />
                              <Route path="statistics" element={<Statistics />} />
                              <Route path="analytics" element={<Analytics />} />
                              <Route path="import" element={<Import />} />
                              <Route path="about" element={<About />} />
                              <Route path="achievements" element={<Achievements />} />
                              <Route path="quests" element={<Quests />} />
                            </Route>
                          </Routes>
                        </ErrorBoundary>
                      </Router>
                    </ErrorBoundary>
                      </ToastProvider>
                    </ErrorBoundary>
                  </StrangerThingsProvider>
                </ErrorBoundary>
              </NewYearProvider>
            </ErrorBoundary>
          </I18nProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
