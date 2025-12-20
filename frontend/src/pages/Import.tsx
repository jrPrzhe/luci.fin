import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import { useI18n } from '../contexts/I18nContext'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface ImportSource {
  id: string
  name: string
  description: string
}

export function Import() {
  const navigate = useNavigate()
  const { showError, showSuccess } = useToast()
  const { t } = useI18n()
  const [sources, setSources] = useState<ImportSource[]>([])
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [importStartTime, setImportStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Проверяем премиум статус пользователя
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: api.getCurrentUser,
  })

  useEffect(() => {
    // Если пользователь не премиум, перенаправляем в профиль
    if (user && !user.is_premium) {
      navigate('/profile')
      return
    }
    
    if (user?.is_premium) {
      loadSources()
      // Скроллим к началу страницы при открытии
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [user, navigate])

  const loadSources = async () => {
    try {
      const response = await api.getImportSources()
      setSources(response)
      if (response.length > 0) {
        setSelectedSource(response[0].id)
      }
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.name.endsWith('.db')) {
        setSelectedFile(file)
      } else {
        showError(t.profile.importSelectFileError)
        setSelectedFile(null)
      }
    }
  }

  const handleImport = async () => {
      if (!selectedSource) {
      showError(t.profile.importSelectSource)
      return
    }

    if (!selectedFile) {
      showError(t.profile.importSelectFileRequired)
      return
    }

    setIsUploading(true)
    setElapsedTime(0)
    const startTime = Date.now()
    setImportStartTime(startTime)

    try {
      const result = await api.importData(selectedSource, selectedFile)
      
      showSuccess(t.profile.importCompleted
        .replace('{accounts}', String(result.accounts_imported || 0))
        .replace('{transactions}', String(result.transactions_imported))
        .replace('{categories}', String(result.categories_imported)))
      
      // Очищаем выбор файла
      setSelectedFile(null)
      const fileInput = document.getElementById('file-input') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }
    } catch (err: any) {
      const { translateError } = await import('../utils/errorMessages')
      showError(translateError(err))
    } finally {
      setIsUploading(false)
      setImportStartTime(null)
      setElapsedTime(0)
    }
  }

  // Обновляем таймер во время импорта
  useEffect(() => {
    if (isUploading && importStartTime !== null) {
      const timerInterval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - importStartTime) / 1000))
      }, 1000)
      return () => clearInterval(timerInterval)
    } else {
      setElapsedTime(0)
    }
  }, [isUploading, importStartTime])

  // Показываем загрузку, пока проверяем премиум статус
  if (isLoadingUser) {
    return <LoadingSpinner fullScreen={true} size="md" />
  }

  // Если пользователь не премиум, не показываем страницу (должен быть перенаправлен)
  if (!user?.is_premium) {
    return null
  }

  return (
    <div className="min-h-screen p-4 md:p-6 animate-fade-in max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/profile')}
          className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text transition-colors text-xl"
        >
          ←
        </button>
        <h1 className="text-xl md:text-2xl font-semibold text-telegram-text dark:text-telegram-dark-text">
          {t.profile.importTitle}
        </h1>
      </div>

      <div className="card p-4 md:p-5 space-y-4 md:space-y-6">
        {/* Выбор источника */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
            {t.profile.importSelectApp}
          </label>
          <div className="space-y-2">
            {sources.map((source) => (
              <button
                key={source.id}
                onClick={() => setSelectedSource(source.id)}
                className={`w-full p-3 rounded-telegram border-2 transition-colors text-left ${
                  selectedSource === source.id
                    ? 'border-telegram-primary dark:border-telegram-dark-primary bg-telegram-primary/10 dark:bg-telegram-dark-primary/10'
                    : 'border-telegram-border dark:border-telegram-dark-border hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-telegram-text dark:text-telegram-dark-text">
                      {source.id === 'myfinance' ? t.profile.importSourceMyFinance : source.name}
                    </p>
                    <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                      {source.id === 'myfinance' ? t.profile.importSourceMyFinanceDesc : source.description}
                    </p>
                  </div>
                  {selectedSource === source.id && (
                    <span className="text-telegram-primary text-xl">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Выбор файла */}
        <div>
          <label className="block text-xs md:text-sm font-medium text-telegram-text dark:text-telegram-dark-text mb-2">
            {t.profile.importSelectFile}
          </label>
          <input
            id="file-input"
            type="file"
            accept=".db"
            onChange={handleFileSelect}
            className="hidden"
          />
          <label
            htmlFor="file-input"
            className="block w-full p-4 border-2 border-dashed border-telegram-border dark:border-telegram-dark-border rounded-telegram hover:border-telegram-primary dark:hover:border-telegram-dark-primary hover:bg-telegram-hover dark:hover:bg-telegram-dark-hover transition-colors cursor-pointer text-center"
          >
            {selectedFile ? (
              <div className="w-full">
                <p className="text-telegram-text dark:text-telegram-dark-text font-medium break-words overflow-wrap-anywhere">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-telegram-text dark:text-telegram-dark-text">{t.profile.importClickToSelect}</p>
                <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                  {t.profile.importSupportedFiles}
                </p>
              </div>
            )}
          </label>
        </div>

        {/* Индикатор загрузки */}
        {isUploading && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-4 rounded-telegram">
            <div className="flex items-center justify-center mb-3">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-center font-medium mb-2">{t.profile.importData}...</p>
            <p className="text-center text-sm text-blue-600 mb-2">
              {t.common.loading}
            </p>
            <p className="text-center text-xs text-blue-500">
              {t.profile.importExecutionTime.replace('{time}', elapsedTime > 0 ? `${elapsedTime} ${t.profile.importSeconds}` : t.profile.importLessThanSecond)}
            </p>
          </div>
        )}


        {/* Кнопка импорта */}
        <button
          onClick={handleImport}
          disabled={isUploading || !selectedFile || !selectedSource}
          className="w-full btn-primary text-sm md:text-base py-2.5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? `${t.profile.importData}...` : t.profile.importData}
        </button>

        {/* Информация */}
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-telegram text-sm">
          <p className="font-medium mb-1">{t.profile.importNote}</p>
          <p>
            {t.profile.importNoteText}
          </p>
        </div>
      </div>
    </div>
  )
}

