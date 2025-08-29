/**
 * 本地存儲工具
 * 提供類型安全的 localStorage 操作和過期管理
 */

export interface StorageOptions {
  /** 過期時間（毫秒）*/
  expires?: number
  /** 是否加密存儲 */
  encrypt?: boolean
}

export interface StorageItem<T = any> {
  value: T
  expires?: number
  created: number
}

/**
 * 存儲管理器
 */
export class StorageManager {
  private prefix: string

  constructor(prefix: string = 'makanmakan_') {
    this.prefix = prefix
  }

  /**
   * 獲取完整的鍵名
   */
  private getKey(key: string): string {
    return `${this.prefix}${key}`
  }

  /**
   * 設置存儲項目
   */
  set<T>(key: string, value: T, options: StorageOptions = {}): boolean {
    try {
      const item: StorageItem<T> = {
        value,
        created: Date.now(),
        expires: options.expires ? Date.now() + options.expires : undefined
      }

      const serialized = JSON.stringify(item)
      localStorage.setItem(this.getKey(key), serialized)
      return true
    } catch (error) {
      console.warn(`Failed to set storage item "${key}":`, error)
      return false
    }
  }

  /**
   * 獲取存儲項目
   */
  get<T>(key: string, defaultValue?: T): T | undefined {
    try {
      const serialized = localStorage.getItem(this.getKey(key))
      if (!serialized) {
        return defaultValue
      }

      const item: StorageItem<T> = JSON.parse(serialized)
      
      // 檢查是否過期
      if (item.expires && Date.now() > item.expires) {
        this.remove(key)
        return defaultValue
      }

      return item.value
    } catch (error) {
      console.warn(`Failed to get storage item "${key}":`, error)
      return defaultValue
    }
  }

  /**
   * 移除存儲項目
   */
  remove(key: string): boolean {
    try {
      localStorage.removeItem(this.getKey(key))
      return true
    } catch (error) {
      console.warn(`Failed to remove storage item "${key}":`, error)
      return false
    }
  }

  /**
   * 檢查項目是否存在且未過期
   */
  has(key: string): boolean {
    const value = this.get(key)
    return value !== undefined
  }

