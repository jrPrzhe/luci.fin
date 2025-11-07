import { useEffect, useState } from 'react'

interface Snowflake {
  id: number
  left: number
  size: number
  speed: number
  opacity: number
  delay: number
}

export function SnowEffect() {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([])

  useEffect(() => {
    // Создаем 30 снежинок (не слишком много, чтобы не отвлекать)
    const flakes: Snowflake[] = []
    for (let i = 0; i < 30; i++) {
      flakes.push({
        id: i,
        left: Math.random() * 100,
        size: Math.random() * 4 + 2, // 2-6px
        speed: Math.random() * 2 + 1, // 1-3s
        opacity: Math.random() * 0.5 + 0.3, // 0.3-0.8
        delay: Math.random() * 5, // задержка до 5s
      })
    }
    setSnowflakes(flakes)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute top-0 text-white select-none"
          style={{
            left: `${flake.left}%`,
            fontSize: `${flake.size}px`,
            opacity: flake.opacity,
            animation: `snowfall ${flake.speed}s linear infinite`,
            animationDelay: `${flake.delay}s`,
          }}
        >
          ❄
        </div>
      ))}
    </div>
  )
}





