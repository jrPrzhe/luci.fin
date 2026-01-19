import { useEffect, useState } from 'react'

interface Heart {
  id: number
  left: number
  size: number
  speed: number
  opacity: number
  delay: number
}

export function HeartEffect() {
  const [hearts, setHearts] = useState<Heart[]>([])

  useEffect(() => {
    // Создаем 30 сердец (не слишком много, чтобы не отвлекать)
    const heartList: Heart[] = []
    for (let i = 0; i < 30; i++) {
      heartList.push({
        id: i,
        left: Math.random() * 100,
        size: Math.random() * 4 + 2, // 2-6px
        speed: Math.random() * 2 + 1, // 1-3s
        opacity: Math.random() * 0.5 + 0.3, // 0.3-0.8
        delay: Math.random() * 5, // задержка до 5s
      })
    }
    setHearts(heartList)
  }, [])

  // SVG контур сердца
  const HeartSVG = ({ size, opacity }: { size: number; opacity: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ opacity }}
      className="text-red-500"
    >
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute top-0 select-none text-red-500"
          style={{
            left: `${heart.left}%`,
            fontSize: `${heart.size}px`,
            opacity: heart.opacity,
            animation: `heartfall ${heart.speed}s linear infinite`,
            animationDelay: `${heart.delay}s`,
          }}
        >
          <HeartSVG size={heart.size * 2} opacity={heart.opacity} />
        </div>
      ))}
    </div>
  )
}
