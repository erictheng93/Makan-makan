/**
 * Offline Storage Utilities for Kitchen Display
 * IndexedDB-based offline data management for kitchen operations
 */

export interface OfflineOrderStatusUpdate {
  id: string
  order_id: string
  restaurant_id: string
  status: 'received' | 'preparing' | 'ready' | 'completed'
  estimated_time?: number
  notes?: string
  updated_by: string
  timestamp: string
  synced: boolean
}

export interface KitchenTimer {
  id: string
  order_id: string
  menu_item_id: string
  name: string
  duration: number
  started_at: string
  ends_at: string
  is_active: boolean
  is_completed: boolean
}

export interface CachedOrder {
  id: string
  restaurant_id: string
  table_number?: string
  customer_name?: string
  items: Array<{
    id: string
    name: string
    quantity: number
    special_instructions?: string
    cooking_time?: number
  }>
  status: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_at: string
  cached_at: string
}

export interface KitchenMetrics {
  id: string
  restaurant_id: string
  date: string
  orders_completed: number
  average_prep_time: number
  orders_cancelled: number
  peak_hour_data: Record<string, number>
  cached_at: string
}

export interface OfflineKitchenAction {
  id: string
  restaurant_id: string
  action_type: 'order_update' | 'timer_action' | 'status_change' | 'note_added'
  target_id: string
  data: Record<string, any>
  user_id: string
  timestamp: string
  synced: boolean
}

