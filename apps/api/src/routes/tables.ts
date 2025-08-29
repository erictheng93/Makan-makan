import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole, requireRestaurantAccess } from '../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/validation'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const createTableSchema = z.object({
  restaurantId: z.number().int().positive(),
  name: z.string().min(1).max(50),
  capacity: z.number().int().positive(),
  location: z.string().max(100).optional(),
  floor: z.string().max(20).optional().default('1F'),
  section: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
  qrCodeSize: z.enum(['small', 'medium', 'large']).default('medium'),
  customQrData: z.any().optional()
})

const updateTableSchema = createTableSchema.partial().omit({ restaurantId: true })

const generateQRBulkSchema = z.object({
  restaurantId: z.number().int().positive(),
  tables: z.array(z.object({
    id: z.number().int().positive(),
    customData: z.any().optional()
  })).min(1).max(50), // 限制一次最多50個QR碼
  format: z.enum(['png', 'svg', 'pdf']).default('png'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  includeTableInfo: z.boolean().default(true)
})

const tableFilterSchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  floor: z.string().optional(),
  section: z.string().optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  minCapacity: z.string().regex(/^\d+$/).transform(Number).optional(),
  maxCapacity: z.string().regex(/^\d+$/).transform(Number).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
})

// QR碼生成輔助函數
function generateQRCodeUrl(tableId: number, restaurantId: number, customData?: any): string {
  const baseUrl = process.env.CLIENT_BASE_URL || 'https://makanmakan.com'
  const qrData = {
    type: 'table',
    tableId,
    restaurantId,
    timestamp: new Date().toISOString(),
    ...customData
  }
  
  return `${baseUrl}/order?data=${encodeURIComponent(JSON.stringify(qrData))}`
}

function getQRCodeImageUrl(content: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
  const sizes = {
    small: '150x150',
    medium: '200x200',
    large: '300x300'
  }
  
  // 使用 QR Server API 生成QR碼圖片
  return `https://api.qrserver.com/v1/create-qr-code/?size=${sizes[size]}&data=${encodeURIComponent(content)}`
}

/**
 * 獲取餐廳桌位列表
 * GET /api/v1/tables
 */
app.get('/',
  authMiddleware,
  requireRole([0, 1, 2, 3, 4]),
  validateQuery(tableFilterSchema),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let whereConditions = ['1=1']
      let params: any[] = []
      
      // 權限過濾
      if (user.role !== 0) { // 非管理員只能查看自己餐廳的桌位
        whereConditions.push('t.restaurant_id = ?')
        params.push(user.restaurantId)
      }
      
      // 其他過濾條件
      if (query.restaurantId) {
        whereConditions.push('t.restaurant_id = ?')
        params.push(query.restaurantId)
      }
      
      if (query.floor) {
        whereConditions.push('t.floor = ?')
        params.push(query.floor)
      }
      
      if (query.section) {
        whereConditions.push('t.section = ?')
        params.push(query.section)
      }
      
      if (query.isActive !== undefined) {
        whereConditions.push('t.is_active = ?')
        params.push(query.isActive ? 1 : 0)
      }
      
      if (query.minCapacity) {
        whereConditions.push('t.capacity >= ?')
        params.push(query.minCapacity)
      }
      
      if (query.maxCapacity) {
        whereConditions.push('t.capacity <= ?')
        params.push(query.maxCapacity)
      }
      
      // 獲取總數
      const countQuery = `
        SELECT COUNT(*) as total
        FROM tables t
        WHERE ${whereConditions.join(' AND ')}
      `
      const countResult = await c.env.DB.prepare(countQuery).bind(...params).first()
      const total = countResult?.total || 0
      
      // 分頁計算
      const offset = (query.page - 1) * query.limit
      
      // 獲取桌位列表
      const tablesQuery = `
        SELECT 
          t.*,
          r.name as restaurant_name,
          COUNT(CASE WHEN o.status IN ('pending', 'confirmed', 'preparing') THEN 1 END) as active_orders
        FROM tables t
        LEFT JOIN restaurants r ON t.restaurant_id = r.id
        LEFT JOIN orders o ON t.id = o.table_id 
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY t.id
        ORDER BY t.floor, t.section, t.name
        LIMIT ? OFFSET ?
      `
      
      const tablesResult = await c.env.DB.prepare(tablesQuery)
        .bind(...params, query.limit, offset).all()
      
      // 為每個桌位生成QR碼URL
      const tables = (tablesResult.results || []).map((table: any) => ({
        ...table,
        qr_code_url: table.qr_code || generateQRCodeUrl(table.id, table.restaurant_id),
        qr_image_url: getQRCodeImageUrl(table.qr_code || generateQRCodeUrl(table.id, table.restaurant_id), 'medium'),
        is_occupied: table.active_orders > 0
      }))
      
      const pagination = {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit)
      }
      
      return c.json({
        success: true,
        data: tables,
        pagination
      })
      
    } catch (error) {
      console.error('Get tables error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tables'
      }, 500)
    }
  }
)

