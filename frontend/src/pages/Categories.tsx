import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useI18n } from '../contexts/I18nContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface Category {
  id: number
  name: string
  icon?: string
  color?: string
  transaction_type: 'income' | 'expense' | 'both'
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

    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          ...formData,
          name: trimmedName
        })
        showSuccess(t.categories.form.updated)
      } else {
        await api.createCategory({
          ...formData,
          name: trimmedName
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
      is_favorite: false,
    })
    setEditingCategory(null)
    setShowForm(false)
    setShowEmojiPicker(false)
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

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text">{t.categories.title}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`px-4 py-2 rounded-telegram transition-all ${
              isEditingMode
                ? 'bg-telegram-primary text-white'
                : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
            }`}
          >
            {isEditingMode ? `✓ ${t.categories.filters.editing}` : '✏️'}
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                  {favoriteCategories.map((category) => (
                    <div key={`category-wrapper-${category.id}`}>
                      <div
                        id={`category-${category.id}`}
                        className="card hover:shadow-lg transition-all relative group p-2 md:p-4"
                        style={{
                          borderLeft: `3px solid ${category.color || '#4CAF50'}`,
                        }}
                      >
                        {/* Кнопка редактирования в правом верхнем углу - только для несистемных категорий */}
                        {isEditingMode && !category.is_system && (
                          <button
                            onClick={() => handleEdit(category)}
                            className="absolute top-2 right-2 p-1.5 text-telegram-primary hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover rounded-full transition-all active:scale-95"
                            title={t.common.edit}
                          >
                            <span className="text-base">✏️</span>
                          </button>
                        )}
                        
                        <div className="flex flex-col items-center gap-2 md:gap-2.5">
                          {/* Иконка категории */}
                          <div
                            className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-xl md:text-2xl lg:text-3xl flex-shrink-0"
                            style={{ backgroundColor: `${category.color || '#4CAF50'}20` }}
                          >
                            {category.icon || '📦'}
                          </div>
                          
                          {/* Название категории */}
                          <div className="w-full text-center px-2">
                            <h4 className="font-semibold text-telegram-text dark:text-telegram-dark-text text-sm md:text-base lg:text-lg mb-1 text-center break-words">
                              {translateCategoryName(category.name)}
                            </h4>
                            <p className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1">
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
                                onClick={() => handleToggleFavorite(category.id, category.is_favorite)}
                                className="p-2 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-full transition-all active:scale-95"
                                title="Убрать из избранного"
                              >
                                <span className="text-base md:text-lg">⭐</span>
                              </button>
                              {!category.is_system && (
                                <button
                                  onClick={() => handleDelete(category.id)}
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
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                    {regularCategories.map((category) => (
                      <div key={`category-wrapper-${category.id}`}>
                        <div
                          id={`category-${category.id}`}
                          className="card hover:shadow-lg transition-all relative group p-2 md:p-4"
                          style={{
                            borderLeft: `3px solid ${category.color || '#4CAF50'}`,
                          }}
                        >
                          {/* Кнопка редактирования в правом верхнем углу */}
                          {isEditingMode && (
                            <button
                              onClick={() => handleEdit(category)}
                              className="absolute top-2 right-2 p-1.5 text-telegram-primary hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover rounded-full transition-all active:scale-95"
                              title="Редактировать"
                            >
                              <span className="text-base">✏️</span>
                            </button>
                          )}
                          
                          <div className="flex flex-col items-center gap-2 md:gap-2.5">
                            {/* Иконка категории */}
                            <div
                              className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-xl md:text-2xl lg:text-3xl flex-shrink-0"
                              style={{ backgroundColor: `${category.color || '#4CAF50'}20` }}
                            >
                              {category.icon || '📦'}
                            </div>
                            
                            {/* Название категории */}
                            <div className="w-full text-center px-2">
                              <h4 className="font-semibold text-telegram-text dark:text-telegram-dark-text text-sm md:text-base lg:text-lg mb-1 text-center break-words">
                                {translateCategoryName(category.name)}
                              </h4>
                              <p className="text-xs md:text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-1">
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
                                  onClick={() => handleToggleFavorite(category.id, category.is_favorite)}
                                  className="p-2 text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-full transition-all active:scale-95"
                                  title="Добавить в избранное"
                                >
                                  <span className="text-base md:text-lg">⭐</span>
                                </button>
                                {!category.is_system && (
                                  <button
                                    onClick={() => handleDelete(category.id)}
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
                        
                        {/* Форма редактирования показывается сразу под редактируемой категорией */}
                        {editingCategory && editingCategory.id === category.id && (
                          <div id={`edit-form-${category.id}`} className="card mb-3 mt-3">
                            <div className="flex justify-between items-center mb-4">
                              <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">
                                {t.categories.filters.editCategory}
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
                                  id={`is_favorite_${category.id}`}
                                  checked={formData.is_favorite}
                                  onChange={(e) => setFormData({ ...formData, is_favorite: e.target.checked })}
                                  className="w-4 h-4 rounded"
                                />
                                <label htmlFor={`is_favorite_${category.id}`} className="text-sm text-telegram-text dark:text-telegram-dark-text">
                                  {t.categories.form.favoriteLabel}
                                </label>
                              </div>

                              <div className="flex gap-3">
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
                        )}
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

