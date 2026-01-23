import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useI18n } from '../contexts/I18nContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

type BudgetGroup = 'needs' | 'wants' | 'savings'

interface Category {
  id: number
  name: string
  icon?: string
  color?: string
  transaction_type: 'income' | 'expense' | 'both'
  budget_group?: BudgetGroup | null
  is_favorite: boolean
  is_system: boolean
  is_active: boolean
  shared_budget_id?: number | null
  created_at: string
  updated_at: string
}

// Предустановленные цвета для категорий
const AVAILABLE_COLORS = [
  '#4CAF50', // Зеленый
  '#2196F3', // Синий
  '#FF9800', // Оранжевый
  '#F44336', // Красный
  '#9C27B0', // Фиолетовый
  '#00BCD4', // Голубой
  '#FFEB3B', // Желтый
  '#795548', // Коричневый
  '#607D8B', // Сине-серый
  '#E91E63', // Розовый
  '#3F51B5', // Индиго
  '#009688', // Бирюзовый
  '#FF5722', // Красно-оранжевый
  '#8BC34A', // Светло-зеленый
  '#FFC107', // Янтарный
  '#673AB7', // Глубокий фиолетовый
]

// Список доступных эмодзи для категорий (уникальные, без дубликатов)
const AVAILABLE_EMOJIS = [
  // Базовые финансы
  '📦', '💰', '💸', '💵', '💳', '💴', '💶', '💷', '💎', '💍',
  // Еда и напитки
  '🍔', '🍕', '🍟', '🌮', '🌯', '🥗', '🍱', '🍜', '🍝', '🍛',
  '🍲', '🍳', '🥘', '🍗', '🥩', '🍖', '🥓', '🌭', '🍞', '🥐',
  '🥨', '🥯', '🥞', '🧇', '🧀', '🍰', '🎂', '🍪', '🍩', '🍫',
  '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🍵', '🍶', '🍷',
  '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🧃', '🧉', '🧊',
  // Транспорт
  '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
  '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔',
  '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝',
  '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫',
  '🛬', '🛩️', '💺', '🚁', '🚀', '🛸', '🚤', '⛵', '🛥️',
  '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🗺️', '🧭',
  // Покупки и услуги
  '🛍️', '🛒', '🛏️', '🛋️', '🪑', '🚪', '🪟', '🪞', '🛁',
  '🛀', '🧴', '🧷', '🧹', '🧺', '🧻', '🧼', '🧽', '🧯',
  '🏪', '🏬', '🏫', '🏩', '🏨', '🏦', '🏥', '🏤', '🏢',
  '🏗️', '🏭', '🏯', '🏰', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋',
  // Развлечения и хобби
  '🎮', '🎯', '🎲', '🃏', '🀄', '🎴', '🎭', '🎨', '🖼️',
  '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🎹', '🥁', '🎷', '🎺',
  '🎸', '🪕', '🎻', '🎪',
  // Здоровье и спорт
  '🏃', '🏃‍♂️', '🏃‍♀️', '🚶', '🚶‍♂️', '🚶‍♀️', '🧍', '🧍‍♂️', '🧍‍♀️', '🧎',
  '🧎‍♂️', '🧎‍♀️', '🏋️', '🏋️‍♂️', '🏋️‍♀️', '🤼', '🤼‍♂️', '🤼‍♀️', '🤸', '🤸‍♂️',
  '🤸‍♀️', '🤺', '🤾', '🤾‍♂️', '🤾‍♀️', '🏌️', '🏌️‍♂️', '🏌️‍♀️', '🏇', '🧘',
  '🧘‍♂️', '🧘‍♀️', '🏄', '🏄‍♂️', '🏄‍♀️', '🏊', '🏊‍♂️', '🏊‍♀️', '🤽', '🤽‍♂️',
  '🤽‍♀️', '🚣', '🚣‍♂️', '🚣‍♀️', '🧗', '🧗‍♂️', '🧗‍♀️', '🚵', '🚵‍♂️', '🚵‍♀️',
  '🚴', '🚴‍♂️', '🚴‍♀️', '🏂', '⛷️',
  // Образование и работа
  '📚', '📖', '📗', '📘', '📙', '📕', '📓', '📔', '📒', '📃',
  '📜', '📄', '📑', '🧾', '📊', '📈', '📉', '🗂️', '📅', '📆',
  '🗒️', '🗓️', '📇', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐',
  '✂️', '🗑️', '🔒', '🔓', '🔏', '🔐', '🔑', '🗝️', '💼', '👜',
  '👝', '👛', '🎒', '🧳', '☂️', '🌂', '🧵', '🧶',
  // Технологии
  '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿',
  '📀', '📱', '📲', '☎️', '📞', '📟', '📠', '📺', '📻', '🎙️',
  '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
  '🔌', '💡', '🔦', '🕯️', '🛢️', '⚖️', '🛠️', '🔨', '⚒️', '🔧',
  '🔩', '⚙️', '⚡', '🔥', '💧', '🌊', '☄️', '🌟', '⭐', '✨', '💫', '💥',
  // Дом и быт
  '🏠', '🏡', '🏘️', '🏚️', '💒', '🗼', '🗽', '⛲', '⛺', '🌁',
  '🌃', '🏙️', '🌄', '🌅', '🌆', '🌇', '🌉', '♨️', '🎠', '🎡',
  '🎢', '💈',
  // Праздники и подарки
  '🎁', '🎀', '🎃', '🎄', '🎅', '🎆', '🎇', '🎈',
  '🎉', '🎊', '🎋', '🎌', '🎍', '🎎', '🎏', '🎐', '🎑', '🧧',
]


