/**
 * VK Mini App utilities
 * https://dev.vk.com/mini-apps/development/launch-params
 */

import bridge from '@vkontakte/vk-bridge'

// Type definitions for VK Bridge
interface VKUser {
  id: number
  first_name: string
  last_name?: string
  photo_200?: string
  photo_100?: string
}

let vkUserCache: VKUser | null = null
let launchParamsCache: string | null = null

/**
 * Check if app is running inside VK
 */
export function isVKWebApp(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  
  // Check for VK launch params in URL
  const urlParams = new URLSearchParams(window.location.search)
  const hasVKParams = urlParams.has('vk_user_id') || urlParams.has('vk_app_id')
  
  // Also check if bridge is available
  return hasVKParams || typeof bridge !== 'undefined'
}

/**
 * Initialize VK Web App
 * Call this early in your app initialization
 */
export async function initVKWebApp(): Promise<void> {
  if (!isVKWebApp()) {
    return
  }

  try {
    // Initialize VK Bridge
    await bridge.send('VKWebAppInit')
    
    // Cache launch params
    const params = await getVKLaunchParams()
    if (params) {
      launchParamsCache = params
    }
    
    // Try to get user info and cache it
    try {
      const userInfo = await bridge.send('VKWebAppGetUserInfo')
      if (userInfo && typeof userInfo === 'object' && 'id' in userInfo) {
        vkUserCache = userInfo as VKUser
      }
    } catch (error) {
      console.warn('Failed to get VK user info:', error)
    }
  } catch (error) {
    console.warn('Failed to initialize VK Web App:', error)
  }
}

/**
 * Get VK launch params from URL
 * Returns the query string with all VK parameters
 */
export async function getVKLaunchParams(): Promise<string> {
  if (launchParamsCache) {
    return launchParamsCache
  }

  if (typeof window === 'undefined') {
    return ''
  }

  const urlParams = new URLSearchParams(window.location.search)
  const vkParams: string[] = []

  // Extract all VK-related parameters
  for (const [key, value] of urlParams.entries()) {
    if (key.startsWith('vk_') || key === 'sign') {
      vkParams.push(`${key}=${encodeURIComponent(value)}`)
    }
  }

  const params = vkParams.join('&')
  if (params) {
    launchParamsCache = params
  }
  
  return params
}

/**
 * Get VK user ID from launch params
 */
export function getVKUserId(): number | null {
  if (typeof window === 'undefined') {
    return null
  }

  const urlParams = new URLSearchParams(window.location.search)
  const userIdStr = urlParams.get('vk_user_id')
  
  if (userIdStr) {
    const userId = parseInt(userIdStr, 10)
    if (!isNaN(userId)) {
      return userId
    }
  }

  // Fallback: try to get from cached user
  if (vkUserCache?.id) {
    return vkUserCache.id
  }

  return null
}

/**
 * Get VK language from launch params
 * Returns language code (e.g., 'ru', 'en') based on vk_language parameter
 * Maps VK language codes to app-supported languages
 */
export function getVKLanguage(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const urlParams = new URLSearchParams(window.location.search)
  const vkLanguage = urlParams.get('vk_language')
  
  if (!vkLanguage) {
    return null
  }

  // VK language codes mapping to app-supported languages
  // VK uses ISO 639-1 codes (ru, en, uk, kk, etc.)
  // Map to supported languages in the app (ru, en)
  const languageMap: Record<string, string> = {
    'ru': 'ru',
    'en': 'en',
    'uk': 'ru', // Ukrainian -> Russian (closest match)
    'kk': 'ru', // Kazakh -> Russian
    'be': 'ru', // Belarusian -> Russian
    // Add more mappings if needed
  }

  const normalizedLang = vkLanguage.toLowerCase().split('-')[0] // Take only language part (ru-RU -> ru)
  return languageMap[normalizedLang] || 'ru' // Default to Russian if unknown
}

/**
 * Get VK user data (if available)
 */
export function getVKUser(): VKUser | null {
  // Return cached user if available
  if (vkUserCache) {
    return vkUserCache
  }

  // Try to get from bridge (synchronous access)
  // Note: This might not work if bridge is not initialized yet
  // For reliable access, use async version
  return null
}

/**
 * Get VK user data asynchronously
 * This is the recommended way to get user info
 */
