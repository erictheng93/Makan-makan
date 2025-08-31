import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole, requireRestaurantAccess } from '../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/validation'
import { TableService, USER_ROLES } from '@makanmakan/database'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const createTableSchema = z.object({
  restaurantId: z.number().int().positive(),
  number: z.string().min(1).max(50),
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().positive(),
  location: z.string().max(100).optional(),
  floor: z.number().int().positive().optional().default(1),
  section: z.string().max(50).optional(),
  features: z.object({
    hasChargingPort: z.boolean().optional(),
    hasWifi: z.boolean().optional(),
    isAccessible: z.boolean().optional(),
    hasView: z.boolean().optional(),
    isQuietZone: z.boolean().optional(),
    smokingAllowed: z.boolean().optional()
  }).optional(),
  isReservable: z.boolean().optional().default(true)
})

const updateTableSchema = z.object({
  number: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().positive().optional(),
  location: z.string().max(100).optional(),
  floor: z.number().int().positive().optional(),
  section: z.string().max(50).optional(),
  features: z.object({
    hasChargingPort: z.boolean().optional(),
    hasWifi: z.boolean().optional(),
    isAccessible: z.boolean().optional(),
    hasView: z.boolean().optional(),
    isQuietZone: z.boolean().optional(),
    smokingAllowed: z.boolean().optional()
  }).optional(),
  isActive: z.boolean().optional(),
  isReservable: z.boolean().optional(),
  maintenanceNotes: z.string().max(500).optional()
})

const generateQRBulkSchema = z.object({
  restaurantId: z.number().int().positive(),
  tableIds: z.array(z.number().int().positive()).min(1).max(50),
  options: z.object({
    size: z.enum(['small', 'medium', 'large']).default('medium'),
    format: z.enum(['png', 'svg', 'pdf']).default('png'),
    includeTableInfo: z.boolean().default(true),
    customData: z.any().optional()
  }).optional()
})

const tableFilterSchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  floor: z.string().regex(/^\d+$/).transform(Number).optional(),
  section: z.string().optional(),
  isOccupied: z.string().transform(val => val === 'true').optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  isReservable: z.string().transform(val => val === 'true').optional(),
  minCapacity: z.string().regex(/^\d+$/).transform(Number).optional(),
  maxCapacity: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
})

/**
 * 獲取餐廳桌位列表
 * GET /api/v1/tables
 */