export function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [isTogglingAll, setIsTogglingAll] = useState(false)
  const [isEditingMode, setIsEditingMode] = useState(false)
  const [showFavoritesSection, setShowFavoritesSection] = useState(true)
  const [showAllCategoriesSection, setShowAllCategoriesSection] = useState(true)
  const { showError, showSuccess } = useToast()
  const { t, translateCategoryName } = useI18n()

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean
    message: string
    onConfirm: () => void | Promise<void>
  }>({
    show: false,
    message: '',
    onConfirm: () => {},
  })

  const [formData, setFormData] = useState({
    name: '',
    transaction_type: 'expense' as 'income' | 'expense' | 'both',
    icon: '',
    color: '#4CAF50',
    budget_group: 'needs' as BudgetGroup,
    is_favorite: false,
  })
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [filterType, showFavoritesOnly])

  // Закрываем выбор эмодзи при клике вне области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showEmojiPicker && !target.closest('.emoji-picker-container')) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const transactionType = filterType === 'all' ? undefined : filterType
      const cats = await api.getCategories(transactionType, showFavoritesOnly)
      setCategories(cats)
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      showError(t.categories.form.nameRequired)
      return
    }

    // Валидация длины названия
    const trimmedName = formData.name.trim()
    if (trimmedName.length > 25) {
      showError('Название категории не может превышать 25 символов')
      return
    }

    const budgetGroupValue = formData.transaction_type === 'income' ? null : formData.budget_group

    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          ...formData,
          name: trimmedName,
          budget_group: budgetGroupValue,
        })
        showSuccess(t.categories.form.updated)
      } else {
        await api.createCategory({
          ...formData,
          name: trimmedName,
          budget_group: budgetGroupValue,
        })
        showSuccess(t.categories.form.created)
      }
      resetForm()
      await loadCategories()
      // Автоматически открываем секцию "Все категории" после создания новой категории
      if (!formData.is_favorite) {
        setShowAllCategoriesSection(true)
      }
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
    }
  }

  const handleEdit = (category: Category) => {
    // Не позволяем редактировать системные категории
    if (category.is_system) {
      showError('Системные категории нельзя редактировать')
      return
    }
    setEditingCategory(category)
    // Если цвет категории не в списке доступных, используем цвет по умолчанию
    const categoryColor = category.color || '#4CAF50'
    const validColor = AVAILABLE_COLORS.includes(categoryColor) ? categoryColor : '#4CAF50'
    setFormData({
      name: category.name,
      transaction_type: category.transaction_type,
      icon: category.icon || '',
      color: validColor,
      budget_group: category.budget_group || 'needs',
      is_favorite: category.is_favorite,
    })
  }

  const handleDelete = (id: number) => {
    setConfirmModal({
      show: true,
      message: t.categories.form.deleteConfirm,
      onConfirm: async () => {
        try {
          await api.deleteCategory(id)
          showSuccess(t.categories.form.deleted)
          await loadCategories()
          setConfirmModal({ show: false, message: '', onConfirm: () => {} })
        } catch (err: any) {
          const { translateError } = await import('../utils/errorMessages')
          showError(translateError(err))
          setConfirmModal({ show: false, message: '', onConfirm: () => {} })
        }
      },
    })
  }

  const handleToggleFavorite = async (id: number, currentFavorite: boolean) => {
    try {
      await api.setCategoryFavorite(id, !currentFavorite)
      await loadCategories()
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
    }
  }

  const handleToggleAllFavorites = async () => {
    try {
      setIsTogglingAll(true)
      
      // Применяем фильтры к текущему списку категорий
      let visibleCategories = categories.filter(cat => {
        if (cat.is_system) return false
        if (filterType === 'all') return true
        if (filterType === 'income') return cat.transaction_type === 'income' || cat.transaction_type === 'both'
        if (filterType === 'expense') return cat.transaction_type === 'expense' || cat.transaction_type === 'both'
        return true
      })
      
      if (showFavoritesOnly) {
        visibleCategories = visibleCategories.filter(cat => cat.is_favorite)
      }
      
      if (visibleCategories.length === 0) {
        showError(t.categories.form.noCategoriesToChange)
        return
      }
      
      // Проверяем, все ли категории уже в избранном
      const allFavorite = visibleCategories.every(cat => cat.is_favorite)
      const targetFavorite = !allFavorite
      
      // Обновляем все категории
      const promises = visibleCategories.map(cat => 
        api.setCategoryFavorite(cat.id, targetFavorite)
      )
      
      await Promise.all(promises)
      
      // Правильное склонение слова "категория" в зависимости от числа
      const count = visibleCategories.length
      let categoryWord = 'категорий' // по умолчанию множественное число
      if (count === 1) {
        categoryWord = 'категории'
      } else if (count >= 2 && count <= 4) {
        categoryWord = 'категории'
      } else if (count >= 5 && count <= 20) {
        categoryWord = 'категорий'
      } else {
        // Для чисел больше 20 проверяем последнюю цифру
        const lastDigit = count % 10
        const lastTwoDigits = count % 100
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
          categoryWord = 'категорий'
        } else if (lastDigit === 1) {
          categoryWord = 'категории'
        } else if (lastDigit >= 2 && lastDigit <= 4) {
          categoryWord = 'категории'
        } else {
          categoryWord = 'категорий'
        }
      }
      
      const message = `Статус избранного изменен для ${count} ${categoryWord}`
      showSuccess(message)
      await loadCategories()
    } catch (err: any) {
      showError(err.message || 'Ошибка изменения статуса категорий')
    } finally {
      setIsTogglingAll(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      transaction_type: 'expense',
      icon: '',
      color: '#4CAF50',
      budget_group: 'needs',
      is_favorite: false,
    })
    setEditingCategory(null)
    setShowForm(false)
    setShowEmojiPicker(false)
  }

  const openCategoryDetails = (category: Category) => {
    setSelectedCategory(category)
  }

  const closeCategoryDetails = () => {
    setSelectedCategory(null)
  }

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'income':
        return t.categories.filters.transactionType.income
      case 'expense':
        return t.categories.filters.transactionType.expense
      case 'both':
        return t.categories.filters.transactionType.both
      default:
        return type
    }
  }

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'income':
        return '💰'
      case 'expense':
        return '💸'
      case 'both':
        return '💵'
      default:
        return '📦'
    }
  }

  const getBudgetGroupMeta = (group?: BudgetGroup | null) => {
    if (!group) return null
    const labels = t.categories.budgetGroups
    const colors: Record<BudgetGroup, string> = {
      needs: '#3B82F6',
      wants: '#EC4899',
      savings: '#22C55E',
    }
    return {
      label: labels[group],
      color: colors[group],
    }
  }

  const getBudgetGroupPercent = (group?: BudgetGroup | null) => {
    if (!group) return null
    const percents: Record<BudgetGroup, string> = {
      needs: '50%',
      wants: '30%',
      savings: '20%',
    }
    return percents[group]
  }

  const renderBudgetGroupDot = (group?: BudgetGroup | null) => {
    const meta = getBudgetGroupMeta(group)
    if (!meta) return null
    return (
      <span
        className="inline-block w-2 h-2 rounded-full opacity-70"
        style={{ backgroundColor: meta.color }}
        title={meta.label}
        aria-label={meta.label}
      />
    )
  }

  // When showFavoritesOnly is true, categories are already filtered on server
  // So we just need to filter by transaction type if needed
  const filteredCategories = categories.filter(cat => {
    if (filterType === 'all') return true
    if (filterType === 'income') return cat.transaction_type === 'income' || cat.transaction_type === 'both'
    if (filterType === 'expense') return cat.transaction_type === 'expense' || cat.transaction_type === 'both'
    return true
  })

  // When showFavoritesOnly is true, all categories from server are already favorites
  // So we display them all as favorites
  const favoriteCategories = showFavoritesOnly 
    ? filteredCategories  // All are favorites when filter is active
    : filteredCategories.filter(cat => cat.is_favorite)
  const regularCategories = showFavoritesOnly 
    ? []  // No regular categories when showing only favorites
    : filteredCategories.filter(cat => !cat.is_favorite)

  const showBudgetGroupSelect = formData.transaction_type !== 'income'

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text">{t.categories.title}</h1>
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
            Нажмите на категорию, чтобы открыть карточку и редактировать
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`px-4 py-2 rounded-telegram transition-all ${
              isEditingMode
                ? 'bg-telegram-primary text-white'
                : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
            }`}
          >
            {isEditingMode ? (
              <>
                ✓ <span className="hidden md:inline">{t.categories.filters.editing}</span>
              </>
            ) : (
              <>
                ✏️ <span className="hidden md:inline">{t.categories.filters.editing}</span>
              </>
            )}
          </button>
          {isEditingMode && (
            <button
              onClick={() => {
                resetForm()
                setShowForm(true)
                // Прокручиваем к форме создания после небольшой задержки для рендеринга
                setTimeout(() => {
                  const formElement = document.getElementById('new-category-form')
                  if (formElement) {
                    formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }, 100)
              }}
              className="btn-primary"
            >
              ➕ {t.categories.filters.addCategory}
            </button>
          )}
        </div>
      </div>


      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-telegram transition-all ${
            filterType === 'all'
              ? 'bg-telegram-primary text-white'
              : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
          }`}
        >
          {t.categories.filters.all}
        </button>
        <button
          onClick={() => setFilterType('expense')}
          className={`px-4 py-2 rounded-telegram transition-all ${
            filterType === 'expense'
              ? 'bg-telegram-primary text-white'
              : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
          }`}
        >
          💸 {t.categories.filters.expense}
        </button>
        <button
          onClick={() => setFilterType('income')}
          className={`px-4 py-2 rounded-telegram transition-all ${
            filterType === 'income'
              ? 'bg-telegram-primary text-white'
              : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
          }`}
        >
          💰 {t.categories.filters.income}
        </button>
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`px-4 py-2 rounded-telegram transition-all ${
            showFavoritesOnly
              ? 'bg-telegram-primary text-white'
              : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
          }`}
        >
          ⭐ {t.categories.filters.favorites}
        </button>
        {isEditingMode && filteredCategories.filter(cat => !cat.is_system).length > 0 && (
          <button
            onClick={handleToggleAllFavorites}
            disabled={isTogglingAll}
            className={`px-4 py-2 rounded-telegram transition-all border-2 ${
              filteredCategories.filter(cat => !cat.is_system).every(cat => cat.is_favorite)
                ? 'border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                : 'border-telegram-primary bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isTogglingAll ? (
              t.categories.filters.processing
            ) : filteredCategories.filter(cat => !cat.is_system).every(cat => cat.is_favorite) ? (
              t.categories.filters.removeAllFromFavorites
            ) : (
              t.categories.filters.addAllToFavorites
            )}
          </button>
        )}
      </div>

      {/* Create Form (only for new categories, not for editing) */}
      {showForm && !editingCategory && (
        <div 
          id="new-category-form"
          className="card mb-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">
              {editingCategory ? t.categories.filters.editCategory : t.categories.filters.newCategory}
            </h2>
            <button
              onClick={resetForm}
              className="text-telegram-textSecondary hover:text-telegram-text"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                {t.categories.form.nameLabel} <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const value = e.target.value
                  // Trim to 25 characters to prevent bypassing the limit
                  const trimmedValue = value.slice(0, 25)
                  setFormData({ ...formData, name: trimmedValue })
                }}
                className="input"
                placeholder={t.categories.form.namePlaceholder}
                maxLength={25}
                required
              />
              <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1 text-right">
                {formData.name.length}/25
              </div>
            </div>

            {showBudgetGroupSelect && (
              <div>
                <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                  {t.categories.form.budgetGroupLabel}
                </label>
                <select
                  value={formData.budget_group}
                  onChange={(e) => setFormData({ ...formData, budget_group: e.target.value as BudgetGroup })}
                  className="input text-sm"
                >
                  <option value="needs">{t.categories.budgetGroups.needs} (50%)</option>
                  <option value="wants">{t.categories.budgetGroups.wants} (30%)</option>
                  <option value="savings">{t.categories.budgetGroups.savings} (20%)</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                {t.categories.form.typeLabel} <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <select
                value={formData.transaction_type}
                onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value as any })}
                className="input"
                required
              >
                <option value="expense">💸 {t.categories.filters.transactionType.expense}</option>
                <option value="income">💰 {t.categories.filters.transactionType.income}</option>
                <option value="both">💵 {t.categories.filters.transactionType.both}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                {t.categories.form.iconLabel}
              </label>
              <div className="relative emoji-picker-container">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-full input flex items-center justify-between cursor-pointer hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors"
                >
                  <span className="text-2xl">{formData.icon || '📦'}</span>
                  <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                    {showEmojiPicker ? '▼' : '▶'}
                  </span>
                </button>
                {showEmojiPicker && (
                  <div className="absolute z-50 mt-2 w-full bg-telegram-surface dark:bg-telegram-dark-surface border border-telegram-border dark:border-telegram-dark-border rounded-telegram shadow-lg max-h-64 overflow-y-auto">
                    <div className="p-2 sm:p-3 grid grid-cols-6 sm:grid-cols-8 gap-1 sm:gap-2">
                      {AVAILABLE_EMOJIS.map((emoji, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, icon: emoji })
                            setShowEmojiPicker(false)
                          }}
                          className="text-xl sm:text-2xl p-1.5 sm:p-2 hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover rounded-telegram transition-colors active:scale-95"
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                {t.categories.form.iconHint}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                {t.categories.form.colorLabel}
              </label>
              <div className="grid grid-cols-8 gap-2">
                {AVAILABLE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, color: color })
                    }}
                    className={`w-full h-10 rounded-telegram transition-all relative ${
                      formData.color === color
                        ? 'ring-2 ring-telegram-primary ring-offset-2 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {formData.color === color && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold drop-shadow-lg">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_favorite"
                checked={formData.is_favorite}
                onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="is_favorite" className="text-sm text-telegram-text dark:text-telegram-dark-text">
                {t.categories.form.favoriteLabel}
              </label>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1">
                {editingCategory ? t.categories.form.save : t.categories.form.create}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
              >
                {t.categories.form.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-block mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-telegram-primaryLight/30 to-telegram-primaryLight/10 flex items-center justify-center text-5xl mb-6">
            📦
          </div>
          <h3 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-2">{t.categories.noCategories}</h3>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6">
            {t.categories.noCategoriesDesc}
          </p>
          <button 
            onClick={() => {
              setShowForm(true)
              // Прокручиваем к форме создания после небольшой задержки для рендеринга
              setTimeout(() => {
                const formElement = document.getElementById('new-category-form')
                if (formElement) {
                  formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }, 100)
            }} 
            className="btn-primary"
          >
            ➕ {t.categories.filters.addCategory}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Favorite Categories */}
          {favoriteCategories.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  ⭐ {showFavoritesOnly ? t.categories.filters.favorites : t.categories.filters.favoriteCategories}
                </span>
                {!showFavoritesOnly && (
                  <button
                    onClick={() => setShowFavoritesSection(!showFavoritesSection)}
                    className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-sm"
                    title={showFavoritesSection ? 'Скрыть' : 'Показать'}
                  >
                    {showFavoritesSection ? '▼' : '▶'}
                  </button>
                )}
              </h3>
              {(showFavoritesSection || showFavoritesOnly) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                  {favoriteCategories.map((category) => (
                    <div key={`category-wrapper-${category.id}`}>
                      <div
                        id={`category-${category.id}`}
                        className="card hover:shadow-lg transition-all relative group p-2 sm:p-3 md:p-4 cursor-pointer active:scale-[0.99]"
                        style={{
                          borderLeft: `3px solid ${category.color || '#4CAF50'}`,
                        }}
                        role="button"
                        tabIndex={0}
                        onClick={() => openCategoryDetails(category)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openCategoryDetails(category)
                          }
                        }}
                      >
                        {/* Кнопка редактирования в правом верхнем углу - только для несистемных категорий */}
                        {isEditingMode && !category.is_system && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(category)
                            }}
                            className="absolute top-2 right-2 p-1.5 text-telegram-primary hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover rounded-full transition-all active:scale-95"
                            title={t.common.edit}
                          >
                            <span className="text-base">✏️</span>
                          </button>
                        )}
                        
                        <div className="flex flex-col items-center gap-2">
                          {/* Иконка категории */}
                          <div
                            className="w-11 h-11 sm:w-12 sm:h-12 md:w-12 md:h-12 rounded-full flex items-center justify-center text-2xl md:text-2xl flex-shrink-0"
                            style={{ backgroundColor: `${category.color || '#4CAF50'}20` }}
                          >
                            {category.icon || '📦'}
                          </div>
                          
                          {/* Название категории */}
                          <div className="w-full text-center px-1">
                            <h4 className="font-semibold text-telegram-text dark:text-telegram-dark-text text-sm md:text-base mb-0.5 text-center leading-tight min-h-[2.5rem] flex items-start justify-center">
                              <span className="inline-flex items-start gap-1.5 clamp-2">
                                {renderBudgetGroupDot(category.budget_group)}
                                <span>{translateCategoryName(category.name)}</span>
                              </span>
                            </h4>
                            <p className="hidden sm:block text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1 leading-tight">
                              {getTransactionTypeIcon(category.transaction_type)} {getTransactionTypeLabel(category.transaction_type)}
                            </p>
                            {(category.is_system || category.shared_budget_id) && (
                              <div className="flex items-center justify-center gap-1.5 mt-1">
                                {category.is_system && (
                                  <span className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary" title="Базовая категория">
                                    📋
                                  </span>
                                )}
                                {category.shared_budget_id && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400" title="Общая категория">
                                    👥
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Кнопки редактирования - внизу карточки (только избранное и удаление) */}
                          {isEditingMode && (
                            <div className="flex items-center justify-center gap-2 w-full pt-2 border-t border-telegram-hover dark:border-telegram-dark-hover mt-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleFavorite(category.id, category.is_favorite)
                                }}
                                className="p-2 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-full transition-all active:scale-95"
                                title="Убрать из избранного"
                              >
                                <span className="text-base md:text-lg">⭐</span>
                              </button>
                              {!category.is_system && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete(category.id)
                                  }}
                                  className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all active:scale-95"
                                  title="Удалить"
                                >
                                  <span className="text-base md:text-lg">🗑️</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Regular Categories */}
          {!showFavoritesOnly && regularCategories.length > 0 && (
            <div>
              {!showFavoritesOnly && (
                <h3 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {favoriteCategories.length > 0 ? t.categories.filters.allCategories : t.categories.filters.categories}
                  </span>
                  <button
                    onClick={() => setShowAllCategoriesSection(!showAllCategoriesSection)}
                    className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-sm"
                    title={showAllCategoriesSection ? 'Скрыть' : 'Показать'}
                  >
                    {showAllCategoriesSection ? '▼' : '▶'}
                  </button>
                </h3>
              )}
              {showAllCategoriesSection && (
                regularCategories.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                    {regularCategories.map((category) => (
                      <div key={`category-wrapper-${category.id}`}>
                        <div
                          id={`category-${category.id}`}
                          className="card hover:shadow-lg transition-all relative group p-2 sm:p-3 md:p-4 cursor-pointer active:scale-[0.99]"
                          style={{
                            borderLeft: `3px solid ${category.color || '#4CAF50'}`,
                          }}
                          role="button"
                          tabIndex={0}
                          onClick={() => openCategoryDetails(category)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openCategoryDetails(category)
                            }
                          }}
                        >
                          {/* Кнопка редактирования в правом верхнем углу */}
                          {isEditingMode && (
                            <span
                              className="absolute top-2 right-2"
                              title={category.is_system ? 'Нельзя редактировать: системная категория' : 'Редактировать'}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (!category.is_system) {
                                    handleEdit(category)
                                  }
                                  if (category.is_system) {
                                    showError('Нельзя редактировать: системная категория')
                                  }
                                }}
                                className={`p-1.5 rounded-full transition-all active:scale-95 ${
                                  category.is_system
                                    ? 'text-telegram-textSecondary dark:text-telegram-dark-textSecondary opacity-50 cursor-not-allowed'
                                    : 'text-telegram-primary hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                                }`}
                                aria-label={category.is_system ? 'Нельзя редактировать: системная категория' : 'Редактировать'}
                                aria-disabled={category.is_system}
                              >
                                <span className="text-base">✏️</span>
                              </button>
                            </span>
                          )}
                          
                          <div className="flex flex-col items-center gap-2">
                            {/* Иконка категории */}
                            <div
                              className="w-11 h-11 sm:w-12 sm:h-12 md:w-12 md:h-12 rounded-full flex items-center justify-center text-2xl md:text-2xl flex-shrink-0"
                              style={{ backgroundColor: `${category.color || '#4CAF50'}20` }}
                            >
                              {category.icon || '📦'}
                            </div>
                            
                            {/* Название категории */}
                            <div className="w-full text-center px-1">
                              <h4 className="font-semibold text-telegram-text dark:text-telegram-dark-text text-sm md:text-base mb-0.5 text-center leading-tight min-h-[2.5rem] flex items-start justify-center">
                                <span className="inline-flex items-start gap-1.5 clamp-2">
                                  {renderBudgetGroupDot(category.budget_group)}
                                  <span>{translateCategoryName(category.name)}</span>
                                </span>
                              </h4>
                              <p className="hidden sm:block text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1 leading-tight">
                                {getTransactionTypeIcon(category.transaction_type)} {getTransactionTypeLabel(category.transaction_type)}
                              </p>
                              {(category.is_system || category.shared_budget_id) && (
                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                  {category.is_system && (
                                    <span className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary" title="Базовая категория">
                                      📋
                                    </span>
                                  )}
                                  {category.shared_budget_id && (
                                    <span className="text-xs text-blue-600 dark:text-blue-400" title="Общая категория">
                                      👥
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Кнопки редактирования - внизу карточки (только избранное и удаление) */}
                            {isEditingMode && (
                              <div className="flex items-center justify-center gap-2 w-full pt-2 border-t border-telegram-hover dark:border-telegram-dark-hover mt-auto">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleFavorite(category.id, category.is_favorite)
                                  }}
                                  className="p-2 text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-full transition-all active:scale-95"
                                  title="Добавить в избранное"
                                >
                                  <span className="text-base md:text-lg">⭐</span>
                                </button>
                                {!category.is_system && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDelete(category.id)
                                    }}
                                    className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all active:scale-95"
                                    title="Удалить"
                                  >
                                    <span className="text-base md:text-lg">🗑️</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      {showFavoritesOnly ? 'Нет избранных категорий' : 'Нет категорий в этом разделе'}
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Category Details Modal */}
      {selectedCategory && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={closeCategoryDetails}
        >
          <div
            className="bg-telegram-surface dark:bg-telegram-dark-surface rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-telegram-border dark:border-telegram-dark-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-telegram-border dark:border-telegram-dark-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: `${selectedCategory.color || '#4CAF50'}20` }}
                  >
                    {selectedCategory.icon || '📦'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text break-words">
                      {translateCategoryName(selectedCategory.name)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      <span className="inline-flex items-center gap-1">
                        {getTransactionTypeIcon(selectedCategory.transaction_type)} {getTransactionTypeLabel(selectedCategory.transaction_type)}
                      </span>
                      {selectedCategory.transaction_type !== 'income' && selectedCategory.budget_group && (
                        <span className="inline-flex items-center gap-1">
                          {renderBudgetGroupDot(selectedCategory.budget_group)}
                          {t.categories.budgetGroups[selectedCategory.budget_group]} · {getBudgetGroupPercent(selectedCategory.budget_group)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={closeCategoryDetails}
                  className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text transition-colors"
                  aria-label={t.common.close}
                  title={t.common.close}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {(selectedCategory.is_system || selectedCategory.shared_budget_id) && (
                <div className="mt-3 flex items-center gap-2">
                  {selectedCategory.is_system && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-telegram-border dark:border-telegram-dark-border text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                      📋 Системная
                    </span>
                  )}
                  {selectedCategory.shared_budget_id && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-telegram-border dark:border-telegram-dark-border text-blue-600 dark:text-blue-400">
                      👥 Общая
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-telegram border border-telegram-border dark:border-telegram-dark-border p-3">
                  <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">Цвет</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-full" style={{ backgroundColor: selectedCategory.color || '#4CAF50' }} />
                    <span className="text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                      {selectedCategory.color || '#4CAF50'}
                    </span>
                  </div>
                </div>
                <div className="rounded-telegram border border-telegram-border dark:border-telegram-dark-border p-3">
                  <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">Бюджетная группа</div>
                  <div className="mt-1 text-sm font-semibold text-telegram-text dark:text-telegram-dark-text">
                    {selectedCategory.transaction_type === 'income' || !selectedCategory.budget_group
                      ? '—'
                      : `${t.categories.budgetGroups[selectedCategory.budget_group]} (${getBudgetGroupPercent(selectedCategory.budget_group)})`}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <span
                  className="flex-1"
                  title={selectedCategory.is_system ? 'Нельзя редактировать: системная категория' : t.common.edit}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCategory.is_system) {
                        showError('Нельзя редактировать: системная категория')
                        return
                      }
                      closeCategoryDetails()
                      handleEdit(selectedCategory)
                    }}
                    className={`w-full px-4 py-3 rounded-telegram font-semibold transition-all ${
                      selectedCategory.is_system
                        ? 'bg-telegram-hover dark:bg-telegram-dark-hover text-telegram-textSecondary dark:text-telegram-dark-textSecondary cursor-not-allowed'
                        : 'bg-telegram-primary text-white hover:bg-telegram-primaryHover'
                    }`}
                    aria-label={selectedCategory.is_system ? 'Нельзя редактировать: системная категория' : t.common.edit}
                    aria-disabled={selectedCategory.is_system}
                  >
                    ✏️ {t.common.edit}
                  </button>
                </span>
                <button
                  type="button"
                  onClick={closeCategoryDetails}
                  className="px-4 py-3 rounded-telegram border border-telegram-border dark:border-telegram-dark-border bg-telegram-bg dark:bg-telegram-dark-bg text-telegram-text dark:text-telegram-dark-text font-semibold hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover"
                >
                  {t.common.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={resetForm}
        >
          <div 
            className="bg-telegram-surface dark:bg-telegram-dark-surface rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-telegram-border dark:border-telegram-dark-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">
                  {t.categories.filters.editCategory}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                    {t.categories.form.nameLabel} <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const value = e.target.value
                      const trimmedValue = value.slice(0, 25)
                      setFormData({ ...formData, name: trimmedValue })
                    }}
                    className="input"
                    placeholder={t.categories.form.namePlaceholder}
                    maxLength={25}
                    required
                  />
                  <div className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1 text-right">
                    {formData.name.length}/25
                  </div>
                </div>

                {showBudgetGroupSelect && (
                  <div>
                    <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                      {t.categories.form.budgetGroupLabel}
                    </label>
                    <select
                      value={formData.budget_group}
                      onChange={(e) => setFormData({ ...formData, budget_group: e.target.value as BudgetGroup })}
                      className="input text-sm"
                    >
                      <option value="needs">{t.categories.budgetGroups.needs} (50%)</option>
                      <option value="wants">{t.categories.budgetGroups.wants} (30%)</option>
                      <option value="savings">{t.categories.budgetGroups.savings} (20%)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                    {t.categories.form.typeLabel} <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <select
                    value={formData.transaction_type}
                    onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value as any })}
                    className="input"
                    required
                  >
                    <option value="expense">💸 {t.categories.filters.transactionType.expense}</option>
                    <option value="income">💰 {t.categories.filters.transactionType.income}</option>
                    <option value="both">💵 {t.categories.filters.transactionType.both}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                    {t.categories.form.iconLabel}
                  </label>
                  <div className="relative emoji-picker-container">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="w-full input flex items-center justify-between cursor-pointer hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors"
                    >
                      <span className="text-2xl">{formData.icon || '📦'}</span>
                      <span className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
                        {showEmojiPicker ? '▼' : '▶'}
                      </span>
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute z-50 mt-2 w-full bg-telegram-surface dark:bg-telegram-dark-surface border border-telegram-border dark:border-telegram-dark-border rounded-telegram shadow-lg max-h-64 overflow-y-auto">
                        <div className="p-2 sm:p-3 grid grid-cols-6 sm:grid-cols-8 gap-1 sm:gap-2">
                          {AVAILABLE_EMOJIS.map((emoji, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, icon: emoji })
                                setShowEmojiPicker(false)
                              }}
                              className="text-xl sm:text-2xl p-1.5 sm:p-2 hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover rounded-telegram transition-colors active:scale-95"
                              title={emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                    {t.categories.form.iconHint}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                    {t.categories.form.colorLabel}
                  </label>
                  <div className="grid grid-cols-8 gap-2">
                    {AVAILABLE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, color: color })
                        }}
                        className={`w-full h-10 rounded-telegram transition-all relative ${
                          formData.color === color
                            ? 'ring-2 ring-telegram-primary ring-offset-2 scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {formData.color === color && (
                          <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold drop-shadow-lg">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_favorite_edit"
                    checked={formData.is_favorite}
                    onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="is_favorite_edit" className="text-sm text-telegram-text dark:text-telegram-dark-text">
                    {t.categories.form.favoriteLabel}
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" className="btn-primary flex-1">
                    {t.categories.form.save}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-secondary"
                  >
                    {t.categories.form.cancel}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-4">
              Подтверждение
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

