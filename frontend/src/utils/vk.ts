/**
 * VK Mini App utilities
 * https://dev.vk.com/mini-apps/development/launch-params
 */

import bridge from '@vkontakte/vk-bridge'

// Type definitions for VK Mini App API
export interface VKUser {
  id: number
  first_name: string
  last_name?: string
  photo_200?: string
  photo_100?: string
  can_access_closed?: boolean
  is_closed?: boolean
}

export interface VKLaunchParams {
  vk_user_id?: number
  vk_app_id?: number
  vk_is_app_user?: number
  vk_are_notifications_enabled?: number
  vk_language?: string
  vk_ref?: string
  vk_access_token_settings?: string
  vk_group_id?: number
  vk_viewer_group_role?: string
  vk_platform?: string
  vk_is_favorite?: number
  sign?: string
}

let vkInitialized = false
let cachedUser: VKUser | null = null
let cachedLaunchParams: VKLaunchParams | null = null

/**
 * Check if app is running inside VK
 */
export function isVKWebApp(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  
  // Check URL parameters for VK launch params
  const urlParams = window.location.search
  const hasVKParams = urlParams.includes('vk_user_id') || 
                       urlParams.includes('vk_app_id') ||
                       urlParams.includes('vk_')
  
  // Check for VK Bridge or VK global object
  const hasVKBridge = typeof (window as any).vkBridge !== 'undefined' ||
                      typeof (window as any).VK !== 'undefined'
  
  // Check referrer for VK domains
  const referrer = document.referrer || ''
  const isVKReferrer = referrer.includes('vk.com') || 
                       referrer.includes('m.vk.com') ||
                       referrer.includes('vk.ru')
  
  // Check if running in iframe (VK Mini Apps often run in iframes)
  const isInIframe = window.self !== window.top
  
  // Check hostname for VK domains (if app is embedded)
  const hostname = window.location.hostname
  const isVKHostname = hostname.includes('vk.com') || 
                        hostname.includes('m.vk.com') ||
                        hostname.includes('vk.ru')
  
  const isVK = hasVKParams || hasVKBridge || isVKReferrer || isVKHostname
  
  // Debug log (always log for debugging)
  console.log('[VK] Platform check:', {
    hasVKParams,
    hasVKBridge,
    isVKReferrer,
    isVKHostname,
    isInIframe,
    isVK,
    urlParams: urlParams.substring(0, 200),
    referrer: referrer.substring(0, 100),
    hostname,
    hasVkBridge: typeof (window as any).vkBridge !== 'undefined',
    hasVK: typeof (window as any).VK !== 'undefined'
  })
  
  return isVK
}

/**
 * Initialize VK Bridge
 * Call this early in your app initialization
 */
