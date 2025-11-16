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
