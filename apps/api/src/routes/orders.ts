import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole, requireRestaurantAccess } from '../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/validation'
import type { Env } from '../types/env'

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

// Helper function to calculate order totals
function calculateOrderTotals(items: any[]) {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const tax = subtotal * 0.06 // 6% tax
  const total = subtotal + tax
  
  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number(total.toFixed(2))
  }
}

/**
 * 創建新訂單 (公開 API - 客戶下單)
 * POST /api/v1/orders
 */
app.post('/', 
  validateBody(createOrderSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      
      // 計算訂單總金額
      const totals = calculateOrderTotals(data.items)
      const orderNumber = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
      
      // 插入訂單
      const orderResult = await c.env.DB.prepare(`
        INSERT INTO orders (
          restaurant_id, table_id, order_number, customer_name, customer_phone, customer_email,
          order_type, status, subtotal, tax, total, notes, scheduled_time, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        data.restaurantId,
        data.tableId || null,
        orderNumber,
        data.customerName || null,
        data.customerPhone || null,
        data.customerEmail || null,
        data.orderType,
        totals.subtotal,
        totals.tax,
        totals.total,
        data.notes || null,
        data.scheduledTime || null
      ).run()
      
      const orderId = orderResult.meta.last_row_id as number
      
      // 插入訂單項目
      for (const item of data.items) {
        await c.env.DB.prepare(`
          INSERT INTO order_items (
            order_id, menu_item_id, quantity, unit_price, subtotal,
            customizations, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          orderId,
          item.menuItemId,
          item.quantity,
          item.price,
          item.price * item.quantity,
          item.customizations ? JSON.stringify(item.customizations) : null,
          item.notes || null
        ).run()
      }
      
      // 獲取完整訂單資料返回
      const order = await c.env.DB.prepare(`
        SELECT 
          o.*,
          r.name as restaurant_name,
          t.name as table_name
        FROM orders o
        LEFT JOIN restaurants r ON o.restaurant_id = r.id
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE o.id = ?
      `).bind(orderId).first()
      
      const orderItems = await c.env.DB.prepare(`
        SELECT 
          oi.*,
          mi.name as menu_item_name,
          mi.image_url as menu_item_image
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
      `).bind(orderId).all()
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        null, // 客戶下單，沒有用戶ID
        'create_order',
        'orders',
        JSON.stringify({ orderId, orderNumber, restaurantId: data.restaurantId })
      ).run()
      
      const response = {
        ...order,
        items: orderItems.results || []
      }
      
      return c.json({
        success: true,
        data: response
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
  validateQuery(orderFilterSchema),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let whereConditions = ['1=1']
      let params: any[] = []
      
      // 角色權限過濾
      if (user.role !== 0) { // 非管理員只能查看自己餐廳的訂單
        whereConditions.push('o.restaurant_id = ?')
        params.push(user.restaurantId)
      }
      
      // 其他過濾條件
      if (query.restaurantId) {
        whereConditions.push('o.restaurant_id = ?')
        params.push(query.restaurantId)
      }
      
      if (query.status) {
        whereConditions.push('o.status = ?')
        params.push(query.status)
      }
      
      if (query.orderType) {
        whereConditions.push('o.order_type = ?')
        params.push(query.orderType)
      }
      
      if (query.tableId) {
        whereConditions.push('o.table_id = ?')
        params.push(query.tableId)
      }
      
      if (query.customerName) {
        whereConditions.push('o.customer_name LIKE ?')
        params.push(`%${query.customerName}%`)
      }
      
      if (query.dateFrom) {
        whereConditions.push('o.created_at >= ?')
        params.push(query.dateFrom)
      }
      
      if (query.dateTo) {
        whereConditions.push('o.created_at <= ?')
        params.push(query.dateTo)
      }
      
      // 獲取總數
      const countQuery = `
        SELECT COUNT(*) as total
        FROM orders o
        WHERE ${whereConditions.join(' AND ')}
      `
      const countResult = await c.env.DB.prepare(countQuery).bind(...params).first()
      const total = countResult?.total || 0
      
      // 分頁計算
      const offset = (query.page - 1) * query.limit
      
      // 獲取訂單列表
      const ordersQuery = `
        SELECT 
          o.*,
          r.name as restaurant_name,
          t.name as table_name,
          COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN restaurants r ON o.restaurant_id = r.id
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `
      
      const ordersResult = await c.env.DB.prepare(ordersQuery)
        .bind(...params, query.limit, offset).all()
      
      const pagination = {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit)
      }
      
      return c.json({
        success: true,
        data: ordersResult.results || [],
        pagination
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
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      
      // 獲取訂單基本資訊
      const order = await c.env.DB.prepare(`
        SELECT 
          o.*,
          r.name as restaurant_name,
          t.name as table_name,
          t.qr_code as table_qr_code
        FROM orders o
        LEFT JOIN restaurants r ON o.restaurant_id = r.id
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE o.id = ?
      `).bind(id).first()
      
      if (!order) {
        return c.json({
          success: false,
          error: 'Order not found'
        }, 404)
      }
      
      // 權限檢查
      if (user.role !== 0 && user.restaurantId !== order.restaurant_id) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 獲取訂單項目
      const items = await c.env.DB.prepare(`
        SELECT 
          oi.*,
          mi.name as menu_item_name,
          mi.description as menu_item_description,
          mi.image_url as menu_item_image,
          c.name as category_name
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        LEFT JOIN categories c ON mi.category_id = c.id
        WHERE oi.order_id = ?
        ORDER BY oi.id
      `).bind(id).all()
      
      const response = {
        ...order,
        items: items.results || []
      }
      
      return c.json({
        success: true,
        data: response
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
  validateParams(commonSchemas.idParam),
  validateBody(updateOrderStatusSchema),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      
      // 獲取現有訂單
      const existingOrder = await c.env.DB.prepare(`
        SELECT * FROM orders WHERE id = ?
      `).bind(id).first()
      
      if (!existingOrder) {
        return c.json({
          success: false,
          error: 'Order not found'
        }, 404)
      }
      
      // 權限檢查
      if (user.role !== 0 && user.restaurantId !== existingOrder.restaurant_id) {
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
      
      // 更新訂單狀態
      const updateResult = await c.env.DB.prepare(`
        UPDATE orders 
        SET status = ?, 
            estimated_ready_time = ?,
            updated_at = datetime('now'),
            updated_by = ?
        WHERE id = ?
      `).bind(data.status, data.estimatedReadyTime || null, user.id, id).run()
      
      if (updateResult.changes === 0) {
        return c.json({
          success: false,
          error: 'Failed to update order'
        }, 500)
      }
      
      // 記錄狀態變更歷史
      await c.env.DB.prepare(`
        INSERT INTO order_status_history (
          order_id, old_status, new_status, changed_by, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).bind(id, existingOrder.status, data.status, user.id, data.notes || null).run()
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        user.id,
        'update_order_status',
        'orders',
        JSON.stringify({ 
          orderId: id, 
          oldStatus: existingOrder.status, 
          newStatus: data.status,
          estimatedReadyTime: data.estimatedReadyTime 
        })
      ).run()
      
      // TODO: 廣播狀態更新給廚房系統 (如果有實時更新需求)
      
      return c.json({
        success: true,
        data: {
          id,
          status: data.status,
          estimatedReadyTime: data.estimatedReadyTime,
          updatedAt: new Date().toISOString(),
          updatedBy: user.id
        }
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
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      
      // 獲取訂單資訊
      const order = await c.env.DB.prepare(`
        SELECT * FROM orders WHERE id = ?
      `).bind(id).first()
      
      if (!order) {
        return c.json({
          success: false,
          error: 'Order not found'
        }, 404)
      }
      
      // 權限檢查
      if (user.role !== 0 && user.restaurantId !== order.restaurant_id) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 檢查訂單是否可以取消
      if (order.status === 'completed' || order.status === 'cancelled') {
        return c.json({
          success: false,
          error: 'Cannot cancel completed or already cancelled order'
        }, 400)
      }
      
      // 更新訂單狀態為已取消
      await c.env.DB.prepare(`
        UPDATE orders 
        SET status = 'cancelled',
            updated_at = datetime('now'),
            updated_by = ?
        WHERE id = ?
      `).bind(user.id, id).run()
      
      // 記錄狀態變更歷史
      await c.env.DB.prepare(`
        INSERT INTO order_status_history (
          order_id, old_status, new_status, changed_by, notes, created_at
        ) VALUES (?, ?, 'cancelled', ?, 'Order cancelled by user', datetime('now'))
      `).bind(id, order.status, user.id).run()
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        user.id,
        'cancel_order',
        'orders',
        JSON.stringify({ orderId: id, reason: 'Cancelled by user' })
      ).run()
      
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
  })),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let whereConditions = ['1=1']
      let params: any[] = []
      
      // 權限過濾
      if (user.role === 1) { // 店主只能查看自己餐廳
        whereConditions.push('restaurant_id = ?')
        params.push(user.restaurantId)
      } else if (query.restaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(query.restaurantId)
      }
      
      // 日期過濾
      if (query.dateFrom) {
        whereConditions.push('created_at >= ?')
        params.push(query.dateFrom)
      }
      
      if (query.dateTo) {
        whereConditions.push('created_at <= ?')
        params.push(query.dateTo)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 總訂單統計
      const totalStats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
          SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as preparing_orders,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as total_revenue,
          AVG(CASE WHEN status = 'completed' THEN total ELSE NULL END) as avg_order_value
        FROM orders 
        WHERE ${whereClause}
      `).bind(...params).first()
      
      // 按日期統計
      const dailyStats = await c.env.DB.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as orders,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue
        FROM orders 
        WHERE ${whereClause}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `).bind(...params).all()
      
      // 按訂單類型統計
      const typeStats = await c.env.DB.prepare(`
        SELECT 
          order_type,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue
        FROM orders 
        WHERE ${whereClause}
        GROUP BY order_type
      `).bind(...params).all()
      
      return c.json({
        success: true,
        data: {
          summary: {
            ...totalStats,
            total_revenue: Number((totalStats?.total_revenue || 0).toFixed(2)),
            avg_order_value: Number((totalStats?.avg_order_value || 0).toFixed(2))
          },
          daily: dailyStats.results || [],
          byType: typeStats.results || []
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