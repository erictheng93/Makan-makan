/**
 * Orders Service
 * Comprehensive business logic for order management
 */

// Import database utilities when needed
import { OrderService as BaseOrderService, CouponService } from '@makanmakan/database'
import { Order, OrderStatus, OrderPaymentStatus, OrderPaymentMethod, RealtimeEventType } from '@makanmakan/shared-types'
import type { Env } from '../../../shared/types'
import type { UserRole } from '../../../shared/constants'
import { ConsoleLogger } from '../../../core/monitoring'
import { RealtimeBroadcastService } from '../../../services/RealtimeBroadcastService'
import type { OrderStatusUpdateEvent } from '@makanmakan/shared-types'
// Use KV for caching

// Import feature-specific types
import type {
  CreateOrderData,
  UpdateOrderData,
  OrderStatusUpdateData,
  OrderQueryFilters,
  OrderSearchParams,
  OrderAnalytics,
  OrderStats,
  CouponValidation,
  CouponPreviewRequest,
  OrderUpdateEvent,
  // OrderNotification, // Available for future use
  BulkOrderOperation,
  BulkOrderResult,
  OrderPermissions,
  OrderReceipt,
  PaymentIntegration,
  IOrdersService
} from '../types'

export class OrdersService implements IOrdersService {
  private baseOrderService: BaseOrderService
  private couponService: CouponService
  private realtimeBroadcastService: RealtimeBroadcastService
  private cacheKV: any
  private logger: ConsoleLogger
  private env: Env

  constructor(env: Env) {
    this.env = env
    this.baseOrderService = new BaseOrderService(env.DB as any, env)
    this.couponService = new CouponService(env.DB as any, env)
    this.realtimeBroadcastService = new RealtimeBroadcastService(env)
    this.cacheKV = env.CACHE_KV
    this.logger = new ConsoleLogger('OrdersService')
  }

  // Core CRUD Operations
  async createOrder(data: CreateOrderData, userId?: number): Promise<Order> {
    try {
      this.logger.info('Creating new order', { restaurantId: data.restaurantId, userId })

      // ========== INPUT VALIDATION ==========
      // 1. Validate restaurant ID
      if (!data.restaurantId || data.restaurantId <= 0) {
        throw new Error('Invalid restaurant ID')
      }

      // 2. Validate items array
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error('Order must contain at least one item')
      }

      // 3. Validate maximum items (prevent abuse)
      if (data.items.length > 100) {
        throw new Error('Order cannot exceed 100 items')
      }

      // 4. Validate each item
      for (const item of data.items) {
        if (!item.menuItemId || item.menuItemId <= 0) {
          throw new Error('Invalid menu item ID')
        }
        if (!item.quantity || item.quantity <= 0) {
          throw new Error('Invalid item quantity: must be greater than 0')
        }
        if (item.quantity > 999) {
          throw new Error('Invalid item quantity: cannot exceed 999 per item')
        }
        // Validate customizations if present
        if (item.customizations && typeof item.customizations !== 'object') {
          throw new Error('Invalid item customizations format')
        }
        // Validate notes length if present
        if (item.notes && item.notes.length > 500) {
          throw new Error('Item notes cannot exceed 500 characters')
        }
      }

      // 5. Validate customer info if provided
      if (data.customerInfo) {
        if (data.customerInfo.phone && !/^[\d\s\-+()]{7,20}$/.test(data.customerInfo.phone)) {
          throw new Error('Invalid phone number format')
        }
        if (data.customerInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerInfo.email)) {
          throw new Error('Invalid email format')
        }
      }

      // 6. Validate notes length if provided
      if (data.notes && data.notes.length > 1000) {
        throw new Error('Order notes cannot exceed 1000 characters')
      }

      // 7. Validate coupon code format if provided
      if (data.couponCode && (data.couponCode.length < 3 || data.couponCode.length > 50)) {
        throw new Error('Invalid coupon code format')
      }

      // Validate business hours
      await this.validateBusinessHours(data.restaurantId, data.scheduledTime)

      // Validate menu items availability
      await this.validateMenuItems(data.items)

