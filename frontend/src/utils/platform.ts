/**
 * Platform detection and unified authentication workflow
 * Detects the platform (Telegram, VK, or Web) and provides unified auth interface
 */

import { isTelegramWebApp, waitForInitData, initTelegramWebApp } from './telegram'
import { isVKWebApp, getVKLaunchParams, getVKUserAsync, initVKWebApp } from './vk'
import { logger } from './logger'

export type Platform = 'telegram' | 'vk' | 'web'

/**
 * Detect the current platform
 * Priority: VK > Telegram > Web
 * This ensures correct platform detection even if both SDKs are loaded
 */
export function detectPlatform(): Platform {
  // PRIORITY 1: Check VK first (VK has highest priority)
  if (isVKWebApp()) {
    return 'vk'
  }
  
  // PRIORITY 2: Check Telegram
  if (isTelegramWebApp()) {
    return 'telegram'
  }
  
  // Default: Web
  return 'web'
}

/**
 * Get platform-specific auth data
 * Waits for auth data to be available (for Telegram/VK)
 */
export async function getPlatformAuthData(platform: Platform, maxWaitMs: number = 8000): Promise<string | null> {
  switch (platform) {
    case 'telegram': {
      // Initialize Telegram Web App first
      logger.log('[platform] Initializing Telegram Web App...')
      await initTelegramWebApp()
      
      // Wait for initData to be available
      logger.log('[platform] Waiting for Telegram initData...')
      const initData = await waitForInitData(maxWaitMs)
      return initData && initData.length > 0 ? initData : null
    }
    
    case 'vk': {
      // Initialize VK Web App first
      await initVKWebApp()
      
      // Get launch params
      let launchParams = await getVKLaunchParams()
      
      // If params not found immediately, wait a bit
      if (!launchParams || launchParams.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
        launchParams = await getVKLaunchParams()
      }
      
      return launchParams && launchParams.length > 0 ? launchParams : null
    }
    
    case 'web':
    default:
      return null
  }
}

/**
 * Unified authentication function
 */
export async function authWithPlatform(
  platform: Platform,
  authData: string | null,
  currentToken?: string | null
): Promise<{ access_token: string; refresh_token: string; user: any } | null> {
  if (!authData) {
    throw new Error(`No auth data available for platform: ${platform}`)
  }
  
  const { api } = await import('../services/api')
  
  switch (platform) {
    case 'telegram': {
      // loginTelegram only accepts initData and currentToken
      return await api.loginTelegram(
        authData,
        currentToken
      )
    }
    
    case 'vk': {
      // Get user info from VK for name (async)
      const vkUser = await getVKUserAsync()
      return await api.loginVK(
        authData,
        currentToken,
        vkUser?.first_name || null,
        vkUser?.last_name || null
      )
    }
    
    case 'web':
    default:
      throw new Error('Web platform does not support automatic authentication')
  }
}