app.get('/',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.CHEF, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateQuery(tableFilterSchema as any),
  async (c) => {
    try {
      const filters = c.get('validatedQuery')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      // 權限過濾：非管理員只能查看自己餐廳的桌子
      let restaurantId = filters.restaurantId
      if (currentUser.role !== USER_ROLES.ADMIN) {
        restaurantId = currentUser.restaurantId
      }
      
      if (!restaurantId) {
        return c.json({
          success: false,
          error: 'Restaurant ID is required'
        }, 400)
      }
      
      const result = await tableService.getRestaurantTables(restaurantId, {
        ...filters,
        restaurantId: undefined // Remove from filters since it's used as parameter
      })
      
      return c.json({
        success: true,
        data: result.tables,
        pagination: result.pagination
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
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.CHEF, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      const table = await tableService.getTableById(parseInt(id))
      
      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }
      
      // 權限檢查：非管理員只能查看自己餐廳的桌子
      if (currentUser.role !== USER_ROLES.ADMIN && table.restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      return c.json({
        success: true,
        data: table
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
 * 創建新桌位
 * POST /api/v1/tables
 */
app.post('/',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(createTableSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      // 權限檢查：非管理員只能為自己的餐廳創建桌子
      if (currentUser.role !== USER_ROLES.ADMIN && data.restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Can only create tables for your own restaurant'
        }, 403)
      }
      
      const newTable = await tableService.createTable({
        restaurantId: data.restaurantId,
        number: data.number,
        name: data.name,
        capacity: data.capacity,
        location: data.location,
        floor: data.floor,
        section: data.section,
        features: data.features,
        isReservable: data.isReservable
      })
      
      return c.json({
        success: true,
        data: newTable
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
 * 更新桌位資訊
 * PUT /api/v1/tables/:id
 */
app.put('/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  validateBody(updateTableSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      const existingTable = await tableService.getTableById(parseInt(id))
      
      if (!existingTable) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }
      
      // 權限檢查：非管理員只能更新自己餐廳的桌子
      if (currentUser.role !== USER_ROLES.ADMIN && existingTable.restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const updatedTable = await tableService.updateTable(parseInt(id), data)
      
      return c.json({
        success: true,
        data: updatedTable
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
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      const existingTable = await tableService.getTableById(parseInt(id))
      
      if (!existingTable) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }
      
      // 權限檢查：非管理員只能刪除自己餐廳的桌子
      if (currentUser.role !== USER_ROLES.ADMIN && existingTable.restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const success = await tableService.deleteTable(parseInt(id))
      
      if (!success) {
        return c.json({
          success: false,
          error: 'Failed to delete table'
        }, 500)
      }
      
      return c.json({
        success: true,
        message: 'Table deleted successfully'
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
 * 佔用桌位
 * POST /api/v1/tables/:id/occupy
 */
app.post('/:id/occupy',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateParams(commonSchemas.idParam as any),
  validateBody(z.object({
    orderId: z.number().int().positive(),
    occupiedBy: z.string().max(100).optional(),
    estimatedMinutes: z.number().int().positive().optional()
  })),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { orderId, occupiedBy, estimatedMinutes } = c.get('validatedBody')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      const table = await tableService.getTableById(parseInt(id))
      
      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }
      
      // 權限檢查：非管理員只能操作自己餐廳的桌子
      if (currentUser.role !== USER_ROLES.ADMIN && table.restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      if (table.isOccupied) {
        return c.json({
          success: false,
          error: 'Table is already occupied'
        }, 400)
      }
      
      const success = await tableService.occupyTable(parseInt(id), orderId, occupiedBy, estimatedMinutes)
      
      if (!success) {
        return c.json({
          success: false,
          error: 'Failed to occupy table'
        }, 500)
      }
      
      return c.json({
        success: true,
        message: 'Table occupied successfully'
      })
      
    } catch (error) {
      console.error('Occupy table error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to occupy table'
      }, 500)
    }
  }
)

/**
 * 釋放桌位
 * POST /api/v1/tables/:id/release
 */
app.post('/:id/release',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      const table = await tableService.getTableById(parseInt(id))
      
      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }
      
      // 權限檢查：非管理員只能操作自己餐廳的桌子
      if (currentUser.role !== USER_ROLES.ADMIN && table.restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const success = await tableService.releaseTable(parseInt(id))
      
      if (!success) {
        return c.json({
          success: false,
          error: 'Failed to release table'
        }, 500)
      }
      
      return c.json({
        success: true,
        message: 'Table released successfully'
      })
      
    } catch (error) {
      console.error('Release table error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to release table'
      }, 500)
    }
  }
)

/**
 * 標記桌位已清潔
 * POST /api/v1/tables/:id/clean
 */
app.post('/:id/clean',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE]),
  validateParams(commonSchemas.idParam as any),
  validateBody(z.object({
    notes: z.string().max(200).optional()
  })),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { notes } = c.get('validatedBody')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      const table = await tableService.getTableById(parseInt(id))
      
      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }
      
      // 權限檢查：非管理員只能操作自己餐廳的桌子
      if (currentUser.role !== USER_ROLES.ADMIN && table.restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const success = await tableService.markTableCleaned(parseInt(id), notes)
      
      if (!success) {
        return c.json({
          success: false,
          error: 'Failed to mark table as cleaned'
        }, 500)
      }
      
      return c.json({
        success: true,
        message: 'Table marked as cleaned successfully'
      })
      
    } catch (error) {
      console.error('Mark table cleaned error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark table as cleaned'
      }, 500)
    }
  }
)

/**
 * 重新生成桌位QR碼
 * POST /api/v1/tables/:id/regenerate-qr
 */
app.post('/:id/regenerate-qr',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  validateBody(z.object({
    customData: z.any().optional()
  })),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { customData } = c.get('validatedBody')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      const table = await tableService.getTableById(parseInt(id))
      
      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }
      
      // 權限檢查：非管理員只能操作自己餐廳的桌子
      if (currentUser.role !== USER_ROLES.ADMIN && table.restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const result = await tableService.regenerateQRCode(parseInt(id), customData)
      
      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 500)
      }
      
      return c.json({
        success: true,
        data: {
          qrCode: result.qrCode
        },
        message: 'QR code regenerated successfully'
      })
      
    } catch (error) {
      console.error('Regenerate QR code error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate QR code'
      }, 500)
    }
  }
)