      // Convert feature-specific data to base service format
      const baseOrderData = {
        restaurantId: data.restaurantId,
        tableId: data.tableId || 0, // Default table for takeaway/delivery
        customerId: data.customerId,
        customerInfo: data.customerInfo,
        items: data.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          customizations: item.customizations,
          notes: item.notes
        })),
        notes: data.notes,
        couponCode: data.couponCode
      }

      // Create order using base service
      const order = await this.baseOrderService.createOrder(baseOrderData)

      // Add order type and scheduled time if provided
      if (data.orderType || data.scheduledTime) {
        // Update with additional fields not handled by base service
        // This would typically involve a direct database update
      }

      // Cache the order
      await this.cacheOrder(order)

      // Log activity
      await this.logOrderActivity(order.id, 'ORDER_CREATED', userId, {
        restaurantId: data.restaurantId,
        itemCount: data.items.length,
        total: order.totalAmount
      })

      // Broadcast new order event
      await this.broadcastNewOrder(order)

      this.logger.info('Order created successfully', { orderId: order.id, orderNumber: order.orderNumber })
      return order

    } catch (error) {
      this.logger.error('Failed to create order', error instanceof Error ? error : undefined, { data })
      throw error
    }
  }

  async getOrder(id: number, includeItems: boolean = true): Promise<Order | null> {
    try {
      // Try cache first
      const cacheKey = `order:${id}:${includeItems ? 'full' : 'basic'}`
      const cached = await this.cacheKV.get(cacheKey, 'json') as Order | null
      if (cached) {
        return cached
      }

      // Get from base service
      const order = await this.baseOrderService.getOrder(id)
      if (!order) return null

      // Cache the result
      await this.cacheKV.set(cacheKey, order, 300) // 5 minutes

      return order

    } catch (error) {
      this.logger.error('Failed to get order', error instanceof Error ? error : undefined, { orderId: id })
      throw error
    }
  }

  async getOrders(
    filters: OrderQueryFilters,
    userId?: number,
    userRole?: UserRole
  ): Promise<{
    orders: Order[]
    total: number
    pagination: { page: number; limit: number; totalPages: number }
  }> {
    try {
      // Apply permission-based filtering
      const permissionFilters = await this.applyPermissionFilters(filters, userId, userRole)

      // Convert to base service format
      const baseFilters = this.convertToBaseFilters(permissionFilters)

      // Get orders from base service
      const result = await this.baseOrderService.getOrders(
        baseFilters,
        filters.page || 1,
        filters.limit || 20
      )

      // Apply additional filtering and sorting
      let orders = result.orders

      if (filters.sortBy) {
        orders = this.sortOrders(orders, filters.sortBy, filters.sortOrder)
      }

      return {
        orders,
        total: result.pagination.total,
        pagination: result.pagination
      }

    } catch (error) {
      this.logger.error('Failed to get orders', error instanceof Error ? error : undefined, { filters })
      throw error
    }
  }

  async updateOrder(id: number, data: UpdateOrderData, userId?: number): Promise<Order | null> {
    try {
      this.logger.info('Updating order', { orderId: id, data, userId })

      const existingOrder = await this.getOrder(id)
      if (!existingOrder) return null

      // Validate permissions
      await this.validateUpdatePermissions(existingOrder, userId)

      // Update using base service methods
      let updatedOrder = existingOrder

      if (data.status !== undefined) {
        updatedOrder = await this.baseOrderService.updateOrderStatus(id, {
          status: String(data.status),
          notes: data.notes
        }) || updatedOrder
      }

      // Handle payment status updates
      if (data.paymentStatus !== undefined) {
        const paymentUpdate = await this.updatePaymentStatus(
          id,
          data.paymentStatus,
          data.paymentMethod
        )
        if (paymentUpdate) {
          updatedOrder = paymentUpdate
        }
      }

      // Clear cache
      await this.invalidateOrderCache(id)

      // Log activity
      await this.logOrderActivity(id, 'ORDER_UPDATED', userId, data)

      this.logger.info('Order updated successfully', { orderId: id })
      return updatedOrder

    } catch (error) {
      this.logger.error('Failed to update order', error instanceof Error ? error : undefined, { orderId: id })
      throw error
    }
  }

  async deleteOrder(id: number, userId?: number): Promise<boolean> {
    try {
      const order = await this.getOrder(id)
      if (!order) return false

      // Only allow deletion of pending orders
      if (String(order.status) !== 'pending') {
        throw new Error('Only pending orders can be deleted')
      }

      // Use base service cancel method
      await this.baseOrderService.cancelOrder(id, 'Order deleted')

      // Clear cache
      await this.invalidateOrderCache(id)

      // Log activity
      await this.logOrderActivity(id, 'ORDER_DELETED', userId)

      return true

    } catch (error) {
      this.logger.error('Failed to delete order', error instanceof Error ? error : undefined, { orderId: id })
      throw error
    }
  }

  // Status Management
  async updateOrderStatus(
    id: number,
    statusData: OrderStatusUpdateData,
    userId?: number,
    userRole?: UserRole
  ): Promise<Order | null> {
    try {
      const order = await this.getOrder(id)
      if (!order) return null

      // Validate status transition (let validateStatusTransition normalize the values)
      this.validateStatusTransition(order.status, statusData.status, userRole)

      // Update using base service
      const updatedOrder = await this.baseOrderService.updateOrderStatus(id, {
        status: String(statusData.status),
        notes: statusData.notes
      })

      if (!updatedOrder) {
        throw new Error('Failed to update order status')
      }

      // Handle side effects based on status
      await this.handleStatusSideEffects(updatedOrder, statusData, userId)

      // Clear cache
      await this.invalidateOrderCache(id)

      // Broadcast real-time update
      await this.broadcastOrderUpdate({
        orderId: id,
        previousStatus: order.status,
        newStatus: statusData.status,
        updatedBy: userId || 0,
        updatedAt: new Date(),
        notes: statusData.notes,
        estimatedReadyTime: statusData.estimatedReadyTime
      })

      return updatedOrder

    } catch (error) {
      this.logger.error('Failed to update order status', error instanceof Error ? error : undefined, { orderId: id })
      throw error
    }
  }

  async cancelOrder(id: number, reason: string, userId?: number): Promise<Order | null> {
    try {
      const cancelledOrder = await this.baseOrderService.cancelOrder(id, reason)

      if (cancelledOrder) {
        await this.invalidateOrderCache(id)
        await this.logOrderActivity(id, 'ORDER_CANCELLED', userId, { reason })
      }

      return cancelledOrder

    } catch (error) {
      this.logger.error('Failed to cancel order', error instanceof Error ? error : undefined, { orderId: id })
      throw error
    }
  }

  async getOrderStatusHistory(id: number): Promise<Array<{
    status: OrderStatus
    timestamp: Date
    updatedBy?: number
    notes?: string
  }>> {
    try {
      // This would require implementing audit log tracking in base service
      // For now, return a basic implementation
      const order = await this.getOrder(id)
      if (!order) return []

      return [{
        status: order.status,
        timestamp: new Date(order.updatedAt),
        notes: order.notes
      }]

    } catch (error) {
      this.logger.error('Failed to get order status history', error instanceof Error ? error : undefined, { orderId: id })
      return []
    }
  }

  // Payment Operations
  async updatePaymentStatus(
    id: number,
    _paymentStatus: OrderPaymentStatus,
    _paymentMethod?: OrderPaymentMethod,
    _transactionData?: PaymentIntegration
  ): Promise<Order | null> {
    try {
      // This would require extending base service or direct database access
      const order = await this.getOrder(id)
      if (!order) return null

      // Update payment information
      // Implementation would depend on base service capabilities

      await this.invalidateOrderCache(id)

      return order

    } catch (error) {
      this.logger.error('Failed to update payment status', error instanceof Error ? error : undefined, { orderId: id })
      throw error
    }
  }

  // Analytics and Reporting
  async getOrderAnalytics(filters: OrderQueryFilters, _userId?: number): Promise<OrderAnalytics> {
    try {
      const cacheKey = `analytics:${JSON.stringify(filters)}`
      const cached = await this.cacheKV.get(cacheKey, 'json') as OrderAnalytics | null
      if (cached) return cached

      // Get basic stats from base service
      const restaurantId = filters.restaurantId
      if (!restaurantId) {
        throw new Error('Restaurant ID required for analytics')
      }

      const dailyStats = await this.baseOrderService.getDailyOrderStats(restaurantId, new Date())

      // Build comprehensive analytics
      const analytics: OrderAnalytics = {
        summary: {
          totalOrders: dailyStats.totalOrders,
          totalRevenue: dailyStats.totalRevenue,
          averageOrderValue: dailyStats.avgOrderValue,
          averagePreparationTime: 0, // Add when available in base service
          orderCompletionRate: 0.95, // Calculate from actual data
          customerRetentionRate: 0.75 // Calculate from actual data
        },
        byStatus: [],
        byPaymentStatus: [],
        byOrderType: [],
        byTime: {
          hourly: [],
          daily: [],
          weekly: [],
          monthly: []
        },
        topItems: [],
        customerAnalytics: {
          newCustomers: 0,
          returningCustomers: 0,
          averageOrdersPerCustomer: 0,
          customerLifetimeValue: 0
        },
        performanceMetrics: {
          averageOrderProcessingTime: 0,
          peakHours: [],
          busyDays: [],
          orderAccuracy: 0.98,
          cancellationRate: 0.05
        }
      }

      // Cache for 15 minutes
      await this.cacheKV.set(cacheKey, analytics, 900)

      return analytics

    } catch (error) {
      this.logger.error('Failed to get order analytics', error instanceof Error ? error : undefined, {})
      throw error
    }
  }

  async getOrderStatistics(restaurantId: number, _filters?: OrderQueryFilters): Promise<OrderStats> {
    return this.getDailyStats(restaurantId, new Date())
  }

  async getActiveOrders(restaurantId: number): Promise<Order[]> {
    const filters: OrderQueryFilters = {
      restaurantId,
      status: ['confirmed', 'preparing', 'ready'] as any,
      limit: 100
    }
    const result = await this.getOrders(filters)
    return result.orders
  }

  async getDailyStats(restaurantId: number, date?: Date): Promise<OrderStats> {
    try {
      const baseStats = await this.baseOrderService.getDailyOrderStats(restaurantId, date || new Date())
      return {
        ...baseStats,
        preparingOrders: 0, // Add when available
        readyOrders: 0, // Add when available
        averageOrderValue: baseStats.avgOrderValue,
        averagePreparationTime: 0 // Add when available
      }
    } catch (error) {
      this.logger.error('Failed to get daily stats', error instanceof Error ? error : undefined, { restaurantId })
      throw error
    }
  }

  async getPopularItems(restaurantId: number, timeRange?: string): Promise<Array<{
    menuItemId: number
    name: string
    quantity: number
    revenue: number
  }>> {
    try {
      const cacheKey = `popular-items:${restaurantId}:${timeRange || 'month'}`
      const cached = await this.cacheKV.get(cacheKey, 'json') as any[] | null
      if (cached) return cached

      // Implementation would require aggregating order items
      const results: Array<{
        menuItemId: number
        name: string
        quantity: number
        revenue: number
      }> = []

      await this.cacheKV.set(cacheKey, results, 1800) // 30 minutes
      return results

    } catch (error) {
      this.logger.error('Failed to get popular items', error instanceof Error ? error : undefined, { restaurantId })
      return []
    }
  }

  // Search and Filter
  async searchOrders(
    searchParams: OrderSearchParams,
    filters?: OrderQueryFilters,
    userId?: number
  ): Promise<Order[]> {
    try {
      // Combine search with filters
      const combinedFilters = { ...filters }

      if (searchParams.query) {
        // Add search logic to filters
        // Implementation would depend on search fields
      }

      const result = await this.getOrders(combinedFilters, userId)
      return result.orders

    } catch (error) {
      this.logger.error('Failed to search orders', error instanceof Error ? error : undefined, { searchParams })
      return []
    }
  }

  // Bulk Operations
  async bulkUpdateOrders(operation: BulkOrderOperation, userId?: number): Promise<BulkOrderResult> {
    try {
      const batchId = operation.batchId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const result: BulkOrderResult = {
        batchId,
        totalOrders: operation.orderIds.length,
        successCount: 0,
        failedCount: 0,
        errors: [],
        results: []
      }

      for (const orderId of operation.orderIds) {
        try {
          let success = false
          let data: any = null

          switch (operation.action) {
            case 'update_status':
              if (operation.data?.status) {
                const updated = await this.updateOrderStatus(
                  orderId,
                  { status: operation.data.status, notes: operation.data.notes },
                  userId
                )
                success = !!updated
                data = updated
              }
              break

            case 'cancel': {
              const cancelled = await this.cancelOrder(
                orderId,
                operation.data?.reason || 'Bulk cancellation',
                userId
              )
              success = !!cancelled
              data = cancelled
              break
            }

            default:
              throw new Error(`Unsupported bulk operation: ${operation.action}`)
          }

          result.results.push({ orderId, success, data })
          if (success) result.successCount++

        } catch (error) {
          result.failedCount++
          const errorMessage = error instanceof Error ? error.message : String(error)
          result.errors.push({ orderId, error: errorMessage })
          result.results.push({ orderId, success: false, error: errorMessage })
        }
      }

      this.logger.info('Bulk operation completed', { batchId, result })
      return result

    } catch (error) {
      this.logger.error('Failed to execute bulk operation', error instanceof Error ? error : undefined, { operation })
      throw error
    }
  }

  // Coupon and Discount Operations
  async previewCoupon(data: CouponPreviewRequest): Promise<CouponValidation> {
    return this.validateCoupon(data)
  }

  async validateCoupon(data: CouponPreviewRequest): Promise<CouponValidation> {
    try {
      const result = await this.couponService.validateCoupon(
        data.couponCode,
        data.restaurantId.toString(),
        data.orderAmount,
        data.userId,
        data.menuItems
      )

      return {
        valid: result.valid,
        coupon: result.coupon ? {
          code: result.coupon.code,
          name: result.coupon.name,
          discountType: result.coupon.discountType as any,
          discountValue: result.coupon.discountValue
        } : undefined,
        originalAmount: data.orderAmount,
        discountAmount: result.discountAmount || 0,
        finalAmount: result.finalAmount || data.orderAmount,
        savings: result.discountAmount,
        error: result.error
      }

    } catch (error) {
      this.logger.error('Failed to validate coupon', error instanceof Error ? error : undefined, { data })
      return {
        valid: false,
        originalAmount: data.orderAmount,
        discountAmount: 0,
        finalAmount: data.orderAmount,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // Receipt and Export
  async generateReceipt(orderId: number): Promise<OrderReceipt> {
    try {
      const order = await this.getOrder(orderId, true)
      if (!order) throw new Error('Order not found')

      // Build receipt data
      const receipt: OrderReceipt = {
        orderNumber: order.orderNumber,
        restaurantInfo: {
          id: order.restaurantId,
          name: order.restaurant?.name || 'Restaurant',
          address: order.restaurant?.address,
          phone: order.restaurant?.phone,
          email: order.restaurant?.email
        },
        customerInfo: order.customerInfo || {},
        tableInfo: order.table ? {
          id: order.tableId,
          number: order.table.number || 'N/A',
          seats: order.table.seats || 0
        } : undefined,
        items: order.items?.map(item => ({
          name: item.menuItem?.name || 'Unknown Item',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          customizations: this.formatCustomizations(item.customizations),
          notes: item.notes
        })) || [],
        summary: {
          subtotal: order.subtotal,
          tax: order.taxAmount,
          serviceCharge: order.serviceCharge,
          discount: order.discountAmount,
          total: order.totalAmount
        },
        paymentInfo: {
          method: (order.paymentMethod as OrderPaymentMethod) || 'cash',
          status: order.paymentStatus,
          paidAt: order.paidAt ? new Date(order.paidAt) : undefined
        },
        timestamps: {
          orderedAt: new Date(order.createdAt),
          confirmedAt: order.confirmedAt ? new Date(order.confirmedAt) : undefined,
          readyAt: order.readyAt ? new Date(order.readyAt) : undefined,
          deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined
        }
      }

      return receipt

    } catch (error) {
      this.logger.error('Failed to generate receipt', error instanceof Error ? error : undefined, { orderId })
      throw error
    }
  }

  async exportOrders(filters: OrderQueryFilters, format: 'csv' | 'excel' | 'pdf'): Promise<Buffer> {
    try {
      // This would require implementing export logic
      // For now, return empty buffer
      return Buffer.from('')
    } catch (error) {
      this.logger.error('Failed to export orders', error instanceof Error ? error : undefined, { filters, format })
      throw error
    }
  }

  // Permissions
  async checkOrderPermissions(userId: number, userRole: UserRole, _orderId?: number): Promise<OrderPermissions> {
    try {
      const isAdmin = userRole === 0

      return {
        canView: true, // All authenticated users can view orders
        canCreate: true,
        canUpdate: isAdmin || userRole === 1, // Admin or owner
        canCancel: isAdmin || userRole === 1,
        canUpdateStatus: isAdmin || [1, 2, 3, 4].includes(userRole), // All staff
        canUpdatePayment: isAdmin || userRole === 1 || userRole === 4, // Admin, owner, cashier
        canViewAllRestaurants: isAdmin,
        canManageItems: isAdmin || userRole === 1,
        canViewAnalytics: isAdmin || userRole === 1,
        allowedStatusTransitions: this.getAllowedStatusTransitions(userRole)
      }

    } catch (error) {
      this.logger.error('Failed to check order permissions', error instanceof Error ? error : undefined, { userId, userRole })
      throw error
    }
  }

  // Real-time Updates
  /**
   * 廣播新訂單事件
   */
  private async broadcastNewOrder(order: Order): Promise<void> {
    try {
      const realtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: this.realtimeBroadcastService.generateEventId(),
        timestamp: Date.now(),
        restaurantId: String(order.restaurantId),
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber || `#${order.id}`,
          tableId: order.tableId ? String(order.tableId) : undefined,
          tableName: undefined,  // 可以從資料庫查詢
          seatId: undefined,
          items: (order.items || []).map(item => ({
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            menuItemName: item.menuItem?.name || '',
            quantity: item.quantity,
            price: item.unitPrice,
            notes: item.notes
          })),
          totalAmount: order.totalAmount,
          notes: order.notes,
          customer: order.customerInfo ? {
            name: order.customerInfo.name,
            phone: order.customerInfo.phone
          } : undefined
        }
      }

      const result = await this.realtimeBroadcastService.broadcastNewOrder(realtimeEvent as any)

      if (result.success) {
        this.logger.info('New order broadcasted successfully', {
          orderId: order.id,
          eventId: result.eventId,
          recipientCount: result.recipientCount
        })
      }
    } catch (error) {
      this.logger.error('Failed to broadcast new order', error instanceof Error ? error : undefined, {
        orderId: order.id
      })
    }
  }

  /**
   * 廣播訂單狀態更新事件
   */
  async broadcastOrderUpdate(event: OrderUpdateEvent): Promise<void> {
    try {
      // 獲取訂單詳情以構建完整的即時事件
      const order = await this.getOrder(event.orderId)
      if (!order) {
        this.logger.warn('Order not found for broadcast', { orderId: event.orderId })
        return
      }

      // 構建即時事件
      const realtimeEvent: OrderStatusUpdateEvent = {
        type: RealtimeEventType.ORDER_STATUS_UPDATE,
        eventId: this.realtimeBroadcastService.generateEventId(),
        timestamp: Date.now(),
        restaurantId: String(order.restaurantId),
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber || `#${order.id}`,
          status: event.newStatus as any,
          previousStatus: event.previousStatus as any,
          estimatedTime: event.estimatedReadyTime ? Math.floor((new Date(event.estimatedReadyTime).getTime() - Date.now()) / 60000) : undefined,
          message: event.notes,
          updatedBy: event.updatedBy ? {
            userId: event.updatedBy,
            userName: 'System',  // 可以從資料庫查詢真實姓名
            role: 'admin'
          } : undefined
        }
      }

      // 廣播事件
      const result = await this.realtimeBroadcastService.broadcastOrderStatusUpdate(realtimeEvent)

      if (result.success) {
        this.logger.info('Order update broadcasted successfully', {
          orderId: event.orderId,
          eventId: result.eventId,
          recipientCount: result.recipientCount
        })
      } else {
        this.logger.error('Failed to broadcast order update', new Error(result.error), {
          orderId: event.orderId
        })
      }

    } catch (error) {
      this.logger.error('Failed to broadcast order update', error instanceof Error ? error : undefined, { event })
    }
  }

  async subscribeToOrderUpdates(restaurantId: number, roles: UserRole[]): Promise<void> {
    try {
      // Implementation would depend on real-time service
      this.logger.info('Subscribing to order updates', { restaurantId, roles })
    } catch (error) {
      this.logger.error('Failed to subscribe to order updates', error instanceof Error ? error : undefined, { restaurantId, roles })
    }
  }

  // Private helper methods
  private async validateBusinessHours(_restaurantId: number, _scheduledTime?: Date): Promise<void> {
    // Implementation would check restaurant business hours
  }

  private async validateMenuItems(_items: any[]): Promise<void> {
    // Implementation would validate menu item availability
  }

  private async cacheOrder(order: Order): Promise<void> {
    await this.cacheKV.set(`order:${order.id}:full`, order, 300)
    await this.cacheKV.set(`order:${order.id}:basic`, order, 300)
  }

  private async invalidateOrderCache(orderId: number): Promise<void> {
    await this.cacheKV.delete(`order:${orderId}:full`)
    await this.cacheKV.delete(`order:${orderId}:basic`)
  }

  private async logOrderActivity(orderId: number, action: string, userId?: number, metadata?: any): Promise<void> {
    // Implementation would log to audit system
    this.logger.info('Order activity logged', { orderId, action, userId, metadata })
  }

  private async applyPermissionFilters(
    filters: OrderQueryFilters,
    userId?: number,
    userRole?: UserRole
  ): Promise<OrderQueryFilters> {
    // Apply role-based filtering
    if (userRole !== 0 && userRole !== undefined) { // Not admin
      // Non-admin users can only see orders from their restaurant
      // This would require looking up user's restaurant
    }
    return filters
  }

  private convertToBaseFilters(filters: OrderQueryFilters): any {
    // Convert feature filters to base service format
    return {
      restaurantId: filters.restaurantId,
      status: filters.status, // Pass status as-is (can be array or single value)
      tableId: filters.tableId,
      dateRange: filters.dateFrom && filters.dateTo ?
        [new Date(filters.dateFrom), new Date(filters.dateTo)] : undefined
    }
  }

  private sortOrders(orders: Order[], sortBy: string, sortOrder?: string): Order[] {
    return orders.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt)
          bValue = new Date(b.createdAt)
          break
        case 'totalAmount':
          aValue = a.totalAmount
          bValue = b.totalAmount
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        default:
          return 0
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }

  private async validateUpdatePermissions(_order: Order, _userId?: number): Promise<void> {
    // Implement permission validation
  }

  /**
   * 將狀態值標準化為小寫字符串
   */
  private normalizeStatus(status: any): string {
    // 如果是數字，轉換為對應的字符串
    const statusMap: Record<number, string> = {
      0: 'pending',
      1: 'confirmed',
      2: 'preparing',
      3: 'ready',
      4: 'delivered',
      5: 'paid',
      6: 'cancelled'
    }

    if (typeof status === 'number') {
      return statusMap[status] || String(status)
    }

    return String(status).toLowerCase()
  }

  private validateStatusTransition(currentStatus: any, newStatus: any, userRole?: UserRole): void {
    // 標準化狀態值
    const normalizedCurrent = this.normalizeStatus(currentStatus)
    const normalizedNew = this.normalizeStatus(newStatus)

    const transitions: Record<string, string[]> = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['delivered', 'cancelled'],
      'delivered': ['paid'],
      'paid': [],
      'cancelled': []
    }

    if (!transitions[normalizedCurrent]?.includes(normalizedNew)) {
      throw new Error(`Invalid status transition from ${normalizedCurrent} to ${normalizedNew}`)
    }

    // Check role permissions
    const rolePermissions: Record<number, string[]> = {
      0: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'paid', 'cancelled'], // Admin
      1: ['confirmed', 'cancelled'], // Owner
      2: ['preparing', 'ready'], // Chef
      3: ['delivered'], // Service
      4: ['confirmed'] // Cashier
    }

    if (userRole !== undefined && !rolePermissions[userRole]?.includes(normalizedNew)) {
      throw new Error(`Insufficient permissions for status transition to ${normalizedNew}`)
    }
  }

  private async handleStatusSideEffects(
    _order: Order,
    _statusData: OrderStatusUpdateData,
    _userId?: number
  ): Promise<void> {
    // Handle notifications, inventory updates, etc.
  }

  private getAllowedStatusTransitions(userRole: UserRole): OrderStatus[] {
    const roleTransitions: Record<number, OrderStatus[]> = {
      0: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.DELIVERED, OrderStatus.PAID, OrderStatus.CANCELLED], // Admin
      1: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED], // Owner
      2: [OrderStatus.PREPARING, OrderStatus.READY], // Chef
      3: [OrderStatus.DELIVERED], // Service
      4: [OrderStatus.CONFIRMED] // Cashier
    }

    return roleTransitions[userRole] || []
  }

  private formatCustomizations(customizations: any): string[] {
    if (!customizations) return []

    const formatted: string[] = []

    if (customizations.size) {
      formatted.push(`Size: ${customizations.size.name}`)
    }

    if (customizations.options) {
      customizations.options.forEach((option: any) => {
        formatted.push(`${option.optionName}: ${option.choiceName}`)
      })
    }

    if (customizations.addOns) {
      customizations.addOns.forEach((addOn: any) => {
        formatted.push(`${addOn.name} x${addOn.quantity}`)
      })
    }

    return formatted
  }
}