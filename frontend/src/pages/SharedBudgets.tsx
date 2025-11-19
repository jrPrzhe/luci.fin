import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { getTelegramWebApp } from '../utils/telegram'
import { useToast } from '../contexts/ToastContext'

interface SharedBudget {
  id: number
  name: string
  description?: string
  currency: string
  created_by: number
  invite_code?: string  // Can be optional for old records
  is_active: boolean
  created_at: string
  updated_at: string
  member_count: number
}

interface Member {
  id: number
  shared_budget_id: number
  user_id: number
  role: string
  joined_at: string
  user_email?: string
  user_name?: string
}

interface Invitation {
  id: number
  token: string
  shared_budget_id: number
  shared_budget_name: string
  invited_by_user_id: number
  invited_by_name: string
  email?: string
  telegram_id?: string
  role: string
  status: string
  message?: string
  created_at: string
  expires_at?: string
}

export function SharedBudgets() {
  const { showSuccess } = useToast()
  const [budgets, setBudgets] = useState<SharedBudget[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showInviteCode, setShowInviteCode] = useState<number | null>(null)
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState<SharedBudget | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [sharedAccounts, setSharedAccounts] = useState<any[]>([])
  const [error, setError] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Create form state
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    currency: 'RUB',
  })


  useEffect(() => {
    loadData()
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const user = await api.getCurrentUser()
      setCurrentUser(user)
    } catch (err) {
      console.error('Failed to load current user:', err)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [budgetsData, invitationsData] = await Promise.all([
        api.getSharedBudgets(),
        api.getPendingInvitations(),
      ])
      setBudgets(budgetsData)
      setInvitations(invitationsData)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }

  const loadMembers = async (budgetId: number) => {
    try {
      const [membersData, accountsData] = await Promise.all([
        api.getBudgetMembers(budgetId),
        api.getAccounts()
      ])
      setMembers(membersData)
      // Filter shared accounts for this budget
      setSharedAccounts(accountsData.filter((acc: any) => acc.shared_budget_id === budgetId))
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки участников')
    }
  }

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!createFormData.name.trim()) {
      setError('Название бюджета обязательно')
      return
    }

    try {
      await api.createSharedBudget({
        name: createFormData.name.trim(),
        description: createFormData.description.trim() || undefined,
        currency: createFormData.currency,
      })

      setCreateFormData({
        name: '',
        description: '',
        currency: 'RUB',
      })
      setShowCreateForm(false)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Ошибка создания бюджета')
    }
  }


  const handleAcceptInvitation = async (token: string) => {
    try {
      await api.acceptInvitation(token, undefined)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Ошибка принятия приглашения')
    }
  }

  const handleDeclineInvitation = async (invitationId: number) => {
    try {
      await api.declineInvitation(invitationId)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Ошибка отклонения приглашения')
    }
  }

  const handleViewBudget = async (budget: SharedBudget) => {
    setSelectedBudget(budget)
    await loadMembers(budget.id)
  }

  const handleRemoveMember = async (budgetId: number, userId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого участника?')) {
      return
    }

    try {
      await api.removeMember(budgetId, userId)
      await loadMembers(budgetId)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления участника')
    }
  }

  const handleUpdateRole = async (budgetId: number, userId: number, newRole: 'admin' | 'member') => {
    const roleName = newRole === 'admin' ? 'администратором' : 'участником'
    if (!confirm(`Вы уверены, что хотите назначить этого пользователя ${roleName}?`)) {
      return
    }

    try {
      await api.updateMemberRole(budgetId, userId, newRole)
      await loadMembers(budgetId)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Ошибка изменения роли')
    }
  }

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!joinCode.trim()) {
      setError('Введите код приглашения')
      return
    }

    try {
      await api.acceptInvitation(undefined, joinCode.toUpperCase().trim())
      setJoinCode('')
      setShowJoinForm(false)
      setError('')
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Ошибка присоединения к бюджету')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(text)
      setTimeout(() => setCopiedCode(null), 2000)
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedCode(text)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

  const sendTelegramInvite = (inviteCode: string, budgetName: string) => {
    const webApp = getTelegramWebApp()
    if (!webApp) {
      // Not in Telegram, fallback to copying
      copyToClipboard(inviteCode)
      showSuccess(`Код приглашения скопирован: ${inviteCode}`)
      return
    }

    // Create invite message
    const message = `Приглашение в совместный бюджет "${budgetName}"\n\nКод: ${inviteCode}\n\nПрисоединяйтесь по коду в приложении!`
    
    // Try to use Telegram's share functionality
    try {
      // Open Telegram share dialog using t.me/share
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('Приглашение в совместный бюджет')}&text=${encodeURIComponent(message)}`
      webApp.openLink(shareUrl, { try_instant_view: false })
    } catch (err) {
      // Fallback: show popup with message to copy
      webApp.showAlert(`Код приглашения: ${inviteCode}\n\nСкопируйте код и отправьте пользователю в Telegram.`, () => {
        copyToClipboard(inviteCode)
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }


  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Загрузка...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-1">💼 Совместные бюджеты</h1>
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">Управляйте общими финансами с друзьями и семьей</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowJoinForm(true)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
          >
            🔗 Присоединиться
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-telegram-primary text-white rounded-lg hover:bg-telegram-primary/90 transition-colors font-medium"
          >
            ➕ Создать бюджет
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📬</span>
              <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">Входящие приглашения</h2>
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
              {invitations.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="card border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🎯</span>
                      <h3 className="font-semibold text-lg text-telegram-text dark:text-telegram-dark-text">
                        {invitation.shared_budget_name}
                      </h3>
                    </div>
                    <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-2">
                      👤 От: <strong className="text-telegram-text dark:text-telegram-dark-text">{invitation.invited_by_name}</strong>
                    </p>
                    <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      📅 {formatDate(invitation.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleAcceptInvitation(invitation.token)}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium whitespace-nowrap"
                    >
                      ✓ Принять
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(invitation.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium whitespace-nowrap"
                    >
                      ✕ Отклонить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budgets List */}
      {selectedBudget ? (
        <div>
          <button
            onClick={() => setSelectedBudget(null)}
            className="mb-4 flex items-center gap-2 text-telegram-primary hover:text-telegram-primary/80 transition-colors font-medium"
          >
            <span>←</span>
            <span>Назад к списку</span>
          </button>
          
          <div className="card mb-6 bg-gradient-to-br from-telegram-primaryLight/10 to-white border-2 border-telegram-primary/20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-telegram-primary to-telegram-primary/70 flex items-center justify-center text-3xl">
                    💼
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-1">{selectedBudget.name}</h2>
                    {selectedBudget.description && (
                      <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{selectedBudget.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-telegram-primaryLight/20 dark:bg-telegram-dark-primary/20 rounded-full">
                    <span>💱</span>
                    <span className="text-sm font-medium text-telegram-text dark:text-telegram-dark-text">{selectedBudget.currency}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-telegram-primaryLight/20 dark:bg-telegram-dark-primary/20 rounded-full">
                    <span>👥</span>
                    <span className="text-sm font-medium text-telegram-text dark:text-telegram-dark-text">{selectedBudget.member_count} участников</span>
                  </div>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!confirm('Вы уверены, что хотите выйти из этого бюджета?')) {
                    return
                  }
                  try {
                    await api.leaveBudget(selectedBudget.id)
                    setSelectedBudget(null)
                    await loadData()
                  } catch (err: any) {
                    setError(err.message || 'Ошибка выхода из бюджета')
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium whitespace-nowrap"
              >
                🚪 Выйти из бюджета
              </button>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <h3 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">Совместные счета</h3>
              </div>
              <button
                onClick={() => setShowInviteCode(selectedBudget.id)}
                className="px-4 py-2 bg-telegram-primary text-white rounded-lg hover:bg-telegram-primary/90 transition-colors font-medium"
              >
                📋 Код приглашения
              </button>
            </div>
            {sharedAccounts.length === 0 ? (
              <div className="card p-6 text-center bg-gray-50 border-2 border-dashed border-gray-300">
                <div className="text-4xl mb-3">💳</div>
                <p className="text-telegram-text dark:text-telegram-dark-text font-medium mb-2">Нет совместных счетов</p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">Создайте счёт в разделе "Счета", выбрав этот бюджет</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sharedAccounts.map((account) => (
                  <div key={account.id} className="card hover:shadow-lg transition-shadow border-l-4 border-l-telegram-primary">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-telegram-text dark:text-telegram-dark-text text-lg">{account.name}</h4>
                      <span className="text-2xl">💵</span>
                    </div>
                    <p className="text-2xl font-bold text-telegram-primary dark:text-telegram-dark-primary mb-2">
                      {new Intl.NumberFormat('ru-RU', {
                        style: 'currency',
                        currency: account.currency,
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(Math.round(account.balance))}
                    </p>
                    <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      {account.type}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">👥</span>
              <h3 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">Участники</h3>
              <span className="px-2 py-1 bg-telegram-primaryLight/20 text-telegram-primary rounded-full text-xs font-semibold">
                {members.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.map((member) => (
                <div key={member.id} className="card hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                        member.role === 'admin' 
                          ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' 
                          : 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                      }`}>
                        {member.user_name?.[0]?.toUpperCase() || member.user_email?.[0]?.toUpperCase() || '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-telegram-text dark:text-telegram-dark-text truncate">
                          {member.user_name || member.user_email || `Пользователь #${member.user_id}`}
                        </h4>
                        <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                          {member.role === 'admin' ? '👑 Администратор' : '👤 Участник'}
                        </p>
                        <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                          📅 {formatDate(member.joined_at)}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      // Check if current user is admin of this budget
                      const currentUserMember = members.find(m => currentUser && m.user_id === currentUser.id)
                      const currentUserIsAdmin = currentUserMember?.role === 'admin'
                      const adminCount = members.filter(m => m.role === 'admin').length
                      const isCurrentUser = currentUser && member.user_id === currentUser.id
                      
                      // Show admin controls only if current user is admin
                      if (currentUserIsAdmin && !isCurrentUser) {
                        return (
                          <div className="flex gap-2">
                            {/* Role change button */}
                            <button
                              onClick={() => handleUpdateRole(
                                selectedBudget.id, 
                                member.user_id, 
                                member.role === 'admin' ? 'member' : 'admin'
                              )}
                              className="px-3 py-1.5 text-xs font-medium rounded-telegram transition-colors"
                              style={{
                                backgroundColor: member.role === 'admin' 
                                  ? '#F59E0B' 
                                  : '#3B82F6',
                                color: 'white'
                              }}
                              title={member.role === 'admin' ? 'Понизить до участника' : 'Повысить до администратора'}
                            >
                              {member.role === 'admin' ? '👑 Админ' : '⭐ Сделать админом'}
                            </button>
                            {/* Delete button - only if not the only admin */}
                            {!(member.role === 'admin' && adminCount === 1) && (
                              <button
                                onClick={() => handleRemoveMember(selectedBudget.id, member.user_id)}
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title="Удалить участника"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {budgets.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-block w-24 h-24 rounded-full bg-gradient-to-br from-telegram-primaryLight/30 to-telegram-primaryLight/10 flex items-center justify-center text-5xl mb-6">
                💼
              </div>
              <h3 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-2">Нет совместных бюджетов</h3>
              <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6 max-w-md mx-auto">
                Создайте совместный бюджет, чтобы управлять общими финансами с друзьями или семьей
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-6 py-3 bg-telegram-primary text-white rounded-lg hover:bg-telegram-primary/90 transition-colors font-medium text-lg"
              >
                ➕ Создать первый бюджет
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {budgets.map((budget) => (
                <div
                  key={budget.id}
                  className="card hover:shadow-xl transition-all duration-200 cursor-pointer border-2 border-transparent hover:border-telegram-primary/30 group"
                  onClick={() => handleViewBudget(budget)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-telegram-primary to-telegram-primary/70 flex items-center justify-center text-2xl">
                        💼
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-telegram-text dark:text-telegram-dark-text mb-1 group-hover:text-telegram-primary dark:group-hover:text-telegram-dark-primary transition-colors">
                          {budget.name}
                        </h3>
                        {budget.description && (
                          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary line-clamp-2">{budget.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm mb-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-telegram-primaryLight/20 dark:bg-telegram-dark-primary/20 rounded-full">
                      <span>👥</span>
                      <span className="font-medium text-telegram-text dark:text-telegram-dark-text">{budget.member_count}</span>
                      <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">участников</span>
                    </div>
                    <div className="px-3 py-1 bg-gray-100 dark:bg-telegram-dark-surface rounded-full font-medium text-telegram-text dark:text-telegram-dark-text">
                      {budget.currency}
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowInviteCode(budget.id)
                      }}
                      className="w-full px-4 py-2 bg-telegram-primaryLight/10 text-telegram-primary rounded-lg hover:bg-telegram-primaryLight/20 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                    >
                      <span>📋</span>
                      <span className="truncate">{budget.invite_code || 'Загрузка...'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Budget Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Создать совместный бюджет</h2>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setError('')
                    setCreateFormData({
                      name: '',
                      description: '',
                      currency: 'RUB',
                    })
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateBudget} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название бюджета <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createFormData.name}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Например: Семейный бюджет"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Валюта <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createFormData.currency}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, currency: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="RUB">₽ RUB</option>
                    <option value="USD">$ USD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Описание (необязательно)
                  </label>
                  <textarea
                    value={createFormData.description}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, description: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={3}
                    placeholder="Описание бюджета"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setError('')
                      setCreateFormData({
                        name: '',
                        description: '',
                        currency: 'RUB',
                      })
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                  <button type="submit" className="flex-1 btn-primary">
                    Создать
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Show Invite Code Modal */}
      {showInviteCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Код приглашения</h2>
                <button
                  onClick={() => setShowInviteCode(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {budgets.find(b => b.id === showInviteCode) && (
                <div>
                  <p className="text-gray-600 mb-4">
                    Отправьте этот код пользователю, чтобы он мог присоединиться к бюджету <strong>"{budgets.find(b => b.id === showInviteCode)?.name}"</strong>
                  </p>
                  
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <code className="text-3xl font-bold text-primary-600">
                        {budgets.find(b => b.id === showInviteCode)?.invite_code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(budgets.find(b => b.id === showInviteCode)?.invite_code || '')}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        {copiedCode === budgets.find(b => b.id === showInviteCode)?.invite_code ? '✓ Скопировано' : '📋 Копировать'}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const budget = budgets.find(b => b.id === showInviteCode)
                      if (budget && budget.invite_code) {
                        sendTelegramInvite(budget.invite_code, budget.name)
                      }
                    }}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 mb-3 flex items-center justify-center gap-2"
                  >
                    <span>📨</span>
                    <span>Отправить в Telegram</span>
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await api.regenerateInviteCode(showInviteCode)
                        await loadData()
                        setError('')
                      } catch (err: any) {
                        setError(err.message || 'Ошибка обновления кода')
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 mb-3"
                  >
                    🔄 Сгенерировать новый код
                  </button>

                  <button
                    onClick={() => setShowInviteCode(null)}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Закрыть
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Join by Code Modal */}
      {showJoinForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Присоединиться к бюджету</h2>
                <button
                  onClick={() => {
                    setShowJoinForm(false)
                    setJoinCode('')
                    setError('')
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleJoinByCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Код приглашения
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-2xl text-center font-bold tracking-widest"
                    placeholder="ABC123"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Введите 6-значный код, который вам предоставил администратор бюджета
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowJoinForm(false)
                      setJoinCode('')
                      setError('')
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                  <button type="submit" className="flex-1 btn-primary">
                    Присоединиться
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
