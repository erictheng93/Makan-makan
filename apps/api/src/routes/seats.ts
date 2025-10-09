import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/validation'
import { SeatService, USER_ROLES } from '@makanmakan/database'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const batchCreateSeatsSchema = z.object({
  tableId: z.number().int().positive(),
  seatCount: z.number().int().positive().min(1).max(100),
  numberingStyle: z.enum(['numeric', 'alphabetic', 'custom']).optional().default('numeric'),
  customNumbers: z.array(z.string()).optional(),
  prefix: z.string().max(10).optional()
})

const updateSeatSchema = z.object({
  seatNumber: z.string().min(1).max(50).optional(),
  seatName: z.string().min(1).max(100).optional(),
  position: z.string().max(200).optional(),
  isActive: z.boolean().optional()
})

const occupySeatSchema = z.object({
  orderId: z.number().int().positive(),
  occupiedBy: z.string().max(100).optional()
})

const seatFilterSchema = z.object({
  tableId: z.string().regex(/^\d+$/).transform(Number),
  isOccupied: z.string().transform(val => val === 'true').optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  seatNumbers: z.string().transform(val => val.split(',').filter(Boolean)).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50')
})

/**
 * 獲取桌子的所有座位
 * GET /api/v1/seats
 */
app.get('/',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.CHEF, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateQuery(seatFilterSchema as any),
  async (c) => {
    try {
      const filters = c.get('validatedQuery')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const { tableId, ...otherFilters } = filters

      const result = await seatService.getSeatsByTableId(tableId, otherFilters)

      return c.json({
        success: true,
        data: result.seats,
        total: result.total,
        pagination: result.pagination
      })

    } catch (error) {
      console.error('Get seats error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch seats'
      }, 500)
    }
  }
)

/**
 * 獲取單一座位詳情
 * GET /api/v1/seats/:id
 */
app.get('/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.CHEF, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const seat = await seatService.getSeatById(parseInt(id))

      if (!seat) {
        return c.json({
          success: false,
          error: 'Seat not found'
        }, 404)
      }

      return c.json({
        success: true,
        data: seat
      })

    } catch (error) {
      console.error('Get seat error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch seat'
      }, 500)
    }
  }
)

/**
 * 批量創建座位
 * POST /api/v1/seats/batch-create
 */
app.post('/batch-create',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(batchCreateSeatsSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const { tableId, seatCount, numberingStyle, customNumbers, prefix } = data

      const seats = await seatService.createSeatsForTable(
        tableId,
        seatCount,
        {
          numberingStyle,
          customNumbers,
          prefix
        }
      )

      return c.json({
        success: true,
        data: seats,
        message: `Successfully created ${seats.length} seats`
      }, 201)

    } catch (error) {
      console.error('Batch create seats error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create seats'
      }, 500)
    }
  }
)

/**
 * 更新座位資訊
 * PUT /api/v1/seats/:id
 */
app.put('/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  validateBody(updateSeatSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const existingSeat = await seatService.getSeatById(parseInt(id))

      if (!existingSeat) {
        return c.json({
          success: false,
          error: 'Seat not found'
        }, 404)
      }

      const updatedSeat = await seatService.updateSeat(parseInt(id), data)

      return c.json({
        success: true,
        data: updatedSeat,
        message: 'Seat updated successfully'
      })

    } catch (error) {
      console.error('Update seat error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update seat'
      }, 500)
    }
  }
)

/**
 * 刪除座位
 * DELETE /api/v1/seats/:id
 */
app.delete('/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const existingSeat = await seatService.getSeatById(parseInt(id))

      if (!existingSeat) {
        return c.json({
          success: false,
          error: 'Seat not found'
        }, 404)
      }

      const success = await seatService.deleteSeat(parseInt(id))

      if (!success) {
        return c.json({
          success: false,
          error: 'Failed to delete seat'
        }, 500)
      }

      return c.json({
        success: true,
        message: 'Seat deleted successfully'
      })

    } catch (error) {
      console.error('Delete seat error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete seat'
      }, 500)
    }
  }
)

/**
 * 佔用座位
 * POST /api/v1/seats/:id/occupy
 */
app.post('/:id/occupy',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateParams(commonSchemas.idParam as any),
  validateBody(occupySeatSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { orderId, occupiedBy } = c.get('validatedBody')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const seat = await seatService.getSeatById(parseInt(id))

      if (!seat) {
        return c.json({
          success: false,
          error: 'Seat not found'
        }, 404)
      }

      if (seat.isOccupied) {
        return c.json({
          success: false,
          error: 'Seat is already occupied'
        }, 400)
      }

      const success = await seatService.occupySeat(parseInt(id), orderId, occupiedBy)

      if (!success) {
        return c.json({
          success: false,
          error: 'Failed to occupy seat'
        }, 500)
      }

      return c.json({
        success: true,
        message: 'Seat occupied successfully'
      })

    } catch (error) {
      console.error('Occupy seat error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to occupy seat'
      }, 500)
    }
  }
)

