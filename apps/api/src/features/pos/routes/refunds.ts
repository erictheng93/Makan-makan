/**
 * 退款管理路由
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../../../middleware/auth'
import { validateBody, validateQuery, validateParams } from '../../../middleware/validation'
import { RefundService } from '../services/RefundService'
import { processRefundSchema } from '../schemas'
import type { Env } from '../../../types/env'

const app = new Hono<{ Bindings: Env }>()

/**
 * 處理退款
 * POST /refunds/create
 */
app.post('/create',
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

      const refundService = new RefundService(c.env.DB as any)
      const result = await refundService.processRefund(data, registerId, user.id, shiftId)

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
 * 獲取退款記錄
 * GET /registers/:registerId/refunds
 */
app.get('/registers/:registerId/refunds',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(z.object({
    registerId: z.string().uuid()
  })),
  validateQuery(z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
    orderId: z.string().regex(/^\d+$/).transform(Number).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
  })),
  async (c) => {
    try {
      const { registerId } = c.get('validatedParams')
      const { startDate, endDate, status, orderId, page, limit } = c.get('validatedQuery')

      const refundService = new RefundService(c.env.DB as any)
      const result = await refundService.getRefunds(registerId, {
        startDate,
        endDate,
        status,
        orderId,
        page,
        limit
      })

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
      console.error('Get refunds error:', error)
      return c.json({
        success: false,
        error: '獲取退款記錄失敗'
      }, 500)
    }
  }
)

/**
 * 獲取退款詳情
 * GET /refunds/:refundId
 */
app.get('/:refundId',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(z.object({
    refundId: z.string().uuid()
  })),
  async (c) => {
    try {
      const { refundId } = c.get('validatedParams')

      const refundService = new RefundService(c.env.DB as any)
      const result = await refundService.getRefundDetail(refundId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, result.error === '退款記錄不存在' ? 404 : 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Get refund detail error:', error)
      return c.json({
        success: false,
        error: '獲取退款詳情失敗'
      }, 500)
    }
  }
)

/**
 * 審核退款
 * POST /refunds/:refundId/approve
 */
app.post('/:refundId/approve',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner only
  validateParams(z.object({
    refundId: z.string().uuid()
  })),
  async (c) => {
    try {
      const { refundId } = c.get('validatedParams')
      const user = c.get('user')

      const refundService = new RefundService(c.env.DB as any)
      const result = await refundService.approveRefund(refundId, user.id)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        message: '退款已審核通過'
      })

    } catch (error) {
      console.error('Approve refund error:', error)
      return c.json({
        success: false,
        error: '審核退款失敗'
      }, 500)
    }
  }
)

/**
 * 拒絕退款
 * POST /refunds/:refundId/reject
 */
app.post('/:refundId/reject',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner only
  validateParams(z.object({
    refundId: z.string().uuid()
  })),
  validateBody(z.object({
    reason: z.string().max(200).optional()
  })),
  async (c) => {
    try {
      const { refundId } = c.get('validatedParams')
      const { reason } = c.get('validatedBody')
      const user = c.get('user')

      const refundService = new RefundService(c.env.DB as any)
      const result = await refundService.rejectRefund(refundId, user.id, reason)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        message: '退款已拒絕'
      })

    } catch (error) {
      console.error('Reject refund error:', error)
      return c.json({
        success: false,
        error: '拒絕退款失敗'
      }, 500)
    }
  }
)

/**
 * 取消退款
 * POST /refunds/:refundId/cancel
 */
app.post('/:refundId/cancel',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner only
  validateParams(z.object({
    refundId: z.string().uuid()
  })),
  validateBody(z.object({
    reason: z.string().max(200).optional()
  })),
  async (c) => {
    try {
      const { refundId } = c.get('validatedParams')
      const { reason } = c.get('validatedBody')
      const user = c.get('user')

      const refundService = new RefundService(c.env.DB as any)
      const result = await refundService.cancelRefund(refundId, user.id, reason)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        message: '退款已取消'
      })

    } catch (error) {
      console.error('Cancel refund error:', error)
      return c.json({
        success: false,
        error: '取消退款失敗'
      }, 500)
    }
  }
)

export default app