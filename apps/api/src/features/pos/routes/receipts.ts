/**
 * 收據管理路由
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../../../middleware/auth'
import { validateBody, validateQuery, validateParams } from '../../../middleware/validation'
import { ReceiptService } from '../services/ReceiptService'
import {
  printReceiptSchema,
  receiptParamsSchema
} from '../schemas'
import type { Env } from '../../../types/env'

const app = new Hono<{ Bindings: Env }>()

/**
 * 打印收據
 * POST /receipts/print
 */
app.post('/print',
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

      const receiptService = new ReceiptService(c.env.DB as any)
      const result = await receiptService.printReceipt(data, registerId, shiftId)

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
 * POST /receipts/:receiptId/reprint
 */
app.post('/:receiptId/reprint',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(receiptParamsSchema),
  async (c) => {
    try {
      const { receiptId } = c.get('validatedParams')

      const receiptService = new ReceiptService(c.env.DB as any)
      const result = await receiptService.reprintReceipt(receiptId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, result.error === '收據不存在' ? 404 : 400)
      }

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
 * 取消收據打印
 * POST /receipts/:receiptId/cancel
 */
app.post('/:receiptId/cancel',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(receiptParamsSchema),
  async (c) => {
    try {
      const { receiptId } = c.get('validatedParams')

      const receiptService = new ReceiptService(c.env.DB as any)
      const result = await receiptService.cancelPrint(receiptId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        message: '打印已取消'
      })

    } catch (error) {
      console.error('Cancel print error:', error)
      return c.json({
        success: false,
        error: '取消打印失敗'
      }, 500)
    }
  }
)

/**
 * 獲取收據列表
 * GET /registers/:registerId/receipts
 */
app.get('/registers/:registerId/receipts',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(z.object({
    registerId: z.string().uuid()
  })),
  validateQuery(z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    receiptType: z.enum(['customer', 'kitchen', 'merchant']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
  })),
  async (c) => {
    try {
      const { registerId } = c.get('validatedParams')
      const { startDate, endDate, receiptType, page, limit } = c.get('validatedQuery')

      const receiptService = new ReceiptService(c.env.DB as any)
      const result = await receiptService.getReceipts(registerId, {
        startDate,
        endDate,
        receiptType,
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
      console.error('Get receipts error:', error)
      return c.json({
        success: false,
        error: '獲取收據列表失敗'
      }, 500)
    }
  }
)

/**
 * 獲取收據詳情
 * GET /receipts/:receiptId
 */
app.get('/:receiptId',
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(receiptParamsSchema),
  async (c) => {
    try {
      const { receiptId } = c.get('validatedParams')

      const receiptService = new ReceiptService(c.env.DB as any)
      const result = await receiptService.getReceiptDetail(receiptId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, result.error === '收據不存在' ? 404 : 400)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Get receipt detail error:', error)
      return c.json({
        success: false,
        error: '獲取收據詳情失敗'
      }, 500)
    }
  }
)

export default app