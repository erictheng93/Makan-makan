import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { validateBody, validateQuery, validateParams } from '../middleware/validation'
import { GroupOrderService, getCurrentTimestamp } from '@makanmakan/database'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const createGroupOrderSchema = z.object({
  restaurantId: z.number().int().positive(),
  tableId: z.number().int().positive().optional(),
  expirationHours: z.number().min(1).max(168).optional(),
  maxMembers: z.number().min(2).max(20).optional(),
  permissions: z.record(z.any()).optional()
})

const joinGroupSchema = z.object({
  memberName: z.string().min(1).max(50),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional()
})

const addCartItemSchema = z.object({
  memberId: z.string().uuid(),
  menuItemId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  customizations: z.record(z.any()).optional(),
  specialInstructions: z.string().max(200).optional()
})

const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().optional(),
  customizations: z.record(z.any()).optional(),
  specialInstructions: z.string().max(200).optional()
})

const splitBillSchema = z.object({
  splitType: z.enum(['equal', 'proportional', 'individual', 'custom']),
  customSplits: z.array(z.object({
    memberId: z.string().uuid(),
    amount: z.number().positive(),
    items: z.array(z.any())
  })).optional()
})

const processPaymentSchema = z.object({
  paymentMethod: z.string(),
  amount: z.number().positive(),
  transactionId: z.string().optional()
})

/**
 * 創建群組訂單
 * POST /api/v1/orders/group/create
 */
app.post('/create',
  authMiddleware,
  validateBody(createGroupOrderSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      
      const groupOrderService = new GroupOrderService(c.env.DB as any, c.env)
      const result = await groupOrderService.createGroupOrder(data, user.id)
      
      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      // 觸發實時事件（可選）
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/group-created`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            groupOrderId: result.data?.groupOrderId,
            restaurantId: data.restaurantId,
            tableId: data.tableId,
            shareCode: result.data?.shareCode
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast group creation:', broadcastError)
      }

      return c.json({
        success: true,
        data: result.data
      })
      
    } catch (error) {
      console.error('Create group order error:', error)
      return c.json({
        success: false,
        error: '創建群組訂單失敗'
      }, 500)
    }
  }
)

/**
 * 透過分享代碼加入群組
 * POST /api/v1/orders/group/join/{shareCode}
 */
app.post('/join/:shareCode',
  validateParams(z.object({ shareCode: z.string().min(6).max(10) })),
  validateBody(joinGroupSchema),
  async (c) => {
    try {
      const { shareCode } = c.get('validatedParams')
      const joinData = c.get('validatedBody')
      
      const groupOrderService = new GroupOrderService(c.env.DB as any, c.env)
      const result = await groupOrderService.joinGroup(shareCode, joinData)
      
      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      // 觸發實時事件
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/member-joined`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            groupOrderId: result.data?.groupOrder.id,
            memberId: result.data?.memberId,
            memberName: joinData.memberName,
            restaurantId: result.data?.groupOrder.restaurantId
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast member join:', broadcastError)
      }

      return c.json({
        success: true,
        data: result.data
      })
      
    } catch (error) {
      console.error('Join group error:', error)
      return c.json({
        success: false,
        error: '加入群組失敗'
      }, 500)
    }
  }
)

/**
 * 獲取群組訂單資訊
 * GET /api/v1/orders/group/{groupOrderId}
 */
app.get('/:groupOrderId',
  validateParams(z.object({ groupOrderId: z.string().uuid() })),
  async (c) => {
    try {
      const { groupOrderId } = c.get('validatedParams')
      
      const groupOrderService = new GroupOrderService(c.env.DB as any, c.env)
      const result = await groupOrderService.getGroupOrder(groupOrderId)
      
      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 404)
      }

      return c.json({
        success: true,
        data: result.data
      })
      
    } catch (error) {
      console.error('Get group order error:', error)
      return c.json({
        success: false,
        error: '獲取群組資訊失敗'
      }, 500)
    }
  }
)

/**
 * 添加項目到群組購物車
 * POST /api/v1/orders/group/{groupOrderId}/cart
 */