/**
 * 獲取單一桌位詳情
 * GET /api/v1/tables/:id
 */
app.get('/:id',
  authMiddleware,
  requireRole([0, 1, 2, 3, 4]),
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      
      const table = await c.env.DB.prepare(`
        SELECT 
          t.*,
          r.name as restaurant_name,
          r.address as restaurant_address
        FROM tables t
        LEFT JOIN restaurants r ON t.restaurant_id = r.id
        WHERE t.id = ?
      `).bind(id).first()
      
      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }
      
      // 權限檢查
      if (user.role !== 0 && user.restaurantId !== table.restaurant_id) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 獲取最近的訂單
      const recentOrders = await c.env.DB.prepare(`
        SELECT 
          id, order_number, status, total, customer_name,
          created_at, updated_at
        FROM orders 
        WHERE table_id = ? 
        ORDER BY created_at DESC 
        LIMIT 5
      `).bind(id).all()
      
      // 生成QR碼資料
      const qrCodeUrl = table.qr_code || generateQRCodeUrl(table.id, table.restaurant_id)
      const qrImageUrl = getQRCodeImageUrl(qrCodeUrl, table.qr_code_size || 'medium')
      
      const response = {
        ...table,
        qr_code_url: qrCodeUrl,
        qr_image_url: qrImageUrl,
        recent_orders: recentOrders.results || []
      }
      
      return c.json({
        success: true,
        data: response
      })
      
    } catch (error) {
      console.error('Get table error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch table'
      }, 500)
    }
  }
)

/**
 * 創建桌位
 * POST /api/v1/tables
 */
