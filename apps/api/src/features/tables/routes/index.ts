/**
 * Tables Routes
 *
 * HTTP route definitions for table management
 */

import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../../../middleware/auth'
import { validateBody, validateQuery, validateParams } from '../../../middleware/validation'
import { USER_ROLES } from '@makanmakan/database'
import type { Env } from '../../../types/env'

import { TablesService } from '../services/TablesService'
import { tableSchemas } from '../schemas/validation'

const app = new Hono<{ Bindings: Env }>()
console.log('[TablesRoutes] Routes module loaded, defining routes...')

// Test route without auth to verify routing works
app.post('/test-no-auth', async (c) => {
  console.log('[TablesRoutes] TEST route hit!')
  return c.json({ success: true, message: 'Test route works!' }, 200)
})

// Test POST / without auth
app.post('/test-root-no-auth', async (c) => {
  console.log('[TablesRoutes] POST /test-root-no-auth hit!')
  return c.json({ success: true, message: 'Root test works!' }, 200)
})

// Test POST / with just auth (no validation)
app.post('/test-with-auth',
  authMiddleware,
  async (c) => {
    console.log('[TablesRoutes] POST /test-with-auth hit!')
    return c.json({ success: true, message: 'Auth test works!' }, 200)
  }
)

// Test POST / with auth + requireRole
app.post('/test-with-role',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  async (c) => {
    console.log('[TablesRoutes] POST /test-with-role hit!')
    return c.json({ success: true, message: 'Role test works!' }, 200)
  }
)

/**
 * Get restaurant tables
 * GET /tables
 */
