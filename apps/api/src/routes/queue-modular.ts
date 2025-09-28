/**
 * Modular Queue Routes
 *
 * This replaces the legacy queue routes with the new modular architecture.
 * Uses the new queue-core types and queue-service implementations.
 */

import { Hono } from 'hono'
import { authMiddleware, requireRole, optionalAuth } from '../middleware/auth'
import { validateBody, validateQuery, validateParams } from '../middleware/validation'
import { QueueServiceModular } from '@makanmakan/database'
import {
  joinQueueSchema,
  callNextSchema,
  updateQueueSettingsSchema,
  seatCustomerSchema,
  cancelQueueSchema,
  getQueueHistorySchema,
  // getQueueStatisticsSchema, // Available for future statistics endpoint
  restaurantIdParamSchema,
  queueIdParamSchema,
  paginationQuerySchema,
  dateRangeQuerySchema,
  QueueStatus,
  ApiResponse
} from '@makanmakan/queue-core'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

/**
 * Join queue endpoint (public, no auth required)
 * POST /api/v1/queue-modular/join
 */
app.post('/join',
  validateBody(joinQueueSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')

      const queueService = new QueueServiceModular(c.env.DB as any)
      const result = await queueService.joinQueue(data)

      if (!result.success) {
        return c.json(result, 400)
      }

      // Trigger real-time update event
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/queue-joined`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            restaurantId: data.restaurantId,
            queueId: result.data?.queueId,
            queueNumber: result.data?.queueNumber,
            customerName: data.customerName,
            partySize: data.partySize
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast queue join:', broadcastError)
      }

      return c.json(result)
    } catch (error) {
      console.error('Join queue error:', error)
      return c.json({
        success: false,
        error: '加入候位失敗'
      }, 500)
    }
  }
)

/**
 * Get restaurant queue status (public)
 * GET /api/v1/queue-modular/{restaurantId}/status
 */
app.get('/:restaurantId/status',
  validateParams(restaurantIdParamSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')

      const queueService = new QueueServiceModular(c.env.DB as any)

      // Get queue statistics and current status
      const [settingsResult] = await Promise.all([
        queueService.getQueueSettings(restaurantId)
      ])

      // Calculate current metrics
      const db = c.env.DB as any
      const currentStats = await db.prepare(`
        SELECT
          COUNT(*) as total_waiting,
          AVG(estimated_wait_minutes) as avg_estimated_wait,
          MIN(estimated_wait_minutes) as min_wait,
          MAX(estimated_wait_minutes) as max_wait,
          COUNT(CASE WHEN queue_type = 'online' THEN 1 END) as online_count,
          COUNT(CASE WHEN queue_type = 'walkin' THEN 1 END) as walkin_count,
          COUNT(CASE WHEN priority > 0 THEN 1 END) as priority_count
        FROM waiting_queue
        WHERE restaurant_id = ?
          AND status = 'waiting'
          AND DATE(joined_at) = DATE('now')
      `).bind(restaurantId).first()

      const dailyActivity = await db.prepare(`
        SELECT
          COUNT(CASE WHEN status = 'seated' THEN 1 END) as seated_today,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_today,
          COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_today,
          AVG(CASE WHEN actual_wait_minutes IS NOT NULL THEN actual_wait_minutes END) as avg_actual_wait
        FROM waiting_queue
        WHERE restaurant_id = ?
          AND DATE(joined_at) = DATE('now')
      `).bind(restaurantId).first()

      const response: ApiResponse<any> = {
        success: true,
        data: {
          queue: currentStats,
          activity: dailyActivity,
          settings: settingsResult.data
        }
      }

      return c.json(response)
    } catch (error) {
      console.error('Get queue status error:', error)
      return c.json({
        success: false,
        error: '獲取候位狀態失敗'
      }, 500)
    }
  }
)

/**
 * Get individual queue position (public)
 * GET /api/v1/queue-modular/{queueId}/position
 */
app.get('/:queueId/position',
  validateParams(queueIdParamSchema),
  async (c) => {
    try {
      const { queueId } = c.get('validatedParams')

      const queueService = new QueueServiceModular(c.env.DB as any)
      const result = await queueService.getQueuePosition(queueId)

      if (!result.success) {
        return c.json(result, 404)
      }

      return c.json(result)
    } catch (error) {
      console.error('Get queue position error:', error)
      return c.json({
        success: false,
        error: '獲取排隊位置失敗'
      }, 500)
    }
  }
)

/**
 * Call next customer (staff only)
 * POST /api/v1/queue-modular/call-next
 */
app.post('/call-next',
  authMiddleware,
  requireRole([0, 1, 2, 3]), // Admin, Owner, Chef, Service
  validateBody(callNextSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')

      // Permission check: staff can only operate their own restaurant's queue
      if (user.role !== 0 && user.restaurantId !== data.restaurantId) {
        return c.json({
          success: false,
          error: '只能操作自己餐廳的候位'
        }, 403)
      }

      const queueService = new QueueServiceModular(c.env.DB as any)
      const result = await queueService.callNext(data, user.id)

      if (!result.success) {
        return c.json(result, 400)
      }

      // Trigger real-time update event
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/queue-called`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            restaurantId: data.restaurantId,
            queueId: result.data?.id,
            queueNumber: result.data?.queueNumber,
            customerName: result.data?.customerName,
            tableId: data.tableId
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast queue call:', broadcastError)
      }

      return c.json(result)
    } catch (error) {
      console.error('Call next error:', error)
      return c.json({
        success: false,
        error: '呼叫下一位失敗'
      }, 500)
    }
  }
)