app.post('/',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateBody(createTableSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      
      // 權限檢查
      if (user.role === 1 && user.restaurantId !== data.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 檢查同餐廳內桌位名稱是否重複
      const existingTable = await c.env.DB.prepare(`
        SELECT id FROM tables 
        WHERE restaurant_id = ? AND name = ?
      `).bind(data.restaurantId, data.name).first()
      
      if (existingTable) {
        return c.json({
          success: false,
          error: 'Table name already exists in this restaurant'
        }, 409)
      }
      
      // 生成QR碼
      const qrCodeUrl = generateQRCodeUrl(0, data.restaurantId, data.customQrData) // 0作為佔位符，稍後更新
      
      const result = await c.env.DB.prepare(`
        INSERT INTO tables (
          restaurant_id, name, capacity, location, floor, section, 
          is_active, qr_code, qr_code_size, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        data.restaurantId,
        data.name,
        data.capacity,
        data.location || null,
        data.floor,
        data.section || null,
        data.isActive ? 1 : 0,
        qrCodeUrl,
        data.qrCodeSize
      ).run()
      
      const tableId = result.meta.last_row_id as number
      
      // 更新QR碼URL包含真實的桌位ID
      const finalQrCodeUrl = generateQRCodeUrl(tableId, data.restaurantId, data.customQrData)
      await c.env.DB.prepare(`
        UPDATE tables SET qr_code = ? WHERE id = ?
      `).bind(finalQrCodeUrl, tableId).run()
      
      // 獲取創建的桌位
      const newTable = await c.env.DB.prepare(`
        SELECT t.*, r.name as restaurant_name
        FROM tables t
        LEFT JOIN restaurants r ON t.restaurant_id = r.id
        WHERE t.id = ?
      `).bind(tableId).first()
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        user.id,
        'create_table',
        'tables',
        JSON.stringify({ tableId, name: data.name, restaurantId: data.restaurantId })
      ).run()
      
      const response = {
        ...newTable,
        qr_code_url: finalQrCodeUrl,
        qr_image_url: getQRCodeImageUrl(finalQrCodeUrl, data.qrCodeSize)
      }
      
      return c.json({
        success: true,
        data: response
      }, 201)
      
    } catch (error) {
      console.error('Create table error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create table'
      }, 500)
    }
  }
)

/**
 * 更新桌位
 * PUT /api/v1/tables/:id
 */
app.put('/:id',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateParams(commonSchemas.idParam),
  validateBody(updateTableSchema),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      
      // 獲取現有桌位
      const existingTable = await c.env.DB.prepare(`
        SELECT * FROM tables WHERE id = ?
      `).bind(id).first()
      
      if (!existingTable) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }
      
      // 權限檢查
      if (user.role === 1 && user.restaurantId !== existingTable.restaurant_id) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 如果要更新名稱，檢查是否重複
      if (data.name && data.name !== existingTable.name) {
        const duplicateTable = await c.env.DB.prepare(`
          SELECT id FROM tables 
          WHERE restaurant_id = ? AND name = ? AND id != ?
        `).bind(existingTable.restaurant_id, data.name, id).first()
        
        if (duplicateTable) {
          return c.json({
            success: false,
            error: 'Table name already exists in this restaurant'
          }, 409)
        }
      }
      
      // 構建更新查詢
      const updateFields = []
      const updateParams = []
      
      if (data.name !== undefined) {
        updateFields.push('name = ?')
        updateParams.push(data.name)
      }
      
      if (data.capacity !== undefined) {
        updateFields.push('capacity = ?')
        updateParams.push(data.capacity)
      }
      
      if (data.location !== undefined) {
        updateFields.push('location = ?')
        updateParams.push(data.location)
      }
      
      if (data.floor !== undefined) {
        updateFields.push('floor = ?')
        updateParams.push(data.floor)
      }
      
      if (data.section !== undefined) {
        updateFields.push('section = ?')
        updateParams.push(data.section)
      }
      
      if (data.isActive !== undefined) {
        updateFields.push('is_active = ?')
        updateParams.push(data.isActive ? 1 : 0)
      }
      
      // 如果需要重新生成QR碼
      if (data.qrCodeSize !== undefined || data.customQrData !== undefined) {
        const newQrCodeUrl = generateQRCodeUrl(
          parseInt(id), 
          existingTable.restaurant_id, 
          data.customQrData
        )
        updateFields.push('qr_code = ?')
        updateParams.push(newQrCodeUrl)
        
        if (data.qrCodeSize) {
          updateFields.push('qr_code_size = ?')
          updateParams.push(data.qrCodeSize)
        }
      }
      
      if (updateFields.length === 0) {
        return c.json({
          success: false,
          error: 'No fields to update'
        }, 400)
      }
      
      updateFields.push('updated_at = datetime(\'now\')')
      updateParams.push(id)
      
      const updateQuery = `
        UPDATE tables 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `
      
      await c.env.DB.prepare(updateQuery).bind(...updateParams).run()
      
      // 獲取更新後的桌位
      const updatedTable = await c.env.DB.prepare(`
        SELECT t.*, r.name as restaurant_name
        FROM tables t
        LEFT JOIN restaurants r ON t.restaurant_id = r.id
        WHERE t.id = ?
      `).bind(id).first()
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        user.id,
        'update_table',
        'tables',
        JSON.stringify({ tableId: id, changes: data })
      ).run()
      
      const response = {
        ...updatedTable,
        qr_code_url: updatedTable.qr_code,
        qr_image_url: getQRCodeImageUrl(updatedTable.qr_code, updatedTable.qr_code_size || 'medium')
      }
      
      return c.json({
        success: true,
        data: response
      })
      
    } catch (error) {
      console.error('Update table error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update table'
      }, 500)
    }
  }
)

/**
 * 刪除桌位
 * DELETE /api/v1/tables/:id
 */
app.delete('/:id',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      
      const table = await c.env.DB.prepare(`
        SELECT * FROM tables WHERE id = ?
      `).bind(id).first()
      
      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }
      
      // 權限檢查
      if (user.role === 1 && user.restaurantId !== table.restaurant_id) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 檢查是否有進行中的訂單
      const activeOrders = await c.env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM orders 
        WHERE table_id = ? AND status IN ('pending', 'confirmed', 'preparing', 'ready')
      `).bind(id).first()
      
      if ((activeOrders?.count || 0) > 0) {
        return c.json({
          success: false,
          error: 'Cannot delete table with active orders'
        }, 400)
      }
      
      // 軟刪除：設置為不活躍
      await c.env.DB.prepare(`
        UPDATE tables 
        SET is_active = 0, updated_at = datetime('now')
        WHERE id = ?
      `).bind(id).run()
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        user.id,
        'delete_table',
        'tables',
        JSON.stringify({ tableId: id, name: table.name })
      ).run()
      
      return c.json({
        success: true,
        message: 'Table deactivated successfully'
      })
      
    } catch (error) {
      console.error('Delete table error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete table'
      }, 500)
    }
  }
)

/**
 * 批量生成QR碼
 * POST /api/v1/tables/qr/bulk
 */