export async function initVKWebApp(): Promise<void> {
  if (!isVKWebApp() || vkInitialized) {
    // If not VK, still try to parse launch params from URL
    if (!vkInitialized && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.has('vk_user_id')) {
        cachedLaunchParams = {
          vk_user_id: urlParams.get('vk_user_id') ? Number(urlParams.get('vk_user_id')) : undefined,
          vk_app_id: urlParams.get('vk_app_id') ? Number(urlParams.get('vk_app_id')) : undefined,
          vk_is_app_user: urlParams.get('vk_is_app_user') ? Number(urlParams.get('vk_is_app_user')) : undefined,
          vk_are_notifications_enabled: urlParams.get('vk_are_notifications_enabled') ? Number(urlParams.get('vk_are_notifications_enabled')) : undefined,
          vk_language: urlParams.get('vk_language') || undefined,
          vk_ref: urlParams.get('vk_ref') || undefined,
          vk_access_token_settings: urlParams.get('vk_access_token_settings') || undefined,
          vk_group_id: urlParams.get('vk_group_id') ? Number(urlParams.get('vk_group_id')) : undefined,
          vk_viewer_group_role: urlParams.get('vk_viewer_group_role') || undefined,
          vk_platform: urlParams.get('vk_platform') || undefined,
          vk_is_favorite: urlParams.get('vk_is_favorite') ? Number(urlParams.get('vk_is_favorite')) : undefined,
          sign: urlParams.get('sign') || undefined,
        }
        if (cachedLaunchParams.vk_user_id) {
          cachedUser = {
            id: cachedLaunchParams.vk_user_id,
            first_name: '',
            last_name: '',
          }
        }
        vkInitialized = true
      }
    }
    return
  }

  try {
    // Initialize VK Bridge
    await bridge.send('VKWebAppInit')
    vkInitialized = true

    // Get launch params from URL
    const urlParams = new URLSearchParams(window.location.search)
    cachedLaunchParams = {
      vk_user_id: urlParams.get('vk_user_id') ? Number(urlParams.get('vk_user_id')) : undefined,
      vk_app_id: urlParams.get('vk_app_id') ? Number(urlParams.get('vk_app_id')) : undefined,
      vk_is_app_user: urlParams.get('vk_is_app_user') ? Number(urlParams.get('vk_is_app_user')) : undefined,
      vk_are_notifications_enabled: urlParams.get('vk_are_notifications_enabled') ? Number(urlParams.get('vk_are_notifications_enabled')) : undefined,
      vk_language: urlParams.get('vk_language') || undefined,
      vk_ref: urlParams.get('vk_ref') || undefined,
      vk_access_token_settings: urlParams.get('vk_access_token_settings') || undefined,
      vk_group_id: urlParams.get('vk_group_id') ? Number(urlParams.get('vk_group_id')) : undefined,
      vk_viewer_group_role: urlParams.get('vk_viewer_group_role') || undefined,
      vk_platform: urlParams.get('vk_platform') || undefined,
      vk_is_favorite: urlParams.get('vk_is_favorite') ? Number(urlParams.get('vk_is_favorite')) : undefined,
      sign: urlParams.get('sign') || undefined,
    }

    // Get user info if available
    if (cachedLaunchParams.vk_user_id) {
      try {
        const userData = await bridge.send('VKWebAppGetUserInfo')
        if (userData && userData.id) {
          cachedUser = userData as VKUser
        }
      } catch (error) {
        console.warn('Failed to get VK user info:', error)
        // Fallback: create user object from launch params
        if (cachedLaunchParams.vk_user_id) {
          cachedUser = {
            id: cachedLaunchParams.vk_user_id,
            first_name: '',
            last_name: '',
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize VK Bridge:', error)
  }
}

/**
 * Get VK user data (if available)
 */
export function getVKUser(): VKUser | null {
  return cachedUser
}

/**
 * Get VK user ID
 */
export function getVKUserId(): number | null {
  if (cachedUser?.id) {
    return cachedUser.id
  }
  if (cachedLaunchParams?.vk_user_id) {
    return cachedLaunchParams.vk_user_id
  }
  return null
}

/**
 * Get launch params for backend verification
 * Returns URL query string with all VK parameters
 */
export function getVKLaunchParams(): string {
  if (!isVKWebApp()) {
    return ''
  }
  
  // Return current URL query string (contains all vk_* parameters)
  return window.location.search
}

/**
 * Get launch params as object
 */
export function getVKLaunchParamsObject(): VKLaunchParams | null {
  return cachedLaunchParams
}

/**
 * Show VK alert
 */
export async function showVKAlert(message: string): Promise<void> {
  if (!isVKWebApp()) {
    alert(message)
    return
  }
  
  try {
    await (bridge.send as any)('VKWebAppShowAlert', { message })
  } catch (error) {
    console.error('Failed to show VK alert:', error)
    alert(message)
  }
}

/**
 * Show VK confirmation
 */
export async function showVKConfirm(message: string): Promise<boolean> {
  if (!isVKWebApp()) {
    const confirmed = confirm(message)
    return confirmed
  }
  
  try {
    const result = await (bridge.send as any)('VKWebAppShowConfirm', { message }) as any
    return result?.result === true || false
  } catch (error) {
    console.error('Failed to show VK confirm:', error)
    const confirmed = confirm(message)
    return confirmed
  }
}

/**
 * Haptic feedback
 */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!isVKWebApp()) {
    return
  }
  
  try {
    (bridge.send as any)('VKWebAppTapticImpactOccurred', { style })
  } catch (error) {
    console.error('Failed to trigger haptic impact:', error)
  }
}

export function hapticNotification(type: 'error' | 'success' | 'warning') {
  if (!isVKWebApp()) {
    return
  }
  
  try {
    (bridge.send as any)('VKWebAppTapticNotificationOccurred', { type })
  } catch (error) {
    console.error('Failed to trigger haptic notification:', error)
  }
}

/**
 * Share link
 */
export async function shareLink(url: string, _text?: string): Promise<void> {
  if (!isVKWebApp()) {
    return
  }
  
  try {
    await (bridge.send as any)('VKWebAppShare', { link: url })
  } catch (error) {
    console.error('Failed to share link:', error)
  }
}

/**
 * Close app
 */
export function closeVKApp(): void {
  if (!isVKWebApp()) {
    return
  }
  
  bridge.send('VKWebAppClose', { status: 'success' })
}

