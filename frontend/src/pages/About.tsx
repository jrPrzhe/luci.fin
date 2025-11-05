import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface InfoPage {
  title: string
  description: string
  image: string
}

const infoPages: InfoPage[] = [
  {
    title: 'Что мы делаем? 📊',
    description: 'Учет всех транзакций: доходы, расходы и переводы между счетами. Создавайте категории, добавляйте счета и отслеживайте баланс в реальном времени. Всё для удобного контроля ваших финансов!',
    image: '/1.png',
  },
  {
    title: 'Как мы помогаем? 💡',
    description: 'Категоризация расходов помогает понять, куда уходят деньги. Совместные бюджеты с семьей для общего учета. Быстрый ввод через карточки категорий. Аналитика и отчеты для планирования бюджета.',
    image: '/2.png',
  },
  {
    title: 'Для чего это нужно? 🎯',
    description: 'Чтобы понимать, куда уходят деньги, планировать бюджет, экономить и достигать финансовых целей. Финансовая свобода начинается с учета! Контролируйте свои финансы и принимайте обоснованные решения.',
    image: '/3.png',
  },
  {
    title: 'Начните с малого 🚀',
    description: 'Добавьте первый счет, создайте транзакцию и выберите категорию. Чем больше данных вы внесете, тем точнее будет анализ ваших финансов. Мы поможем вам разобраться!',
    image: '/4.png',
  },
  {
    title: 'Люся всегда рядом 👋',
    description: 'Я ваш виртуальный помощник! Я помогу вам разобраться с приложением и подскажу, как лучше организовать учет финансов. Если возникнут вопросы - я всегда здесь!',
    image: '/5.png',
  },
]


export function About() {
  const [currentPage, setCurrentPage] = useState(0)
  const [imageKey, setImageKey] = useState(0)
  const navigate = useNavigate()
  const isLastPage = currentPage === infoPages.length - 1

  // Обновляем key изображения при смене слайда
  useEffect(() => {
    setImageKey(prev => prev + 1)
  }, [currentPage])

  const handleNext = () => {
    if (isLastPage) {
      setCurrentPage(0)
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
          className="text-telegram-textSecondary hover:text-telegram-text transition-colors text-xl"
        >
          ←
        </button>
        <h1 className="text-xl md:text-2xl font-semibold text-telegram-text">
          О приложении
        </h1>
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
          <h2 className="text-xl md:text-2xl font-bold text-telegram-text mb-4">
            {currentPageData.title}
          </h2>
          <p className="text-base md:text-lg text-telegram-textSecondary leading-relaxed">
            {currentPageData.description}
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-6">
          {infoPages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-telegram-primary w-8'
                  : 'bg-telegram-border w-2'
              }`}
              aria-label={`Страница ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={handlePrev}
            className="btn-secondary flex-1"
          >
            ← Назад
          </button>
          <button
            onClick={handleNext}
            className="btn-primary flex-1"
          >
            {isLastPage ? 'В начало' : 'Далее →'}
          </button>
        </div>
      </div>
    </div>
  )
}

