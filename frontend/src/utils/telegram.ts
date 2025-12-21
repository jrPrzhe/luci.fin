/**
 * Telegram Web App utilities
 * https://core.telegram.org/bots/webapps
 */

import { logger } from './logger'

// Type definitions for Telegram Web App API
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            language_code?: string
            is_premium?: boolean
            photo_url?: string
          }
          auth_date: number
          hash: string
          query_id?: string
          start_param?: string
        }
        version: string
        platform: string
        colorScheme: 'light' | 'dark'
        themeParams: {
          bg_color?: string
          text_color?: string
          hint_color?: string
          link_color?: string
          button_color?: string
          button_text_color?: string
        }
        isExpanded: boolean
        viewportHeight: number
        viewportStableHeight: number
        headerColor: string
        backgroundColor: string
        isClosingConfirmationEnabled: boolean
        BackButton: {
          isVisible: boolean
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
          show: () => void
          hide: () => void
        }
        MainButton: {
          text: string
          color: string
          textColor: string
          isVisible: boolean
          isActive: boolean
          isProgressVisible: boolean
          setText: (text: string) => void
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
          show: () => void
          hide: () => void
          enable: () => void
          disable: () => void
          showProgress: (leaveActive?: boolean) => void
          hideProgress: () => void
          setParams: (params: {
            text?: string
            color?: string
            text_color?: string
            is_active?: boolean
            is_visible?: boolean
          }) => void
        }
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void
          selectionChanged: () => void
        }
        CloudStorage: {
          setItem: (key: string, value: string, callback?: (error: Error | null, success: boolean) => void) => void
          getItem: (key: string, callback: (error: Error | null, value: string) => void) => void
          getItems: (keys: string[], callback: (error: Error | null, values: Record<string, string>) => void) => void
          removeItem: (key: string, callback?: (error: Error | null, success: boolean) => void) => void
          removeItems: (keys: string[], callback?: (error: Error | null, success: boolean) => void) => void
          getKeys: (callback: (error: Error | null, keys: string[]) => void) => void
        }
        ready: () => void
        expand: () => void
        close: () => void
        sendData: (data: string) => void
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void
        openTelegramLink: (url: string) => void
        openInvoice: (url: string, callback?: (status: string) => void) => void
        showPopup: (params: {
          title?: string
          message: string
          buttons?: Array<{
            id?: string
            type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'
            text: string
          }>
        }, callback?: (id: string) => void) => void
        showAlert: (message: string, callback?: () => void) => void
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void
        showScanQrPopup: (params: {
          text?: string
        }, callback?: (text: string) => void) => void
        closeScanQrPopup: () => void
        readTextFromClipboard: (callback?: (text: string) => void) => void
        requestWriteAccess: (callback?: (granted: boolean) => void) => void
        requestContact: (callback?: (granted: boolean) => void) => void
        onEvent: (eventType: string, eventHandler: () => void) => void
        offEvent: (eventType: string, eventHandler: () => void) => void
      }
    }
  }
}

/**
 * Check if app is running inside Telegram
 * Uses multiple detection methods for reliability
 * IMPORTANT: VK has priority - if VK parameters are in URL, this should return false
 */
