/**
 * Storage utilities for VK Mini App, Telegram Mini App and web
 * Uses VK Storage for VK Mini App (привязано к user_id, не к устройству)
 * Uses Telegram Cloud Storage for Telegram Mini App (привязано к user_id, не к устройству)
 * Uses localStorage for web (привязано к браузеру/устройству)
 */

import { isVKWebApp } from './vk'
import { isTelegramWebApp, getTelegramWebApp } from './telegram'
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
      // VK Storage: передаем пустое значение для удаления
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

class TelegramCloudStorage implements StorageInterface {
  async getItem(key: string): Promise<string | null> {
    try {
      const webApp = getTelegramWebApp()
      if (!webApp || !webApp.CloudStorage) {
        return null
      }
      
      return new Promise<string | null>((resolve) => {
        webApp.CloudStorage.getItem(key, (error, value) => {
          if (error) {
            console.warn('Failed to get item from Telegram Cloud Storage:', error)
            resolve(null)
          } else {
            resolve(value || null)
          }
        })
      })
    } catch (error) {
      console.warn('Failed to get item from Telegram Cloud Storage:', error)
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const webApp = getTelegramWebApp()
      if (!webApp || !webApp.CloudStorage) {
        return
      }
      
      return new Promise<void>((resolve, reject) => {
        webApp.CloudStorage.setItem(key, value, (error, success) => {
          if (error || !success) {
            console.warn('Failed to set item in Telegram Cloud Storage:', error)
            reject(error || new Error('Failed to set item'))
          } else {
            resolve()
          }
        })
      })
    } catch (error) {
      console.warn('Failed to set item in Telegram Cloud Storage:', error)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const webApp = getTelegramWebApp()
      if (!webApp || !webApp.CloudStorage) {
        return
      }
      
      return new Promise<void>((resolve, reject) => {
        webApp.CloudStorage.removeItem(key, (error, success) => {
          if (error || !success) {
            console.warn('Failed to remove item from Telegram Cloud Storage:', error)
            reject(error || new Error('Failed to remove item'))
          } else {
            resolve()
          }
        })
      })
    } catch (error) {
      console.warn('Failed to remove item from Telegram Cloud Storage:', error)
    }
  }

  async clear(): Promise<void> {
    try {
      const webApp = getTelegramWebApp()
      if (!webApp || !webApp.CloudStorage) {
        return
      }
      
      // Telegram Cloud Storage doesn't have a clear method
      // We need to get all keys and remove them one by one
      return new Promise<void>((resolve, reject) => {
        webApp.CloudStorage.getKeys((error, keys) => {
          if (error) {
            console.warn('Failed to get keys from Telegram Cloud Storage:', error)
            reject(error)
            return
          }
          
          if (!keys || keys.length === 0) {
            resolve()
            return
          }
          
          webApp.CloudStorage.removeItems(keys, (removeError, success) => {
            if (removeError || !success) {
              console.warn('Failed to clear Telegram Cloud Storage:', removeError)
              reject(removeError || new Error('Failed to clear'))
            } else {
              resolve()
            }
          })
        })
      })
    } catch (error) {
      console.warn('Failed to clear Telegram Cloud Storage:', error)
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
// Приоритет: VK > Telegram > localStorage
// Для VK и Telegram используем их хранилища (привязаны к user_id, не к устройству)
// Для обычного веба используем localStorage (привязан к браузеру/устройству)
const storage: StorageInterface = (() => {
  if (isVKWebApp()) {
    return new VKStorage()
  }
  if (isTelegramWebApp()) {
    return new TelegramCloudStorage()
  }
  return new LocalStorage()
})()

// Кэш для синхронного доступа (только для localStorage)
// Для VK и Telegram всегда возвращаем null в синхронной версии
const syncCache = new Map<string, string>()

// Synchronous wrappers for backward compatibility
// ВАЖНО: Для VK и Telegram синхронные методы не работают надежно
// Используйте асинхронные методы storage.getItem/setItem когда возможно
export const storageSync = {
  getItem: (key: string): string | null => {
    // Для VK и Telegram - возвращаем null, нужно использовать async версию
    if (isVKWebApp() || isTelegramWebApp()) {
      // Возвращаем из кэша, если есть (может быть устаревшим)
      return syncCache.get(key) || null
    }
    
    // Для обычного веба используем localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = localStorage.getItem(key)
        // Обновляем кэш
        if (value !== null) {
          syncCache.set(key, value)
        }
        return value
      }
    } catch (error) {
      console.warn('Failed to get item from localStorage:', error)
    }
    return null
  },
  setItem: (key: string, value: string): void => {
    // Обновляем кэш
    syncCache.set(key, value)
    
    // Для VK и Telegram - используем async версию
    if (isVKWebApp() || isTelegramWebApp()) {
      storage.setItem(key, value).catch(console.error)
      return
    }
    
    // Для обычного веба используем localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value)
      }
    } catch (error) {
      console.warn('Failed to set item in localStorage:', error)
    }
  },
  removeItem: (key: string): void => {
    // Удаляем из кэша
    syncCache.delete(key)
    
    // Для VK и Telegram - используем async версию
    if (isVKWebApp() || isTelegramWebApp()) {
      storage.removeItem(key).catch(console.error)
      return
    }
    
    // Для обычного веба используем localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.warn('Failed to remove item from localStorage:', error)
    }
  },
  clear: (): void => {
    // Очищаем кэш
    syncCache.clear()
    
    // Для VK и Telegram - используем async версию
    if (isVKWebApp() || isTelegramWebApp()) {
      storage.clear().catch(console.error)
      return
    }
    
    // Для обычного веба используем localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.clear()
      }
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
    }
  },
}

// Функция для инициализации и загрузки данных из правильного хранилища
// Вызывайте эту функцию при старте приложения для загрузки токенов и других данных
export async function initStorage(): Promise<void> {
  // Для VK и Telegram загружаем данные из их хранилищ в кэш
  if (isVKWebApp() || isTelegramWebApp()) {
    try {
      // Загружаем важные ключи в кэш для синхронного доступа
      const importantKeys = ['token', 'refresh_token', 'language', 'theme', 'valentineTheme', 'onboarding_completed']
      for (const key of importantKeys) {
        try {
          const value = await storage.getItem(key)
          if (value !== null) {
            syncCache.set(key, value)
          }
        } catch (error) {
          console.warn(`Failed to load ${key} from storage:`, error)
        }
      }
    } catch (error) {
      console.warn('Failed to initialize storage:', error)
    }
  }
}

// Export isVKWebApp and isTelegramWebApp for api.ts
export { isVKWebApp } from './vk'
export { isTelegramWebApp } from './telegram'

export default storage

