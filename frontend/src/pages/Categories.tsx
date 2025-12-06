import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useI18n } from '../contexts/I18nContext'

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

// Функция для извлечения только первого эмодзи из строки
const getFirstEmoji = (text: string): string => {
  if (!text) return ''
  
  // Используем Array.from для правильной работы с Unicode (включая эмодзи)
  // Это правильно обрабатывает суррогатные пары и последовательности эмодзи
  const chars = Array.from(text)
  
  if (chars.length === 0) return ''
  
  // Берем первый символ
  let firstChar = chars[0]
  
  // Проверяем, является ли это частью последовательности эмодзи
  // Эмодзи могут состоять из нескольких символов (например, с модификаторами кожи или флагами)
  // Но для простоты берем только первый визуальный символ
  
  // Если следующий символ - это модификатор (например, для составных эмодзи), включаем его
  if (chars.length > 1) {
    const secondChar = chars[1]
    // Проверяем, является ли второй символ частью эмодзи (модификатор, zero-width joiner и т.д.)
    const emojiModifiers = /[\u{FE0F}\u{200D}\u{20E3}]/u
    if (emojiModifiers.test(secondChar)) {
      // Это может быть составной эмодзи, но для простоты берем только первый символ
      // В большинстве случаев достаточно одного эмодзи
    }
  }
  
  // Возвращаем только первый символ (эмодзи)
  return firstChar
}

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
  const { translateCategoryName } = useI18n()

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

  useEffect(() => {
    loadCategories()
  }, [filterType, showFavoritesOnly])

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
      showError('Название категории обязательно')
      return
    }

    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, formData)
        showSuccess('Категория успешно обновлена')
      } else {
        await api.createCategory(formData)
        showSuccess('Категория успешно создана')
      }
      resetForm()
      await loadCategories()
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      transaction_type: category.transaction_type,
      icon: category.icon || '',
      color: category.color || '#4CAF50',
      is_favorite: category.is_favorite,
    })
    setShowForm(true)
  }

  const handleDelete = (id: number) => {
    setConfirmModal({
      show: true,
      message: 'Вы уверены, что хотите удалить эту категорию?',
      onConfirm: async () => {
        try {
          await api.deleteCategory(id)
          showSuccess('Категория успешно удалена')
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
        showError('Нет категорий для изменения')
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
      showSuccess(`Статус избранного изменен для ${visibleCategories.length} категорий`)
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
  }

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'income':
        return 'Доход'
      case 'expense':
        return 'Расход'
      case 'both':
        return 'Оба'
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

  const filteredCategories = categories.filter(cat => {
    if (filterType === 'all') return true
    if (filterType === 'income') return cat.transaction_type === 'income' || cat.transaction_type === 'both'
    if (filterType === 'expense') return cat.transaction_type === 'expense' || cat.transaction_type === 'both'
    return true
  })

  const favoriteCategories = filteredCategories.filter(cat => cat.is_favorite)
  const regularCategories = filteredCategories.filter(cat => !cat.is_favorite)

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-telegram-primary mb-4"></div>
          <p className="text-telegram-textSecondary">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-telegram-text dark:text-telegram-dark-text">Категории</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`px-4 py-2 rounded-telegram transition-all ${
              isEditingMode
                ? 'bg-telegram-primary text-white'
                : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
            }`}
          >
            {isEditingMode ? '✓ Редактирование' : '✏️'}
          </button>
          {isEditingMode && (
            <button
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="btn-primary"
            >
              ➕ Добавить категорию
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
          Все
        </button>
        <button
          onClick={() => setFilterType('expense')}
          className={`px-4 py-2 rounded-telegram transition-all ${
            filterType === 'expense'
              ? 'bg-telegram-primary text-white'
              : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
          }`}
        >
          💸 Расходы
        </button>
        <button
          onClick={() => setFilterType('income')}
          className={`px-4 py-2 rounded-telegram transition-all ${
            filterType === 'income'
              ? 'bg-telegram-primary text-white'
              : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
          }`}
        >
          💰 Доходы
        </button>
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`px-4 py-2 rounded-telegram transition-all ${
            showFavoritesOnly
              ? 'bg-telegram-primary text-white'
              : 'bg-telegram-surface dark:bg-telegram-dark-surface text-telegram-text dark:text-telegram-dark-text hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
          }`}
        >
          ⭐ Избранные
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
              '⏳ Обработка...'
            ) : filteredCategories.filter(cat => !cat.is_system).every(cat => cat.is_favorite) ? (
              '⭐ Убрать все из избранного'
            ) : (
              '⭐ Добавить все в избранное'
            )}
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="card mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text">
              {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
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
                Название
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="Название категории"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Тип транзакций
              </label>
              <select
                value={formData.transaction_type}
                onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value as any })}
                className="input"
                required
              >
                <option value="expense">💸 Расход</option>
                <option value="income">💰 Доход</option>
                <option value="both">💵 Оба</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Иконка (эмодзи)
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => {
                  // Извлекаем только первый эмодзи из введенного текста
                  const firstEmoji = getFirstEmoji(e.target.value)
                  setFormData({ ...formData, icon: firstEmoji })
                }}
                onPaste={(e) => {
                  // Обрабатываем вставку из буфера обмена
                  e.preventDefault()
                  const pastedText = e.clipboardData.getData('text')
                  const firstEmoji = getFirstEmoji(pastedText)
                  setFormData({ ...formData, icon: firstEmoji })
                }}
                className="input"
                placeholder="📦"
                maxLength={10}
              />
              <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                Можно использовать только один эмодзи
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
                Цвет
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-12 rounded-telegram cursor-pointer"
              />
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
                ⭐ Добавить в избранные (топ категории)
              </label>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1">
                {editingCategory ? 'Сохранить' : 'Создать'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
              >
                Отмена
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
          <h3 className="text-xl font-semibold text-telegram-text dark:text-telegram-dark-text mb-2">Нет категорий</h3>
          <p className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-6">
            Создайте категорию для удобной организации транзакций
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            ➕ Создать категорию
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Favorite Categories */}
          {!showFavoritesOnly && favoriteCategories.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  ⭐ Избранные категории
                </span>
                <button
                  onClick={() => setShowFavoritesSection(!showFavoritesSection)}
                  className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text text-sm"
                  title={showFavoritesSection ? 'Скрыть' : 'Показать'}
                >
                  {showFavoritesSection ? '▼' : '▶'}
                </button>
              </h3>
              {showFavoritesSection && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                  {favoriteCategories.map((category) => (
                    <div
                      key={category.id}
                      className="card hover:shadow-lg transition-all relative group p-2 md:p-4"
                      style={{
                        borderLeft: `3px solid ${category.color || '#4CAF50'}`,
                      }}
                    >
                      {/* Кнопка редактирования в правом верхнем углу */}
                      {isEditingMode && (
                        <button
                          onClick={() => handleEdit(category)}
                          className="absolute top-2 right-2 p-1.5 text-telegram-primary hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover rounded-full transition-all active:scale-95 z-10"
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
                        <div className="w-full text-center">
                          <h4 className="font-semibold text-telegram-text dark:text-telegram-dark-text truncate text-sm md:text-base lg:text-lg mb-1 pr-8">
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
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Regular Categories */}
          {(!showFavoritesOnly || favoriteCategories.length === 0) && (
            <div>
              {!showFavoritesOnly && favoriteCategories.length > 0 && (
                <h3 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Все категории
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                  {regularCategories.map((category) => (
                  <div
                    key={category.id}
                    className="card hover:shadow-lg transition-all relative group p-2 md:p-4"
                    style={{
                      borderLeft: `3px solid ${category.color || '#4CAF50'}`,
                    }}
                  >
                    {/* Кнопка редактирования в правом верхнем углу */}
                    {isEditingMode && (
                      <button
                        onClick={() => handleEdit(category)}
                        className="absolute top-2 right-2 p-1.5 text-telegram-primary hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover rounded-full transition-all active:scale-95 z-10"
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
                      <div className="w-full text-center">
                        <h4 className="font-semibold text-telegram-text dark:text-telegram-dark-text truncate text-sm md:text-base lg:text-lg mb-1 pr-8">
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
                  ))}
                </div>
              )}
            </div>
          )}
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