export function isTelegramWebApp(): boolean {
  try {
    if (typeof window === 'undefined') {
      return false
    }

    // Get URL params once - reuse for all checks
    const urlParams = new URLSearchParams(window.location.search)

    // PRIORITY CHECK 1: If VK parameters are in URL, we're NOT in Telegram
    // VK Mini Apps can sometimes have Telegram SDK loaded, but we should prioritize VK
    if (urlParams.has('vk_user_id') || urlParams.has('vk_app_id')) {
      // Definitely VK, not Telegram
      return false
    }

    // PRIORITY CHECK 2: Check hash for VK parameters (for SPA navigation)
    const hash = window.location.hash
    if (hash) {
      const hashParams = new URLSearchParams(hash.split('?')[1] || '')
      if (hashParams.has('vk_user_id') || hashParams.has('vk_app_id')) {
        // Definitely VK, not Telegram
        return false
      }
    }

    // PRIORITY CHECK 3: Check sessionStorage for saved VK status
    // This prevents false Telegram detection after navigation in VK Mini App
    try {
      const savedVKStatus = sessionStorage.getItem('isVKWebApp')
      if (savedVKStatus === 'true') {
        logger.log('[isTelegramWebApp] VK detected via sessionStorage, returning false')
        return false
      }
    } catch (error) {
      // Ignore errors accessing sessionStorage
    }

    // PRIORITY CHECK 4: Check for VK Bridge (if available, we're in VK)
    try {
      if ((window as any).vkBridge) {
        // VK Bridge detected, we're in VK, not Telegram
        return false
      }
    } catch (error) {
      // Ignore errors accessing vkBridge
    }

    // Method 1: Check if Telegram WebApp object exists (most reliable)
    // BUT: Only if we don't have VK indicators
    // This is the PRIMARY method - if this exists AND no VK indicators, we're in Telegram
    if (window.Telegram?.WebApp) {
      // Double-check: make sure we're not in VK
      // Re-check VK params to be absolutely sure (including hash and sessionStorage)
      const hashForFinalCheck = window.location.hash
      const hashParamsForFinalCheck = hashForFinalCheck ? new URLSearchParams(hashForFinalCheck.split('?')[1] || '') : null
      let savedVKStatus = false
      try {
        savedVKStatus = sessionStorage.getItem('isVKWebApp') === 'true'
      } catch (error) {
        // Ignore errors
      }
      const finalVKCheck = urlParams.has('vk_user_id') || 
                          urlParams.has('vk_app_id') || 
                          (hashParamsForFinalCheck && (hashParamsForFinalCheck.has('vk_user_id') || hashParamsForFinalCheck.has('vk_app_id'))) ||
                          savedVKStatus ||
                          (window as any).vkBridge
      if (finalVKCheck) {
        // VK detected, not Telegram
        logger.log('[isTelegramWebApp] VK detected in final check, returning false')
        return false
      }
      
      // Only log once to avoid spam
      if (!(window as any).__telegramDetected) {
        logger.log('[isTelegramWebApp] Detected via window.Telegram.WebApp')
        ;(window as any).__telegramDetected = true
      }
      return true
    }

    // Method 2: Check URL parameters (Telegram Mini Apps often have tgWebAppData or similar)
    if (urlParams.has('tgWebAppData') || urlParams.has('tgWebAppStartParam')) {
      if (!(window as any).__telegramDetected) {
        logger.log('[isTelegramWebApp] Detected via URL parameters')
        ;(window as any).__telegramDetected = true
      }
      return true
    }

    // Method 3: Check user agent (Telegram WebView has specific user agent)
    // BUT: Only if we have explicit Telegram parameters or WebApp object
    // Don't rely on user agent alone - it can be spoofed or similar
    const userAgent = navigator.userAgent || ''
    if ((userAgent.includes('Telegram') || userAgent.includes('WebApp')) && 
        (urlParams.has('tgWebAppData') || urlParams.has('tgWebAppStartParam') || window.Telegram?.WebApp)) {
      if (!(window as any).__telegramDetected) {
        logger.log('[isTelegramWebApp] Detected via user agent:', userAgent)
        ;(window as any).__telegramDetected = true
      }
      return true
    }

    // Method 4: Check referrer (Telegram Mini Apps are opened from telegram.org)
    // BUT: Only if we have explicit Telegram parameters or WebApp object
    // Don't rely on referrer alone - it can be missing or incorrect
    const referrer = document.referrer || ''
    if ((referrer.includes('telegram.org') || referrer.includes('t.me')) &&
        (urlParams.has('tgWebAppData') || urlParams.has('tgWebAppStartParam') || window.Telegram?.WebApp)) {
      if (!(window as any).__telegramDetected) {
        logger.log('[isTelegramWebApp] Detected via referrer:', referrer)
        ;(window as any).__telegramDetected = true
      }
      return true
    }

    return false
  } catch (error) {
    logger.error('[isTelegramWebApp] Error checking Telegram WebApp:', error)
    return false
  }
}

/**
 * Get Telegram Web App instance
 */
export function getTelegramWebApp() {
  try {
    if (!isTelegramWebApp()) {
      return null
    }
    return window.Telegram?.WebApp || null
  } catch (error) {
    logger.warn('[getTelegramWebApp] Error getting Telegram WebApp:', error)
    return null
  }
}

