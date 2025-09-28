/**
 * 班次管理路由
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../../../middleware/auth'
import { validateBody, validateQuery, validateParams } from '../../../middleware/validation'
import { ShiftService } from '../services/ShiftService'
import { ReportService } from '../services/ReportService'
import {
  startShiftSchema,
  endShiftSchema,
  shiftParamsSchema,
  statsQuerySchema
} from '../schemas'
import type { Env } from '../../../types/env'

const app = new Hono<{ Bindings: Env }>()

/**
 * 開始班次
 * POST /shifts/start
 */
app.post('/start',
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

      const shiftService = new ShiftService(c.env.DB as any)
      const result = await shiftService.startShift(data)

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
 * POST /shifts/:shiftId/end
 */
app.post('/:shiftId/end',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(shiftParamsSchema),
  validateBody(endShiftSchema),
  async (c) => {
    try {
      const { shiftId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')

      const shiftService = new ShiftService(c.env.DB as any)
      const result = await shiftService.endShift(shiftId, data, user.id)

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
 * 暫停班次
 * POST /shifts/:shiftId/suspend
 */
app.post('/:shiftId/suspend',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(shiftParamsSchema),
  validateBody(z.object({
    reason: z.string().max(200).optional()
  })),
  async (c) => {
    try {
      const { shiftId } = c.get('validatedParams')
      const { reason } = c.get('validatedBody')

      const shiftService = new ShiftService(c.env.DB as any)
      const result = await shiftService.suspendShift(shiftId, reason)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        message: '班次已暫停'
      })

    } catch (error) {
      console.error('Suspend shift error:', error)
      return c.json({
        success: false,
        error: '暫停班次失敗'
      }, 500)
    }
  }
)

/**
 * 恢復班次
 * POST /shifts/:shiftId/resume
 */
app.post('/:shiftId/resume',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(shiftParamsSchema),
  async (c) => {
    try {
      const { shiftId } = c.get('validatedParams')

      const shiftService = new ShiftService(c.env.DB as any)
      const result = await shiftService.resumeShift(shiftId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        message: '班次已恢復'
      })

    } catch (error) {
      console.error('Resume shift error:', error)
      return c.json({
        success: false,
        error: '恢復班次失敗'
      }, 500)
    }
  }
)

/**
 * 獲取當前班次
 * GET /shifts/current/:registerId
 */
app.get('/current/:registerId',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(z.object({
    registerId: z.string().uuid()
  })),
  async (c) => {
    try {
      const { registerId } = c.get('validatedParams')

      const shiftService = new ShiftService(c.env.DB as any)
      const result = await shiftService.getCurrentShift(registerId)

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
      console.error('Get current shift error:', error)
      return c.json({
        success: false,
        error: '獲取當前班次失敗'
      }, 500)
    }
  }
)

/**
 * 生成班次報表
 * GET /shifts/:shiftId/report
 */
app.get('/:shiftId/report',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(shiftParamsSchema),
  async (c) => {
    try {
      const { shiftId } = c.get('validatedParams')

      const reportService = new ReportService(c.env.DB as any)
      const result = await reportService.generateShiftReport(shiftId)

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
 * GET /shifts/stats
 */
app.get('/stats',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateQuery(statsQuerySchema),
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

      const reportService = new ReportService(c.env.DB as any)
      const result = await reportService.getShiftStats(restaurantId, dateRange)

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

export default app