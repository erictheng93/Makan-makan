import { eq, and, desc, asc, count, sql, gte, lte, inArray } from 'drizzle-orm'
import { BaseService } from './base'
import { orders, orderItems, menuItems, restaurants, tables, users, ORDER_STATUS } from '../schema'
import type { Order, OrderItem, SelectedCustomizations } from '@makanmakan/shared-types'

export interface CreateOrderData {
  restaurantId: number
  tableId: number
  customerId?: number
  customerInfo?: any
  items: Array<{
    menuItemId: number
    quantity: number
    customizations?: SelectedCustomizations
    notes?: string
  }>
  notes?: string
  couponCode?: string
}

export interface UpdateOrderStatusData {
  status: string
  notes?: string
}

export interface OrderFilters {
  restaurantId?: number
  tableId?: number
  customerId?: number
  status?: string
  dateRange?: [Date, Date]
  minAmount?: number
  maxAmount?: number
}

export class OrderService extends BaseService {
  
  // 創建訂單
  async createOrder(data: CreateOrderData): Promise<Order> {
    try {
      // 驗證餐廳和桌子
      const restaurant = await this.db.query.restaurants.findFirst({
        where: eq(restaurants.id, data.restaurantId)
      })
      
      if (!restaurant || !restaurant.isAvailable) {
        throw new Error('Restaurant is not available')
      }

      const table = await this.db.query.tables.findFirst({
        where: eq(tables.id, data.tableId)
      })
      
      if (!table || !table.isActive) {
        throw new Error('Table is not available')
      }

      // 計算訂單總金額
      let subtotal = 0
      const orderItemsData = []

      for (const item of data.items) {
        const menuItem = await this.db.query.menuItems.findFirst({
          where: eq(menuItems.id, item.menuItemId)
        })

        if (!menuItem || !menuItem.isAvailable) {
          throw new Error(`Menu item ${item.menuItemId} is not available`)
        }

        // 檢查庫存
        if (menuItem.inventoryCount !== null && menuItem.inventoryCount < item.quantity) {
          throw new Error(`Insufficient inventory for ${menuItem.name}`)
        }

        // 計算單價（含客製化選項）
        let unitPrice = menuItem.price
        
        if (item.customizations?.size?.priceAdjustment) {
          unitPrice += item.customizations.size.priceAdjustment
        }
        
        if (item.customizations?.options) {
          for (const option of item.customizations.options) {
            unitPrice += option.priceAdjustment || 0
          }
        }
        
        if (item.customizations?.addOns) {
          for (const addOn of item.customizations.addOns) {
            unitPrice += addOn.unitPrice * (addOn.quantity || 1)
          }
        }

        const totalPrice = unitPrice * item.quantity
        subtotal += totalPrice

        orderItemsData.push({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          customizations: item.customizations,
          notes: item.notes,
          itemSnapshot: {
            name: menuItem.name,
            description: menuItem.description || undefined,
            imageUrl: menuItem.imageUrl || undefined,
            category: 'category' // 需要從關聯獲取
          }
        })
      }

      // 計算稅金和服務費
      const settings = restaurant.settings || {}
      const taxRate = settings.taxRate || 0
      const serviceChargeRate = settings.serviceChargeRate || 0
      const { taxAmount, serviceCharge, totalAmount } = this.calculateOrderTotal(
        subtotal,
        taxRate,
        serviceChargeRate
      )

      // 生成訂單號碼
      const orderNumber = this.generateOrderNumber(data.restaurantId)

      // 創建訂單
      const [order] = await this.db
        .insert(orders)
        .values({
          restaurantId: data.restaurantId,
          tableId: data.tableId,
          customerId: data.customerId,
          orderNumber,
          subtotal,
          taxAmount,
          serviceCharge,
          totalAmount,
          customerInfo: data.customerInfo,
          notes: data.notes,
          estimatedPrepTime: this.calculateEstimatedPrepTime(orderItemsData)
        })
        .returning()

      // 創建訂單項目
      const items = await this.db
        .insert(orderItems)
        .values(
          orderItemsData.map(item => ({
            ...item,
            orderId: order.id
          }))
        )
        .returning()

      // 更新菜品訂購次數和庫存
      for (let i = 0; i < data.items.length; i++) {
        const { menuItemId, quantity } = data.items[i]
        
        // 增加訂購次數
        await this.db
          .update(menuItems)
          .set({
            orderCount: sql`${menuItems.orderCount} + ${quantity}`,
            inventoryCount: menuItems.inventoryCount 
              ? sql`${menuItems.inventoryCount} - ${quantity}`
              : null
          })
          .where(eq(menuItems.id, menuItemId))
      }

      // 更新餐廳總訂單數
      await this.db
        .update(restaurants)
        .set({
          totalOrders: sql`${restaurants.totalOrders} + 1`
        })
        .where(eq(restaurants.id, data.restaurantId))

      return this.mapToOrder({ ...order, items })
    } catch (error) {
      this.handleError(error, 'createOrder')
    }
  }

