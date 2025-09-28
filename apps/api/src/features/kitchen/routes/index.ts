/**
 * Kitchen Feature Routes
 * Modular routes for kitchen operations and SSE events
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { authMiddleware } from '../../../middleware/auth'
// import { validateBody, validateParams } from '../../../shared/middleware/validation'
import type { Env } from '../../../types/env'
import { KitchenService } from '../services/KitchenService'
// Schemas available for future validation if needed
// import {
//   orderItemStatusUpdateSchema,
//   broadcastTestEventSchema,
//   restaurantIdSchema,
//   orderItemParamsSchema
// } from '../schemas/validation'
import { createSuccessResponse, createErrorResponse } from '../../../shared/utils/response'

const app = new Hono<{ Bindings: Env }>()

/**
 * SSE 端點 - 廚房事件流
 * GET /api/v1/kitchen/{restaurantId}/events
 */
app.get('/:restaurantId/events', authMiddleware, async (c) => {
    const restaurantId = parseInt(c.req.param('restaurantId'))
    const user = c.get('user')
    const kitchenService = new KitchenService(c.env)

    // Validate chef access
    if (!kitchenService.validateChefAccess(user.id, user.role, restaurantId)) {
      return c.json(createErrorResponse('Access denied. Chef role required.', 403), 403)
    }

    // Validate restaurant permission
    if (user.restaurantId !== restaurantId) {
      return c.json(createErrorResponse('Access denied. Restaurant permission required.', 403), 403)
    }

    console.log(`Kitchen SSE connection requested for restaurant ${restaurantId} by user ${user.id}`)

    return streamSSE(c, async (stream) => {
      const connectionId = kitchenService.generateConnectionId()

      // Register connection
      kitchenService.registerConnection(connectionId, {
        restaurantId,
        userId: user.id,
        controller: stream,
        lastHeartbeat: Date.now()
      })

      console.log(`Kitchen SSE connection established: ${connectionId}`)

      // Send initial connection confirmation
      await stream.writeSSE({
        event: 'connected',
        data: JSON.stringify({
          type: 'HEARTBEAT',
          connectionId,
          timestamp: new Date().toISOString(),
          restaurantId,
          message: 'Kitchen display connected successfully'
        }),
        id: `heartbeat_${Date.now()}`
      })

      // Setup heartbeat interval
      const heartbeatInterval = setInterval(async () => {
        try {
          await stream.writeSSE({
            event: 'heartbeat',
            data: JSON.stringify({
              type: 'HEARTBEAT',
              timestamp: new Date().toISOString(),
              restaurantId,
              connectionCount: kitchenService.getConnectionStatus(restaurantId).restaurantConnections
            }),
            id: `heartbeat_${Date.now()}`
          })

          // Update heartbeat timestamp
          const connection = kitchenService.getConnectionStatus(restaurantId).connections
            .find(conn => conn.id === connectionId)
          if (connection) {
            // Update lastHeartbeat in service if needed
          }
        } catch (error) {
          console.error(`Heartbeat failed for connection ${connectionId}:`, error)
          clearInterval(heartbeatInterval)
          kitchenService.removeConnection(connectionId)
        }
      }, 30000) // 30 second heartbeat

      // Listen for connection close
      c.req.raw.signal?.addEventListener('abort', () => {
        console.log(`Kitchen SSE connection closed: ${connectionId}`)
        clearInterval(heartbeatInterval)
        kitchenService.removeConnection(connectionId)
      })

      // Keep connection open
      return new Promise(() => {
        // This Promise never resolves, keeping SSE connection open
        // Connection will be cleaned up when client disconnects or heartbeat fails
      })
    })
  }
)

/**
 * 獲取廚房訂單資料
 * GET /api/v1/kitchen/{restaurantId}/orders
 */
app.get('/:restaurantId/orders', authMiddleware, async (c) => {
    const restaurantId = parseInt(c.req.param('restaurantId'))
    const user = c.get('user')
    const kitchenService = new KitchenService(c.env)

    // Validate permissions
    if (!kitchenService.validateChefAccess(user.id, user.role, restaurantId) || user.restaurantId !== restaurantId) {
      return c.json(createErrorResponse('Access denied', 403), 403)
    }

    try {
      const data = await kitchenService.getKitchenOrders(restaurantId, user.id)

      return c.json(createSuccessResponse(data, 'Kitchen orders retrieved successfully'))
    } catch (error: any) {
      console.error('Failed to fetch kitchen orders:', error)
      return c.json(createErrorResponse('Failed to fetch orders', 500), 500)
    }
  }
)

/**
 * 更新訂單項目狀態
 * PUT /api/v1/kitchen/{restaurantId}/orders/{orderId}/items/{itemId}
 */
app.put('/:restaurantId/orders/:orderId/items/:itemId', authMiddleware, async (c) => {
    const restaurantId = parseInt(c.req.param('restaurantId'))
    const orderId = parseInt(c.req.param('orderId'))
    const itemId = parseInt(c.req.param('itemId'))
    const statusUpdate = await c.req.json()
    const user = c.get('user')
    const kitchenService = new KitchenService(c.env)

    // Validate permissions
    if (!kitchenService.validateChefAccess(user.id, user.role, restaurantId) || user.restaurantId !== restaurantId) {
      return c.json(createErrorResponse('Access denied', 403), 403)
    }

    try {
      const result = await kitchenService.updateOrderItemStatus(
        restaurantId,
        orderId,
        itemId,
        statusUpdate,
        user.id
      )

      return c.json(createSuccessResponse(result, 'Order item status updated successfully'))
    } catch (error: any) {
      console.error('Failed to update order item status:', error)
      return c.json(createErrorResponse('Failed to update order status', 500), 500)
    }
  }
)

/**
 * 廣播測試端點 (開發用)
 * POST /api/v1/kitchen/{restaurantId}/broadcast-test
 */
app.post('/:restaurantId/broadcast-test', authMiddleware, async (c) => {
    // Only allow in non-production environments
    if (c.env.NODE_ENV === 'production') {
      return c.json(createErrorResponse('Test endpoint not available in production', 404), 404)
    }

    const restaurantId = parseInt(c.req.param('restaurantId'))
    const testEvent = await c.req.json()
    const kitchenService = new KitchenService(c.env)

    const sentCount = kitchenService.broadcastTestEvent(restaurantId, testEvent)

    return c.json(createSuccessResponse({
      message: `Test event broadcasted to ${sentCount} connections`,
      sentCount,
      event: testEvent
    }, 'Test broadcast sent successfully'))
  }
)

/**
 * 獲取連接狀態
 * GET /api/v1/kitchen/{restaurantId}/connections
 */
app.get('/:restaurantId/connections', authMiddleware, async (c) => {
    const restaurantId = parseInt(c.req.param('restaurantId'))
    const user = c.get('user')
    const kitchenService = new KitchenService(c.env)

    // Only admin and same restaurant chef can view
    if (user.role !== 0 && (!kitchenService.validateChefAccess(user.id, user.role, restaurantId) || user.restaurantId !== restaurantId)) {
      return c.json(createErrorResponse('Access denied', 403), 403)
    }

    const connectionStatus = kitchenService.getConnectionStatus(restaurantId)

    return c.json(createSuccessResponse(connectionStatus, 'Connection status retrieved successfully'))
  }
)

export default app