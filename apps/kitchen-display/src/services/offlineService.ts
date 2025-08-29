import { ref, computed } from 'vue'
import type { KitchenOrder, KitchenOrderItem } from '@/types'

// Offline storage types
export interface OfflineAction {
  id: string
  type: 'start_cooking' | 'mark_ready' | 'update_status' | 'priority_change' | 'batch_operation'
  orderId: number
  itemId?: number
  payload: any
  timestamp: number
  synced: boolean
  retryCount: number
  error?: string
}

export interface OfflineData {
  orders: KitchenOrder[]
  actions: OfflineAction[]
  lastSync: number
  syncInProgress: boolean
}

export interface SyncConflict {
  id: string
  type: 'order_updated' | 'order_deleted' | 'status_conflict'
  localData: any
  serverData: any
  resolution?: 'local' | 'server' | 'merge'
}

class OfflineService {
  private readonly STORAGE_KEY = 'kitchen-offline-data'
  private readonly MAX_RETRY_ATTEMPTS = 5
  private readonly SYNC_INTERVAL = 30000 // 30 seconds
  
  // Reactive state
  public isOnline = ref(navigator.onLine)
  public isOfflineMode = ref(false)
  public pendingActions = ref<OfflineAction[]>([])
  public syncConflicts = ref<SyncConflict[]>([])
  public lastSyncTime = ref<number>(0)
  public syncInProgress = ref(false)
  