  // 獲取訂單詳情
  async getOrder(id: number): Promise<Order | null> {
    try {
      const order = await this.db.query.orders.findFirst({
        where: eq(orders.id, id),
        with: {
          restaurant: {
            columns: {
              id: true,
              name: true,
              phone: true
            }
          },
          table: {
            columns: {
              id: true,
              number: true
            }
          },
          customer: {
            columns: {
              id: true,
              fullName: true,
              phone: true
            }
          },
          items: {
            with: {
              menuItem: {
                columns: {
                  id: true,
                  name: true,
                  imageUrl: true
                }
              }
            }
          }
        }
      })

      return order ? this.mapToOrder(order) : null
    } catch (error) {
      this.handleError(error, 'getOrder')
    }
  }

  // 根據訂單號獲取訂單
  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    try {
      const order = await this.db.query.orders.findFirst({
        where: eq(orders.orderNumber, orderNumber),
        with: {
          restaurant: true,
          table: true,
          customer: true,
          items: {
            with: {
              menuItem: true
            }
          }
        }
      })

      return order ? this.mapToOrder(order) : null
    } catch (error) {
      this.handleError(error, 'getOrderByNumber')
    }
  }

  // 獲取訂單列表
  async getOrders(
    filters: OrderFilters = {},
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const { offset } = this.createPagination(page, limit)
      const conditions = []

      if (filters.restaurantId) {
        conditions.push(eq(orders.restaurantId, filters.restaurantId))
      }

      if (filters.tableId) {
        conditions.push(eq(orders.tableId, filters.tableId))
      }

      if (filters.customerId) {
        conditions.push(eq(orders.customerId, filters.customerId))
      }

      if (filters.status) {
        conditions.push(eq(orders.status, filters.status))
      }

      if (filters.dateRange) {
        const [startDate, endDate] = filters.dateRange
        conditions.push(
          and(
            gte(orders.createdAt, startDate),
            lte(orders.createdAt, endDate)
          )
        )
      }

      if (filters.minAmount) {
        conditions.push(gte(orders.totalAmount, filters.minAmount))
      }

      if (filters.maxAmount) {
        conditions.push(lte(orders.totalAmount, filters.maxAmount))
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const orderList = await this.db.query.orders.findMany({
        where: whereClause,
        with: {
          restaurant: {
            columns: { id: true, name: true }
          },
          table: {
            columns: { id: true, number: true }
          },
          items: {
            with: {
              menuItem: {
                columns: { id: true, name: true, imageUrl: true }
              }
            }
          }
        },
        orderBy: desc(orders.createdAt),
        limit,
        offset
      })

      const [{ totalCount }] = await this.db
        .select({ totalCount: count() })
        .from(orders)
        .where(whereClause)

      return {
        orders: orderList.map(order => this.mapToOrder(order)),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    } catch (error) {
      this.handleError(error, 'getOrders')
    }
  }

  // 更新訂單狀態
  async updateOrderStatus(id: number, data: UpdateOrderStatusData): Promise<Order> {
    try {
      const statusField = `${data.status}At` as keyof typeof orders
      const updateData: any = {
        status: data.status,
        updatedAt: new Date()
      }

      // 設置狀態時間戳
      if (['confirmed', 'preparing', 'ready', 'delivered', 'paid', 'cancelled'].includes(data.status)) {
        updateData[statusField] = new Date()
      }

      // 添加備註
      if (data.notes) {
        updateData.internalNotes = data.notes
      }

      const [order] = await this.db
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, id))
        .returning()

      if (!order) {
        throw new Error('Order not found')
      }

      // 如果訂單完成，釋放桌子
      if (data.status === ORDER_STATUS.PAID || data.status === ORDER_STATUS.DELIVERED) {
        await this.db
          .update(tables)
          .set({
            isOccupied: false,
            currentOrderId: null,
            occupiedAt: null,
            occupiedBy: null
          })
          .where(eq(tables.id, order.tableId))
      }

      return this.mapToOrder(order)
    } catch (error) {
      this.handleError(error, 'updateOrderStatus')
    }
  }

  // 取消訂單
  async cancelOrder(id: number, reason?: string): Promise<Order> {
    try {
      const order = await this.getOrder(id)
      if (!order) {
        throw new Error('Order not found')
      }

      if (![ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED].includes(order.status as any)) {
        throw new Error('Order cannot be cancelled')
      }

      // 恢復庫存
      for (const item of order.items || []) {
        await this.db
          .update(menuItems)
          .set({
            inventoryCount: menuItems.inventoryCount 
              ? sql`${menuItems.inventoryCount} + ${item.quantity}`
              : null
          })
          .where(eq(menuItems.id, item.menuItemId))
      }

      return await this.updateOrderStatus(id, {
        status: ORDER_STATUS.CANCELLED,
        notes: reason
      })
    } catch (error) {
      this.handleError(error, 'cancelOrder')
    }
  }

  // 獲取餐廳當日訂單統計
  async getDailyOrderStats(restaurantId: number, date: Date = new Date()) {
    try {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      const stats = await this.db
        .select({
          totalOrders: count(),
          totalRevenue: sql<number>`SUM(${orders.totalAmount})`,
          avgOrderValue: sql<number>`AVG(${orders.totalAmount})`,
          pendingOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'pending' THEN 1 ELSE 0 END)`,
          confirmedOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'confirmed' THEN 1 ELSE 0 END)`,
          completedOrders: sql<number>`SUM(CASE WHEN ${orders.status} IN ('delivered', 'paid') THEN 1 ELSE 0 END)`,
          cancelledOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'cancelled' THEN 1 ELSE 0 END)`
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, startOfDay),
            lte(orders.createdAt, endOfDay)
          )
        )

      return stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0
      }
    } catch (error) {
      this.handleError(error, 'getDailyOrderStats')
    }
  }

  // 計算預估準備時間
  private calculateEstimatedPrepTime(orderItems: any[]): number {
    let maxPrepTime = 0
    let totalComplexity = 0

    for (const item of orderItems) {
      // 基礎準備時間（預設 15 分鐘）
      const basePrepTime = 15
      
      // 根據客製化增加時間
      let itemComplexity = 1
      if (item.customizations?.options?.length > 0) {
        itemComplexity += item.customizations.options.length * 0.2
      }
      if (item.customizations?.addOns?.length > 0) {
        itemComplexity += item.customizations.addOns.length * 0.1
      }

      const itemPrepTime = basePrepTime * itemComplexity * item.quantity
      maxPrepTime = Math.max(maxPrepTime, itemPrepTime)
      totalComplexity += itemComplexity
    }

    // 綜合計算：取最長時間和平均複雜度的平衡
    return Math.ceil(Math.max(maxPrepTime, totalComplexity * 10))
  }

  // 資料轉換
  private mapToOrder(order: any): Order {
    return {
      id: order.id,
      restaurantId: order.restaurantId,
      tableId: order.tableId,
      customerId: order.customerId,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      serviceCharge: order.serviceCharge,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      customerInfo: order.customerInfo,
      estimatedPrepTime: order.estimatedPrepTime,
      actualPrepTime: order.actualPrepTime,
      confirmedAt: order.confirmedAt,
      preparingAt: order.preparingAt,
      readyAt: order.readyAt,
      deliveredAt: order.deliveredAt,
      paidAt: order.paidAt,
      cancelledAt: order.cancelledAt,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      rating: order.rating,
      reviewComment: order.reviewComment,
      notes: order.notes,
      internalNotes: order.internalNotes,
      items: order.items?.map((item: any) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        customizations: item.customizations,
        notes: item.notes,
        status: item.status,
        menuItem: item.menuItem
      })) || [],
      restaurant: order.restaurant,
      table: order.table,
      customer: order.customer,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }
  }
}