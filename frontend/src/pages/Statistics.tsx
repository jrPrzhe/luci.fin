import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function Statistics() {
  const navigate = useNavigate()

  useEffect(() => {
    // Редирект на страницу аналитики с табом "Статистика пользователей"
    navigate('/analytics?tab=users', { replace: true })
  }, [navigate])

  return null
}
