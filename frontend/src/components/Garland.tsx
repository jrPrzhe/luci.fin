import { useEffect, useState } from 'react'

interface Bulb {
  id: number
  color: string
  delay: number
  xPercent: number
  yOffset: number
}

const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffa07a', '#ffe66d', '#95e1d3', '#f38181']

export function Garland() {
  const [bulbs, setBulbs] = useState<Bulb[]>([])

  useEffect(() => {
    // Создаем 25 лампочек для гирлянды с волнистой формой
    const newBulbs: Bulb[] = []
    const bulbCount = 25
    
    for (let i = 0; i < bulbCount; i++) {
      const progress = i / (bulbCount - 1) // 0 до 1
      const xPercent = progress * 100
      // Создаем волнистую форму (синусоида)
      const waveAmplitude = 4 // амплитуда волны в пикселях
      const yOffset = Math.sin(progress * Math.PI * 3) * waveAmplitude
      
      newBulbs.push({
        id: i,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 2,
        xPercent,
        yOffset,
      })
    }
    setBulbs(newBulbs)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 h-8 overflow-hidden pointer-events-none z-0">
      <svg 
        className="w-full h-full absolute top-0 left-0"
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
      >
        {/* Провод гирлянды - основной */}
        <polyline
          points={bulbs.map(b => {
            const y = 6 + (b.yOffset / 8) * 0.5
            return `${b.xPercent},${y}`
          }).join(' ')}
          fill="none"
          stroke="#555"
          strokeWidth="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
        {/* Провод гирлянды - тень */}
        <polyline
          points={bulbs.map(b => {
            const y = 6.1 + (b.yOffset / 8) * 0.5
            return `${b.xPercent},${y}`
          }).join(' ')}
          fill="none"
          stroke="#333"
          strokeWidth="0.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
        />
      </svg>
      
      {/* Лампочки */}
      <div className="relative w-full h-full">
        {bulbs.map((bulb) => (
          <div
            key={bulb.id}
            className="absolute"
            style={{
              left: `${bulb.xPercent}%`,
              top: `${6 + bulb.yOffset}px`,
              transform: 'translateX(-50%)',
            }}
          >
            {/* Провод к лампочке (от основного провода) */}
            <div
              className="absolute w-px bg-gray-600 opacity-50"
              style={{
                height: '3px',
                top: '3px',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
            {/* Сама лампочка */}
            <div
              className="relative"
              style={{
                width: '10px',
                height: '12px',
              }}
            >
              {/* Основание лампочки (цоколь) */}
              <div
                className="absolute bottom-0 left-1/2 transform -translate-x-1/2"
                style={{
                  width: '4px',
                  height: '2px',
                  backgroundColor: '#555',
                  borderRadius: '1px 1px 0 0',
                  opacity: 0.7,
                }}
              />
              {/* Колба лампочки */}
              <div
                className="absolute bottom-2 left-1/2 transform -translate-x-1/2"
                style={{
                  width: '6px',
                  height: '7px',
                  backgroundColor: bulb.color,
                  borderRadius: '50%',
                  boxShadow: `
                    0 0 4px ${bulb.color},
                    0 0 8px ${bulb.color},
                    0 0 12px ${bulb.color}80,
                    inset 0 1px 3px rgba(255, 255, 255, 0.4)
                  `,
                  animation: `garland-flicker 2.5s ease-in-out infinite`,
                  animationDelay: `${bulb.delay}s`,
                }}
              />
              {/* Блик на лампочке */}
              <div
                className="absolute bottom-3.5 left-1/2 transform -translate-x-1/2"
                style={{
                  width: '2px',
                  height: '2px',
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  borderRadius: '50%',
                  animation: `garland-flicker 2.5s ease-in-out infinite`,
                  animationDelay: `${bulb.delay}s`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