app.post('/:groupOrderId/cart',
  validateParams(z.object({ groupOrderId: z.string().uuid() })),
  validateBody(addCartItemSchema),
  async (c) => {
    try {
      const { groupOrderId } = c.get('validatedParams')
      const itemData = c.get('validatedBody')
      
      const groupOrderService = new GroupOrderService(c.env.DB as any, c.env)
      const result = await groupOrderService.addCartItem(groupOrderId, itemData)
      
      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      // 觸發實時購物車更新
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/cart-updated`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            groupOrderId,
            memberId: itemData.memberId,
            action: 'add',
            item: result.data
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast cart update:', broadcastError)
      }

      return c.json({
        success: true,
        data: result.data
      })
      
    } catch (error) {
      console.error('Add cart item error:', error)
      return c.json({
        success: false,
        error: '添加項目失敗'
      }, 500)
    }
  }
)

/**
 * 更新群組購物車項目
 * PUT /api/v1/orders/group/{groupOrderId}/cart/{itemId}
 */
app.put('/:groupOrderId/cart/:itemId',
  validateParams(z.object({ 
    groupOrderId: z.string().uuid(),
    itemId: z.string().uuid()
  })),
  validateBody(updateCartItemSchema),
  async (c) => {
    try {
      const { groupOrderId, itemId } = c.get('validatedParams')
      const updateData = c.get('validatedBody')
      
      // 更新購物車項目的邏輯
      const db = c.env.DB as any
      
      const item = await db.prepare(
        'SELECT * FROM group_cart_items WHERE id = ? AND group_order_id = ?'
      ).bind(itemId, groupOrderId).first()

      if (!item) {
        return c.json({
          success: false,
          error: '找不到指定項目'
        }, 404)
      }

      // 計算新的總價
      const newTotalPrice = updateData.quantity ? 
        parseFloat(item.unit_price) * updateData.quantity : 
        parseFloat(item.total_price)

      const now = getCurrentTimestamp()
      await db.prepare(`
        UPDATE group_cart_items
        SET quantity = COALESCE(?, quantity),
            total_price = ?,
            customizations = COALESCE(?, customizations),
            special_instructions = COALESCE(?, special_instructions),
            updated_at = ?
        WHERE id = ?
      `).bind(
        updateData.quantity || null,
        newTotalPrice,
        updateData.customizations ? JSON.stringify(updateData.customizations) : null,
        updateData.specialInstructions || null,
        now,
        itemId
      ).run()

      // 觸發實時更新
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/cart-updated`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            groupOrderId,
            action: 'update',
            itemId,
            updates: updateData
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast cart update:', broadcastError)
      }

      return c.json({
        success: true,
        message: '項目已更新'
      })
      
    } catch (error) {
      console.error('Update cart item error:', error)
      return c.json({
        success: false,
        error: '更新項目失敗'
      }, 500)
    }
  }
)

/**
 * 從群組購物車移除項目
 * DELETE /api/v1/orders/group/{groupOrderId}/cart/{itemId}
 */
app.delete('/:groupOrderId/cart/:itemId',
  validateParams(z.object({ 
    groupOrderId: z.string().uuid(),
    itemId: z.string().uuid()
  })),
  async (c) => {
    try {
      const { groupOrderId, itemId } = c.get('validatedParams')
      const db = c.env.DB as any

      // 檢查項目是否存在
      const item = await db.prepare(
        'SELECT member_id FROM group_cart_items WHERE id = ? AND group_order_id = ?'
      ).bind(itemId, groupOrderId).first()

      if (!item) {
        return c.json({
          success: false,
          error: '找不到指定項目'
        }, 404)
      }

      // 標記為已移除
      const removedAt = getCurrentTimestamp()
      await db.prepare(
        'UPDATE group_cart_items SET status = "removed", updated_at = ? WHERE id = ?'
      ).bind(removedAt, itemId).run()

      // 觸發實時更新
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/cart-updated`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            groupOrderId,
            action: 'remove',
            itemId,
            memberId: item.member_id
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast cart update:', broadcastError)
      }

      return c.json({
        success: true,
        message: '項目已移除'
      })
      
    } catch (error) {
      console.error('Remove cart item error:', error)
      return c.json({
        success: false,
        error: '移除項目失敗'
      }, 500)
    }
  }
)

/**
 * 開始分帳流程
 * POST /api/v1/orders/group/{groupOrderId}/split
 */
app.post('/:groupOrderId/split',
  validateParams(z.object({ groupOrderId: z.string().uuid() })),
  validateBody(splitBillSchema),
  async (c) => {
    try {
      const { groupOrderId } = c.get('validatedParams')
      const splitData = c.get('validatedBody')
      
      // 從請求頭或身份驗證中獲取發起者ID
      const memberId = c.req.header('X-Member-Id')
      if (!memberId) {
        return c.json({
          success: false,
          error: '缺少成員身份資訊'
        }, 401)
      }
      
      const groupOrderService = new GroupOrderService(c.env.DB as any, c.env)
      const result = await groupOrderService.initiateSplit(groupOrderId, splitData, memberId)
      
      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      // 觸發分帳開始事件
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/split-initiated`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            groupOrderId,
            splitType: splitData.splitType,
            splitBills: result.data
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast split initiation:', broadcastError)
      }

      return c.json({
        success: true,
        data: result.data
      })
      
    } catch (error) {
      console.error('Initiate split error:', error)
      return c.json({
        success: false,
        error: '開始分帳失敗'
      }, 500)
    }
  }
)

