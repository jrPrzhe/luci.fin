import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { getTelegramWebApp } from '../utils/telegram'
import { isVKWebApp, getVKMiniAppLink } from '../utils/vk'
import bridge from '@vkontakte/vk-bridge'
import { useToast } from '../contexts/ToastContext'
import { useI18n } from '../contexts/I18nContext'

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

// Функция для правильного склонения слова "участник" (используется внутри компонента с доступом к t)

// Account type icons mapping
const accountTypeIcons: Record<string, string> = {
  cash: '💵',
  bank_card: '💳',
  bank_account: '🏦',
  e_wallet: '📱',
  credit_card: '💳',
  investment: '📈',
  other: '📦',
}

export function SharedBudgets() {
  const { showSuccess, showError } = useToast()
  const { t, language } = useI18n()
  
  // Функция для правильного склонения слова "участник"
  const getParticipantWord = (count: number): string => {
    if (language === 'en') {
      return count === 1 ? t.sharedBudgets.participant : t.sharedBudgets.participants
    }
    
    // Русский язык - склонение
    const lastDigit = count % 10
    const lastTwoDigits = count % 100
    
    // Для чисел 11-14 всегда "участников"
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return t.sharedBudgets.participants5
    }
    
    // Для чисел, оканчивающихся на 1 - "участник"
    if (lastDigit === 1) {
      return t.sharedBudgets.participant
    }
    
    // Для чисел, оканчивающихся на 2, 3, 4 - "участника"
    if (lastDigit >= 2 && lastDigit <= 4) {
      return t.sharedBudgets.participants2
    }
    
    // Для остальных - "участников"
    return t.sharedBudgets.participants5
  }
  
  // Account type labels mapping
  const accountTypeLabels: Record<string, string> = {
    cash: t.accounts.types.cash,
    bank_card: t.accounts.types.bank_card,
    bank_account: t.accounts.types.bank_account,
    e_wallet: t.accounts.types.e_wallet,
    credit_card: t.accounts.types.credit_card,
    investment: t.accounts.types.investment,
    other: t.accounts.types.other,
  }
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

  // Confirmation modals state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean
    message: string
    onConfirm: () => void | Promise<void>
  }>({
    show: false,
    message: '',
    onConfirm: () => {},
  })

  // Create form state
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    currency: 'RUB',
  })


  useEffect(() => {
    loadData()
    loadCurrentUser()
    
    // Check for inviteCode in URL hash (from VK Mini App link)
    // Format: #/shared-budgets?inviteCode=ABC123 or #?inviteCode=ABC123
    const hash = window.location.hash
    if (hash) {
      // Extract query string from hash (everything after ?)
      const hashParts = hash.split('?')
      if (hashParts.length > 1) {
        const hashParams = new URLSearchParams(hashParts[1])
        const inviteCode = hashParams.get('inviteCode')
        if (inviteCode) {
          // Auto-fill join form and show it
          setJoinCode(inviteCode.toUpperCase().trim())
          setShowJoinForm(true)
          // Clear inviteCode from hash to avoid re-triggering, but keep the path
          const pathPart = hashParts[0] || '#'
          hashParams.delete('inviteCode')
          const newHash = hashParams.toString() 
            ? `${pathPart}?${hashParams.toString()}`
            : pathPart
          window.history.replaceState(null, '', window.location.pathname + window.location.search + newHash)
        }
      }
    }
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
      const { translateError } = await import('../utils/errorMessages')
      setError(translateError(err))
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
      const { translateError } = await import('../utils/errorMessages')
      setError(translateError(err))
    }
  }

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!createFormData.name.trim()) {
      setError(t.sharedBudgets.nameRequired)
      return
    }

    const trimmedName = createFormData.name.trim()
    if (trimmedName.length > 100) {
      setError(t.sharedBudgets.nameMaxLength)
      return
    }

    try {
      await api.createSharedBudget({
        name: trimmedName,
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
      const { translateError } = await import('../utils/errorMessages')
      setError(translateError(err))
    }
  }


  const handleAcceptInvitation = async (token: string) => {
    try {
      await api.acceptInvitation(token, undefined)
      await loadData()
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      setError(translateError(err))
    }
  }

  const handleDeclineInvitation = async (invitationId: number) => {
    try {
      await api.declineInvitation(invitationId)
      await loadData()
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      setError(translateError(err))
    }
  }

  const handleViewBudget = async (budget: SharedBudget) => {
    setError('') // Очищаем ошибку при переходе к другому бюджету
    setSelectedBudget(budget)
    await loadMembers(budget.id)
  }

  const handleRemoveMember = async (budgetId: number, userId: number) => {
    setConfirmModal({
      show: true,
      message: t.sharedBudgets.removeMemberConfirm,
      onConfirm: async () => {
        try {
          await api.removeMember(budgetId, userId)
          await loadMembers(budgetId)
          await loadData()
          setConfirmModal({ show: false, message: '', onConfirm: () => {} })
        } catch (err: any) {
          const { translateError } = await import('../utils/errorMessages')
          setError(translateError(err))
          setConfirmModal({ show: false, message: '', onConfirm: () => {} })
        }
      },
    })
  }

  const handleUpdateRole = async (budgetId: number, userId: number, newRole: 'admin' | 'member') => {
    const roleName = newRole === 'admin' ? t.sharedBudgets.admin : t.sharedBudgets.member
    setConfirmModal({
      show: true,
      message: t.sharedBudgets.updateRoleConfirm.replace('{role}', roleName),
      onConfirm: async () => {
        try {
          await api.updateMemberRole(budgetId, userId, newRole)
          await loadMembers(budgetId)
          await loadData()
          setConfirmModal({ show: false, message: '', onConfirm: () => {} })
        } catch (err: any) {
          const { translateError } = await import('../utils/errorMessages')
          setError(translateError(err))
          setConfirmModal({ show: false, message: '', onConfirm: () => {} })
        }
      },
    })
  }

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!joinCode.trim()) {
      setError(t.sharedBudgets.codeRequired)
      return
    }

    try {
      const response = await api.acceptInvitation(undefined, joinCode.toUpperCase().trim())
      
      // Check if API returned a message indicating user is already a member
      // API returns 200 with message "You are already a member of this budget" instead of error
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as any).message
        if (typeof message === 'string' && 
            (message.toLowerCase().includes('already a member') || 
             message.toLowerCase().includes('уже являетесь участником'))) {
          setError(t.sharedBudgets.joinSuccess) // Используем существующий ключ или можно добавить новый
          return
        }
      }
      
      // Successfully joined
      setJoinCode('')
      setShowJoinForm(false)
      setError('')
      await loadData()
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      setError(translateError(err))
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

  const sendVKInvite = async (inviteCode: string, budgetName: string) => {
    if (!isVKWebApp()) {
      // Not in VK, fallback to copying
      copyToClipboard(inviteCode)
      showSuccess(`Код приглашения скопирован: ${inviteCode}`)
      return
    }

    try {
      // Generate link to VK Mini App with invite code parameter
      // This ensures users open the app in VK Mini App with proper authentication
      const miniAppLink = getVKMiniAppLink('/shared-budgets', {
        inviteCode: inviteCode
      })
      
      // Create invitation message with code
      const shareMessage = `Приглашаю тебя в бюджет "${budgetName}", вот код #${inviteCode}`
      
      // Use VK Bridge share functionality with Mini App link and message
      await bridge.send('VKWebAppShare', {
        link: miniAppLink,
        text: shareMessage
      })
      
      // Also copy to clipboard as fallback with budget name
      const message = `Приглашение в совместный бюджет "${budgetName}"\n\nКод: ${inviteCode}\n\nСсылка: ${miniAppLink}`
      copyToClipboard(message)
    } catch (err) {
      // Fallback: copy to clipboard with budget name and Mini App link
      const miniAppLink = getVKMiniAppLink('/shared-budgets', {
        inviteCode: inviteCode
      })
      const message = `Приглашение в совместный бюджет "${budgetName}"\n\nКод: ${inviteCode}\n\nСсылка: ${miniAppLink}`
      copyToClipboard(message)
      showSuccess(`Код приглашения скопирован: ${inviteCode}\n\nОтправьте его пользователю во ВКонтакте.`)
    }
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
          <div className="text-lg">{t.common.loading}</div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              {t.common.confirm}
            </h2>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6">
              {confirmModal.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  confirmModal.onConfirm()
                }}
                className="flex-1 btn-primary text-sm md:text-base py-2.5 md:py-3"
              >
                {t.common.yes}
              </button>
              <button
                onClick={() => {
                  setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                }}
                className="flex-1 btn-secondary text-sm md:text-base py-2.5 md:py-3"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-1">💼 {t.sharedBudgets.title}</h1>
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.sharedBudgets.noBudgetsDesc}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              setError('') // Очищаем ошибку при открытии модалки присоединения
              setShowJoinForm(true)
            }}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
          >
            🔗 {t.sharedBudgets.joinBudget}
          </button>
          <button
            onClick={() => {
              setError('') // Очищаем ошибку при открытии модалки создания
              setShowCreateForm(true)
            }}
            className="px-4 py-2 bg-telegram-primary text-white rounded-lg hover:bg-telegram-primary/90 transition-colors font-medium"
          >
            ➕ {t.sharedBudgets.createBudget}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="sticky top-0 z-40 mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError('')}
              className="flex-shrink-0 text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 transition-colors p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40"
              aria-label={t.common.close}
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📬</span>
              <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">{t.sharedBudgets.invitations}</h2>
            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
              {invitations.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="card border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl flex-shrink-0">🎯</span>
                      <h3 className="font-semibold text-lg text-telegram-text dark:text-telegram-dark-text truncate break-words" title={invitation.shared_budget_name}>
                        {invitation.shared_budget_name}
                      </h3>
                    </div>
                    <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-2">
                      👤 {t.common.from}: <strong className="text-telegram-text dark:text-telegram-dark-text">{invitation.invited_by_name}</strong>
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
                      ✓ {t.sharedBudgets.accept}
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(invitation.id)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium whitespace-nowrap"
                    >
                      ✕ {t.sharedBudgets.decline}
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
            onClick={() => {
              setError('') // Очищаем ошибку при переходе к списку
              setSelectedBudget(null)
            }}
            className="mb-4 flex items-center gap-2 text-telegram-primary hover:text-telegram-primary/80 transition-colors font-medium"
          >
            <span>←</span>
            <span>{t.common.back}</span>
          </button>
          
          <div className="card mb-6 bg-gradient-to-br from-telegram-primaryLight/10 to-white border-2 border-telegram-primary/20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-telegram-primary to-telegram-primary/70 flex items-center justify-center text-3xl flex-shrink-0">
                    💼
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h2 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text mb-1 break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }} title={selectedBudget.name}>{selectedBudget.name}</h2>
                    {selectedBudget.description && (
                      <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{selectedBudget.description}</p>
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
                    <span className="text-sm font-medium text-telegram-text dark:text-telegram-dark-text">{selectedBudget.member_count} {getParticipantWord(selectedBudget.member_count)}</span>
                  </div>
                </div>
              </div>
              {/* Show "Delete Budget" for creator, "Leave" for other members */}
              {currentUser && selectedBudget.created_by === currentUser.id ? (
                <button
                  onClick={() => {
                    setConfirmModal({
                      show: true,
                      message: t.sharedBudgets.deleteBudgetConfirm,
                      onConfirm: async () => {
                        try {
                          await api.deleteBudget(selectedBudget.id)
                          setSelectedBudget(null)
                          await loadData()
                          showSuccess(t.sharedBudgets.deleted || 'Бюджет успешно удален')
                          setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                        } catch (err: any) {
                          setError(err.message || 'Ошибка удаления бюджета')
                          setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                        }
                      },
                    })
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium whitespace-nowrap"
                >
                  🗑️ {t.sharedBudgets.delete || 'Удалить бюджет'}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      await api.leaveBudget(selectedBudget.id)
                      setSelectedBudget(null)
                      await loadData()
                      showSuccess(t.sharedBudgets.leaveSuccess)
                    } catch (err: any) {
                      // Check if error is about being the last admin
                      if (err.message && (err.message.includes('LAST_ADMIN_CANNOT_LEAVE') || err.message.includes('последний администратор'))) {
                        setConfirmModal({
                          show: true,
                          message: 'Вы не можете выйти из бюджета, так как являетесь единственным администратором.\n\nПеред выходом необходимо назначить другого участника администратором. Для этого нажмите на кнопку "⭐ Сделать админом" рядом с нужным участником.',
                          onConfirm: () => {
                            setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                          },
                        })
                      } else {
                        setError(err.message || 'Ошибка выхода из бюджета')
                      }
                    }
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium whitespace-nowrap"
                >
                  🚪 {t.sharedBudgets.leave}
                </button>
              )}
            </div>
          </div>

          <div className="mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <h3 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">{t.sharedBudgets.accounts}</h3>
              </div>
              <button
                onClick={() => {
                  setError('') // Очищаем ошибку при открытии модалки с кодом
                  setShowInviteCode(selectedBudget.id)
                }}
                className="px-4 py-2 bg-telegram-primary text-white rounded-lg hover:bg-telegram-primary/90 transition-colors font-medium"
              >
                📋 {t.sharedBudgets.inviteCode}
              </button>
            </div>
            {sharedAccounts.length === 0 ? (
              (() => {
                // Check if current user is admin of this budget
                const currentUserMember = members.find(m => currentUser && m.user_id === currentUser.id)
                const currentUserIsAdmin = currentUserMember?.role === 'admin'
                
                // Only show the hint to admins
                if (!currentUserIsAdmin) {
                  return (
                    <div className="card p-6 text-center bg-gray-50 border-2 border-dashed border-gray-300">
                      <div className="text-4xl mb-3">💳</div>
                      <p className="text-telegram-text dark:text-telegram-dark-text font-medium mb-2">{t.sharedBudgets.noAccounts}</p>
                    </div>
                  )
                }
                
                return (
                  <div className="card p-6 text-center bg-gray-50 border-2 border-dashed border-gray-300">
                    <div className="text-4xl mb-3">💳</div>
                    <p className="text-telegram-text dark:text-telegram-dark-text font-medium mb-2">{t.sharedBudgets.noAccounts}</p>
                    <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{t.sharedBudgets.noAccountsDesc}</p>
                  </div>
                )
              })()
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sharedAccounts.map((account) => (
                  <div key={account.id} className="card hover:shadow-lg transition-shadow border-l-4 border-l-telegram-primary">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-telegram-text dark:text-telegram-dark-text text-lg">{account.name}</h4>
                      <span className="text-2xl">{accountTypeIcons[account.type] || accountTypeIcons.other}</span>
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
                      {accountTypeLabels[account.type] || accountTypeLabels.other}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">👥</span>
              <h3 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">{t.sharedBudgets.members}</h3>
              <span className="px-2 py-1 bg-telegram-primaryLight/20 text-telegram-primary rounded-full text-xs font-semibold">
                {members.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.map((member) => {
                const memberName = member.user_name || member.user_email || `Пользователь #${member.user_id}`
                const currentUserMember = members.find(m => currentUser && m.user_id === currentUser.id)
                const currentUserIsAdmin = currentUserMember?.role === 'admin'
                const adminCount = members.filter(m => m.role === 'admin').length
                const isCurrentUser = currentUser && member.user_id === currentUser.id
                
                // Truncate name if too long (more than 20 characters)
                const displayName = memberName.length > 20 ? `${memberName.substring(0, 20)}...` : memberName
                
                return (
                  <div key={member.id} className="card hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${
                        member.role === 'admin' 
                          ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' 
                          : 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                      }`}>
                        {member.user_name?.[0]?.toUpperCase() || member.user_email?.[0]?.toUpperCase() || '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 
                          className="font-semibold text-telegram-text dark:text-telegram-dark-text break-words"
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                          title={memberName}
                        >
                          {displayName}
                        </h4>
                        <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                          {member.role === 'admin' ? `👑 ${t.sharedBudgets.adminRole}` : `👤 ${t.sharedBudgets.memberRole}`}
                        </p>
                        <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                          📅 {formatDate(member.joined_at)}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      // Show admin controls only if current user is admin
                      if (currentUserIsAdmin && !isCurrentUser) {
                        return (
                          <div className="flex gap-2 pt-3 border-t border-telegram-border dark:border-telegram-dark-border">
                            {/* Role change button */}
                            <button
                              onClick={() => handleUpdateRole(
                                selectedBudget.id, 
                                member.user_id, 
                                member.role === 'admin' ? 'member' : 'admin'
                              )}
                              className="px-3 py-1.5 text-xs font-medium rounded-telegram transition-colors whitespace-nowrap flex-1"
                              style={{
                                backgroundColor: member.role === 'admin' 
                                  ? '#F59E0B' 
                                  : '#3B82F6',
                                color: 'white'
                              }}
                              title={member.role === 'admin' ? t.sharedBudgets.memberRole : t.sharedBudgets.adminRole}
                            >
                              {member.role === 'admin' ? `👑 ${t.sharedBudgets.adminRole}` : `⭐ ${t.sharedBudgets.makeAdmin}`}
                            </button>
                            {/* Delete button - only if not the only admin */}
                            {!(member.role === 'admin' && adminCount === 1) && (
                              <button
                                onClick={() => handleRemoveMember(selectedBudget.id, member.user_id)}
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex-shrink-0"
                                title={t.sharedBudgets.removeMember}
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
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          {budgets.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-block mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-telegram-primaryLight/30 to-telegram-primaryLight/10 flex items-center justify-center text-5xl mb-6">
                💼
              </div>
              <h3 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-2">{t.sharedBudgets.noBudgets}</h3>
              <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6 max-w-md mx-auto">
                {t.sharedBudgets.noBudgetsDesc}
              </p>
              <button
                onClick={() => {
                  setError('') // Очищаем ошибку при открытии модалки создания
                  setShowCreateForm(true)
                }}
                className="px-6 py-3 bg-telegram-primary text-white rounded-lg hover:bg-telegram-primary/90 transition-colors font-medium text-lg"
              >
                ➕ {t.sharedBudgets.newBudget}
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
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-telegram-primary to-telegram-primary/70 flex items-center justify-center text-2xl flex-shrink-0">
                        💼
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg text-telegram-text dark:text-telegram-dark-text mb-1 group-hover:text-telegram-primary dark:group-hover:text-telegram-dark-primary transition-colors truncate" title={budget.name}>
                          {budget.name}
                        </h3>
                        {budget.description && (
                          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary line-clamp-2 break-words">{budget.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm mb-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-telegram-primaryLight/20 dark:bg-telegram-dark-primary/20 rounded-full">
                      <span>👥</span>
                      <span className="font-medium text-telegram-text dark:text-telegram-dark-text">{budget.member_count}</span>
                      <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">{getParticipantWord(budget.member_count)}</span>
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
                      <span className="truncate">{budget.invite_code || t.common.loading}</span>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text">{t.sharedBudgets.createBudgetTitle}</h2>
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
                  className="text-gray-400 dark:text-telegram-dark-textSecondary hover:text-gray-600 dark:hover:text-telegram-dark-text text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateBudget} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {t.sharedBudgets.budgetName} <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={createFormData.name}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-telegram-dark-border rounded-lg focus:ring-2 focus:ring-telegram-primary dark:focus:ring-telegram-dark-primary focus:border-transparent bg-white dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text"
                    placeholder={t.sharedBudgets.budgetNamePlaceholder}
                    maxLength={100}
                    required
                  />
                  <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                    {createFormData.name.length}/100 {t.common.characters}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {t.sharedBudgets.currency} <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <select
                    value={createFormData.currency}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, currency: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-telegram-dark-border rounded-lg focus:ring-2 focus:ring-telegram-primary dark:focus:ring-telegram-dark-primary focus:border-transparent bg-white dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text"
                  >
                    <option value="RUB">₽ RUB</option>
                    <option value="USD">$ USD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {t.sharedBudgets.description} ({t.common.optional})
                  </label>
                  <textarea
                    value={createFormData.description}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, description: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-telegram-dark-border rounded-lg focus:ring-2 focus:ring-telegram-primary dark:focus:ring-telegram-dark-primary focus:border-transparent bg-white dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text resize-none"
                    rows={3}
                    style={{ resize: 'none', maxHeight: '120px', overflowY: 'auto' }}
                    placeholder={t.sharedBudgets.descriptionPlaceholder}
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
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-telegram-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-telegram-dark-hover text-telegram-text dark:text-telegram-dark-text"
                  >
                    {t.common.cancel}
                  </button>
                  <button type="submit" className="flex-1 btn-primary">
                    {t.sharedBudgets.create}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Show Invite Code Modal */}
      {showInviteCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text">{t.sharedBudgets.inviteCode}</h2>
                <button
                  onClick={() => {
                    setError('') // Очищаем ошибку при закрытии модалки
                    setShowInviteCode(null)
                  }}
                  className="text-gray-400 dark:text-telegram-dark-textSecondary hover:text-gray-600 dark:hover:text-telegram-dark-text text-2xl"
                >
                  ×
                </button>
              </div>

              {budgets.find(b => b.id === showInviteCode) && (
                <div>
                  <p className="text-gray-600 dark:text-telegram-dark-textSecondary mb-4 break-words">
                    {t.sharedBudgets.inviteCodeDesc.replace('{budgetName}', `"${budgets.find(b => b.id === showInviteCode)?.name}"`)}
                  </p>
                  
                  <div className="bg-gray-50 dark:bg-telegram-dark-hover p-4 rounded-lg mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <code className="text-3xl font-bold text-telegram-primary dark:text-telegram-dark-primary">
                        {budgets.find(b => b.id === showInviteCode)?.invite_code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(budgets.find(b => b.id === showInviteCode)?.invite_code || '')}
                        className="px-4 py-2 bg-telegram-primary dark:bg-telegram-dark-primary text-white rounded-lg hover:bg-telegram-primaryHover dark:hover:bg-telegram-dark-primaryHover"
                      >
                        {copiedCode === budgets.find(b => b.id === showInviteCode)?.invite_code ? `✓ ${t.common.copied}` : `📋 ${t.common.copy}`}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const budget = budgets.find(b => b.id === showInviteCode)
                      if (budget && budget.invite_code) {
                        if (isVKWebApp()) {
                          sendVKInvite(budget.invite_code, budget.name)
                        } else {
                          sendTelegramInvite(budget.invite_code, budget.name)
                        }
                      }
                    }}
                    className="w-full px-4 py-2 bg-blue-500 dark:bg-telegram-primary text-white rounded-lg hover:bg-blue-600 dark:hover:bg-telegram-primaryHover mb-3 flex items-center justify-center gap-2"
                  >
                    <span>📨</span>
                    <span>{isVKWebApp() ? t.sharedBudgets.sendToVK : t.sharedBudgets.sendToTelegram}</span>
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await api.regenerateInviteCode(showInviteCode)
                        await loadData()
                        setError('')
                        showSuccess(t.sharedBudgets.inviteCodeRegenerated)
                      } catch (err: any) {
                        const errorMessage = err.message || t.sharedBudgets.inviteCodeRegenerateError
                        showError(errorMessage)
                        setError('') // Очищаем локальное состояние ошибки, так как используем Toast
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-telegram-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-telegram-dark-hover mb-3 text-telegram-text dark:text-telegram-dark-text"
                  >
                    🔄 {t.sharedBudgets.regenerateCode}
                  </button>

                  <button
                    onClick={() => {
                      setError('') // Очищаем ошибку при закрытии модалки
                      setShowInviteCode(null)
                    }}
                    className="w-full px-4 py-2 bg-gray-200 dark:bg-telegram-dark-surface text-gray-700 dark:text-telegram-dark-text rounded-lg hover:bg-gray-300 dark:hover:bg-telegram-dark-hover"
                  >
                    {t.common.close}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Join by Code Modal */}
      {showJoinForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text">{t.sharedBudgets.joinBudgetTitle}</h2>
                <button
                  onClick={() => {
                    setShowJoinForm(false)
                    setJoinCode('')
                    setError('')
                  }}
                  className="text-gray-400 dark:text-telegram-dark-textSecondary hover:text-gray-600 dark:hover:text-telegram-dark-text text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleJoinByCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-1">
                    {t.sharedBudgets.inviteCode}
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      // Remove spaces and limit to 6 characters
                      const value = e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 6)
                      setJoinCode(value)
                    }}
                    onPaste={(e) => {
                      e.preventDefault()
                      // Get pasted text, remove spaces, uppercase, limit to 6 chars
                      const pastedText = e.clipboardData.getData('text').replace(/\s/g, '').toUpperCase().slice(0, 6)
                      setJoinCode(pastedText)
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-telegram-dark-border rounded-lg focus:ring-2 focus:ring-telegram-primary dark:focus:ring-telegram-dark-primary focus:border-transparent text-2xl text-center font-bold tracking-widest bg-white dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text"
                    placeholder="ABC123"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-telegram-dark-textSecondary mt-2">
                    {t.sharedBudgets.enterInviteCode}
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
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
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-telegram-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-telegram-dark-hover text-telegram-text dark:text-telegram-dark-text"
                  >
                    {t.common.cancel}
                  </button>
                  <button type="submit" className="flex-1 btn-primary">
                    {t.sharedBudgets.join}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-telegram-dark-surface rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              {confirmModal.message.includes('не можете выйти') ? 'Внимание' : 'Подтверждение'}
            </h2>
            <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6 whitespace-pre-line">
              {confirmModal.message}
            </p>
            <div className="flex gap-3">
              {confirmModal.message.includes('не можете выйти') ? (
                // Информационное сообщение - только кнопка "Понятно"
                <button
                  onClick={() => {
                    setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                  }}
                  className="flex-1 btn-primary text-sm md:text-base py-2.5 md:py-3"
                >
                  Понятно
                </button>
              ) : (
                // Обычное подтверждение - кнопки "Да" и "Отмена"
                <>
                  <button
                    onClick={() => {
                      confirmModal.onConfirm()
                    }}
                    className="flex-1 btn-primary text-sm md:text-base py-2.5 md:py-3"
                  >
                    Да
                  </button>
                  <button
                    onClick={() => {
                      setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                    }}
                    className="flex-1 btn-secondary text-sm md:text-base py-2.5 md:py-3"
                  >
                    Отмена
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

