import { useNewYearTheme } from '../contexts/NewYearContext'

interface SnowPileProps {
  className?: string
  size?: 'small' | 'medium' | 'large'
}

export function SnowPile({ className = '', size = 'small' }: SnowPileProps) {
  const { isEnabled } = useNewYearTheme()

  if (!isEnabled) return null

  const sizeClasses = {
    small: 'w-8 h-4 text-xs',
    medium: 'w-12 h-6 text-sm',
    large: 'w-16 h-8 text-base',
  }

  return (
    <div className={`absolute pointer-events-none ${className} ${sizeClasses[size]}`}>
      <div className="relative w-full h-full">
        {/* Кучка снега из эмодзи */}
        <div className="absolute bottom-0 left-0 right-0 text-center opacity-80">
          <span className="inline-block transform -rotate-12">❄</span>
          <span className="inline-block transform rotate-6">❄</span>
          <span className="inline-block transform -rotate-3">❄</span>
        </div>
        {/* Небольшие снежинки вокруг */}
        <span 
          className="absolute -top-1 -left-1 text-xs opacity-60 animate-pulse"
          style={{ animationDelay: '0s', animationDuration: '2s' }}
        >
          ❄
        </span>
        <span 
          className="absolute -top-1 -right-1 text-xs opacity-60 animate-pulse"
          style={{ animationDelay: '1s', animationDuration: '2s' }}
        >
          ❄
        </span>
      </div>
    </div>
  )
}

