import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole, optionalAuth } from '../middleware/auth'
import { validateBody, validateQuery, validateParams } from '../middleware/validation'
import { UnifiedQueueService } from '../features/queue/services/UnifiedQueueService'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const joinQueueSchema = z.object({
  restaurantId: z.number().int().positive(),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().optional(),
  partySize: z.number().int().min(1).max(20),
  specialRequests: z.string().max(500).optional(),
  queueType: z.enum(['walkin', 'online', 'phone']).optional().default('online'),
  tablePreferences: z.array(z.number().int().positive()).optional(),
  notificationMethods: z.array(z.enum(['sms', 'push', 'email'])).optional()
})

const callNextSchema = z.object({
  restaurantId: z.number().int().positive(),
  tableId: z.number().int().positive().optional(),
  specificQueueId: z.string().uuid().optional()
})

const updateQueueSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  maxQueueSize: z.number().int().min(1).max(200).optional(),
  avgServiceTime: z.number().int().min(15).max(480).optional(),
  maxWaitTime: z.number().int().min(30).max(600).optional(),
  minAdvanceNotice: z.number().int().min(1).max(60).optional(),
  notificationMethods: z.array(z.enum(['sms', 'push', 'email', 'call'])).optional(),
  autoCallEnabled: z.boolean().optional(),
  autoCallInterval: z.number().int().min(1).max(60).optional(),
  noShowTimeout: z.number().int().min(5).max(60).optional(),
  queueNumberReset: z.enum(['daily', 'weekly', 'monthly', 'never']).optional()
})

/**
 * 加入候位隊列 (公開端點，不需要認證)
 * POST /api/v1/queue/join
 */
