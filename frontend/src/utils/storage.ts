/**
 * Storage utilities for VK Mini App and web
 * Uses VK Storage for VK Mini App, localStorage for web
 */

import { isVKWebApp } from './vk'
import bridge from '@vkontakte/vk-bridge'

interface StorageInterface {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
}

class VKStorage implements StorageInterface {
  async getItem(key: string): Promise<string | null> {
    try {
      if (!isVKWebApp()) {
        return null
      }
      const response = await bridge.send('VKWebAppStorageGet', { keys: [key] })
      if (response && response.keys && response.keys.length > 0) {
        const item = response.keys.find((k: any) => k.key === key)
        return item ? item.value : null
      }
      return null
    } catch (error) {
      console.warn('Failed to get item from VK Storage:', error)
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (!isVKWebApp()) {
        return
      }
      await bridge.send('VKWebAppStorageSet', { key, value })
    } catch (error) {
      console.warn('Failed to set item in VK Storage:', error)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (!isVKWebApp()) {
        return
      }
      await bridge.send('VKWebAppStorageSet', { key, value: '' })
    } catch (error) {
      console.warn('Failed to remove item from VK Storage:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      if (!isVKWebApp()) {
        return
      }
      // VK Storage doesn't have a clear method, so we need to get all keys first
      // For now, we'll just log a warning
      console.warn('VK Storage clear is not supported')
    } catch (error) {
      console.warn('Failed to clear VK Storage:', error)
    }
  }
}

class LocalStorage implements StorageInterface {
  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null
      }
      return localStorage.getItem(key)
    } catch (error) {
      console.warn('Failed to get item from localStorage:', error)
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return
      }
      localStorage.setItem(key, value)
    } catch (error) {
      console.warn('Failed to set item in localStorage:', error)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return
      }
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('Failed to remove item from localStorage:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return
      }
      localStorage.clear()
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
    }
  }
}

// Create storage instance based on platform
const storage: StorageInterface = isVKWebApp() ? new VKStorage() : new LocalStorage()

// Synchronous wrappers for backward compatibility
export const storageSync = {
  getItem: (key: string): string | null => {
    if (isVKWebApp()) {
      // For VK, we can't do synchronous storage access
      // Return null and let async version handle it
      return null
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(key)
      }
    } catch (error) {
      console.warn('Failed to get item from localStorage:', error)
    }
    return null
  },
  setItem: (key: string, value: string): void => {
    if (isVKWebApp()) {
      // For VK, use async version
      storage.setItem(key, value).catch(console.error)
      return
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value)
      }
    } catch (error) {
      console.warn('Failed to set item in localStorage:', error)
    }
  },
  removeItem: (key: string): void => {
    if (isVKWebApp()) {
      // For VK, use async version
      storage.removeItem(key).catch(console.error)
      return
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.warn('Failed to remove item from localStorage:', error)
    }
  },
  clear: (): void => {
    if (isVKWebApp()) {
      // For VK, use async version
      storage.clear().catch(console.error)
      return
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear()
      }
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
    }
  },
}

export default storage

