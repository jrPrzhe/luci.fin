interface PremiumSubscriptionModalProps {
  onClose: () => void
}

export function PremiumSubscriptionModal({ onClose }: PremiumSubscriptionModalProps) {
  const subscriptionPlans = [
    {
      name: 'Месячная подписка',
      price: '299 ₽',
      period: 'в месяц',
      features: [
        '📊 Детальные финансовые отчеты',
        '📈 Графики и визуализация',
        '📄 Экспорт в PDF и Excel',
        '💬 Отправка отчетов через бота',
        '🎯 Расширенная аналитика',
      ],
      popular: false,
    },
    {
      name: 'Годовая подписка',
      price: '2490 ₽',
      period: 'в год',
      originalPrice: '3588 ₽',
      discount: 'Скидка 30%',
      features: [
        '📊 Детальные финансовые отчеты',
        '📈 Графики и визуализация',
        '📄 Экспорт в PDF и Excel',
        '💬 Отправка отчетов через бота',
        '🎯 Расширенная аналитика',
        '🎁 Экономия 1098 ₽',
      ],
      popular: true,
    },
  ]

  return (
    <div 
      className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-telegram-surface dark:bg-telegram-dark-surface rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-telegram-border dark:border-telegram-dark-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-telegram-text dark:text-telegram-dark-text flex items-center gap-2">
                <span className="text-3xl">⭐</span>
                Премиум подписка
              </h2>
              <p className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                Получите доступ к расширенным функциям
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-telegram-textSecondary dark:text-telegram-dark-textSecondary hover:text-telegram-text dark:hover:text-telegram-dark-text transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

      {/* Content */}
      <div className="p-5 md:p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-telegram-text dark:text-telegram-dark-text mb-3">
            Премиум функции включают:
          </h3>
          <div className="space-y-2">
            {[
              '📊 Детальные финансовые отчеты с графиками',
              '📈 Визуализация данных и трендов',
              '📄 Экспорт отчетов в PDF и Excel',
              '💬 Автоматическая отправка отчетов через бота',
              '🎯 Расширенная аналитика и инсайты',
              '📱 Приоритетная поддержка',
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3 text-telegram-text dark:text-telegram-dark-text">
                <span className="text-xl">{feature.split(' ')[0]}</span>
                <span className="text-sm">{feature.substring(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {subscriptionPlans.map((plan, index) => (
            <div
              key={index}
              className={`relative p-5 rounded-xl border-2 transition-all ${
                plan.popular
                  ? 'border-telegram-primary bg-telegram-primary/5 dark:bg-telegram-primary/10'
                  : 'border-telegram-border dark:border-telegram-dark-border bg-telegram-surface dark:bg-telegram-dark-surface'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-telegram-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                    Популярно
                  </span>
                </div>
              )}
              
              <div className="text-center mb-4">
                <h4 className="text-lg font-bold text-telegram-text dark:text-telegram-dark-text mb-2">
                  {plan.name}
                </h4>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-3xl font-bold text-telegram-primary">
                    {plan.price}
                  </span>
                  {plan.originalPrice && (
                    <span className="text-sm text-telegram-textSecondary dark:text-telegram-dark-textSecondary line-through">
                      {plan.originalPrice}
                    </span>
                  )}
                </div>
                <p className="text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary mt-1">
                  {plan.period}
                </p>
                {plan.discount && (
                  <span className="inline-block mt-2 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                    {plan.discount}
                  </span>
                )}
              </div>

              <ul className="space-y-2 mb-4">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-2 text-sm text-telegram-text dark:text-telegram-dark-text">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  plan.popular
                    ? 'bg-telegram-primary text-white hover:bg-telegram-primary/90'
                    : 'bg-telegram-surface dark:bg-telegram-dark-surface border-2 border-telegram-primary text-telegram-primary hover:bg-telegram-primary hover:text-white'
                }`}
                onClick={() => {
                  // TODO: Implement subscription purchase
                  alert('Функция покупки подписки будет реализована позже')
                }}
              >
                Выбрать план
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-telegram-textSecondary dark:text-telegram-dark-textSecondary">
          <p>
            Подписка автоматически продлевается. Вы можете отменить в любой момент.
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}

