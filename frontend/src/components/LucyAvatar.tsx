import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

interface LucyAvatarProps {
  emotion?: 'happy' | 'sad' | 'neutral' | 'proud' | 'warm'
  size?: 'small' | 'medium' | 'large'
}

export function LucyAvatar({ emotion = 'neutral', size = 'medium' }: LucyAvatarProps) {
  const [currentEmotion, setCurrentEmotion] = useState(emotion)

  useEffect(() => {
    setCurrentEmotion(emotion)
  }, [emotion])

  const emotionEmoji: Record<string, string> = {
    happy: '😊',
    sad: '😢',
    neutral: '😐',
    proud: '😎',
    warm: '🥰',
  }

  const sizeClasses = {
    small: 'lucy-avatar-small',
    medium: 'lucy-avatar-medium',
    large: 'lucy-avatar-large',
  }

  return (
    <div className={`lucy-avatar ${sizeClasses[size]} emotion-${currentEmotion}`}>
      <div className="lucy-face">
        <span className="lucy-emoji">{emotionEmoji[currentEmotion] || emotionEmoji.neutral}</span>
      </div>
      <div className="lucy-name">Люся</div>
    </div>
  )
}

export function LucyMessage({ event, userData }: { event: string, userData?: Record<string, any> }) {
  const { data: message, isLoading } = useQuery({
    queryKey: ['lucy-message', event, userData],
    queryFn: () => api.getGamificationMessage(event, userData),
    enabled: !!event,
    staleTime: 60000,
  })

  if (isLoading) {
    return (
      <div className="lucy-message loading">
        <div className="skeleton">Люся думает...</div>
      </div>
    )
  }

  if (!message) {
    return null
  }

  return (
    <div className={`lucy-message emotion-${message.emotion}`}>
      <LucyAvatar emotion={message.emotion as any} size="small" />
      <div className="lucy-text">
        <p>{message.message}</p>
      </div>
    </div>
  )
}

