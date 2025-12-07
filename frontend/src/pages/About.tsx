import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'

interface InfoPage {
  title: string
  description: string
  image: string
  content?: string[]
}

export function About() {
  const { t } = useI18n()
  const [currentPage, setCurrentPage] = useState(0)
  const [imageKey, setImageKey] = useState(0)
  const navigate = useNavigate()

  const infoPages: InfoPage[] = [
    {
      title: t.help.gettingStarted,
      description: t.help.gettingStartedDesc,
      image: '/1.png',
      content: t.help.quickStartSteps,
    },
    {
      title: t.help.accounts,
      description: t.help.accountsDesc,
      image: '/2.png',
      content: [
        t.help.accountTypesDesc,
        ...t.help.accountTypesList,
      ],
    },
    {
      title: t.help.transactions,
      description: t.help.transactionsDesc,
      image: '/3.png',
      content: [
        t.help.transactionTypesDesc,
        ...t.help.transactionTypesList,
      ],
    },
    {
      title: t.help.categories,
      description: t.help.categoriesDesc,
      image: '/4.png',
      content: [
        t.help.categoryTipsDesc,
        ...t.help.categoryTipsList,
      ],
    },
    {
      title: t.help.goals,
      description: t.help.goalsDesc,
      image: '/5.png',
      content: [
        t.help.goalTipsDesc,
        ...t.help.goalTipsList,
      ],
    },
    {
      title: t.help.navigation,
      description: t.help.navigationDesc,
      image: '/1.png',
      content: t.help.navigationList,
    },
  ]

  const isLastPage = currentPage === infoPages.length - 1

  // Обновляем key изображения при смене слайда
  useEffect(() => {
    setImageKey(prev => prev + 1)
  }, [currentPage])

  const handleNext = () => {
    if (isLastPage) {
      navigate('/')
    } else {
      setCurrentPage(currentPage + 1)
    }
  }

  const handlePrev = () => {
    if (currentPage === 0) {
      setCurrentPage(infoPages.length - 1)
    } else {
      setCurrentPage(currentPage - 1)
    }
  }

  const currentPageData = infoPages[currentPage]

  return (
    <div className="min-h-screen p-4 md:p-6 animate-fade-in max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/profile')}
          className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text transition-colors text-xl"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-telegram-text dark:text-telegram-dark-text">
            {t.help.title}
          </h1>
          <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
            {t.help.subtitle}
          </p>
        </div>
      </div>

      <div className="card p-6 md:p-8">
        {/* Image Display */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-4 transform transition-transform duration-300 hover:scale-105">
            <img 
              key={`about-image-${currentPage}-${imageKey}`}
              src={currentPageData.image} 
              alt={currentPageData.title}
              className="w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 object-contain animate-fade-in"
              loading="eager"
              onError={(e) => {
                console.error('Failed to load image in About:', currentPageData.image, 'Page:', currentPage)
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
              onLoad={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'block'
                console.log('Image loaded in About:', currentPageData.image, 'Page:', currentPage)
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-telegram-text dark:text-telegram-dark-text mb-4">
            {currentPageData.title}
          </h2>
          <p className="text-base md:text-lg text-telegram-textSecondary dark:text-telegram-dark-textSecondary leading-relaxed mb-4">
            {currentPageData.description}
          </p>
          
          {/* Additional Content List */}
          {currentPageData.content && currentPageData.content.length > 0 && (
            <div className="mt-6 text-left">
              {currentPage === 0 ? (
                // Первый слайд - все элементы с маркерами (маркированный список)
                <ul className="space-y-2">
                  {currentPageData.content.map((item, index) => (
                    <li 
                      key={index}
                      className="text-sm md:text-base text-telegram-textSecondary dark:text-telegram-dark-textSecondary flex items-start gap-2"
                    >
                      <span className="text-telegram-primary dark:text-telegram-dark-primary mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                // Остальные слайды - первый элемент без маркера (описание), остальные с маркерами
                <>
                  {currentPageData.content[0] && (
                    <p className="text-sm md:text-base text-telegram-textSecondary dark:text-telegram-dark-textSecondary mb-3">
                      {currentPageData.content[0]}
                    </p>
                  )}
                  {currentPageData.content.length > 1 && (
                    <ul className="space-y-2">
                      {currentPageData.content.slice(1).map((item, index) => (
                        <li 
                          key={index + 1}
                          className="text-sm md:text-base text-telegram-textSecondary dark:text-telegram-dark-textSecondary flex items-start gap-2"
                        >
                          <span className="text-telegram-primary dark:text-telegram-dark-primary mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-6">
          {infoPages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-telegram-primary dark:bg-telegram-dark-primary w-8'
                  : 'bg-telegram-border dark:bg-telegram-dark-border w-2'
              }`}
              aria-label={`${t.common.page} ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={handlePrev}
            className="btn-secondary flex-1"
          >
            ← {t.common.back}
          </button>
          <button
            onClick={handleNext}
            className="btn-primary flex-1"
          >
            {isLastPage ? t.common.close : `${t.common.next} →`}
          </button>
        </div>
      </div>
    </div>
  )
}