class KitchenOfflineStorageManager {
  private dbName = 'MakanMakanKitchen'
  private dbVersion = 1
  private db: IDBDatabase | null = null

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Order status updates for offline management
        if (!db.objectStoreNames.contains('orderStatusUpdates')) {
          const statusStore = db.createObjectStore('orderStatusUpdates', { keyPath: 'id' })
          statusStore.createIndex('order_id', 'order_id', { unique: false })
          statusStore.createIndex('restaurant_id', 'restaurant_id', { unique: false })
          statusStore.createIndex('status', 'status', { unique: false })
          statusStore.createIndex('synced', 'synced', { unique: false })
          statusStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Kitchen timers for cooking management
        if (!db.objectStoreNames.contains('kitchenTimers')) {
          const timersStore = db.createObjectStore('kitchenTimers', { keyPath: 'id' })
          timersStore.createIndex('order_id', 'order_id', { unique: false })
          timersStore.createIndex('menu_item_id', 'menu_item_id', { unique: false })
          timersStore.createIndex('is_active', 'is_active', { unique: false })
          timersStore.createIndex('ends_at', 'ends_at', { unique: false })
        }

        // Cached orders for offline viewing
        if (!db.objectStoreNames.contains('cachedOrders')) {
          const ordersStore = db.createObjectStore('cachedOrders', { keyPath: 'id' })
          ordersStore.createIndex('restaurant_id', 'restaurant_id', { unique: false })
          ordersStore.createIndex('status', 'status', { unique: false })
          ordersStore.createIndex('priority', 'priority', { unique: false })
          ordersStore.createIndex('created_at', 'created_at', { unique: false })
          ordersStore.createIndex('cached_at', 'cached_at', { unique: false })
        }

        // Kitchen metrics for performance tracking
        if (!db.objectStoreNames.contains('kitchenMetrics')) {
          const metricsStore = db.createObjectStore('kitchenMetrics', { keyPath: 'id' })
          metricsStore.createIndex('restaurant_id', 'restaurant_id', { unique: false })
          metricsStore.createIndex('date', 'date', { unique: false })
          metricsStore.createIndex('cached_at', 'cached_at', { unique: false })
        }

        // Offline kitchen actions
        if (!db.objectStoreNames.contains('offlineKitchenActions')) {
          const actionsStore = db.createObjectStore('offlineKitchenActions', { keyPath: 'id' })
          actionsStore.createIndex('restaurant_id', 'restaurant_id', { unique: false })
          actionsStore.createIndex('action_type', 'action_type', { unique: false })
          actionsStore.createIndex('user_id', 'user_id', { unique: false })
          actionsStore.createIndex('synced', 'synced', { unique: false })
          actionsStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Kitchen settings and preferences
        if (!db.objectStoreNames.contains('kitchenSettings')) {
          db.createObjectStore('kitchenSettings', { keyPath: 'key' })
        }

        // Sound settings and notifications
        if (!db.objectStoreNames.contains('soundSettings')) {
          db.createObjectStore('soundSettings', { keyPath: 'type' })
        }
      }
    })
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    const transaction = this.db.transaction([storeName], mode)
    return transaction.objectStore(storeName)
  }

  // Order Status Updates Management
  async saveOrderStatusUpdate(update: OfflineOrderStatusUpdate): Promise<void> {
    const store = this.getStore('orderStatusUpdates', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(update)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedOrderStatusUpdates(): Promise<OfflineOrderStatusUpdate[]> {
    const store = this.getStore('orderStatusUpdates')
    const index = store.index('synced')
    return new Promise((resolve, reject) => {
      const request = index.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async markOrderStatusUpdateAsSynced(updateId: string): Promise<void> {
    const store = this.getStore('orderStatusUpdates', 'readwrite')
    return new Promise((resolve, reject) => {
      const getRequest = store.get(updateId)
      getRequest.onsuccess = () => {
        const update = getRequest.result
        if (update) {
          update.synced = true
          const updateRequest = store.put(update)
          updateRequest.onsuccess = () => resolve()
          updateRequest.onerror = () => reject(updateRequest.error)
        } else {
          reject(new Error('Order status update not found'))
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  // Kitchen Timers Management
  async saveTimer(timer: KitchenTimer): Promise<void> {
    const store = this.getStore('kitchenTimers', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(timer)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getActiveTimers(): Promise<KitchenTimer[]> {
    const store = this.getStore('kitchenTimers')
    const index = store.index('is_active')
    return new Promise((resolve, reject) => {
      const request = index.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getTimersForOrder(orderId: string): Promise<KitchenTimer[]> {
    const store = this.getStore('kitchenTimers')
    const index = store.index('order_id')
    return new Promise((resolve, reject) => {
      const request = index.getAll(orderId)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async updateTimer(timerId: string, updates: Partial<KitchenTimer>): Promise<void> {
    const store = this.getStore('kitchenTimers', 'readwrite')
    return new Promise((resolve, reject) => {
      const getRequest = store.get(timerId)
      getRequest.onsuccess = () => {
        const timer = getRequest.result
        if (timer) {
          Object.assign(timer, updates)
          const updateRequest = store.put(timer)
          updateRequest.onsuccess = () => resolve()
          updateRequest.onerror = () => reject(updateRequest.error)
        } else {
          reject(new Error('Timer not found'))
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async deleteTimer(timerId: string): Promise<void> {
    const store = this.getStore('kitchenTimers', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(timerId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Cached Orders Management
  async cacheOrder(order: CachedOrder): Promise<void> {
    const store = this.getStore('cachedOrders', 'readwrite')
    order.cached_at = new Date().toISOString()
    return new Promise((resolve, reject) => {
      const request = store.put(order)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getCachedOrders(restaurantId: string): Promise<CachedOrder[]> {
    const store = this.getStore('cachedOrders')
    const index = store.index('restaurant_id')
    return new Promise((resolve, reject) => {
      const request = index.getAll(restaurantId)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getCachedOrder(orderId: string): Promise<CachedOrder | null> {
    const store = this.getStore('cachedOrders')
    return new Promise((resolve, reject) => {
      const request = store.get(orderId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async updateCachedOrderStatus(orderId: string, status: string): Promise<void> {
    const store = this.getStore('cachedOrders', 'readwrite')
    return new Promise((resolve, reject) => {
      const getRequest = store.get(orderId)
      getRequest.onsuccess = () => {
        const order = getRequest.result
        if (order) {
          order.status = status
          order.cached_at = new Date().toISOString()
          const updateRequest = store.put(order)
          updateRequest.onsuccess = () => resolve()
          updateRequest.onerror = () => reject(updateRequest.error)
        } else {
          reject(new Error('Order not found'))
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  // Kitchen Metrics Management
  async saveKitchenMetrics(metrics: KitchenMetrics): Promise<void> {
    const store = this.getStore('kitchenMetrics', 'readwrite')
    metrics.cached_at = new Date().toISOString()
    return new Promise((resolve, reject) => {
      const request = store.put(metrics)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getKitchenMetrics(restaurantId: string, date: string): Promise<KitchenMetrics | null> {
    const store = this.getStore('kitchenMetrics')
    const index = store.index('restaurant_id')
    return new Promise((resolve, reject) => {
      const request = index.getAll(restaurantId)
      request.onsuccess = () => {
        const results = request.result.filter(item => item.date === date)
        resolve(results.length > 0 ? results[0] : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  // Offline Kitchen Actions Management
  async saveOfflineKitchenAction(action: OfflineKitchenAction): Promise<void> {
    const store = this.getStore('offlineKitchenActions', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(action)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getUnsyncedKitchenActions(): Promise<OfflineKitchenAction[]> {
    const store = this.getStore('offlineKitchenActions')
    const index = store.index('synced')
    return new Promise((resolve, reject) => {
      const request = index.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // Settings Management
  async saveSetting(key: string, value: any): Promise<void> {
    const store = this.getStore('kitchenSettings', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value, updated_at: new Date().toISOString() })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getSetting(key: string): Promise<any> {
    const store = this.getStore('kitchenSettings')
    return new Promise((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result?.value || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Sound Settings Management
  async saveSoundSetting(type: string, settings: any): Promise<void> {
    const store = this.getStore('soundSettings', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put({ type, settings, updated_at: new Date().toISOString() })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getSoundSetting(type: string): Promise<any> {
    const store = this.getStore('soundSettings')
    return new Promise((resolve, reject) => {
      const request = store.get(type)
      request.onsuccess = () => resolve(request.result?.settings || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Cache Cleanup and Maintenance
  async cleanupExpiredCache(expirationHours: number = 8): Promise<void> {
    const cutoffTime = new Date(Date.now() - expirationHours * 60 * 60 * 1000).toISOString()

    // Cleanup expired cached orders
    const ordersStore = this.getStore('cachedOrders', 'readwrite')
    const ordersIndex = ordersStore.index('cached_at')
    const ordersRange = IDBKeyRange.upperBound(cutoffTime)

    await new Promise<void>((resolve, reject) => {
      const request = ordersIndex.openCursor(ordersRange)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })

    // Cleanup completed timers older than 24 hours
    const timersStore = this.getStore('kitchenTimers', 'readwrite')
    const timersRange = IDBKeyRange.upperBound(cutoffTime)

    await new Promise<void>((resolve, reject) => {
      const request = timersStore.openCursor()
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const timer = cursor.value
          if (timer.is_completed && timer.ends_at < cutoffTime) {
            cursor.delete()
          }
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getStorageInfo(): Promise<{
    statusUpdatesCount: number
    activeTimersCount: number
    cachedOrdersCount: number
    metricsCount: number
    unsyncedActionsCount: number
  }> {
    const counts = await Promise.all([
      this.getCount('orderStatusUpdates'),
      this.getActiveTimersCount(),
      this.getCount('cachedOrders'),
      this.getCount('kitchenMetrics'),
      this.getUnsyncedActionsCount()
    ])

    return {
      statusUpdatesCount: counts[0],
      activeTimersCount: counts[1],
      cachedOrdersCount: counts[2],
      metricsCount: counts[3],
      unsyncedActionsCount: counts[4]
    }
  }

  private async getCount(storeName: string): Promise<number> {
    const store = this.getStore(storeName)
    return new Promise((resolve, reject) => {
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private async getActiveTimersCount(): Promise<number> {
    const store = this.getStore('kitchenTimers')
    const index = store.index('is_active')
    return new Promise((resolve, reject) => {
      const request = index.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private async getUnsyncedActionsCount(): Promise<number> {
    const store = this.getStore('offlineKitchenActions')
    const index = store.index('synced')
    return new Promise((resolve, reject) => {
      const request = index.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async clearAllCache(): Promise<void> {
    const storeNames = ['cachedOrders', 'kitchenMetrics']

    for (const storeName of storeNames) {
      const store = this.getStore(storeName, 'readwrite')
      await new Promise<void>((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  }
}

export const kitchenOfflineStorage = new KitchenOfflineStorageManager()

// Auto-initialize when imported
kitchenOfflineStorage.initialize().catch(error => {
  console.error('Failed to initialize kitchen offline storage:', error)
})

export default kitchenOfflineStorage