/**
 * 釋放座位
 * POST /api/v1/seats/:id/release
 */
app.post('/:id/release',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE, USER_ROLES.CASHIER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const seat = await seatService.getSeatById(parseInt(id))

      if (!seat) {
        return c.json({
          success: false,
          error: 'Seat not found'
        }, 404)
      }

      const success = await seatService.releaseSeat(parseInt(id))

      if (!success) {
        return c.json({
          success: false,
          error: 'Failed to release seat'
        }, 500)
      }

      return c.json({
        success: true,
        message: 'Seat released successfully'
      })

    } catch (error) {
      console.error('Release seat error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to release seat'
      }, 500)
    }
  }
)

/**
 * 重新生成座位 QR Code
 * POST /api/v1/seats/:id/regenerate-qr
 */
app.post('/:id/regenerate-qr',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const seat = await seatService.getSeatById(parseInt(id))

      if (!seat) {
        return c.json({
          success: false,
          error: 'Seat not found'
        }, 404)
      }

      const result = await seatService.regenerateSeatQRCode(parseInt(id))

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error || 'Failed to regenerate QR code'
        }, 500)
      }

      return c.json({
        success: true,
        data: {
          qrCode: result.qrCode
        },
        message: 'Seat QR code regenerated successfully'
      })

    } catch (error) {
      console.error('Regenerate seat QR code error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate seat QR code'
      }, 500)
    }
  }
)

/**
 * 批量生成桌子所有座位的 QR Codes
 * POST /api/v1/seats/batch-regenerate-qr
 */
app.post('/batch-regenerate-qr',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(z.object({
    tableId: z.number().int().positive()
  }) as any),
  async (c) => {
    try {
      const { tableId } = c.get('validatedBody')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const result = await seatService.batchGenerateSeatQRCodes(tableId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error || 'Failed to generate QR codes'
        }, 500)
      }

      return c.json({
        success: true,
        data: result.qrCodes,
        message: `Successfully regenerated QR codes for ${result.qrCodes?.length || 0} seats`
      })

    } catch (error) {
      console.error('Batch regenerate seat QR codes error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate seat QR codes'
      }, 500)
    }
  }
)

/**
 * 獲取桌子的座位統計
 * GET /api/v1/seats/stats
 */
app.get('/stats',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(z.object({
    tableId: z.string().regex(/^\d+$/).transform(Number)
  }) as any),
  async (c) => {
    try {
      const { tableId } = c.get('validatedQuery')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const stats = await seatService.getSeatStats(tableId)

      return c.json({
        success: true,
        data: stats
      })

    } catch (error) {
      console.error('Get seat stats error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch seat statistics'
      }, 500)
    }
  }
)

/**
 * 根據 QR Code 獲取座位資訊
 * GET /api/v1/seats/qr/:qrCode
 */
app.get('/qr/:qrCode',
  validateParams(z.object({
    qrCode: z.string()
  }) as any),
  async (c) => {
    try {
      const { qrCode } = c.get('validatedParams')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const seat = await seatService.getSeatByQRCode(decodeURIComponent(qrCode))

      if (!seat) {
        return c.json({
          success: false,
          error: 'Invalid QR code or seat not found'
        }, 404)
      }

      // 只返回公開資訊
      const publicSeatInfo = {
        id: seat.id,
        tableId: seat.tableId,
        tableNumber: seat.tableNumber,
        restaurantId: seat.restaurantId,
        restaurantName: seat.restaurantName,
        seatNumber: seat.seatNumber,
        seatName: seat.seatName,
        isActive: seat.isActive,
        isOccupied: seat.isOccupied,
        capacity: seat.capacity
      }

      return c.json({
        success: true,
        data: publicSeatInfo
      })

    } catch (error) {
      console.error('Get seat by QR code error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch seat information'
      }, 500)
    }
  }
)

/**
 * 批量刪除桌子的所有座位（用於模式切換）
 * DELETE /api/v1/seats/table/:tableId
 */
app.delete('/table/:tableId',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(z.object({
    tableId: z.string().regex(/^\d+$/).transform(Number)
  }) as any),
  async (c) => {
    try {
      const { tableId } = c.get('validatedParams')
      const seatService = new SeatService(c.env.DB as any, c.env)

      const success = await seatService.deleteSeatsForTable(tableId)

      if (!success) {
        return c.json({
          success: false,
          error: 'Failed to delete seats'
        }, 500)
      }

      return c.json({
        success: true,
        message: 'All seats for the table deleted successfully'
      })

    } catch (error) {
      console.error('Delete seats for table error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete seats'
      }, 500)
    }
  }
)

export default app
