import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../services/api'

export function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }
    
    try {
      const response = await api.register({ email, password })
      // Tokens are already stored by api.register method
      
      // Помечаем, что пользователь только что вошел
      sessionStorage.setItem('justLoggedIn', 'true')
      
      // Проверяем онбординг - Layout перенаправит на онбординг если нужно
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Ошибка регистрации')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-telegram-bg p-4 animate-fade-in">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-telegram-primary to-telegram-primaryLight mb-4 shadow-telegram-lg">
            <span className="text-4xl">₽</span>
          </div>
          <h1 className="text-3xl font-semibold text-telegram-text mb-2">
            Регистрация
          </h1>
          <p className="text-sm text-telegram-textSecondary">
            Создайте новый аккаунт
          </p>
        </div>

        {/* Register Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-telegram text-sm animate-slide-up">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-telegram-text mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="your@email.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-telegram-text mb-2">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-telegram-text mb-2">
                Подтвердите пароль
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>
            
            <button type="submit" className="w-full btn-primary">
              Зарегистрироваться
            </button>
          </form>
          
          <div className="divider"></div>
          
          <p className="text-center text-sm text-telegram-textSecondary">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-telegram-primary hover:underline font-medium">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