/**
 * Wait for Telegram Web App SDK script to load
 * Returns true when Telegram WebApp is available, false after timeout
 */
export async function waitForTelegramSDK(maxWaitMs: number = 5000): Promise<boolean> {
  // If already available, return immediately
  if (window.Telegram?.WebApp) {
    logger.log('[waitForTelegramSDK] Telegram SDK already loaded')
    return true
  }

  // Check if script tag exists
  const scriptTag = document.querySelector('script[src*="telegram-web-app.js"]')
  if (!scriptTag) {
    logger.warn('[waitForTelegramSDK] Telegram Web App SDK script tag not found in HTML')
    // Still wait a bit in case it's loaded dynamically
  }

  const startTime = Date.now()
  const checkInterval = 50 // Check every 50ms

  return new Promise((resolve) => {
    const checkSDK = () => {
      if (window.Telegram?.WebApp) {
        logger.log('[waitForTelegramSDK] Telegram SDK loaded after', Date.now() - startTime, 'ms')
        resolve(true)
        return
      }

      if (Date.now() - startTime >= maxWaitMs) {
        logger.warn('[waitForTelegramSDK] Timeout: Telegram SDK not loaded after', maxWaitMs, 'ms')
        logger.warn('[waitForTelegramSDK] Debug info:', {
          hasWindow: typeof window !== 'undefined',
          hasTelegram: !!window.Telegram,
          hasWebApp: !!window.Telegram?.WebApp,
          userAgent: navigator.userAgent,
          url: window.location.href,
          referrer: document.referrer
        })
        resolve(false)
        return
      }

      setTimeout(checkSDK, checkInterval)
    }

    // Start checking immediately
    checkSDK()
  })
}

/**
 * Initialize Telegram Web App
 * Call this early in your app initialization
 * Now returns a Promise to allow async initialization
 */
export async function initTelegramWebApp(): Promise<boolean> {
  logger.log('[initTelegramWebApp] Starting initialization...')
  
  try {
    // First, wait for SDK to load if we detect we're in Telegram
    const isTelegram = isTelegramWebApp()
    logger.log('[initTelegramWebApp] isTelegramWebApp() returned:', isTelegram)
    
    if (isTelegram) {
      logger.log('[initTelegramWebApp] Detected Telegram environment, waiting for SDK...')
      const sdkLoaded = await waitForTelegramSDK(5000)
      
      if (!sdkLoaded) {
        logger.error('[initTelegramWebApp] Telegram SDK failed to load after timeout')
        logger.error('[initTelegramWebApp] This might cause issues with Telegram Mini App functionality')
        // Continue anyway - app should still work
      }
    }

    const webApp = getTelegramWebApp()
    if (!webApp) {
      logger.warn('[initTelegramWebApp] Telegram WebApp not available after waiting')
      logger.warn('[initTelegramWebApp] App will continue but Telegram-specific features may not work')
      return false
    }

    logger.log('[initTelegramWebApp] Telegram WebApp found, initializing...')

    // Expand to full height
    try {
      webApp.expand()
      logger.log('[initTelegramWebApp] Expanded to full height')
    } catch (error) {
      logger.warn('[initTelegramWebApp] Failed to expand:', error)
    }

    // Set theme colors if available
    try {
      const themeParams = webApp.themeParams
      if (themeParams && themeParams.bg_color) {
        document.documentElement.style.setProperty('--tg-theme-bg-color', themeParams.bg_color)
      }
      if (themeParams && themeParams.text_color) {
        document.documentElement.style.setProperty('--tg-theme-text-color', themeParams.text_color)
      }
      if (themeParams && themeParams.button_color) {
        document.documentElement.style.setProperty('--tg-theme-button-color', themeParams.button_color)
      }
      if (themeParams && themeParams.button_text_color) {
        document.documentElement.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color)
      }
      logger.log('[initTelegramWebApp] Theme colors set')
    } catch (error) {
      logger.warn('[initTelegramWebApp] Failed to set theme colors:', error)
    }

    // Notify Telegram that app is ready
    try {
      webApp.ready()
      logger.log('[initTelegramWebApp] Called ready()')
    } catch (error) {
      logger.warn('[initTelegramWebApp] Failed to call ready():', error)
    }

    logger.log('[initTelegramWebApp] Initialization complete')
    return true
  } catch (error) {
    logger.error('[initTelegramWebApp] Initialization error:', error)
    return false
  }
}

