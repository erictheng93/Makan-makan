import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateBody, validateQuery, validateParams } from '../middleware/validation'
import { POSService, getCurrentTimestamp } from '@makanmakan/database'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const createRegisterSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  restaurantId: z.number().int().positive(),
  hardwareConfig: z.record(z.any()).optional(),
  peripherals: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional()
})

const startShiftSchema = z.object({
  registerId: z.string().uuid(),
  operatorId: z.number().int().positive(),
  startAmount: z.number().min(0),
  notes: z.string().max(500).optional()
})

const endShiftSchema = z.object({
  actualAmount: z.number().min(0),
  closingNotes: z.string().max(500).optional()
})

const cashMovementSchema = z.object({
  type: z.enum(['cash_in', 'cash_out', 'count', 'adjustment', 'payout', 'deposit']),
  amount: z.number(),
  description: z.string().min(1).max(200),
  denominationBreakdown: z.record(z.number()).optional(),
  referenceId: z.number().int().positive().optional(),
  referenceType: z.string().optional()
})

const printReceiptSchema = z.object({
  orderId: z.number().int().positive(),
  templateName: z.string().optional().default('standard'),
  receiptType: z.enum(['customer', 'kitchen', 'merchant']).optional().default('customer'),
  copies: z.number().int().min(1).max(5).optional().default(1)
})

const processRefundSchema = z.object({
  originalOrderId: z.number().int().positive(),
  refundType: z.enum(['full', 'partial', 'item', 'service']),
  refundAmount: z.number().positive(),
  refundMethod: z.string().min(1).max(50),
  reasonCode: z.string().min(1).max(50),
  reasonDescription: z.string().max(500).optional(),
  itemsRefunded: z.array(z.any()).optional(),
  customerSignature: z.string().optional()
})

/**
 * 創建收銀機
 * POST /api/v1/pos/registers
 * 權限：管理員或店主
 */
app.post('/registers',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateBody(createRegisterSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')

      // 權限檢查：店主只能為自己的餐廳創建收銀機
      if (user.role === 1 && user.restaurantId !== data.restaurantId) {
        return c.json({
          success: false,
          error: '只能為自己的餐廳創建收銀機'
        }, 403)
      }

      const posService = new POSService(c.env.DB as any, c.env)
      const result = await posService.createRegister(data, user.id)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Create register error:', error)
      return c.json({
        success: false,
        error: '創建收銀機失敗'
      }, 500)
    }
  }
)

/**
 * 獲取收銀機列表
 * GET /api/v1/pos/registers
 */
app.get('/registers',
  authMiddleware,
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional()
  })),
  async (c) => {
    try {
      const user = c.get('user')
      const query = c.get('validatedQuery')

      // 確定餐廳ID
      let restaurantId: number
      if (query.restaurantId) {
        restaurantId = query.restaurantId
        // 權限檢查
        if (user.role === 1 && user.restaurantId !== restaurantId) {
          return c.json({
            success: false,
            error: '只能查看自己餐廳的收銀機'
          }, 403)
        }
      } else if (user.restaurantId) {
        restaurantId = user.restaurantId
      } else {
        return c.json({
          success: false,
          error: '需要指定餐廳ID'
        }, 400)
      }

      const posService = new POSService(c.env.DB as any, c.env)
      const result = await posService.getRegisters(restaurantId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Get registers error:', error)
      return c.json({
        success: false,
        error: '獲取收銀機列表失敗'
      }, 500)
    }
  }
)

/**
 * 開始班次
 * POST /api/v1/pos/shifts/start
 * 權限：收銀員及以上
 */
app.post('/shifts/start',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateBody(startShiftSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')

      // 如果不是管理員，操作員必須是自己
      if (user.role !== 0 && data.operatorId !== user.id) {
        return c.json({
          success: false,
          error: '只能為自己開班'
        }, 403)
      }

      const posService = new POSService(c.env.DB as any, c.env)
      const result = await posService.startShift(data)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Start shift error:', error)
      return c.json({
        success: false,
        error: '開班失敗'
      }, 500)
    }
  }
)

/**
 * 結束班次
 * POST /api/v1/pos/shifts/{shiftId}/end
 * 權限：收銀員及以上
 */
