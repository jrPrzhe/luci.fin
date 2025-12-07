/**
 * Утилита для перевода технических ошибок в понятные сообщения на русском языке
 */

export function translateError(error: any): string {
  if (!error) {
    return 'Произошла неизвестная ошибка'
  }

  // Если ошибка уже на русском и понятная, возвращаем как есть
  let errorMessage: string
  if (typeof error === 'string') {
    errorMessage = error
  } else if (error && typeof error === 'object') {
    // Проверяем различные возможные поля с сообщением об ошибке
    errorMessage = error.message || error.detail || error.error || error.msg || error.toString()
    // Если toString() вернул "[object Object]", пытаемся извлечь информацию из объекта
    if (errorMessage === '[object Object]' || errorMessage === '[object Error]') {
      // Пытаемся найти полезную информацию в объекте
      if (error.name) {
        errorMessage = `${error.name}: ${error.message || 'Неизвестная ошибка'}`
      } else if (error.status) {
        errorMessage = `Ошибка ${error.status}: ${error.statusText || 'Ошибка запроса'}`
      } else {
        // Пытаемся сериализовать объект
        try {
          const errorStr = JSON.stringify(error)
          if (errorStr !== '{}' && errorStr.length < 200) {
            errorMessage = errorStr
          } else {
            errorMessage = 'Произошла неизвестная ошибка'
          }
        } catch {
          errorMessage = 'Произошла неизвестная ошибка'
        }
      }
    }
  } else {
    errorMessage = String(error)
  }
  
  // Проверяем, не является ли сообщение уже понятным русским текстом
  if (errorMessage.includes('Сумма слишком большая') || 
      errorMessage.includes('Максимум') ||
      errorMessage.includes('обязательные поля') ||
      errorMessage.includes('успешно') ||
      errorMessage.includes('не найдено') ||
      errorMessage.includes('недоступен')) {
    return errorMessage
  }

  // Переводим технические ошибки на русский
  const errorLower = errorMessage.toLowerCase()

  // Ошибки сети и таймауты
  if (errorLower.includes('timeout') || errorLower.includes('request timeout')) {
    return 'Превышено время ожидания ответа от сервера. Пожалуйста, попробуйте позже.'
  }
  
  if (errorLower.includes('network error') || errorLower.includes('failed to fetch') || errorLower.includes('networkerror')) {
    return 'Ошибка сети. Проверьте подключение к интернету и попробуйте снова.'
  }

  if (errorLower.includes('connection refused') || errorLower.includes('connection reset')) {
    return 'Не удалось подключиться к серверу. Сервер может быть временно недоступен.'
  }

  // Ошибки авторизации
  if (errorLower.includes('unauthorized') || errorLower.includes('401') || errorLower.includes('not authenticated')) {
    return 'Сессия истекла. Пожалуйста, войдите в систему снова.'
  }

  if (errorLower.includes('forbidden') || errorLower.includes('403') || errorLower.includes('access denied')) {
    return 'У вас нет доступа к этому ресурсу.'
  }

  if (errorLower.includes('incorrect email or password') || errorLower.includes('invalid credentials')) {
    return 'Неверный email или пароль.'
  }

  // Ошибки валидации Pydantic
  if (errorLower.includes('greater_than') || errorLower.includes('input should be greater than')) {
    if (errorLower.includes('target_amount') || errorLower.includes('amount')) {
      return 'Стоимость должна быть больше 0'
    }
    return 'Значение должно быть больше 0'
  }

  if (errorLower.includes('less_than') || errorLower.includes('input should be less than')) {
    return 'Значение слишком большое. Проверьте введенные данные.'
  }

  // Ошибки валидации
  if (errorLower.includes('validation error') || errorLower.includes('invalid')) {
    return 'Ошибка валидации данных. Проверьте правильность введенных данных.'
  }

  if (errorLower.includes('required') || errorLower.includes('обязательное поле')) {
    return 'Заполните все обязательные поля.'
  }

  // Ошибки длины полей
  if (errorLower.includes('max_length') || errorLower.includes('too long') || errorLower.includes('exceeds')) {
    if (errorLower.includes('name') || errorLower.includes('название')) {
      return 'Название счета не может превышать 255 символов.'
    }
    if (errorLower.includes('description') || errorLower.includes('описание')) {
      return 'Описание не может превышать 500 символов.'
    }
    return 'Превышена максимальная длина поля. Проверьте введенные данные.'
  }

  if (errorLower.includes('min_length') || errorLower.includes('too short')) {
    return 'Поле слишком короткое. Проверьте введенные данные.'
  }

  // Ошибки базы данных
  if (errorLower.includes('numeric') || errorLower.includes('overflow') || errorLower.includes('value too large') || errorLower.includes('out of range')) {
    return 'Сумма слишком большая. Максимальная сумма: 9 999 999 999 999.99'
  }

  if (errorLower.includes('database') || errorLower.includes('sql') || errorLower.includes('constraint')) {
    return 'Ошибка базы данных. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
  }

  // Ошибки "не найдено"
  if (errorLower.includes('not found') || errorLower.includes('404') || errorLower.includes('does not exist')) {
    return 'Запрашиваемый ресурс не найден.'
  }

  // Ошибки сервера
  if (errorLower.includes('internal server error') || errorLower.includes('500') || errorLower.includes('server error')) {
    return 'Внутренняя ошибка сервера. Пожалуйста, попробуйте позже.'
  }

  if (errorLower.includes('bad request') || errorLower.includes('400')) {
    return 'Неверный запрос. Проверьте введенные данные.'
  }

  // Ошибки файлов
  if (errorLower.includes('file') && errorLower.includes('too large')) {
    return 'Файл слишком большой. Выберите файл меньшего размера.'
  }

  if (errorLower.includes('file') && errorLower.includes('not found')) {
    return 'Файл не найден.'
  }

  // Ошибки JSON
  if (errorLower.includes('json') || errorLower.includes('parse error') || errorLower.includes('unexpected token')) {
    return 'Ошибка обработки данных. Пожалуйста, попробуйте снова.'
  }

  // Ошибки токенов
  if (errorLower.includes('token') && (errorLower.includes('expired') || errorLower.includes('invalid'))) {
    return 'Сессия истекла. Пожалуйста, войдите в систему снова.'
  }

  // Ошибки Telegram/VK
  if (errorLower.includes('telegram') || errorLower.includes('initdata') || errorLower.includes('vk')) {
    return 'Ошибка авторизации через Telegram/VK. Убедитесь, что вы открыли приложение через Mini App.'
  }

  // Ошибки аккаунтов
  if (errorLower.includes('account') && errorLower.includes('not found')) {
    return 'Счет не найден.'
  }

  if (errorLower.includes('account') && errorLower.includes('insufficient')) {
    return 'Недостаточно средств на счете.'
  }

  // Ошибки транзакций
  if (errorLower.includes('transaction') && errorLower.includes('not found')) {
    return 'Транзакция не найдена.'
  }

  if (errorLower.includes('transaction') && errorLower.includes('failed')) {
    return 'Не удалось создать транзакцию. Проверьте данные и попробуйте снова.'
  }

  // Ошибки категорий
  if (errorLower.includes('category') && errorLower.includes('not found')) {
    return 'Категория не найдена.'
  }

  if (errorLower.includes('category') && errorLower.includes('already exists')) {
    return 'Категория с таким именем уже существует.'
  }

  // Ошибки целей
  if (errorLower.includes('goal') && errorLower.includes('not found')) {
    return 'Цель не найдена.'
  }

  // Ошибки общих бюджетов
  if (errorLower.includes('budget') && errorLower.includes('not found')) {
    return 'Бюджет не найден.'
  }

  if (errorLower.includes('budget') && errorLower.includes('access')) {
    return 'У вас нет доступа к этому бюджету.'
  }

  if (errorLower.includes('last_admin_cannot_leave') || errorMessage.includes('LAST_ADMIN_CANNOT_LEAVE')) {
    return 'LAST_ADMIN_CANNOT_LEAVE'
  }

  // Ошибки импорта
  if (errorLower.includes('import') || errorLower.includes('upload')) {
    return 'Ошибка при импорте данных. Проверьте формат файла и попробуйте снова.'
  }

  // Общие ошибки HTTP
  if (errorLower.includes('http error')) {
    const statusMatch = errorMessage.match(/status:?\s*(\d+)/i)
    if (statusMatch) {
      const status = statusMatch[1]
      switch (status) {
        case '400':
          return 'Неверный запрос. Проверьте введенные данные.'
        case '401':
          return 'Сессия истекла. Пожалуйста, войдите в систему снова.'
        case '403':
          return 'У вас нет доступа к этому ресурсу.'
        case '404':
          return 'Запрашиваемый ресурс не найден.'
        case '500':
          return 'Внутренняя ошибка сервера. Пожалуйста, попробуйте позже.'
        case '502':
          return 'Сервер временно недоступен. Пожалуйста, попробуйте позже.'
        case '503':
          return 'Сервис временно недоступен. Пожалуйста, попробуйте позже.'
        default:
          return `Ошибка сервера (код ${status}). Пожалуйста, попробуйте позже.`
      }
    }
  }

  // Если ничего не подошло, возвращаем исходное сообщение или общее сообщение
  // Но убираем технические детали
  if (errorMessage.length > 200) {
    return 'Произошла ошибка при выполнении операции. Пожалуйста, попробуйте позже.'
  }

  // Если сообщение содержит технические детали, заменяем их
  let cleanMessage = errorMessage
    .replace(/Error:?\s*/gi, '')
    .replace(/Exception:?\s*/gi, '')
    .replace(/at\s+.*/gi, '')
    .replace(/\(.*\)/g, '')
    .trim()

  // Если после очистки осталось что-то осмысленное, возвращаем
  if (cleanMessage.length > 5 && cleanMessage.length < 200) {
    return cleanMessage
  }

  return 'Произошла ошибка. Пожалуйста, попробуйте позже или обратитесь в поддержку.'
}