app.post('/qr/bulk',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateBody(generateQRBulkSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      
      // 權限檢查
      if (user.role === 1 && user.restaurantId !== data.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const qrCodes = []
      
      for (const tableRef of data.tables) {
        // 獲取桌位信息
        const table = await c.env.DB.prepare(`
          SELECT * FROM tables 
          WHERE id = ? AND restaurant_id = ?
        `).bind(tableRef.id, data.restaurantId).first()
        
        if (!table) {
          continue // 跳過不存在的桌位
        }
        
        const qrCodeUrl = generateQRCodeUrl(table.id, data.restaurantId, tableRef.customData)
        const qrImageUrl = getQRCodeImageUrl(qrCodeUrl, data.size)
        
        qrCodes.push({
          tableId: table.id,
          tableName: table.name,
          floor: table.floor,
          section: table.section,
          capacity: table.capacity,
          qrCodeUrl,
          qrImageUrl,
          downloadUrl: `${qrImageUrl}&download=1`, // 直接下載連結
          includeInfo: data.includeTableInfo
        })
        
        // 更新桌位的QR碼
        await c.env.DB.prepare(`
          UPDATE tables 
          SET qr_code = ?, qr_code_size = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(qrCodeUrl, data.size, table.id).run()
      }
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        user.id,
        'bulk_generate_qr',
        'tables',
        JSON.stringify({ 
          restaurantId: data.restaurantId, 
          tableCount: qrCodes.length,
          format: data.format,
          size: data.size 
        })
      ).run()
      
      return c.json({
        success: true,
        data: {
          generated: qrCodes.length,
          qrCodes,
          format: data.format,
          size: data.size,
          generatedAt: new Date().toISOString()
        }
      })
      
    } catch (error) {
      console.error('Bulk generate QR codes error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate QR codes'
      }, 500)
    }
  }
)

/**
 * 獲取桌位QR碼
 * GET /api/v1/tables/:id/qr
 */
app.get('/:id/qr',
  validateParams(commonSchemas.idParam),
  validateQuery(z.object({
    size: z.enum(['small', 'medium', 'large']).optional().default('medium'),
    format: z.enum(['png', 'svg']).optional().default('png')
  })),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { size, format } = c.get('validatedQuery')
      
      const table = await c.env.DB.prepare(`
        SELECT t.*, r.name as restaurant_name
        FROM tables t
        LEFT JOIN restaurants r ON t.restaurant_id = r.id
        WHERE t.id = ? AND t.is_active = 1
      `).bind(id).first()
      
      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found or inactive'
        }, 404)
      }
      
      const qrCodeUrl = table.qr_code || generateQRCodeUrl(table.id, table.restaurant_id)
      const qrImageUrl = getQRCodeImageUrl(qrCodeUrl, size)
      
      return c.json({
        success: true,
        data: {
          tableId: table.id,
          tableName: table.name,
          restaurantName: table.restaurant_name,
          qrCodeUrl,
          qrImageUrl,
          downloadUrl: `${qrImageUrl}&download=1`,
          format,
          size
        }
      })
      
    } catch (error) {
      console.error('Get table QR code error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get QR code'
      }, 500)
    }
  }
)

/**
 * 獲取餐廳桌位統計
 * GET /api/v1/tables/stats/:restaurantId
 */
app.get('/stats/:restaurantId',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number)
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const user = c.get('user')
      
      // 權限檢查
      if (user.role === 1 && user.restaurantId !== restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 基本統計
      const basicStats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_tables,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_tables,
          SUM(capacity) as total_capacity,
          AVG(capacity) as avg_capacity
        FROM tables 
        WHERE restaurant_id = ?
      `).bind(restaurantId).first()
      
      // 按樓層統計
      const floorStats = await c.env.DB.prepare(`
        SELECT 
          floor,
          COUNT(*) as table_count,
          SUM(capacity) as total_capacity,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_tables
        FROM tables 
        WHERE restaurant_id = ?
        GROUP BY floor
        ORDER BY floor
      `).bind(restaurantId).all()
      
      // 使用率統計（基於今日訂單）
      const utilizationStats = await c.env.DB.prepare(`
        SELECT 
          t.id,
          t.name,
          t.capacity,
          COUNT(CASE WHEN DATE(o.created_at) = DATE('now') THEN 1 END) as orders_today,
          COUNT(CASE WHEN o.status IN ('pending', 'confirmed', 'preparing') THEN 1 END) as current_orders
        FROM tables t
        LEFT JOIN orders o ON t.id = o.table_id
        WHERE t.restaurant_id = ? AND t.is_active = 1
        GROUP BY t.id
        ORDER BY orders_today DESC
      `).bind(restaurantId).all()
      
      const occupancyRate = (utilizationStats.results || []).reduce((acc: number, table: any) => {
        return acc + (table.current_orders > 0 ? 1 : 0)
      }, 0) / Math.max((basicStats?.active_tables || 1), 1) * 100
      
      return c.json({
        success: true,
        data: {
          summary: {
            ...basicStats,
            occupancy_rate: Number(occupancyRate.toFixed(2)),
            avg_capacity: Number((basicStats?.avg_capacity || 0).toFixed(1))
          },
          by_floor: floorStats.results || [],
          utilization: utilizationStats.results || []
        }
      })
      
    } catch (error) {
      console.error('Get table stats error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch table statistics'
      }, 500)
    }
  }
)

export default app