/**
 * Get current queue for staff
 * GET /api/v1/queue-modular/{restaurantId}/current
 */
app.get('/:restaurantId/current',
  authMiddleware,
  requireRole([0, 1, 2, 3]), // Admin, Owner, Chef, Service
  validateParams(restaurantIdParamSchema),
  validateQuery(paginationQuerySchema.extend({
    status: joinQueueSchema.shape.queueType.optional()
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { status, limit } = c.get('validatedQuery')
      const user = c.get('user')

      // Permission check
      if (user.role !== 0 && user.restaurantId !== restaurantId) {
        return c.json({
          success: false,
          error: '只能查看自己餐廳的候位列表'
        }, 403)
      }

      const db = c.env.DB as any

      let statusFilter = ''
      const params = [restaurantId]

      if (status) {
        statusFilter = ' AND status = ?'
        params.push(status)
      } else {
        statusFilter = ' AND status IN (?, ?, ?)'
        params.push(QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.NOTIFIED)
      }

      const currentQueue = await db.prepare(`
        SELECT
          wq.*,
          ROW_NUMBER() OVER (
            ORDER BY
              CASE wq.status
                WHEN '${QueueStatus.CALLED}' THEN 1
                WHEN '${QueueStatus.NOTIFIED}' THEN 2
                WHEN '${QueueStatus.WAITING}' THEN 3
                ELSE 4
              END,
              wq.priority DESC,
              wq.joined_at ASC
          ) as current_position
        FROM waiting_queue wq
        WHERE wq.restaurant_id = ? ${statusFilter}
          AND DATE(wq.joined_at) = DATE('now')
        ORDER BY current_position
        LIMIT ?
      `).bind(...params, limit || 50).all()

      const response: ApiResponse<any> = {
        success: true,
        data: {
          queue: currentQueue.results.map((item: any) => ({
            id: item.id,
            queue_number: item.queue_number,
            customer_name: item.customer_name,
            customer_phone: item.customer_phone,
            party_size: item.party_size,
            status: item.status,
            joined_at: item.joined_at,
            estimated_wait_minutes: item.estimated_wait_minutes,
            priority: item.priority,
            current_position: item.current_position,
            table_preferences: JSON.parse(item.table_preferences || '[]'),
            notification_methods: JSON.parse(item.notification_methods || '[]'),
            special_requests: item.special_requests,
            metadata: JSON.parse(item.metadata || '{}')
          })),
          totalCount: currentQueue.results.length
        }
      }

      return c.json(response)
    } catch (error) {
      console.error('Get current queue error:', error)
      return c.json({
        success: false,
        error: '獲取候位列表失敗'
      }, 500)
    }
  }
)

/**
 * Get queue settings (admin/owner only)
 * GET /api/v1/queue-modular/{restaurantId}/settings
 */
app.get('/:restaurantId/settings',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(restaurantIdParamSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const user = c.get('user')

      // Permission check
      if (user.role === 1 && user.restaurantId !== restaurantId) {
        return c.json({
          success: false,
          error: '只能查看自己餐廳的設定'
        }, 403)
      }

      const queueService = new QueueServiceModular(c.env.DB as any)
      const result = await queueService.getQueueSettings(restaurantId)

      if (!result.success) {
        return c.json(result, 400)
      }

      return c.json(result)
    } catch (error) {
      console.error('Get queue settings error:', error)
      return c.json({
        success: false,
        error: '獲取候位設定失敗'
      }, 500)
    }
  }
)

/**
 * Performance metrics endpoint
 * GET /api/v1/queue-modular/performance
 */
app.get('/performance',
  authMiddleware,
  requireRole([0]), // Admin only
  async (c) => {
    try {
      const queueService = new QueueServiceModular(c.env.DB as any)
      const metrics = (queueService as any).getPerformanceMetrics()

      return c.json({
        success: true,
        data: metrics
      })
    } catch (error) {
      console.error('Get performance metrics error:', error)
      return c.json({
        success: false,
        error: '獲取性能指標失敗'
      }, 500)
    }
  }
)

