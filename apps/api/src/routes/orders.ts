import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole, requireRestaurantAccess } from '../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/validation'
import { createDatabase, OrderService } from '@makanmakan/database'
import type { Env } from '../types/env'

// SSE 廣播輔助函數
async function broadcastOrderUpdate(env: Env, orderId: number, orderData: any, restaurantId: number, targetRoles?: number[]) {
  try {
    // 調用 SSE 廣播端點
    const response = await fetch(`${(env as any).API_BASE_URL || 'http://localhost:8787'}/api/v1/sse/broadcast/order-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(env as any).INTERNAL_API_TOKEN || 'internal'}`
      },
      body: JSON.stringify({
        orderId,
        orderData,
        restaurantId,
        targetRoles
      })
    })
    
    if (!response.ok) {
      throw new Error(`SSE broadcast failed: ${response.status}`)
    }
    
    console.log(`Order update broadcasted successfully for order ${orderId}`)
  } catch (error) {
    console.error('Failed to broadcast order update via SSE:', error)
    // 不拋出錯誤，因為這是非關鍵功能
  }
}

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const createOrderSchema = z.object({
  restaurantId: z.number().int().positive(),
  tableId: z.number().int().positive().optional(),
  customerName: z.string().min(1).max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().optional(),
  items: z.array(z.object({
    menuItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    customizations: z.any().optional(),
    notes: z.string().max(200).optional()
  })).min(1),
  notes: z.string().max(500).optional(),
  orderType: z.enum(['dine_in', 'takeaway', 'delivery']).default('dine_in'),
  scheduledTime: z.string().datetime().optional()
})

const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']),
  notes: z.string().max(500).optional(),
  estimatedReadyTime: z.string().datetime().optional()
})

const orderFilterSchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']).optional(),
  orderType: z.enum(['dine_in', 'takeaway', 'delivery']).optional(),
  tableId: z.string().regex(/^\d+$/).transform(Number).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  customerName: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
})


/**
 * 創建新訂單 (公開 API - 客戶下單)
 * POST /api/v1/orders
 */
app.post('/', 
  validateBody(createOrderSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const db = createDatabase(c.env.DB)
      const orderService = new OrderService(c.env.DB as any)
      
      // 轉換資料格式
      const createOrderData = {
        restaurantId: data.restaurantId,
        tableId: data.tableId,
        customerInfo: {
          name: data.customerName,
          phone: data.customerPhone,
          email: data.customerEmail
        },
        items: data.items.map((item: any) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          customizations: item.customizations,
          notes: item.notes
        })),
        notes: data.notes
      }
      
      // 使用 OrderService 創建訂單
      const order = await orderService.createOrder(createOrderData)
      
      // 廣播新訂單給廚房和管理人員
      c.executionCtx?.waitUntil(
        broadcastOrderUpdate(
          c.env, 
          order.id, 
          order, 
          data.restaurantId, 
          [0, 1, 2] // 通知管理員、店主、廚師
        )
      )
      
      return c.json({
        success: true,
        data: order
      }, 201)
      
    } catch (error) {
      console.error('Create order error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create order'
      }, 500)
    }
  }
)

/**
 * 獲取訂單列表
 * GET /api/v1/orders
 */
app.get('/',
  authMiddleware,
  requireRole([0, 1, 2, 3, 4]), // 所有員工角色都可以查看
  validateQuery(orderFilterSchema as any),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      const orderService = new OrderService(c.env.DB as any)
      
      // 轉換過濾條件
      const filters: any = {}
      
      // 角色權限過濾
      if (user.role !== 0) { // 非管理員只能查看自己餐廳的訂單
        filters.restaurantId = user.restaurantId
      } else if (query.restaurantId) {
        filters.restaurantId = query.restaurantId
      }
      
      if (query.status) {
        filters.status = query.status
      }
      
      if (query.tableId) {
        filters.tableId = query.tableId
      }
      
      if (query.dateFrom || query.dateTo) {
        const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(0)
        const dateTo = query.dateTo ? new Date(query.dateTo) : new Date()
        filters.dateRange = [dateFrom, dateTo]
      }
      
      // 獲取訂單列表
      const result = await orderService.getOrders(filters, query.page, query.limit)
      
      return c.json({
        success: true,
        data: result.orders,
        pagination: result.pagination
      })
      
    } catch (error) {
      console.error('Get orders error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch orders'
      }, 500)
    }
  }
)

/**
 * 獲取單一訂單詳情
 * GET /api/v1/orders/:id
 */
app.get('/:id',
  authMiddleware,
  requireRole([0, 1, 2, 3, 4]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      const orderService = new OrderService(c.env.DB as any)
      
      // 獲取訂單詳情
      const order = await orderService.getOrder(parseInt(id))
      
      if (!order) {
        return c.json({
          success: false,
          error: 'Order not found'
        }, 404)
      }
      
      // 權限檢查
      if (user.role !== 0 && user.restaurantId !== order.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      return c.json({
        success: true,
        data: order
      })
      
    } catch (error) {
      console.error('Get order error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch order'
      }, 500)
    }
  }
)

