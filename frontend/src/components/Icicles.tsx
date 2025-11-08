import { useEffect, useState } from 'react'

interface Icicle {
  id: number
  left: number
  width: number
  height: number
  delay: number
}

export function Icicles() {
  const [icicles, setIcicles] = useState<Icicle[]>([])

  useEffect(() => {
    // Создаем сосульки для нижнего меню (перевернутые вверх)
    const newIcicles: Icicle[] = []
    const icicleCount = 15
    
    for (let i = 0; i < icicleCount; i++) {
      newIcicles.push({
        id: i,
        left: (i / icicleCount) * 100 + (Math.random() * 100) / icicleCount, // Равномерно распределяем с небольшим случайным смещением
        width: Math.random() * 3 + 2, // 2-5px ширина
        height: Math.random() * 8 + 6, // 6-14px высота
        delay: Math.random() * 2, // Задержка анимации
      })
    }
    setIcicles(newIcicles)
  }, [])

  return (
    <div className="fixed bottom-0 left-0 right-0 h-6 overflow-visible pointer-events-none z-50" style={{ marginBottom: '56px' }}>
      <div className="relative w-full h-full">
        {icicles.map((icicle) => (
          <div
            key={icicle.id}
            className="absolute bottom-0"
            style={{
              left: `${icicle.left}%`,
              width: `${icicle.width}px`,
              height: `${icicle.height}px`,
              transform: 'translateX(-50%)',
            }}
          >
            {/* Сосулька - треугольник с закругленным концом */}
            <div
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2"
              style={{
                width: `${icicle.width}px`,
                height: `${icicle.height}px`,
                background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.9), rgba(200, 230, 255, 0.7))',
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                borderRadius: '0 0 50% 50%',
                boxShadow: `
                  0 2px 4px rgba(255, 255, 255, 0.3),
                  inset 0 -1px 2px rgba(200, 230, 255, 0.5)
                `,
                animation: `icicle-drip 3s ease-in-out infinite`,
                animationDelay: `${icicle.delay}s`,
              }}
            />
            {/* Капля на конце сосульки */}
            <div
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2"
              style={{
                width: `${icicle.width * 0.6}px`,
                height: `${icicle.width * 0.6}px`,
                background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8), rgba(200, 230, 255, 0.6))',
                borderRadius: '50%',
                bottom: `-${icicle.width * 0.3}px`,
                animation: `icicle-drop 3s ease-in-out infinite`,
                animationDelay: `${icicle.delay}s`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

