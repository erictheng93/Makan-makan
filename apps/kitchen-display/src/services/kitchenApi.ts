import api from './authApi'
import type { ApiResponse, KitchenOrdersResponse, ItemStatus } from '@/types'

export interface UpdateItemStatusRequest {
  status: ItemStatus
  notes?: string
}

export interface BroadcastTestRequest {
  type?: string
  payload?: any
}

export const kitchenApi = {
  /**
   * 獲取廚房訂單資料
   */
  async getOrders(restaurantId: number): Promise<ApiResponse<KitchenOrdersResponse>> {
    try {
      const response = await api.get(`/kitchen/${restaurantId}/orders`)
      
      return {
        success: true,
        data: response.data.data,
        timestamp: response.data.timestamp
      }
    } catch (error: any) {
      console.error('Get kitchen orders API error:', error)
      
      const message = error.response?.data?.message || error.message || '獲取訂單失敗'
      return {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
      }
    }
  },

  /**
   * 更新訂單項目狀態
   */
  async updateItemStatus(
    restaurantId: number, 
    orderId: number, 
    itemId: number, 
    request: UpdateItemStatusRequest
  ): Promise<ApiResponse> {
    try {
      const response = await api.put(
        `/kitchen/${restaurantId}/orders/${orderId}/items/${itemId}`,
        request
      )
      
      return {
        success: true,
        data: response.data.data,
        timestamp: response.data.timestamp
      }
    } catch (error: any) {
      console.error('Update item status API error:', error)
      
      const message = error.response?.data?.message || error.message || '更新狀態失敗'
      return {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
      }
    }
  },

  /**
   * 批量更新訂單項目狀態
   */
  async batchUpdateItemStatus(
    restaurantId: number,
    updates: Array<{
      orderId: number
      itemId: number
      status: ItemStatus
      notes?: string
    }>
  ): Promise<ApiResponse> {
    try {
      const promises = updates.map(update =>
        this.updateItemStatus(
          restaurantId,
          update.orderId,
          update.itemId,
          { status: update.status, notes: update.notes }
        )
      )
      
      const results = await Promise.all(promises)
      const failures = results.filter(result => !result.success)
      
      if (failures.length > 0) {
        return {
          success: false,
          error: `${failures.length} 個更新失敗`,
          timestamp: new Date().toISOString()
        }
      }
      
      return {
        success: true,
        data: { updatedCount: updates.length },
        timestamp: new Date().toISOString()
      }
    } catch (error: any) {
      console.error('Batch update item status API error:', error)
      
      return {
        success: false,
        error: '批量更新失敗',
        timestamp: new Date().toISOString()
      }
    }
  },

  /**
   * 獲取連接狀態
   */
  async getConnectionStatus(restaurantId: number): Promise<ApiResponse> {
    try {
      const response = await api.get(`/kitchen/${restaurantId}/connections`)
      
      return {
        success: true,
        data: response.data.data,
        timestamp: response.data.timestamp
      }
    } catch (error: any) {
      console.error('Get connection status API error:', error)
      
      const message = error.response?.data?.message || error.message || '獲取連接狀態失敗'
      return {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
      }
    }
  },

  /**
   * 廣播測試事件 (開發用)
   */
  async broadcastTest(restaurantId: number, request: BroadcastTestRequest): Promise<ApiResponse> {
    try {
      const response = await api.post(`/kitchen/${restaurantId}/broadcast-test`, request)
      
      return {
        success: true,
        data: response.data,
        timestamp: new Date().toISOString()
      }
    } catch (error: any) {
      console.error('Broadcast test API error:', error)
      
      const message = error.response?.data?.message || error.message || '廣播測試失敗'
      return {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
      }
    }
  },

  /**
   * 開始製作訂單項目
   */
  async startCooking(restaurantId: number, orderId: number, itemId: number): Promise<ApiResponse> {
    return this.updateItemStatus(restaurantId, orderId, itemId, {
      status: 'preparing'
    })
  },

  /**
   * 標記訂單項目完成
   */
  async markItemReady(restaurantId: number, orderId: number, itemId: number): Promise<ApiResponse> {
    return this.updateItemStatus(restaurantId, orderId, itemId, {
      status: 'ready'
    })
  },

  /**
   * 批量開始製作訂單中的所有項目
   */
  async startAllItems(restaurantId: number, orderId: number, itemIds: number[]): Promise<ApiResponse> {
    const updates = itemIds.map(itemId => ({
      orderId,
      itemId,
      status: 'preparing' as ItemStatus
    }))
    
    return this.batchUpdateItemStatus(restaurantId, updates)
  },

  /**
   * 批量標記訂單中的所有項目完成
   */
  async markAllItemsReady(restaurantId: number, orderId: number, itemIds: number[]): Promise<ApiResponse> {
    const updates = itemIds.map(itemId => ({
      orderId,
      itemId,
      status: 'ready' as ItemStatus
    }))
    
    return this.batchUpdateItemStatus(restaurantId, updates)
  }
}