/**
 * Batch update queue positions for performance
 * POST /api/v1/queue-modular/{restaurantId}/optimize
 */
app.post('/:restaurantId/optimize',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(restaurantIdParamSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const user = c.get('user')

      // Permission check
      if (user.role === 1 && user.restaurantId !== restaurantId) {
        return c.json({
          success: false,
          error: '只能優化自己餐廳的隊列'
        }, 403)
      }

      const queueService = new QueueServiceModular(c.env.DB as any)
      await (queueService as any).batchUpdateQueuePositions(restaurantId)

      return c.json({
        success: true,
        data: {
          message: '隊列位置已優化更新',
          timestamp: new Date().toISOString()
        }
      })
    } catch (error) {
      console.error('Queue optimization error:', error)
      return c.json({
        success: false,
        error: '隊列優化失敗'
      }, 500)
    }
  }
)

/**
 * Seat customer (staff only)
 * POST /api/v1/queue-modular/{queueId}/seat
 */
app.post('/:queueId/seat',
  authMiddleware,
  requireRole([0, 1, 2, 3]), // Admin, Owner, Chef, Service
  validateParams(queueIdParamSchema),
  validateBody(seatCustomerSchema.omit({ queueId: true, operatorId: true })),
  async (c) => {
    try {
      const { queueId } = c.get('validatedParams')
      const { tableId } = c.get('validatedBody')
      const user = c.get('user')

      const queueService = new QueueServiceModular(c.env.DB as any)
      const result = await (queueService as any).seatCustomer(queueId, tableId, user.id)

      if (!result.success) {
        return c.json(result, 400)
      }

      // Trigger real-time update event
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/customer-seated`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            queueId,
            tableId,
            operatorId: user.id
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast customer seated:', broadcastError)
      }

      return c.json(result)
    } catch (error) {
      console.error('Seat customer error:', error)
      return c.json({
        success: false,
        error: '客戶入座失敗'
      }, 500)
    }
  }
)

/**
 * Cancel queue (customer or staff can operate)
 * POST /api/v1/queue-modular/{queueId}/cancel
 */
app.post('/:queueId/cancel',
  optionalAuth, // Customer can cancel without login, staff need login
  validateParams(queueIdParamSchema),
  validateBody(cancelQueueSchema.omit({ queueId: true, cancelledBy: true })),
  async (c) => {
    try {
      const { queueId } = c.get('validatedParams')
      const { reason, checkInCode } = c.get('validatedBody')
      const user = c.get('user') // May be null (customer not logged in)

      // If no user logged in, need to verify cancellation code
      if (!user && !checkInCode) {
        return c.json({
          success: false,
          error: '需要提供取消代碼'
        }, 401)
      }

      if (!user && checkInCode) {
        // Verify cancellation code
        const db = c.env.DB as any
        const queue = await db.prepare(
          'SELECT id FROM waiting_queue WHERE id = ? AND check_in_code = ? AND status = "waiting"'
        ).bind(queueId, checkInCode).first()

        if (!queue) {
          return c.json({
            success: false,
            error: '無效的取消代碼'
          }, 401)
        }
      }

      const queueService = new QueueServiceModular(c.env.DB as any)
      const result = await (queueService as any).cancelQueue(queueId, user?.id, reason)

      if (!result.success) {
        return c.json(result, 400)
      }

      // Trigger real-time update event
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/queue-cancelled`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            queueId,
            reason,
            cancelledBy: user?.id || 'customer'
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast queue cancellation:', broadcastError)
      }

      return c.json(result)
    } catch (error) {
      console.error('Cancel queue error:', error)
      return c.json({
        success: false,
        error: '取消候位失敗'
      }, 500)
    }
  }
)

/**
 * Update queue settings (admin/owner only)
 * PUT /api/v1/queue-modular/{restaurantId}/settings
 */
app.put('/:restaurantId/settings',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(restaurantIdParamSchema),
  validateBody(updateQueueSettingsSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const updates = c.get('validatedBody')
      const user = c.get('user')

      // Permission check
      if (user.role === 1 && user.restaurantId !== restaurantId) {
        return c.json({
          success: false,
          error: '只能修改自己餐廳的設定'
        }, 403)
      }

      const queueService = new QueueServiceModular(c.env.DB as any)
      const result = await (queueService as any).updateQueueSettings(restaurantId, updates)

      if (!result.success) {
        return c.json(result, 400)
      }

      return c.json(result)
    } catch (error) {
      console.error('Update queue settings error:', error)
      return c.json({
        success: false,
        error: '更新候位設定失敗'
      }, 500)
    }
  }
)

