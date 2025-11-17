import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'

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

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [isTogglingAll, setIsTogglingAll] = useState(false)
  const [isEditingMode, setIsEditingMode] = useState(false)
  const { showError, showSuccess } = useToast()

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
      showError(err.message || 'Ошибка загрузки категорий')
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
      // Extract user-friendly error message
      let errorMessage = err.message || 'Ошибка сохранения категории'
      // Remove technical details if present
      if (errorMessage.includes('Failed to create category:')) {
        errorMessage = errorMessage.replace('Failed to create category:', '').trim()
      }
      if (errorMessage.includes('(psycopg2.errors.')) {
        // Extract meaningful part before technical error
        const parts = errorMessage.split('(psycopg2.errors.')
        if (parts.length > 0) {
          errorMessage = parts[0].trim() || 'Ошибка при создании категории'
        }
      }
      showError(errorMessage)
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

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту категорию?')) {
      return
    }

    try {
      await api.deleteCategory(id)
      showSuccess('Категория успешно удалена')
      await loadCategories()
    } catch (err: any) {
      showError(err.message || 'Ошибка удаления категории')
    }
  }

  const handleToggleFavorite = async (id: number, currentFavorite: boolean) => {
    try {
      await api.setCategoryFavorite(id, !currentFavorite)
      await loadCategories()
    } catch (err: any) {
      showError(err.message || 'Ошибка изменения статуса категории')
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
        <h1 className="text-2xl md:text-3xl font-bold text-telegram-text">Категории</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`px-4 py-2 rounded-telegram transition-all ${
              isEditingMode
                ? 'bg-telegram-primary text-white'
                : 'bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
            }`}
          >
            {isEditingMode ? '✓ Редактирование' : '✏️ Редактировать'}
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
              : 'bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
          }`}
        >
          Все
        </button>
        <button
          onClick={() => setFilterType('expense')}
          className={`px-4 py-2 rounded-telegram transition-all ${
            filterType === 'expense'
              ? 'bg-telegram-primary text-white'
              : 'bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
          }`}
        >
          💸 Расходы
        </button>
        <button
          onClick={() => setFilterType('income')}
          className={`px-4 py-2 rounded-telegram transition-all ${
            filterType === 'income'
              ? 'bg-telegram-primary text-white'
              : 'bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
          }`}
        >
          💰 Доходы
        </button>
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`px-4 py-2 rounded-telegram transition-all ${
            showFavoritesOnly
              ? 'bg-telegram-primary text-white'
              : 'bg-telegram-surface text-telegram-text hover:bg-telegram-hover'
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
            <h2 className="text-xl font-semibold text-telegram-text">
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
              <label className="block text-sm font-medium text-telegram-text mb-2">
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
              <label className="block text-sm font-medium text-telegram-text mb-2">
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
              <label className="block text-sm font-medium text-telegram-text mb-2">
                Иконка (эмодзи)
              </label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className="input"
                placeholder="📦"
                maxLength={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-telegram-text mb-2">
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
              <label htmlFor="is_favorite" className="text-sm text-telegram-text">
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
          <div className="inline-block w-24 h-24 rounded-full bg-gradient-to-br from-telegram-primaryLight/30 to-telegram-primaryLight/10 flex items-center justify-center text-5xl mb-6">
            📦
          </div>
          <h3 className="text-xl font-semibold text-telegram-text mb-2">Нет категорий</h3>
          <p className="text-telegram-textSecondary mb-6">
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
              <h3 className="text-lg font-semibold text-telegram-text mb-3 flex items-center gap-2">
                ⭐ Избранные категории
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {favoriteCategories.map((category) => (
                  <div
                    key={category.id}
                    className="card hover:shadow-lg transition-all relative group p-2 md:p-4"
                    style={{
                      borderLeft: `3px solid ${category.color || '#4CAF50'}`,
                    }}
                  >
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
                        <h4 className="font-semibold text-telegram-text truncate text-sm md:text-base lg:text-lg mb-1">
                          {category.name}
                        </h4>
                        <p className="text-xs md:text-sm text-telegram-textSecondary mb-1">
                          {getTransactionTypeIcon(category.transaction_type)} {getTransactionTypeLabel(category.transaction_type)}
                        </p>
                        {(category.is_system || category.shared_budget_id) && (
                          <div className="flex items-center justify-center gap-1.5 mt-1">
                            {category.is_system && (
                              <span className="text-xs text-telegram-textSecondary" title="Базовая категория">
                                📋
                              </span>
                            )}
                            {category.shared_budget_id && (
                              <span className="text-xs text-blue-600" title="Общая категория">
                                👥
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Кнопки редактирования - внизу карточки */}
                      {isEditingMode && (
                        <div className="flex items-center justify-center gap-2 w-full pt-2 border-t border-telegram-hover mt-auto">
                          <button
                            onClick={() => handleToggleFavorite(category.id, category.is_favorite)}
                            className="p-2 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-full transition-all active:scale-95"
                            title="Убрать из избранного"
                          >
                            <span className="text-base md:text-lg">⭐</span>
                          </button>
                          <button
                            onClick={() => handleEdit(category)}
                            className="p-2 text-telegram-primary hover:bg-telegram-surface rounded-full transition-all active:scale-95"
                            title="Редактировать"
                          >
                            <span className="text-base md:text-lg">✏️</span>
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
            </div>
          )}

          {/* Regular Categories */}
          {(!showFavoritesOnly || favoriteCategories.length === 0) && (
            <div>
              {!showFavoritesOnly && favoriteCategories.length > 0 && (
                <h3 className="text-lg font-semibold text-telegram-text mb-3 flex items-center gap-2">
                  Все категории
                </h3>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {regularCategories.map((category) => (
                  <div
                    key={category.id}
                    className="card hover:shadow-lg transition-all relative group p-2 md:p-4"
                    style={{
                      borderLeft: `3px solid ${category.color || '#4CAF50'}`,
                    }}
                  >
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
                        <h4 className="font-semibold text-telegram-text truncate text-sm md:text-base lg:text-lg mb-1">
                          {category.name}
                        </h4>
                        <p className="text-xs md:text-sm text-telegram-textSecondary mb-1">
                          {getTransactionTypeIcon(category.transaction_type)} {getTransactionTypeLabel(category.transaction_type)}
                        </p>
                        {(category.is_system || category.shared_budget_id) && (
                          <div className="flex items-center justify-center gap-1.5 mt-1">
                            {category.is_system && (
                              <span className="text-xs text-telegram-textSecondary" title="Базовая категория">
                                📋
                              </span>
                            )}
                            {category.shared_budget_id && (
                              <span className="text-xs text-blue-600" title="Общая категория">
                                👥
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Кнопки редактирования - внизу карточки */}
                      {isEditingMode && (
                        <div className="flex items-center justify-center gap-2 w-full pt-2 border-t border-telegram-hover mt-auto">
                          <button
                            onClick={() => handleToggleFavorite(category.id, category.is_favorite)}
                            className="p-2 text-telegram-textSecondary hover:text-yellow-500 hover:bg-yellow-50 rounded-full transition-all active:scale-95"
                            title="Добавить в избранное"
                          >
                            <span className="text-base md:text-lg">⭐</span>
                          </button>
                          <button
                            onClick={() => handleEdit(category)}
                            className="p-2 text-telegram-primary hover:bg-telegram-surface rounded-full transition-all active:scale-95"
                            title="Редактировать"
                          >
                            <span className="text-base md:text-lg">✏️</span>
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}