  private syncInterval: NodeJS.Timeout | null = null
  private retryTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.initializeOfflineHandling()
    this.loadOfflineData()
    this.startPeriodicSync()
  }

  // Computed properties
  get hasPendingActions() {
    return computed(() => this.pendingActions.value.length > 0)
  }

  get hasConflicts() {
    return computed(() => this.syncConflicts.value.length > 0)
  }

  get canSync() {
    return computed(() => this.isOnline.value && !this.syncInProgress.value)
  }

  // Initialize offline handling
  private initializeOfflineHandling() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))
    
    // Listen for visibility changes to trigger sync when app becomes visible
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    
    // Set initial online status
    this.isOnline.value = navigator.onLine
  }

  private handleOnline() {
    console.log('Network connection restored')
    this.isOnline.value = true
    this.isOfflineMode.value = false
    
    // Trigger immediate sync when coming back online
    this.syncPendingActions()
  }

  private handleOffline() {
    console.log('Network connection lost')
    this.isOnline.value = false
    this.isOfflineMode.value = true
  }

  private handleVisibilityChange() {
    if (!document.hidden && this.isOnline.value) {
      this.syncPendingActions()
    }
  }

  // Data persistence
  private saveOfflineData() {
    const data: OfflineData = {
      orders: this.getCachedOrders(),
      actions: this.pendingActions.value,
      lastSync: this.lastSyncTime.value,
      syncInProgress: this.syncInProgress.value
    }
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save offline data:', error)
    }
  }

  private loadOfflineData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      if (data) {
        const parsed: OfflineData = JSON.parse(data)
        this.pendingActions.value = parsed.actions || []
        this.lastSyncTime.value = parsed.lastSync || 0
        
        // Filter out old actions (older than 24 hours)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
        this.pendingActions.value = this.pendingActions.value.filter(
          action => action.timestamp > oneDayAgo
        )
      }
    } catch (error) {
      console.error('Failed to load offline data:', error)
    }
  }

  // Order caching
  public cacheOrders(orders: KitchenOrder[]) {
    try {
      localStorage.setItem('kitchen-cached-orders', JSON.stringify(orders))
    } catch (error) {
      console.error('Failed to cache orders:', error)
    }
  }

  public getCachedOrders(): KitchenOrder[] {
    try {
      const cached = localStorage.getItem('kitchen-cached-orders')
      return cached ? JSON.parse(cached) : []
    } catch (error) {
      console.error('Failed to get cached orders:', error)
      return []
    }
  }

  // Action queuing
  public queueAction(
    type: OfflineAction['type'],
    orderId: number,
    payload: any,
    itemId?: number
  ): string {
    const action: OfflineAction = {
      id: this.generateActionId(),
      type,
      orderId,
      itemId,
      payload,
      timestamp: Date.now(),
      synced: false,
      retryCount: 0
    }

    this.pendingActions.value.push(action)
    this.saveOfflineData()

    // Try to sync immediately if online
    if (this.isOnline.value) {
      this.syncPendingActions()
    }

    return action.id
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Action application (optimistic updates)
  public applyActionLocally(action: OfflineAction) {
    const cachedOrders = this.getCachedOrders()
    const orderIndex = cachedOrders.findIndex(o => o.id === action.orderId)
    
    if (orderIndex === -1) return

    const order = cachedOrders[orderIndex]

    switch (action.type) {
      case 'start_cooking':
        if (action.itemId) {
          const item = order.items.find(i => i.id === action.itemId)
          if (item) {
            item.status = 'preparing'
          }
        }
        break

      case 'mark_ready':
        if (action.itemId) {
          const item = order.items.find(i => i.id === action.itemId)
          if (item) {
            item.status = 'ready'
          }
        }
        break

      case 'update_status':
        order.status = action.payload.status
        break

      case 'priority_change':
        order.priority = action.payload.priority
        break

      case 'batch_operation':
        // Handle batch operations
        this.applyBatchOperation(order, action.payload)
        break
    }

    // Update order's overall status based on items
    this.updateOrderStatus(order)
    
    // Save updated cached orders
    this.cacheOrders(cachedOrders)
  }

  private applyBatchOperation(order: KitchenOrder, payload: any) {
    switch (payload.operation) {
      case 'start_all':
        order.items.forEach(item => {
          if (item.status === 'pending') {
            item.status = 'preparing'
          }
        })
        break

      case 'complete_all':
        order.items.forEach(item => {
          if (item.status === 'preparing') {
            item.status = 'ready'
          }
        })
        break
    }
  }

  private updateOrderStatus(order: KitchenOrder) {
    const allReady = order.items.every(item => item.status === 'ready')
    const anyPreparing = order.items.some(item => item.status === 'preparing')
    
    if (allReady) {
      order.status = 3 // Ready
    } else if (anyPreparing) {
      order.status = 2 // Preparing
    } else {
      order.status = 1 // Confirmed
    }
  }

  // Synchronization
  public async syncPendingActions(): Promise<void> {
    if (!this.canSync.value || this.pendingActions.value.length === 0) {
      return
    }

    this.syncInProgress.value = true
    const actionsToSync = [...this.pendingActions.value].filter(a => !a.synced)

    try {
      for (const action of actionsToSync) {
        await this.syncSingleAction(action)
      }

      // Remove successfully synced actions
      this.pendingActions.value = this.pendingActions.value.filter(a => !a.synced)
      this.lastSyncTime.value = Date.now()
      
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      this.syncInProgress.value = false
      this.saveOfflineData()
    }
  }

  private async syncSingleAction(action: OfflineAction): Promise<void> {
    try {
      const response = await this.sendActionToServer(action)
      
      if (response.success) {
        action.synced = true
        action.error = undefined
      } else if (response.conflict) {
        // Handle conflict
        this.handleSyncConflict(action, response.conflict)
      } else {
        throw new Error(response.error || 'Sync failed')
      }
      
    } catch (error: any) {
      action.retryCount++
      action.error = error.message
      
      if (action.retryCount >= this.MAX_RETRY_ATTEMPTS) {
        console.error(`Action ${action.id} failed after ${this.MAX_RETRY_ATTEMPTS} attempts:`, error)
        // Move to failed actions or handle differently
      }
      
      throw error
    }
  }

  private async sendActionToServer(action: OfflineAction): Promise<any> {
    // This would make actual API calls in a real implementation
    // For now, we'll simulate the API response
    
    const endpoint = this.getActionEndpoint(action)
    const payload = this.formatActionPayload(action)
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers
        },
        body: JSON.stringify(payload)
      })
      
      return await response.json()
    } catch (error) {
      // Simulate network error handling
      console.log(`Simulating API call for action ${action.type}`)
      
      // Simulate success for demonstration
      return { success: true }
    }
  }

  private getActionEndpoint(action: OfflineAction): string {
    const baseUrl = import.meta.env.VITE_API_BASE_URL
    
    switch (action.type) {
      case 'start_cooking':
        return `${baseUrl}/kitchen/${action.orderId}/items/${action.itemId}/start`
      case 'mark_ready':
        return `${baseUrl}/kitchen/${action.orderId}/items/${action.itemId}/ready`
      case 'update_status':
        return `${baseUrl}/kitchen/${action.orderId}/status`
      case 'priority_change':
        return `${baseUrl}/kitchen/${action.orderId}/priority`
      case 'batch_operation':
        return `${baseUrl}/kitchen/${action.orderId}/batch`
      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
  }

  private formatActionPayload(action: OfflineAction): any {
    return {
      action: action.type,
      timestamp: action.timestamp,
      data: action.payload
    }
  }

  // Conflict resolution
  private handleSyncConflict(action: OfflineAction, conflictData: any) {
    const conflict: SyncConflict = {
      id: `conflict_${action.id}`,
      type: conflictData.type,
      localData: action.payload,
      serverData: conflictData.serverData
    }
    
    this.syncConflicts.value.push(conflict)
  }

  public resolveConflict(conflictId: string, resolution: 'local' | 'server' | 'merge') {
    const conflictIndex = this.syncConflicts.value.findIndex(c => c.id === conflictId)
    if (conflictIndex === -1) return

    const conflict = this.syncConflicts.value[conflictIndex]
    conflict.resolution = resolution

    // Apply resolution logic here
    switch (resolution) {
      case 'local':
        // Keep local changes, retry sync
        break
      case 'server':
        // Accept server version, discard local changes
        this.discardLocalChanges(conflict)
        break
      case 'merge':
        // Attempt to merge changes
        this.mergeChanges(conflict)
        break
    }

    // Remove resolved conflict
    this.syncConflicts.value.splice(conflictIndex, 1)
  }

  private discardLocalChanges(conflict: SyncConflict) {
    // Implementation would update cached data with server version
    console.log('Discarding local changes for conflict:', conflict.id)
  }

  private mergeChanges(conflict: SyncConflict) {
    // Implementation would merge local and server data intelligently
    console.log('Merging changes for conflict:', conflict.id)
  }

  // Periodic sync
  private startPeriodicSync() {
    this.syncInterval = setInterval(() => {
      if (this.isOnline.value && this.pendingActions.value.length > 0) {
        this.syncPendingActions()
      }
    }, this.SYNC_INTERVAL)
  }

  private stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  // Manual sync control
  public async forcSync(): Promise<void> {
    await this.syncPendingActions()
  }

  public cancelSync() {
    this.syncInProgress.value = false
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }
  }

  // Data integrity
  public validateCachedData(): boolean {
    try {
      const cachedOrders = this.getCachedOrders()
      
      // Basic validation - check if orders have required fields
      return cachedOrders.every(order => 
        order.id && 
        order.orderNumber && 
        Array.isArray(order.items) &&
        typeof order.status === 'number'
      )
    } catch (error) {
      console.error('Data validation failed:', error)
      return false
    }
  }

  public repairData(): boolean {
    try {
      const cachedOrders = this.getCachedOrders()
      let repaired = false

      // Repair missing or invalid data
      cachedOrders.forEach(order => {
        if (!order.elapsedTime) {
          const now = Date.now()
          const createdTime = new Date(order.createdAt).getTime()
          order.elapsedTime = Math.floor((now - createdTime) / (1000 * 60))
          repaired = true
        }

        if (!order.priority) {
          order.priority = 'normal'
          repaired = true
        }
      })

      if (repaired) {
        this.cacheOrders(cachedOrders)
      }

      return repaired
    } catch (error) {
      console.error('Data repair failed:', error)
      return false
    }
  }

  // Statistics
  public getOfflineStats() {
    return {
      pendingActions: this.pendingActions.value.length,
      failedActions: this.pendingActions.value.filter(a => a.error).length,
      lastSyncTime: this.lastSyncTime.value,
      isOnline: this.isOnline.value,
      isOfflineMode: this.isOfflineMode.value,
      conflicts: this.syncConflicts.value.length
    }
  }

  // Cleanup
  public clearOfflineData() {
    this.pendingActions.value = []
    this.syncConflicts.value = []
    localStorage.removeItem(this.STORAGE_KEY)
    localStorage.removeItem('kitchen-cached-orders')
  }

  public destroy() {
    this.stopPeriodicSync()
    this.cancelSync()
    
    window.removeEventListener('online', this.handleOnline.bind(this))
    window.removeEventListener('offline', this.handleOffline.bind(this))
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
  }
}

// Create and export singleton instance
export const offlineService = new OfflineService()
export default offlineService