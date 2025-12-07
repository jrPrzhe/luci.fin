import { useState, useEffect } from 'react'

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

interface StoriesProps {
  isOpen: boolean
  onClose: () => void
}

export function Stories({ isOpen, onClose }: StoriesProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [imagesLoaded, setImagesLoaded] = useState<Set<number>>(new Set())
  const [imageKey, setImageKey] = useState(0)
  const isLastPage = currentPage === infoPages.length - 1

  // Предзагрузка всех изображений при открытии
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0)
      setImageKey(0)
      
      // Предзагружаем все изображения
      const loadedSet = new Set<number>()
      infoPages.forEach((page, index) => {
        const img = new Image()
        img.onload = () => {
          loadedSet.add(index)
          setImagesLoaded(new Set(loadedSet))
        }
        img.onerror = () => {
          console.error('Failed to preload image:', page.image)
        }
        img.src = page.image
      })
    }
  }, [isOpen])

  // Обновляем key изображения при смене слайда
  useEffect(() => {
    if (isOpen) {
      setImageKey(prev => prev + 1)
    }
  }, [currentPage, isOpen])

  // Закрытие при нажатии Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Блокировка прокрутки фона при открытии модального окна
  useEffect(() => {
    if (!isOpen) return

    // Сохраняем текущую позицию прокрутки
    const scrollY = window.scrollY
    const scrollX = window.scrollX
    
    // Сохраняем оригинальные стили для body и html
    const originalBodyOverflow = document.body.style.overflow
    const originalBodyPosition = document.body.style.position
    const originalBodyTop = document.body.style.top
    const originalBodyLeft = document.body.style.left
    const originalBodyWidth = document.body.style.width
    const originalBodyHeight = document.body.style.height
    const originalBodyTouchAction = document.body.style.touchAction
    
    const originalHtmlOverflow = document.documentElement.style.overflow
    const originalHtmlPosition = document.documentElement.style.position
    const originalHtmlTop = document.documentElement.style.top
    const originalHtmlLeft = document.documentElement.style.left
    const originalHtmlWidth = document.documentElement.style.width
    const originalHtmlHeight = document.documentElement.style.height
    const originalHtmlTouchAction = document.documentElement.style.touchAction
    
    // Применяем стили для предотвращения прокрутки на body и html
    const preventScrollStyles = {
      overflow: 'hidden',
      position: 'fixed',
      top: `-${scrollY}px`,
      left: `-${scrollX}px`,
      width: '100%',
      height: '100%',
      touchAction: 'none',
    }
    
    Object.assign(document.body.style, preventScrollStyles)
    Object.assign(document.documentElement.style, preventScrollStyles)
    
    // Предотвращаем события прокрутки с помощью обработчиков событий
    const preventWheel = (e: WheelEvent) => {
      // Разрешаем прокрутку только внутри модального окна
      const target = e.target as HTMLElement
      const modalContent = target.closest('.stories-modal-content')
      if (!modalContent) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }
    
    const preventTouchMove = (e: TouchEvent) => {
      // Разрешаем прокрутку только внутри модального окна
      const target = e.target as HTMLElement
      const modalContent = target.closest('.stories-modal-content')
      if (!modalContent) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }
    
    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement
      const modalContent = target.closest('.stories-modal-content')
      if (!modalContent && target !== document.body && target !== document.documentElement) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return false
      }
    }
    
    // Добавляем обработчики событий с passive: false для возможности preventDefault
    document.addEventListener('wheel', preventWheel, { passive: false, capture: true })
    document.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true })
    document.addEventListener('scroll', preventScroll, { passive: false, capture: true })
    window.addEventListener('scroll', preventScroll, { passive: false, capture: true })
    
    return () => {
      // Удаляем обработчики событий
      document.removeEventListener('wheel', preventWheel, { capture: true } as EventListenerOptions)
      document.removeEventListener('touchmove', preventTouchMove, { capture: true } as EventListenerOptions)
      document.removeEventListener('scroll', preventScroll, { capture: true } as EventListenerOptions)
      window.removeEventListener('scroll', preventScroll, { capture: true } as EventListenerOptions)
      
      // Восстанавливаем оригинальные стили
      // Если стиль был пустым, удаляем свойство полностью
      if (originalBodyOverflow) {
        document.body.style.overflow = originalBodyOverflow
      } else {
        document.body.style.removeProperty('overflow')
      }
      if (originalBodyPosition) {
        document.body.style.position = originalBodyPosition
      } else {
        document.body.style.removeProperty('position')
      }
      if (originalBodyTop) {
        document.body.style.top = originalBodyTop
      } else {
        document.body.style.removeProperty('top')
      }
      if (originalBodyLeft) {
        document.body.style.left = originalBodyLeft
      } else {
        document.body.style.removeProperty('left')
      }
      if (originalBodyWidth) {
        document.body.style.width = originalBodyWidth
      } else {
        document.body.style.removeProperty('width')
      }
      if (originalBodyHeight) {
        document.body.style.height = originalBodyHeight
      } else {
        document.body.style.removeProperty('height')
      }
      if (originalBodyTouchAction) {
        document.body.style.touchAction = originalBodyTouchAction
      } else {
        document.body.style.removeProperty('touch-action')
      }
      
      if (originalHtmlOverflow) {
        document.documentElement.style.overflow = originalHtmlOverflow
      } else {
        document.documentElement.style.removeProperty('overflow')
      }
      if (originalHtmlPosition) {
        document.documentElement.style.position = originalHtmlPosition
      } else {
        document.documentElement.style.removeProperty('position')
      }
      if (originalHtmlTop) {
        document.documentElement.style.top = originalHtmlTop
      } else {
        document.documentElement.style.removeProperty('top')
      }
      if (originalHtmlLeft) {
        document.documentElement.style.left = originalHtmlLeft
      } else {
        document.documentElement.style.removeProperty('left')
      }
      if (originalHtmlWidth) {
        document.documentElement.style.width = originalHtmlWidth
      } else {
        document.documentElement.style.removeProperty('width')
      }
      if (originalHtmlHeight) {
        document.documentElement.style.height = originalHtmlHeight
      } else {
        document.documentElement.style.removeProperty('height')
      }
      if (originalHtmlTouchAction) {
        document.documentElement.style.touchAction = originalHtmlTouchAction
      } else {
        document.documentElement.style.removeProperty('touch-action')
      }
      
      // Восстанавливаем позицию прокрутки после того, как браузер пересчитает layout
      // Используем requestAnimationFrame для гарантии, что стили применены
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(scrollX, scrollY)
        })
      })
    }
  }, [isOpen])

  const handleNext = () => {
    if (isLastPage) {
      onClose()
    } else {
      setCurrentPage(currentPage + 1)
    }
  }

  const handlePrev = () => {
    if (currentPage === 0) {
      onClose()
    } else {
      setCurrentPage(currentPage - 1)
    }
  }

  // Обработка свайпов (для мобильных)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50
    if (isLeftSwipe) {
      handleNext()
    }
    if (isRightSwipe) {
      handlePrev()
    }
  }

  if (!isOpen) return null

  const currentPageData = infoPages[currentPage]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-fade-in stories-modal-content" style={{ backdropFilter: 'blur(10px)' }}>
      {/* Progress Bar вверху */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-black/30 z-10">
        <div className="flex gap-1 p-1">
          {infoPages.map((_, index) => (
            <div
              key={index}
              className={`h-full rounded-full transition-all duration-300 ${
                index < currentPage
                  ? 'bg-white'
                  : index === currentPage
                  ? 'bg-white animate-pulse'
                  : 'bg-white/30'
              }`}
              style={{
                width: `${100 / infoPages.length}%`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Кнопка закрытия */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        aria-label="Закрыть"
      >
        ✕
      </button>

      {/* Контент слайда */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 max-w-2xl mx-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Изображение */}
        <div className="mb-6 md:mb-8" key={`image-container-${currentPage}`}>
          <div className="flex justify-center items-center transform transition-all duration-300">
            <img
              key={`stories-image-${currentPage}-${imageKey}`}
              src={currentPageData.image}
              alt={currentPageData.title}
              className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 object-contain transition-opacity duration-300"
              loading="eager"
              style={{
                opacity: imagesLoaded.has(currentPage) ? 1 : 0.7,
                display: 'block',
              }}
              onError={(e) => {
                console.error('Failed to load image in Stories:', currentPageData.image, 'Page:', currentPage, 'Full URL:', window.location.origin + currentPageData.image)
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
              onLoad={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'block'
                target.style.opacity = '1'
                console.log('Image loaded in Stories:', currentPageData.image, 'Page:', currentPage)
                setImagesLoaded(prev => new Set(prev).add(currentPage))
              }}
            />
          </div>
        </div>

        {/* Текст */}
        <div className="text-center text-white animate-fade-in" key={`text-${currentPage}`}>
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            {currentPageData.title}
          </h2>
          <p className="text-base md:text-lg text-white/90 leading-relaxed max-w-xl mx-auto">
            {currentPageData.description}
          </p>
        </div>

        {/* Индикаторы слайдов */}
        <div className="flex justify-center gap-2 mt-8">
          {infoPages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-white w-8'
                  : 'bg-white/40 w-2'
              }`}
              aria-label={`Слайд ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Навигационные кнопки */}
      <button
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        aria-label="Предыдущий слайд"
      >
        ←
      </button>
      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        aria-label={isLastPage ? 'Закрыть' : 'Следующий слайд'}
      >
        →
      </button>

      {/* Зоны для свайпа */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer"
        onClick={handlePrev}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer"
        onClick={handleNext}
      />
    </div>
  )
}