app.get('/',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.CHEF, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateQuery(tableSchemas.filters as any),
  async (c) => {
    try {
      const filters = c.get('validatedQuery')
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      // Permission check: non-admins can only view their own restaurant's tables
      let restaurantId = filters.restaurantId
      if (currentUser.role !== USER_ROLES.ADMIN) {
        restaurantId = currentUser.restaurantId || 0
      }

      if (!restaurantId) {
        return c.json({
          success: false,
          error: 'Restaurant ID is required'
        }, 400)
      }

      const result = await tablesService.getRestaurantTables(restaurantId, {
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
 * Get single table details
 * GET /tables/:id
 */
app.get('/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.CHEF, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateParams(tableSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams') as { id: number }
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      const table = await tablesService.getTableById(id)

      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }

      // Permission check: non-admins can only view their own restaurant's tables
      if (!tablesService.validateTableAccess(table, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
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

// Handler function for creating tables
const createTableHandler = async (c: any) => {
  console.log('[TablesRoutes] Create table handler called!')
  try {
    const data = c.get('validatedBody') as any
    const currentUser = c.get('user')
    const tablesService = new TablesService(c.env)

      // Permission check: non-admins can only create tables for their own restaurant
      if (!tablesService.validateRestaurantAccess(data.restaurantId, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
        return c.json({
          success: false,
          error: 'Can only create tables for your own restaurant'
        }, 403)
      }

      const newTable = await tablesService.createTable(data)

      return c.json({
        success: true,
        data: newTable
      }, 201)

  } catch (error) {
    console.log('[TablesRoutes] Create table error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create table'
    }, 500)
  }
}

/**
 * Create new table
 * POST /tables  OR  POST /tables/
 * Register both paths to handle trailing slash variations
 */
const createTableMiddleware = [
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(tableSchemas.create as any)
]

// Register both `/` and empty string to handle Hono path stripping
app.post('/', ...createTableMiddleware, createTableHandler)
app.post('', ...createTableMiddleware, createTableHandler) // Empty string for routes ending with /
console.log('[TablesRoutes] Registered POST / and POST routes for creating tables')

/**
 * Update table information
 * PUT /tables/:id
 */
app.put('/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(tableSchemas.idParam as any),
  validateBody(tableSchemas.update as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams') as { id: number }
      const data = c.get('validatedBody') as any
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      const existingTable = await tablesService.getTableById(id)

      if (!existingTable) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }

      // Permission check: non-admins can only update their own restaurant's tables
      if (!tablesService.validateTableAccess(existingTable, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const updatedTable = await tablesService.updateTable(id, data)

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
 * Delete table
 * DELETE /tables/:id
 */
app.delete('/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(tableSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams') as { id: number }
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      const existingTable = await tablesService.getTableById(id)

      if (!existingTable) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }

      // Permission check: non-admins can only delete their own restaurant's tables
      if (!tablesService.validateTableAccess(existingTable, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const success = await tablesService.deleteTable(id)

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
 * Occupy table
 * POST /tables/:id/occupy
 */
app.post('/:id/occupy',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateParams(tableSchemas.idParam as any),
  validateBody(tableSchemas.occupy as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams') as { id: number }
      const { orderId, occupiedBy, estimatedMinutes } = c.get('validatedBody')
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      const table = await tablesService.getTableById(id)

      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }

      // Permission check: non-admins can only operate their own restaurant's tables
      if (!tablesService.validateTableAccess(table, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
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

      const success = await tablesService.occupyTable(id, orderId, occupiedBy, estimatedMinutes)

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
 * Release table
 * POST /tables/:id/release
 */
app.post('/:id/release',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateParams(tableSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams') as { id: number }
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      const table = await tablesService.getTableById(id)

      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }

      // Permission check: non-admins can only operate their own restaurant's tables
      if (!tablesService.validateTableAccess(table, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const success = await tablesService.releaseTable(id)

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
 * Mark table as cleaned
 * POST /tables/:id/clean
 */
app.post('/:id/clean',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE]),
  validateParams(tableSchemas.idParam as any),
  validateBody(tableSchemas.clean as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams') as { id: number }
      const { notes } = c.get('validatedBody')
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      const table = await tablesService.getTableById(id)

      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }

      // Permission check: non-admins can only operate their own restaurant's tables
      if (!tablesService.validateTableAccess(table, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const success = await tablesService.markTableCleaned(id, notes)

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
 * Regenerate table QR code
 * POST /tables/:id/regenerate-qr
 */
app.post('/:id/regenerate-qr',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(tableSchemas.idParam as any),
  validateBody(tableSchemas.regenerateQR as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams') as { id: number }
      const { customData } = c.get('validatedBody')
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      const table = await tablesService.getTableById(id)

      if (!table) {
        return c.json({
          success: false,
          error: 'Table not found'
        }, 404)
      }

      // Permission check: non-admins can only operate their own restaurant's tables
      if (!tablesService.validateTableAccess(table, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const result = await tablesService.regenerateQRCode(id, customData)

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
 * Bulk generate QR codes
 * POST /tables/bulk-qr
 */
app.post('/bulk-qr',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(tableSchemas.bulkQR as any),
  async (c) => {
    try {
      const { restaurantId, tableIds, options = {} } = c.get('validatedBody') as any
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      // Permission check: non-admins can only operate their own restaurant's tables
      if (!tablesService.validateRestaurantAccess(restaurantId, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const result = await tablesService.generateBulkQRCodes(restaurantId, tableIds, options)

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
 * Get available tables
 * GET /tables/available
 */
app.get('/available',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateQuery(tableSchemas.availableTables as any),
  async (c) => {
    try {
      const { restaurantId, capacity } = c.get('validatedQuery') as any
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      // Permission check: non-admins can only view their own restaurant's tables
      if (!tablesService.validateRestaurantAccess(restaurantId, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const availableTables = await tablesService.getAvailableTables(restaurantId, capacity)

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
 * Get table statistics
 * GET /tables/stats
 */
app.get('/stats',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(tableSchemas.stats as any),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedQuery') as any
      const currentUser = c.get('user')
      const tablesService = new TablesService(c.env)

      // Permission check: non-admins can only view their own restaurant's statistics
      if (!tablesService.validateRestaurantAccess(restaurantId, currentUser.restaurantId || 0, currentUser.role === USER_ROLES.ADMIN)) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const stats = await tablesService.getTableStats(restaurantId)

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
 * Get table information by QR code
 * GET /tables/qr/:qrCode
 */
app.get('/qr/:qrCode',
  validateParams(tableSchemas.qrCodeParam as any),
  async (c) => {
    try {
      const { qrCode } = c.get('validatedParams') as any
      const tablesService = new TablesService(c.env)

      const table = await tablesService.getTableByQRCode(decodeURIComponent(qrCode))

      if (!table) {
        return c.json({
          success: false,
          error: 'Invalid QR code or table not found'
        }, 404)
      }

      // Return only public information
      const publicTableInfo = tablesService.getPublicTableInfo(table)

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