/**
 * Get Telegram user data (if available)
 */
export function getTelegramUser() {
  const webApp = getTelegramWebApp()
  if (!webApp) {
    return null
  }
  return webApp.initDataUnsafe?.user || null
}

/**
 * Wait for Telegram WebApp to be ready and initData to be available
 * Returns initData when ready, or empty string after timeout
 * 
 * This function ensures Telegram WebApp is fully initialized before returning initData
 */
export async function waitForInitData(maxWaitMs: number = 5000): Promise<string> {
  // PRIORITY: Проверяем платформу перед попыткой получить WebApp
  // Если это не Telegram (например, VK или Web), сразу возвращаем пустую строку
  // КРИТИЧЕСКИ ВАЖНО: Проверяем ВК ПЕРВЫМ делом - если мы в ВК, не пытаемся получить Telegram данные
  try {
    // Импортируем функцию проверки ВК динамически, чтобы избежать циклических зависимостей
    const { isVKWebApp } = await import('./vk')
    if (isVKWebApp()) {
      logger.log('[waitForInitData] VK detected (PRIORITY CHECK), returning empty string immediately')
      return ''
    }
  } catch (error) {
    // Игнорируем ошибки импорта - продолжаем проверку
    logger.warn('[waitForInitData] Could not check VK status:', error)
  }
  
  if (!isTelegramWebApp()) {
    logger.log('[waitForInitData] Not in Telegram Mini App, returning empty string')
    return ''
  }
  
  // Helper function to validate initData (declared before use)
  const isValidInitData = (data: string): boolean => {
    if (!data || data.length === 0) {
      return false
    }
    // Valid initData should contain at least user data or hash
    // Also check for minimum length (initData should be at least 50 chars)
    if (data.length < 50) {
      return false
    }
    return data.includes('user=') || data.includes('hash=')
  }

  const webApp = getTelegramWebApp()
  if (!webApp) {
    logger.warn('[waitForInitData] Telegram WebApp not available')
    return ''
  }

  // Ensure WebApp is ready
  try {
    webApp.ready()
    logger.log('[waitForInitData] Called ready(), waiting for initData...')
  } catch (error) {
    logger.warn('[waitForInitData] Error calling ready():', error)
  }
  
  // Give Telegram a moment to populate initData after ready()
  // Sometimes initData appears with a small delay
  await new Promise(resolve => setTimeout(resolve, 200))
  
  // Check again after the delay
  if (isValidInitData(webApp.initData)) {
    logger.log('[waitForInitData] InitData available after ready() delay')
    return webApp.initData
  }

  // If initData is already available and valid, return it immediately
  if (isValidInitData(webApp.initData)) {
    logger.log('[waitForInitData] InitData already available, length:', webApp.initData.length)
    return webApp.initData
  }
  
  // Log current state for debugging
  logger.log('[waitForInitData] InitData not immediately available', {
    hasWebApp: !!webApp,
    initDataLength: webApp.initData?.length || 0,
    initDataPreview: webApp.initData?.substring(0, 50) || 'empty',
    hasInitDataUnsafe: !!webApp.initDataUnsafe,
    hasUser: !!webApp.initDataUnsafe?.user
  })

  // Wait for initData to become available
  const startTime = Date.now()
  const checkInterval = 50 // Check every 50ms

  return new Promise((resolve) => {
    const checkInitData = async () => {
      // Периодически проверяем, не изменилась ли платформа на ВК
      try {
        const { isVKWebApp } = await import('./vk')
        if (isVKWebApp()) {
          logger.log('[waitForInitData] VK detected during wait, returning empty string')
          resolve('')
          return
        }
      } catch (error) {
        // Игнорируем ошибки импорта
      }
      
      const currentWebApp = getTelegramWebApp()
      
      if (!currentWebApp) {
        if (Date.now() - startTime >= maxWaitMs) {
          logger.warn('[waitForInitData] Timeout: WebApp not available')
          resolve('')
          return
        }
        setTimeout(checkInitData, checkInterval)
        return
      }

      // Check if initData is available and valid
      if (isValidInitData(currentWebApp.initData)) {
        // Финальная проверка на ВК перед возвратом данных
        try {
          const { isVKWebApp } = await import('./vk')
          if (isVKWebApp()) {
            logger.log('[waitForInitData] VK detected before returning initData, returning empty string')
            resolve('')
            return
          }
        } catch (error) {
          // Игнорируем ошибки импорта
        }
        
        logger.log('[waitForInitData] InitData became available after', Date.now() - startTime, 'ms', {
          initDataLength: currentWebApp.initData.length,
          initDataPreview: currentWebApp.initData.substring(0, 50),
          hasUser: !!currentWebApp.initDataUnsafe?.user,
          userId: currentWebApp.initDataUnsafe?.user?.id
        })
        resolve(currentWebApp.initData)
        return
      }
      
      // If initData is not valid but we have initDataUnsafe with user, log for debugging
      if (currentWebApp.initDataUnsafe?.user && !isValidInitData(currentWebApp.initData)) {
        logger.warn('[waitForInitData] initDataUnsafe has user but initData is invalid', {
          initDataLength: currentWebApp.initData?.length || 0,
          initDataPreview: currentWebApp.initData?.substring(0, 50) || 'empty',
          userId: currentWebApp.initDataUnsafe.user.id
        })
      }

      // Check timeout
      if (Date.now() - startTime >= maxWaitMs) {
        // Финальная проверка на ВК перед возвратом (даже если таймаут)
        try {
          const { isVKWebApp } = await import('./vk')
          if (isVKWebApp()) {
            logger.log('[waitForInitData] VK detected at timeout, returning empty string')
            resolve('')
            return
          }
        } catch (error) {
          // Игнорируем ошибки импорта
        }
        
        // Timeout reached, но пробуем еще раз с небольшим ожиданием
        // Иногда initData появляется с небольшой задержкой после ready()
        if (currentWebApp && !isValidInitData(currentWebApp.initData)) {
          logger.log('[waitForInitData] WebApp available but initData empty at timeout, waiting a bit more...')
          // Даем еще 1 секунду на появление initData
          await new Promise(resolve => setTimeout(resolve, 1000))
          if (isValidInitData(currentWebApp.initData)) {
            logger.log('[waitForInitData] InitData appeared after additional wait')
            resolve(currentWebApp.initData)
            return
          }
        }
        
        // Timeout reached, return whatever we have (might be empty)
        const finalData = currentWebApp?.initData || ''
        logger.warn('[waitForInitData] Timeout reached after', maxWaitMs, 'ms. InitData:', finalData ? `available (${finalData.length} chars) but might be incomplete` : 'not available')
        resolve(finalData)
        return
      }

      setTimeout(checkInitData, checkInterval)
    }

    // Start checking immediately
    checkInitData()
  })
}

