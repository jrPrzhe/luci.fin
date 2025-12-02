/**
 * Telegram Web App utilities
 * https://core.telegram.org/bots/webapps
 */

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
 */
export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp
}

/**
 * Get Telegram Web App instance
 */
export function getTelegramWebApp() {
  if (!isTelegramWebApp()) {
    return null
  }
  return window.Telegram!.WebApp
}

/**
 * Initialize Telegram Web App
 * Call this early in your app initialization
 */
export function initTelegramWebApp() {
  const webApp = getTelegramWebApp()
  if (!webApp) {
    return
  }

  // Expand to full height
  webApp.expand()

  // Set theme colors if available
  const themeParams = webApp.themeParams
  if (themeParams.bg_color) {
    document.documentElement.style.setProperty('--tg-theme-bg-color', themeParams.bg_color)
  }
  if (themeParams.text_color) {
    document.documentElement.style.setProperty('--tg-theme-text-color', themeParams.text_color)
  }
  if (themeParams.button_color) {
    document.documentElement.style.setProperty('--tg-theme-button-color', themeParams.button_color)
  }
  if (themeParams.button_text_color) {
    document.documentElement.style.setProperty('--tg-theme-button-text-color', themeParams.button_text_color)
  }

  // Notify Telegram that app is ready
  webApp.ready()
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
  const webApp = getTelegramWebApp()
  if (!webApp) {
    console.warn('[waitForInitData] Telegram WebApp not available')
    return ''
  }

  // Ensure WebApp is ready
  try {
    webApp.ready()
  } catch (error) {
    console.warn('[waitForInitData] Error calling ready():', error)
  }

  // Helper function to validate initData
  const isValidInitData = (data: string): boolean => {
    if (!data || data.length === 0) {
      return false
    }
    // Valid initData should contain at least user data or hash
    return data.includes('user=') || data.includes('hash=')
  }

  // If initData is already available and valid, return it immediately
  if (isValidInitData(webApp.initData)) {
    console.log('[waitForInitData] InitData already available')
    return webApp.initData
  }

  // Wait for initData to become available
  const startTime = Date.now()
  const checkInterval = 50 // Check every 50ms

  return new Promise((resolve) => {
    const checkInitData = () => {
      const currentWebApp = getTelegramWebApp()
      
      if (!currentWebApp) {
        if (Date.now() - startTime >= maxWaitMs) {
          console.warn('[waitForInitData] Timeout: WebApp not available')
          resolve('')
          return
        }
        setTimeout(checkInitData, checkInterval)
        return
      }

      // Check if initData is available and valid
      if (isValidInitData(currentWebApp.initData)) {
        console.log('[waitForInitData] InitData became available after', Date.now() - startTime, 'ms')
        resolve(currentWebApp.initData)
        return
      }

      // Check timeout
      if (Date.now() - startTime >= maxWaitMs) {
        // Timeout reached, return whatever we have (might be empty)
        const finalData = currentWebApp.initData || ''
        console.warn('[waitForInitData] Timeout reached after', maxWaitMs, 'ms. InitData:', finalData ? `available (${finalData.length} chars) but might be incomplete` : 'not available')
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
    console.warn('[Telegram Alert]', message)
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
    console.warn('[Telegram Confirm]', message)
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

