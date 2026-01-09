import { useEffect, useState } from 'react'

export function CRTNoise() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Показываем помехи периодически (раз в 30 секунд на 2-3 секунды)
    const interval = setInterval(() => {
      setVisible(true)
      setTimeout(() => {
        setVisible(false)
      }, 2000 + Math.random() * 1000) // 2-3 секунды
    }, 30000) // каждые 30 секунд

    return () => clearInterval(interval)
  }, [])

  if (!visible) return null

  return <div className="crt-noise" />
}