/**
 * Get init data for backend verification
 */
export function getInitData(): string {
  const webApp = getTelegramWebApp()
  if (!webApp) {
    return ''
  }
  return webApp.initData
}

/**
 * Show Telegram alert
 * Note: In production, prefer using ToastContext in React components instead of this function
 */
export function showTelegramAlert(message: string, callback?: () => void) {
  const webApp = getTelegramWebApp()
  if (webApp) {
    webApp.showAlert(message, callback)
  } else {
    // No browser alerts allowed - log to console instead
    logger.warn('[Telegram Alert]', message)
    callback?.()
  }
}

/**
 * Show Telegram confirmation
 * Note: In production, prefer using custom modal dialogs in React components instead of this function
 */
export function showTelegramConfirm(message: string, callback?: (confirmed: boolean) => void) {
  const webApp = getTelegramWebApp()
  if (webApp) {
    webApp.showConfirm(message, callback)
  } else {
    // No browser dialogs allowed - log to console and return false
    logger.warn('[Telegram Confirm]', message)
    callback?.(false)
  }
}

/**
 * Haptic feedback
 */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
  const webApp = getTelegramWebApp()
  if (webApp) {
    webApp.HapticFeedback.impactOccurred(style)
  }
}

export function hapticNotification(type: 'error' | 'success' | 'warning') {
  const webApp = getTelegramWebApp()
  if (webApp) {
    webApp.HapticFeedback.notificationOccurred(type)
  }
}

