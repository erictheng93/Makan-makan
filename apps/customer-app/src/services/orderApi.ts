import { apiClient } from './api'
import type { 
  Order, 
  OrderItem,
  CreateOrderRequest,
  OrderStatus
} from '@makanmakan/shared-types'

export interface OrderSummary {
  subtotal: number
  serviceCharge: number
  tax: number
  discount: number
  total: number
}

export interface OrderTrackingInfo {
  order: Order
  timeline: Array<{
    status: OrderStatus
    timestamp: string
    note?: string
    estimatedTime?: string
  }>
  estimatedReadyTime?: string
  currentWaitTime?: number
  queuePosition?: number
}

export const orderApi = {
  /**
   * 創建新訂單
   */
  async createOrder(orderData: CreateOrderRequest): Promise<Order> {
    const response = await apiClient.post<Order>(
      '/orders',
      orderData
    )
    return response
  },

  /**
   * 獲取訂單詳情
   */
  async getOrder(orderId: number): Promise<Order> {
    const response = await apiClient.get<Order>(
      `/orders/${orderId}`
    )
    return response
  },

  /**
   * 獲取訂單追蹤資訊
   */
  async getOrderTracking(orderId: number): Promise<OrderTrackingInfo> {
    const response = await apiClient.get<OrderTrackingInfo>(
      `/orders/${orderId}/tracking`
    )
    return response
  },

  /**
   * 取消訂單
   */
  async cancelOrder(orderId: number, reason?: string): Promise<Order> {
    const response = await apiClient.post<Order>(
      `/orders/${orderId}/cancel`,
      { reason }
    )
    return response
  },

  /**
   * 修改訂單項目
   */
  async updateOrderItem(
    orderId: number, 
    orderItemId: number, 
    updates: {
      quantity?: number
      notes?: string
    }
  ): Promise<OrderItem> {
    const response = await apiClient.patch<OrderItem>(
      `/orders/${orderId}/items/${orderItemId}`,
      updates
    )
    return response
  },

  /**
   * 添加訂單項目
   */
  async addOrderItem(
    orderId: number,
    itemData: {
      menuItemId: number
      quantity: number
      customizations?: any
      notes?: string
    }
  ): Promise<OrderItem> {
    const response = await apiClient.post<OrderItem>(
      `/orders/${orderId}/items`,
      itemData
    )
    return response
  },

  /**
   * 移除訂單項目
   */
  async removeOrderItem(orderId: number, orderItemId: number): Promise<void> {
    await apiClient.delete(`/orders/${orderId}/items/${orderItemId}`)
  },

  /**
   * 計算訂單價格摘要
   */
  async calculateOrderSummary(
    restaurantId: number,
    items: Array<{
      menuItemId: number
      quantity: number
      customizations?: any
    }>
  ): Promise<OrderSummary> {
    const response = await apiClient.post<OrderSummary>(
      `/restaurants/${restaurantId}/orders/calculate`,
      { items }
    )
    return response
  },

  /**
   * 獲取餐廳訂單歷史（針對桌號）
   */
  async getTableOrderHistory(
    restaurantId: number, 
    tableId: number,
    options?: {
      limit?: number
      offset?: number
      status?: OrderStatus[]
      dateFrom?: string
      dateTo?: string
    }
  ): Promise<{
    orders: Order[]
    total: number
    hasMore: boolean
  }> {
    const params = new URLSearchParams()
    
    if (options?.limit) {
      params.append('limit', options.limit.toString())
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString())
    }
    if (options?.status?.length) {
      options.status.forEach(status => params.append('status', status.toString()))
    }
    if (options?.dateFrom) {
      params.append('dateFrom', options.dateFrom)
    }
    if (options?.dateTo) {
      params.append('dateTo', options.dateTo)
    }

    const response = await apiClient.get<{
      orders: Order[]
      total: number
      hasMore: boolean
    }>(
      `/restaurants/${restaurantId}/tables/${tableId}/orders${params.toString() ? `?${params.toString()}` : ''}`
    )
    return response
  },

  /**
   * 請求服務（呼叫服務員）
   */
  async requestService(
    restaurantId: number,
    tableId: number,
    request: {
      type: 'water' | 'napkins' | 'utensils' | 'assistance' | 'bill' | 'other'
      message?: string
      priority?: 'low' | 'normal' | 'high' | 'urgent'
    }
  ): Promise<{
    id: number
    estimatedResponseTime: number
    queuePosition: number
  }> {
    const response = await apiClient.post<{
      id: number
      estimatedResponseTime: number
      queuePosition: number
    }>(
      `/restaurants/${restaurantId}/tables/${tableId}/service-requests`,
      request
    )
    return response
  },

  /**
   * 提交訂單評價
   */
  async submitOrderReview(
    orderId: number,
    review: {
      rating: number // 1-5 stars
      comment?: string
      itemRatings?: Array<{
        orderItemId: number
        rating: number
        comment?: string
      }>
    }
  ): Promise<void> {
    await apiClient.post(`/orders/${orderId}/review`, review)
  },

  /**
   * 獲取訂單收據
   */
  async getOrderReceipt(orderId: number): Promise<{
    orderId: number
    receiptNumber: string
    items: Array<{
      name: string
      quantity: number
      unitPrice: number
      total: number
      customizations?: string
    }>
    summary: OrderSummary
    paymentInfo?: {
      method: string
      transactionId?: string
      paidAt: string
    }
    restaurant: {
      name: string
      address: string
      phone: string
      taxId?: string
    }
    generatedAt: string
  }> {
    const response = await apiClient.get<{
      orderId: number
      receiptNumber: string
      items: Array<{
        name: string
        quantity: number
        unitPrice: number
        total: number
        customizations?: string
      }>
      summary: OrderSummary
      paymentInfo?: {
        method: string
        transactionId?: string
        paidAt: string
      }
      restaurant: {
        name: string
        address: string
        phone: string
        taxId?: string
      }
      generatedAt: string
    }>(
      `/orders/${orderId}/receipt`
    )
    return response
  },

  /**
   * 檢查桌子當前訂單狀態
   */
  async getTableCurrentOrder(
    restaurantId: number, 
    tableId: number
  ): Promise<Order | null> {
    try {
      const response = await apiClient.get<Order | null>(
        `/restaurants/${restaurantId}/tables/${tableId}/current-order`
      )
      return response
    } catch (error: any) {
      // 404 表示沒有進行中的訂單
      if (error.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * 獲取餐廳等待時間估算
   */
  async getRestaurantWaitTime(restaurantId: number): Promise<{
    averageWaitTime: number // 分鐘
    currentOrderCount: number
    kitchenStatus: 'normal' | 'busy' | 'very_busy'
    estimatedPrepTime: number
  }> {
    const response = await apiClient.get<{
      averageWaitTime: number
      currentOrderCount: number
      kitchenStatus: 'normal' | 'busy' | 'very_busy'
      estimatedPrepTime: number
    }>(
      `/restaurants/${restaurantId}/wait-time`
    )
    return response
  }
}

export default orderApi