/**
 * 處理個別成員付款
 * POST /api/v1/orders/group/{groupOrderId}/payment/{memberId}
 */
app.post('/:groupOrderId/payment/:memberId',
  validateParams(z.object({ 
    groupOrderId: z.string().uuid(),
    memberId: z.string().uuid()
  })),
  validateBody(processPaymentSchema),
  async (c) => {
    try {
      const { groupOrderId, memberId } = c.get('validatedParams')
      const paymentData = c.get('validatedBody')
      
      const groupOrderService = new GroupOrderService(c.env.DB as any, c.env)
      const result = await groupOrderService.processPayment(groupOrderId, memberId, paymentData)
      
      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      // 觸發付款完成事件
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/payment-completed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            groupOrderId,
            memberId,
            amount: paymentData.amount,
            paymentMethod: paymentData.paymentMethod
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast payment completion:', broadcastError)
      }

      return c.json({
        success: true,
        message: '付款處理成功'
      })
      
    } catch (error) {
      console.error('Process payment error:', error)
      return c.json({
        success: false,
        error: '付款處理失敗'
      }, 500)
    }
  }
)

/**
 * 離開群組
 * POST /api/v1/orders/group/{groupOrderId}/leave/{memberId}
 */
app.post('/:groupOrderId/leave/:memberId',
  validateParams(z.object({ 
    groupOrderId: z.string().uuid(),
    memberId: z.string().uuid()
  })),
  async (c) => {
    try {
      const { groupOrderId, memberId } = c.get('validatedParams')
      
      const groupOrderService = new GroupOrderService(c.env.DB as any, c.env)
      const result = await groupOrderService.leaveGroup(groupOrderId, memberId)
      
      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      // 觸發成員離開事件
      try {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/member-left`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${c.env.INTERNAL_API_TOKEN}`
          },
          body: JSON.stringify({
            groupOrderId,
            memberId
          })
        })
      } catch (broadcastError) {
        console.warn('Failed to broadcast member leave:', broadcastError)
      }

      return c.json({
        success: true,
        message: '已離開群組'
      })
      
    } catch (error) {
      console.error('Leave group error:', error)
      return c.json({
        success: false,
        error: '離開群組失敗'
      }, 500)
    }
  }
)

/**
 * 獲取群組活動日誌
 * GET /api/v1/orders/group/{groupOrderId}/activities
 */
app.get('/:groupOrderId/activities',
  validateParams(z.object({ groupOrderId: z.string().uuid() })),
  validateQuery(z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
  })),
  async (c) => {
    try {
      const { groupOrderId } = c.get('validatedParams')
      const { page, limit } = c.get('validatedQuery')
      const offset = (page - 1) * limit

      const db = c.env.DB as any
      
      const activities = await db.prepare(`
        SELECT gal.*, gm.name as member_name
        FROM group_activity_logs gal
        LEFT JOIN group_members gm ON gal.member_id = gm.id
        WHERE gal.group_order_id = ?
        ORDER BY gal.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(groupOrderId, limit, offset).all()

      return c.json({
        success: true,
        data: {
          activities: activities.results.map((activity: any) => ({
            ...activity,
            metadata: JSON.parse(activity.metadata || '{}')
          })),
          pagination: {
            page,
            limit,
            hasMore: activities.results.length === limit
          }
        }
      })
      
    } catch (error) {
      console.error('Get group activities error:', error)
      return c.json({
        success: false,
        error: '獲取活動記錄失敗'
      }, 500)
    }
  }
)

/**
 * 清理過期群組訂單（系統內部使用）
 * POST /api/v1/orders/group/cleanup/expired
 */
app.post('/cleanup/expired',
  authMiddleware,
  async (c) => {
    try {
      const user = c.get('user')
      
      // 只允許管理員執行
      if (user.role !== 0) {
        return c.json({
          success: false,
          error: '權限不足'
        }, 403)
      }
      
      const groupOrderService = new GroupOrderService(c.env.DB as any, c.env)
      const result = await groupOrderService.cleanupExpiredGroups()
      
      return c.json({
        success: true,
        data: {
          cleanedCount: result.cleaned || 0
        }
      })
      
    } catch (error) {
      console.error('Cleanup expired groups error:', error)
      return c.json({
        success: false,
        error: '清理過期群組失敗'
      }, 500)
    }
  }
)

export default app