/**
 * 批量生成QR碼
 * POST /api/v1/tables/bulk-qr
 */
app.post('/bulk-qr',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(generateQRBulkSchema),
  async (c) => {
    try {
      const { restaurantId, tableIds, options = {} } = c.get('validatedBody')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      // 權限檢查：非管理員只能操作自己餐廳的桌子
      if (currentUser.role !== USER_ROLES.ADMIN && restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const result = await tableService.generateBulkQRCodes(restaurantId, tableIds, options)
      
      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 500)
      }
      
      return c.json({
        success: true,
        data: result.qrCodes,
        message: 'QR codes generated successfully'
      })
      
    } catch (error) {
      console.error('Generate bulk QR codes error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate QR codes'
      }, 500)
    }
  }
)

/**
 * 獲取可用桌位
 * GET /api/v1/tables/available
 */
app.get('/available',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number),
    capacity: z.string().regex(/^\d+$/).transform(Number).optional()
  }) as any),
  async (c) => {
    try {
      const { restaurantId, capacity } = c.get('validatedQuery')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      // 權限檢查：非管理員只能查看自己餐廳的桌子
      if (currentUser.role !== USER_ROLES.ADMIN && restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const availableTables = await tableService.getAvailableTables(restaurantId, capacity)
      
      return c.json({
        success: true,
        data: availableTables
      })
      
    } catch (error) {
      console.error('Get available tables error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch available tables'
      }, 500)
    }
  }
)

/**
 * 獲取桌位統計
 * GET /api/v1/tables/stats
 */
app.get('/stats',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number)
  }) as any),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedQuery')
      const currentUser = c.get('user')
      const tableService = new TableService(c.env.DB as any)
      
      // 權限檢查：非管理員只能查看自己餐廳的統計
      if (currentUser.role !== USER_ROLES.ADMIN && restaurantId !== currentUser.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const stats = await tableService.getTableStats(restaurantId)
      
      return c.json({
        success: true,
        data: stats
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

/**
 * 根據QR碼獲取桌位資訊
 * GET /api/v1/tables/qr/:qrCode
 */
app.get('/qr/:qrCode',
  validateParams(z.object({
    qrCode: z.string()
  })),
  async (c) => {
    try {
      const { qrCode } = c.get('validatedParams')
      const tableService = new TableService(c.env.DB as any)
      
      const table = await tableService.getTableByQRCode(decodeURIComponent(qrCode))
      
      if (!table) {
        return c.json({
          success: false,
          error: 'Invalid QR code or table not found'
        }, 404)
      }
      
      // 只返回公開資訊
      const publicTableInfo = {
        id: table.id,
        restaurantId: table.restaurantId,
        number: table.number,
        name: table.name,
        capacity: table.capacity,
        location: table.location,
        floor: table.floor,
        section: table.section,
        features: table.features,
        isActive: table.isActive,
        isOccupied: table.isOccupied
      }
      
      return c.json({
        success: true,
        data: publicTableInfo
      })
      
    } catch (error) {
      console.error('Get table by QR code error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch table information'
      }, 500)
    }
  }
)

export default app