/**
 * Get queue statistics (admin/owner only)
 * GET /api/v1/queue-modular/{restaurantId}/stats
 */
app.get('/:restaurantId/stats',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(restaurantIdParamSchema),
  validateQuery(dateRangeQuerySchema),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { dateFrom, dateTo } = c.get('validatedQuery')
      const user = c.get('user')

      // Permission check
      if (user.role === 1 && user.restaurantId !== restaurantId) {
        return c.json({
          success: false,
          error: '只能查看自己餐廳的統計'
        }, 403)
      }

      const dateRange = dateFrom && dateTo ? {
        from: new Date(dateFrom),
        to: new Date(dateTo)
      } : undefined

      const queueService = new QueueServiceModular(c.env.DB as any)
      const result = await (queueService as any).getQueueStatistics(restaurantId, dateRange)

      if (!result.success) {
        return c.json(result, 400)
      }

      return c.json(result)
    } catch (error) {
      console.error('Get queue statistics error:', error)
      return c.json({
        success: false,
        error: '獲取候位統計失敗'
      }, 500)
    }
  }
)

/**
 * Get queue history (admin/owner only)
 * GET /api/v1/queue-modular/{restaurantId}/history
 */
app.get('/:restaurantId/history',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(restaurantIdParamSchema),
  validateQuery(getQueueHistorySchema.omit({ restaurantId: true })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { status, dateFrom, dateTo, page, limit } = c.get('validatedQuery')
      const offset = (page - 1) * limit
      const user = c.get('user')

      // Permission check
      if (user.role === 1 && user.restaurantId !== restaurantId) {
        return c.json({
          success: false,
          error: '只能查看自己餐廳的歷史記錄'
        }, 403)
      }

      const db = c.env.DB as any

      const filters = ['restaurant_id = ?']
      const params = [restaurantId]

      if (status) {
        filters.push('status = ?')
        params.push(status)
      } else {
        filters.push('status IN (?, ?, ?)')
        params.push(QueueStatus.SEATED, QueueStatus.CANCELLED, QueueStatus.NO_SHOW)
      }

      if (dateFrom) {
        filters.push('joined_at >= ?')
        params.push(dateFrom)
      }

      if (dateTo) {
        filters.push('joined_at <= ?')
        params.push(dateTo)
      }

      const history = await db.prepare(`
        SELECT
          wq.*,
          u.full_name as served_by_name
        FROM waiting_queue wq
        LEFT JOIN users u ON wq.served_by = u.id
        WHERE ${filters.join(' AND ')}
        ORDER BY wq.joined_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all()

      const response: ApiResponse<any> = {
        success: true,
        data: {
          history: history.results.map((item: any) => ({
            id: item.id,
            queue_number: item.queue_number,
            customer_name: item.customer_name,
            customer_phone: item.customer_phone,
            customer_email: item.customer_email,
            party_size: item.party_size,
            status: item.status,
            joined_at: item.joined_at,
            called_at: item.called_at,
            seated_at: item.seated_at,
            cancelled_at: item.cancelled_at,
            actual_wait_minutes: item.actual_wait_minutes,
            served_by: item.served_by,
            served_by_name: item.served_by_name,
            table_preferences: JSON.parse(item.table_preferences || '[]'),
            notification_methods: JSON.parse(item.notification_methods || '[]'),
            special_requests: item.special_requests,
            metadata: JSON.parse(item.metadata || '{}')
          })),
          pagination: {
            page,
            limit,
            hasMore: history.results.length === limit
          }
        }
      }

      return c.json(response)
    } catch (error) {
      console.error('Get queue history error:', error)
      return c.json({
        success: false,
        error: '獲取候位歷史失敗'
      }, 500)
    }
  }
)

/**
 * Cleanup expired queue records (admin only)
 * POST /api/v1/queue-modular/cleanup/expired
 */
app.post('/cleanup/expired',
  authMiddleware,
  requireRole([0]), // Admin only
  async (c) => {
    try {
      const queueService = new QueueServiceModular(c.env.DB as any)
      const result = await (queueService as any).cleanupExpiredQueues()

      return c.json({
        success: true,
        data: {
          cleanedCount: result.cleaned || 0
        }
      })
    } catch (error) {
      console.error('Cleanup expired queues error:', error)
      return c.json({
        success: false,
        error: '清理過期候位記錄失敗'
      }, 500)
    }
  }
)

/**
 * Health check for modular queue system
 * GET /api/v1/queue-modular/health
 */
app.get('/health', async (c) => {
  return c.json({
    success: true,
    data: {
      service: 'queue-modular',
      version: '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  })
})

export default app