export async function getVKUserAsync(): Promise<VKUser | null> {
  if (!isVKWebApp()) {
    return null
  }

  // Return cached user if available
  if (vkUserCache) {
    return vkUserCache
  }

  try {
    const userInfo = await bridge.send('VKWebAppGetUserInfo')
    if (userInfo && typeof userInfo === 'object' && 'id' in userInfo) {
      vkUserCache = userInfo as VKUser
      return vkUserCache
    }
  } catch (error) {
    console.warn('Failed to get VK user info:', error)
  }

  return null
}

/**
 * Show VK alert (uses VKWebAppShowSnackbar)
 * Note: In production, prefer using ToastContext in React components instead of this function
 */
export async function showVKAlert(message: string, callback?: () => void): Promise<void> {
  if (!isVKWebApp()) {
    // No browser alerts allowed - log to console instead
    console.warn('[VK Alert]', message)
    callback?.()
    return
  }

  try {
    // Initialize VK Bridge if not already initialized
    await initVKWebApp()

    // Use VK Bridge snackbar (recommended for VK Mini Apps)
    // @ts-expect-error - VKWebAppShowSnackbar is not in TypeScript types but exists in VK Bridge
    await bridge.send('VKWebAppShowSnackbar', {
      text: message,
      duration: 'long' // or 'short'
    })
    
    callback?.()
  } catch (error) {
    // No browser alerts allowed - log to console instead
    console.warn('[VK Alert] Failed to show VK snackbar:', error)
    console.warn('[VK Alert] Message:', message)
    callback?.()
  }
}

/**
 * Show VK snackbar notification
 * VK Bridge method for showing temporary notifications
 */
export async function showVKSnackbar(
  message: string, 
  duration: 'short' | 'long' = 'short'
): Promise<void> {
  if (!isVKWebApp()) {
    // Fallback to console if not in VK
    console.info(message)
    return
  }

  try {
    await initVKWebApp()
    // @ts-expect-error - VKWebAppShowSnackbar is not in TypeScript types but exists in VK Bridge
    await bridge.send('VKWebAppShowSnackbar', {
      text: message,
      duration
    })
  } catch (error) {
    console.warn('Failed to show VK snackbar:', error)
    // Fallback to console
    console.info(message)
  }
}

/**
 * Check if browser alerts are being blocked or if native VK methods are available
 * Returns info about alert support
 */
export async function checkAlertSupport(): Promise<{
  vkBridgeAvailable: boolean
  browserAlertAvailable: boolean
  preferredMethod: 'vk' | 'browser' | 'none'
}> {
  const vkBridgeAvailable = isVKWebApp() && typeof bridge !== 'undefined'
  
  // Check if browser alert is available (not blocked)
  let browserAlertAvailable = false
  try {
    // Try to detect if alerts are blocked by checking window.alert
    browserAlertAvailable = typeof window !== 'undefined' && typeof window.alert === 'function'
  } catch {
    browserAlertAvailable = false
  }

  let preferredMethod: 'vk' | 'browser' | 'none' = 'none'
  if (vkBridgeAvailable) {
    preferredMethod = 'vk'
  } else if (browserAlertAvailable) {
    preferredMethod = 'browser'
  }

  return {
    vkBridgeAvailable,
    browserAlertAvailable,
    preferredMethod
  }
}

/**
 * Monitor for browser alerts (for debugging/testing purposes)
 * This function wraps window.alert to detect when alerts are triggered
 * 
 * Usage in development:
 * ```typescript
 * const stopMonitoring = monitorBrowserAlerts((message) => {
 *   console.log('Alert detected:', message)
 * })
 * // Later: stopMonitoring() to restore original alert
 * ```
 */
export function monitorBrowserAlerts(
  onAlert?: (message: string) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  // Store original alert
  const originalAlert = window.alert

  // Wrap alert to monitor it (but don't actually show alerts)
  window.alert = function(message: string) {
    // Log to console instead of showing alert
    console.warn('[Browser Alert Blocked]', message)
    console.warn('[Browser Alert Blocked] Use ToastContext or platform-specific methods instead')
    
    // Call callback if provided
    onAlert?.(message)

    // Don't call original alert - block it completely
    return undefined
  }

  // Return function to restore original alert
  return () => {
    window.alert = originalAlert
  }
}