app.post('/join',
  validateBody(joinQueueSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')

      const queueService = new UnifiedQueueService(c.env)
      const result = await queueService.joinQueue(data)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      // 觸發實時更新事件
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/queue-joined`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            restaurantId: data.restaurantId,
            queueId: result.data?.id,
            queueNumber: result.data?.queueNumber,
            customerName: data.customerName,
            partySize: data.partySize
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast queue join:', broadcastError)
      }

      return c.json({
        success: true,
        data: result.data
      })

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
 * 查詢餐廳候位狀態 (公開端點)
 * GET /api/v1/queue/{restaurantId}/status
 */
app.get('/:restaurantId/status',
  validateParams(z.object({ restaurantId: z.string().regex(/^\d+$/).transform(Number) })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')

      const queueService = new UnifiedQueueService(c.env)
      const result = await queueService.getQueueStatus(restaurantId)

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
      console.error('Get queue status error:', error)
      return c.json({
        success: false,
        error: '獲取候位狀態失敗'
      }, 500)
    }
  }
)

/**
 * 查詢個人排隊位置 (公開端點)
 * GET /api/v1/queue/{queueId}/position
 */
app.get('/:queueId/position',
  validateParams(z.object({ queueId: z.string().uuid() })),
  async (c) => {
    try {
      const { queueId: _queueId } = c.get('validatedParams')

      // TODO: getQueuePosition method not implemented in UnifiedQueueService
      // const queueService = new UnifiedQueueService(c.env)
      // const result = await queueService.getQueuePosition(_queueId)

      // Return not implemented error for now
      return c.json({
        success: false,
        error: 'getQueuePosition endpoint is deprecated and not implemented'
      }, 501) // 501 Not Implemented

      // if (!result.success) {
      //   return c.json({
      //     success: false,
      //     error: result.error
      //   }, 404)
      // }
      //
      // return c.json({
      //   success: true,
      //   data: result.data
      // })

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
 * 呼叫下一位客戶 (需要員工權限)
 * POST /api/v1/queue/call-next
 */
app.post('/call-next',
  authMiddleware,
  requireRole([0, 1, 2, 3]), // Admin, Owner, Chef, Service
  validateBody(callNextSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')

      // 權限檢查：店主和員工只能操作自己餐廳的候位
      if (user.role !== 0 && user.restaurantId !== data.restaurantId) {
        return c.json({
          success: false,
          error: '只能操作自己餐廳的候位'
        }, 403)
      }

      const queueService = new UnifiedQueueService(c.env)
      const result = await queueService.callNext(data.restaurantId, data)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      // 觸發實時更新事件
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

      return c.json({
        success: true,
        data: result.data
      })

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
 * 客戶入座 (需要員工權限)
 * POST /api/v1/queue/{queueId}/seat
 */
app.post('/:queueId/seat',
  authMiddleware,
  requireRole([0, 1, 2, 3]), // Admin, Owner, Chef, Service
  validateParams(z.object({ queueId: z.string().uuid() })),
  validateBody(z.object({ tableId: z.number().int().positive() })),
  async (c) => {
    try {
      const { queueId } = c.get('validatedParams')
      const { tableId } = c.get('validatedBody')
      const user = c.get('user')

      const queueService = new UnifiedQueueService(c.env)
      const result = await queueService.seatCustomer(queueId, tableId, user.id)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      // 觸發實時更新事件
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

      return c.json({
        success: true,
        message: '客戶已入座'
      })

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
 * 取消候位 (客戶或員工可操作)
 * POST /api/v1/queue/{queueId}/cancel
 */
app.post('/:queueId/cancel',
  optionalAuth, // 客戶可以不登入取消，員工需要登入
  validateParams(z.object({ queueId: z.string().uuid() })),
  validateBody(z.object({ 
    reason: z.string().max(200).optional(),
    checkInCode: z.string().optional() // 客戶取消時需要提供
  })),
  async (c) => {
    try {
      const { queueId } = c.get('validatedParams')
      const { reason: _reason, checkInCode } = c.get('validatedBody')
      const user = c.get('user') // 可能為 null（客戶未登入）

      // 如果沒有用戶登入，需要驗證取消代碼
      if (!user && !checkInCode) {
        return c.json({
          success: false,
          error: '需要提供取消代碼'
        }, 401)
      }

      if (!user && checkInCode) {
        // 驗證取消代碼
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

      // TODO: cancelQueue method not implemented in UnifiedQueueService
      // const queueService = new UnifiedQueueService(c.env)
      // const result = await queueService.cancelQueue(queueId, user?.id, reason)

      return c.json({
        success: false,
        error: 'cancelQueue endpoint is deprecated and not implemented'
      }, 501) // 501 Not Implemented

      // Unreachable code commented out:
      // if (!result.success) {
      //   return c.json({
      //     success: false,
      //     error: result.error
      //   }, 400)
      // }
      //
      // // 觸發實時更新事件
      // try {
      //   await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/queue-cancelled`, {
      //     method: 'POST',
      //     headers: {
      //       'Content-Type': 'application/json',
      //       'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
      //     },
      //     body: JSON.stringify({
      //       queueId,
      //       reason,
      //       cancelledBy: user?.id || 'customer'
      //     })
      //   })
      // } catch (broadcastError) {
      //   console.warn('Failed to broadcast queue cancellation:', broadcastError)
      // }
      //
      // return c.json({
      //   success: true,
      //   message: '候位已取消'
      // })

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
 * 獲取候位系統設定 (管理員/店主)
 * GET /api/v1/queue/{restaurantId}/settings
 */
app.get('/:restaurantId/settings',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(z.object({ restaurantId: z.string().regex(/^\d+$/).transform(Number) })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const user = c.get('user')

      // 權限檢查
      if (user.role === 1 && user.restaurantId !== restaurantId) {
        return c.json({
          success: false,
          error: '只能查看自己餐廳的設定'
        }, 403)
      }

      // TODO: getQueueSettings method not implemented in UnifiedQueueService
      // const queueService = new UnifiedQueueService(c.env)
      // const result = await queueService.getQueueSettings(restaurantId)

      return c.json({
        success: false,
        error: 'getQueueSettings endpoint is deprecated and not implemented'
      }, 501) // 501 Not Implemented

      // Unreachable code commented out:
      // if (!result.success) {
      //   return c.json({
      //     success: false,
      //     error: result.error
      //   }, 400)
      // }
      //
      // return c.json({
      //   success: true,
      //   data: result.data
      // })

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
 * 更新候位系統設定 (管理員/店主)
 * PUT /api/v1/queue/{restaurantId}/settings
 */
app.put('/:restaurantId/settings',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(z.object({ restaurantId: z.string().regex(/^\d+$/).transform(Number) })),
  validateBody(updateQueueSettingsSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const _updates = c.get('validatedBody')
      const user = c.get('user')

      // 權限檢查
      if (user.role === 1 && user.restaurantId !== restaurantId) {
        return c.json({
          success: false,
          error: '只能修改自己餐廳的設定'
        }, 403)
      }

      // TODO: updateQueueSettings method interface mismatch (returns LegacyQueueSettings not ApiResponse)
      // const queueService = new UnifiedQueueService(c.env)
      // const result = await queueService.updateQueueSettingsLegacy(restaurantId, updates)

      return c.json({
        success: false,
        error: 'updateQueueSettings endpoint is deprecated and not implemented'
      }, 501) // 501 Not Implemented

      // Unreachable code commented out:
      // if (!result.success) {
      //   return c.json({
      //     success: false,
      //     error: result.error
      //   }, 400)
      // }
      //
      // return c.json({
      //   success: true,
      //   message: '設定已更新'
      // })

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
 * 獲取候位統計 (管理員/店主)
 * GET /api/v1/queue/{restaurantId}/stats
 */
app.get('/:restaurantId/stats',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(z.object({ restaurantId: z.string().regex(/^\d+$/).transform(Number) })),
  validateQuery(z.object({
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional()
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { dateFrom, dateTo } = c.get('validatedQuery')
      const user = c.get('user')

      // 權限檢查
      if (user.role === 1 && user.restaurantId !== restaurantId) {
        return c.json({
          success: false,
          error: '只能查看自己餐廳的統計'
        }, 403)
      }

      const _dateRange = dateFrom && dateTo ? {
        from: new Date(dateFrom),
        to: new Date(dateTo)
      } : undefined

      // TODO: getQueueStatistics method not implemented in UnifiedQueueService
      // const queueService = new UnifiedQueueService(c.env)
      // const result = await queueService.getQueueStatistics(restaurantId, _dateRange)

      return c.json({
        success: false,
        error: 'getQueueStatistics endpoint is deprecated and not implemented'
      }, 501) // 501 Not Implemented

      // Unreachable code commented out:
      // if (!result.success) {
      //   return c.json({
      //     success: false,
      //     error: result.error
      //   }, 400)
      // }
      //
      // return c.json({
      //   success: true,
      //   data: result.data
      // })

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
 * 獲取當前候位列表 (員工使用)
 * GET /api/v1/queue/{restaurantId}/current
 */
app.get('/:restaurantId/current',
  authMiddleware,
  requireRole([0, 1, 2, 3]), // Admin, Owner, Chef, Service
  validateParams(z.object({ restaurantId: z.string().regex(/^\d+$/).transform(Number) })),
  validateQuery(z.object({
    status: z.enum(['waiting', 'called', 'notified']).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50')
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { status, limit } = c.get('validatedQuery')
      const user = c.get('user')

      // 權限檢查
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
        statusFilter = ' AND status IN ("waiting", "called", "notified")'
      }

      const currentQueue = await db.prepare(`
        SELECT 
          wq.*,
          ROW_NUMBER() OVER (
            ORDER BY 
              CASE wq.status 
                WHEN 'called' THEN 1
                WHEN 'notified' THEN 2
                WHEN 'waiting' THEN 3
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
      `).bind(...params, limit).all()

      return c.json({
        success: true,
        data: {
          queue: currentQueue.results.map((item: any) => ({
            ...item,
            tablePreferences: JSON.parse(item.table_preferences || '[]'),
            notificationMethods: JSON.parse(item.notification_methods || '[]'),
            metadata: JSON.parse(item.metadata || '{}')
          })),
          totalCount: currentQueue.results.length
        }
      })

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
 * 獲取候位歷史記錄 (管理員/店主)
 * GET /api/v1/queue/{restaurantId}/history
 */
app.get('/:restaurantId/history',
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(z.object({ restaurantId: z.string().regex(/^\d+$/).transform(Number) })),
  validateQuery(z.object({
    status: z.enum(['seated', 'cancelled', 'no_show']).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { status, dateFrom, dateTo, page, limit } = c.get('validatedQuery')
      const offset = (page - 1) * limit
      const user = c.get('user')

      // 權限檢查
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
        filters.push('status IN ("seated", "cancelled", "no_show")')
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

      return c.json({
        success: true,
        data: {
          history: history.results.map((item: any) => ({
            ...item,
            tablePreferences: JSON.parse(item.table_preferences || '[]'),
            notificationMethods: JSON.parse(item.notification_methods || '[]'),
            metadata: JSON.parse(item.metadata || '{}')
          })),
          pagination: {
            page,
            limit,
            hasMore: history.results.length === limit
          }
        }
      })

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
 * 清理過期候位記錄 (系統內部使用)
 * POST /api/v1/queue/cleanup/expired
 */
app.post('/cleanup/expired',
  authMiddleware,
  requireRole([0]), // Admin only
  async (c) => {
    try {
      // TODO: cleanupExpiredQueues method not implemented in UnifiedQueueService
      // const queueService = new UnifiedQueueService(c.env)
      // const result = await queueService.cleanupExpiredQueues()

      return c.json({
        success: false,
        error: 'cleanupExpiredQueues endpoint is deprecated and not implemented'
      }, 501) // 501 Not Implemented

      // return c.json({
      //   success: true,
      //   data: {
      //     cleanedCount: result.cleaned || 0
      //   }
      // })

    } catch (error) {
      console.error('Cleanup expired queues error:', error)
      return c.json({
        success: false,
        error: '清理過期候位記錄失敗'
      }, 500)
    }
  }
)

export default app