app.post('/shifts/:shiftId/end',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(z.object({ shiftId: z.string().uuid() })),
  validateBody(endShiftSchema),
  async (c) => {
    try {
      const { shiftId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')

      const posService = new POSService(c.env.DB as any, c.env)
      const result = await posService.endShift(shiftId, data, user.id)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('End shift error:', error)
      return c.json({
        success: false,
        error: '結班失敗'
      }, 500)
    }
  }
)

/**
 * 現金操作記錄
 * POST /api/v1/pos/shifts/{shiftId}/cash
 * 權限：收銀員及以上
 */
app.post('/shifts/:shiftId/cash',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(z.object({ shiftId: z.string().uuid() })),
  validateBody(cashMovementSchema),
  async (c) => {
    try {
      const { shiftId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')

      const posService = new POSService(c.env.DB as any, c.env)
      const result = await posService.processCashMovement(shiftId, data, user.id)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        message: '現金操作記錄成功'
      })

    } catch (error) {
      console.error('Cash movement error:', error)
      return c.json({
        success: false,
        error: '現金操作記錄失敗'
      }, 500)
    }
  }
)

/**
 * 打印收據
 * POST /api/v1/pos/receipts/print
 * 權限：收銀員及以上
 */
app.post('/receipts/print',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateBody(printReceiptSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const registerId = c.req.header('X-Register-Id')
      const shiftId = c.req.header('X-Shift-Id')

      if (!registerId) {
        return c.json({
          success: false,
          error: '需要指定收銀機ID'
        }, 400)
      }

      const posService = new POSService(c.env.DB as any, c.env)
      const result = await posService.printReceipt(data, registerId, shiftId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Print receipt error:', error)
      return c.json({
        success: false,
        error: '打印收據失敗'
      }, 500)
    }
  }
)

/**
 * 重打收據
 * POST /api/v1/pos/receipts/{receiptId}/reprint
 * 權限：收銀員及以上
 */
app.post('/receipts/:receiptId/reprint',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(z.object({ receiptId: z.string().uuid() })),
  async (c) => {
    try {
      const { receiptId } = c.get('validatedParams')
      const db = c.env.DB as any

      // 檢查收據是否存在
      const receipt = await db.prepare(
        'SELECT * FROM receipts WHERE id = ?'
      ).bind(receiptId).first()

      if (!receipt) {
        return c.json({
          success: false,
          error: '收據不存在'
        }, 404)
      }

      // 更新重打次數
      const reprintTime = getCurrentTimestamp()
      await db.prepare(`
        UPDATE receipts
        SET reprinted_count = reprinted_count + 1,
            last_reprint_at = ?,
            print_status = 'pending'
        WHERE id = ?
      `).bind(reprintTime, receiptId).run()

      // 模擬重打過程
      setTimeout(async () => {
        try {
          const printedTime = getCurrentTimestamp()
          await db.prepare(`
            UPDATE receipts
            SET print_status = 'printed', printed_at = ?
            WHERE id = ?
          `).bind(printedTime, receiptId).run()
        } catch (error) {
          console.error('更新重打狀態失敗:', error)
        }
      }, 1000)

      return c.json({
        success: true,
        message: '收據重打中'
      })

    } catch (error) {
      console.error('Reprint receipt error:', error)
      return c.json({
        success: false,
        error: '重打收據失敗'
      }, 500)
    }
  }
)

/**
 * 處理退款
 * POST /api/v1/pos/refunds/create
 * 權限：管理員或店主
 */
app.post('/refunds/create',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner only
  validateBody(processRefundSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      const registerId = c.req.header('X-Register-Id')
      const shiftId = c.req.header('X-Shift-Id')

      if (!registerId) {
        return c.json({
          success: false,
          error: '需要指定收銀機ID'
        }, 400)
      }

      const posService = new POSService(c.env.DB as any, c.env)
      const result = await posService.processRefund(data, registerId, user.id, shiftId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Process refund error:', error)
      return c.json({
        success: false,
        error: '處理退款失敗'
      }, 500)
    }
  }
)

/**
 * 獲取班次報表
 * GET /api/v1/pos/shifts/{shiftId}/report
 * 權限：收銀員及以上
 */