  /**
   * 清除所有帶前綴的項目
   */
  clear(): number {
    let cleared = 0
    try {
      const keys = Object.keys(localStorage)
      for (const key of keys) {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key)
          cleared++
        }
      }
    } catch (error) {
      console.warn('Failed to clear storage:', error)
    }
    return cleared
  }

  /**
   * 獲取存儲項目的元資訊
   */
  getInfo(key: string): {
    exists: boolean
    created?: number
    expires?: number
    timeToExpire?: number
    size?: number
  } {
    try {
      const serialized = localStorage.getItem(this.getKey(key))
      if (!serialized) {
        return { exists: false }
      }

      const item: StorageItem = JSON.parse(serialized)
      const now = Date.now()
      
      return {
        exists: true,
        created: item.created,
        expires: item.expires,
        timeToExpire: item.expires ? Math.max(0, item.expires - now) : undefined,
        size: new Blob([serialized]).size
      }
    } catch (error) {
      return { exists: false }
    }
  }

  /**
   * 清理過期項目
   */
  cleanup(): number {
    let cleaned = 0
    try {
      const keys = Object.keys(localStorage)
      const now = Date.now()

      for (const key of keys) {
        if (key.startsWith(this.prefix)) {
          try {
            const serialized = localStorage.getItem(key)
            if (serialized) {
              const item: StorageItem = JSON.parse(serialized)
              if (item.expires && now > item.expires) {
                localStorage.removeItem(key)
                cleaned++
              }
            }
          } catch (error) {
            // 如果項目損壞，也移除它
            localStorage.removeItem(key)
            cleaned++
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup storage:', error)
    }
    return cleaned
  }

  /**
   * 獲取存儲使用統計
   */
  getStats(): {
    totalItems: number
    totalSize: number
    expiredItems: number
    oldestItem?: number
    newestItem?: number
  } {
    const stats = {
      totalItems: 0,
      totalSize: 0,
      expiredItems: 0,
      oldestItem: undefined as number | undefined,
      newestItem: undefined as number | undefined
    }

    try {
      const keys = Object.keys(localStorage)
      const now = Date.now()

      for (const key of keys) {
        if (key.startsWith(this.prefix)) {
          try {
            const serialized = localStorage.getItem(key)
            if (serialized) {
              stats.totalSize += new Blob([serialized]).size
              stats.totalItems++

              const item: StorageItem = JSON.parse(serialized)
              
              if (item.expires && now > item.expires) {
                stats.expiredItems++
              }

              if (item.created) {
                if (!stats.oldestItem || item.created < stats.oldestItem) {
                  stats.oldestItem = item.created
                }
                if (!stats.newestItem || item.created > stats.newestItem) {
                  stats.newestItem = item.created
                }
              }
            }
          } catch (error) {
            // 忽略損壞的項目
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get storage stats:', error)
    }

    return stats
  }
}

// 默認存儲實例
export const storage = new StorageManager()

// 便捷方法
export const setItem = storage.set.bind(storage)
export const getItem = storage.get.bind(storage)
export const removeItem = storage.remove.bind(storage)
export const hasItem = storage.has.bind(storage)
export const clearStorage = storage.clear.bind(storage)

// 專用存儲管理器
export const cartStorage = new StorageManager('makanmakan_cart_')
export const userStorage = new StorageManager('makanmakan_user_')
export const cacheStorage = new StorageManager('makanmakan_cache_')

/**
 * 購物車存儲助手
 */
export const cartStorageHelper = {
  saveCart(restaurantId: number, tableId: number, cartData: any, expires: number = 24 * 60 * 60 * 1000) {
    const key = `${restaurantId}_${tableId}`
    return cartStorage.set(key, cartData, { expires })
  },

  getCart(restaurantId: number, tableId: number) {
    const key = `${restaurantId}_${tableId}`
    return cartStorage.get(key)
  },

  clearCart(restaurantId: number, tableId: number) {
    const key = `${restaurantId}_${tableId}`
    return cartStorage.remove(key)
  },

  hasCart(restaurantId: number, tableId: number): boolean {
    const key = `${restaurantId}_${tableId}`
    return cartStorage.has(key)
  }
}

/**
 * 用戶偏好存儲助手
 */
export const userPreferenceHelper = {
  setPreference(key: string, value: any) {
    return userStorage.set(key, value)
  },

  getPreference<T>(key: string, defaultValue?: T): T | undefined {
    return userStorage.get(key, defaultValue)
  },

  getLanguage(): string {
    return this.getPreference('language', 'zh-TW') || 'zh-TW'
  },

  setLanguage(language: string) {
    return this.setPreference('language', language)
  },

  getTheme(): 'light' | 'dark' | 'auto' {
    return this.getPreference('theme', 'auto') || 'auto'
  },

  setTheme(theme: 'light' | 'dark' | 'auto') {
    return this.setPreference('theme', theme)
  }
}

/**
 * 快取存儲助手
 */
export const cacheHelper = {
  setCache(key: string, data: any, expires: number = 5 * 60 * 1000) {
    return cacheStorage.set(key, data, { expires })
  },

  getCache<T>(key: string): T | undefined {
    return cacheStorage.get(key)
  },

  clearCache(key?: string) {
    if (key) {
      return cacheStorage.remove(key)
    } else {
      return cacheStorage.clear()
    }
  },

  // 餐廳菜單快取
  cacheMenu(restaurantId: number, menuData: any) {
    return this.setCache(`menu_${restaurantId}`, menuData, 10 * 60 * 1000) // 10分鐘
  },

  getCachedMenu(restaurantId: number) {
    return this.getCache(`menu_${restaurantId}`)
  },

  // 餐廳資訊快取
  cacheRestaurant(restaurantId: number, restaurantData: any) {
    return this.setCache(`restaurant_${restaurantId}`, restaurantData, 30 * 60 * 1000) // 30分鐘
  },

  getCachedRestaurant(restaurantId: number) {
    return this.getCache(`restaurant_${restaurantId}`)
  }
}

// 定期清理過期項目
if (typeof window !== 'undefined') {
  // 每10分鐘清理一次
  setInterval(() => {
    storage.cleanup()
    cartStorage.cleanup()
    cacheStorage.cleanup()
  }, 10 * 60 * 1000)

  // 頁面卸載時清理
  window.addEventListener('beforeunload', () => {
    storage.cleanup()
    cartStorage.cleanup()
    cacheStorage.cleanup()
  })
}