/**
 * 更新訂單狀態
 * PUT /api/v1/orders/:id/status
 */
app.put('/:id/status',
  authMiddleware,
  requireRole([0, 1, 2, 3, 4]),
  validateParams(commonSchemas.idParam as any),
  validateBody(updateOrderStatusSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const orderService = new OrderService(c.env.DB as any)
      
      // 獲取現有訂單
      const existingOrder = await orderService.getOrder(parseInt(id))
      
      if (!existingOrder) {
        return c.json({
          success: false,
          error: 'Order not found'
        }, 404)
      }
      
      // 權限檢查
      if (user.role !== 0 && user.restaurantId !== existingOrder.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 角色權限檢查 - 不同角色只能執行特定狀態變更
      const statusTransitions: Record<number, string[]> = {
        0: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'], // 管理員可以設置任何狀態
        1: ['confirmed', 'cancelled'], // 店主可以確認或取消訂單
        2: ['preparing', 'ready'], // 廚師可以設置準備中或準備完成
        3: ['completed'], // 服務員可以設置完成
        4: ['confirmed'] // 收銀可以確認訂單
      }
      
      if (!statusTransitions[user.role]?.includes(data.status)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions for this status change'
        }, 403)
      }
      
      // 使用 OrderService 更新狀態
      const updatedOrder = await orderService.updateOrderStatus(parseInt(id), {
        status: data.status,
        notes: data.notes
      })
      
      // 根據訂單狀態確定目標角色
      let targetRoles: number[] = []
      switch (data.status) {
        case 'confirmed':
          targetRoles = [0, 1, 2] // 管理員、店主、廚師
          break
        case 'preparing':
          targetRoles = [0, 1, 3] // 管理員、店主、服務員
          break
        case 'ready':
          targetRoles = [0, 1, 3] // 管理員、店主、服務員
          break
        case 'completed':
          targetRoles = [0, 1] // 管理員、店主
          break
        case 'cancelled':
          targetRoles = [0, 1, 2, 3] // 所有相關人員
          break
        default:
          targetRoles = [0, 1] // 預設通知管理員和店主
      }
      
      // 異步廣播更新，不阻塞主要回應
      c.executionCtx?.waitUntil(
        broadcastOrderUpdate(c.env, parseInt(id), updatedOrder, existingOrder.restaurantId, targetRoles)
      )
      
      return c.json({
        success: true,
        data: updatedOrder
      })
      
    } catch (error) {
      console.error('Update order status error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update order status'
      }, 500)
    }
  }
)

/**
 * 取消訂單
 * DELETE /api/v1/orders/:id
 */
app.delete('/:id',
  authMiddleware,
  requireRole([0, 1]), // 只有管理員和店主可以取消訂單
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      const orderService = new OrderService(c.env.DB as any)
      
      // 獲取訂單資訊
      const order = await orderService.getOrder(parseInt(id))
      
      if (!order) {
        return c.json({
          success: false,
          error: 'Order not found'
        }, 404)
      }
      
      // 權限檢查
      if (user.role !== 0 && user.restaurantId !== order.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 使用 OrderService 取消訂單
      const cancelledOrder = await orderService.cancelOrder(parseInt(id), 'Cancelled by user')
      
      // 廣播訂單取消通知
      c.executionCtx?.waitUntil(
        broadcastOrderUpdate(
          c.env, 
          parseInt(id), 
          cancelledOrder, 
          order.restaurantId, 
          [0, 1, 2, 3] // 通知所有相關人員
        )
      )
      
      return c.json({
        success: true,
        message: 'Order cancelled successfully'
      })
      
    } catch (error) {
      console.error('Cancel order error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel order'
      }, 500)
    }
  }
)

/**
 * 獲取訂單統計
 * GET /api/v1/orders/stats
 */
app.get('/stats',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional()
  }) as any),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      const orderService = new OrderService(c.env.DB as any)
      
      // 確定餐廳 ID
      let restaurantId: number | undefined
      if (user.role === 1) { // 店主只能查看自己餐廳
        restaurantId = user.restaurantId
      } else if (query.restaurantId) {
        restaurantId = query.restaurantId
      }
      
      if (!restaurantId) {
        return c.json({
          success: false,
          error: 'Restaurant ID is required'
        }, 400)
      }
      
      // 設定日期範圍
      const dateFrom = query.dateFrom ? new Date(query.dateFrom) : new Date(new Date().setDate(new Date().getDate() - 30))
      const dateTo = query.dateTo ? new Date(query.dateTo) : new Date()
      
      // 獲取統計資料
      const dailyStats = await orderService.getDailyOrderStats(restaurantId, new Date())
      
      return c.json({
        success: true,
        data: {
          summary: dailyStats,
          daily: [], // TODO: 實現每日統計
          byType: [] // TODO: 實現類型統計
        }
      })
      
    } catch (error) {
      console.error('Get order stats error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch order statistics'
      }, 500)
    }
  }
)

export default app