app.get('/shifts/:shiftId/report',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(z.object({ shiftId: z.string().uuid() })),
  async (c) => {
    try {
      const { shiftId } = c.get('validatedParams')

      const posService = new POSService(c.env.DB as any, c.env)
      const result = await posService.generateShiftReport(shiftId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Get shift report error:', error)
      return c.json({
        success: false,
        error: '獲取班次報表失敗'
      }, 500)
    }
  }
)

/**
 * 獲取班次統計
 * GET /api/v1/pos/stats/shifts
 * 權限：管理員或店主
 */
app.get('/stats/shifts',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional()
  })),
  async (c) => {
    try {
      const user = c.get('user')
      const query = c.get('validatedQuery')

      // 確定餐廳ID
      let restaurantId: number
      if (query.restaurantId) {
        restaurantId = query.restaurantId
        if (user.role === 1 && user.restaurantId !== restaurantId) {
          return c.json({
            success: false,
            error: '只能查看自己餐廳的統計'
          }, 403)
        }
      } else if (user.restaurantId) {
        restaurantId = user.restaurantId
      } else {
        return c.json({
          success: false,
          error: '需要指定餐廳ID'
        }, 400)
      }

      const dateRange = query.dateFrom && query.dateTo ? {
        from: new Date(query.dateFrom),
        to: new Date(query.dateTo)
      } : undefined

      const posService = new POSService(c.env.DB as any, c.env)
      const result = await posService.getShiftStats(restaurantId, dateRange)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Get shift stats error:', error)
      return c.json({
        success: false,
        error: '獲取班次統計失敗'
      }, 500)
    }
  }
)

/**
 * 獲取收銀機狀態
 * GET /api/v1/pos/registers/{registerId}/status
 * 權限：收銀員及以上
 */
app.get('/registers/:registerId/status',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(z.object({ registerId: z.string().uuid() })),
  async (c) => {
    try {
      const { registerId } = c.get('validatedParams')
      const db = c.env.DB as any

      const status = await db.prepare(`
        SELECT 
          cr.*,
          cs.id as current_shift_id,
          cs.operator_id,
          cs.started_at as shift_started,
          cs.start_amount,
          cs.total_sales,
          cs.total_transactions,
          u.full_name as operator_name
        FROM cash_registers cr
        LEFT JOIN cash_shifts cs ON cr.current_shift_id = cs.id AND cs.status = 'active'
        LEFT JOIN users u ON cs.operator_id = u.id
        WHERE cr.id = ?
      `).bind(registerId).first()

      if (!status) {
        return c.json({
          success: false,
          error: '收銀機不存在'
        }, 404)
      }

      return c.json({
        success: true,
        data: {
          ...status,
          hardwareConfig: JSON.parse(status.hardware_config || '{}'),
          peripherals: JSON.parse(status.peripherals || '{}'),
          settings: JSON.parse(status.settings || '{}'),
          isShiftActive: !!status.current_shift_id
        }
      })

    } catch (error) {
      console.error('Get register status error:', error)
      return c.json({
        success: false,
        error: '獲取收銀機狀態失敗'
      }, 500)
    }
  }
)

/**
 * 獲取現金流動記錄
 * GET /api/v1/pos/shifts/{shiftId}/movements
 * 權限：收銀員及以上
 */
app.get('/shifts/:shiftId/movements',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(z.object({ shiftId: z.string().uuid() })),
  validateQuery(z.object({
    type: z.enum(['sale', 'refund', 'cash_in', 'cash_out', 'count', 'opening', 'closing', 'adjustment', 'payout', 'deposit']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
  })),
  async (c) => {
    try {
      const { shiftId } = c.get('validatedParams')
      const { type, page, limit } = c.get('validatedQuery')
      const offset = (page - 1) * limit

      const db = c.env.DB as any

      let typeFilter = ''
      const params = [shiftId]
      
      if (type) {
        typeFilter = ' AND type = ?'
        params.push(type)
      }

      const movements = await db.prepare(`
        SELECT 
          cm.*,
          u.full_name as recorded_by_name,
          ua.full_name as approved_by_name
        FROM cash_movements cm
        LEFT JOIN users u ON cm.recorded_by = u.id
        LEFT JOIN users ua ON cm.approved_by = ua.id
        WHERE cm.shift_id = ? ${typeFilter}
        ORDER BY cm.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all()

      return c.json({
        success: true,
        data: {
          movements: movements.results.map((movement: any) => ({
            ...movement,
            denominationBreakdown: JSON.parse(movement.denomination_breakdown || '{}'),
            metadata: JSON.parse(movement.metadata || '{}')
          })),
          pagination: {
            page,
            limit,
            hasMore: movements.results.length === limit
          }
        }
      })

    } catch (error) {
      console.error('Get cash movements error:', error)
      return c.json({
        success: false,
        error: '獲取現金流動記錄失敗'
      }, 500)
    }
  }
)

export default app