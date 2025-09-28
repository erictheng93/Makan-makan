/**
 * SSE Routes
 * Real-time event streaming endpoints
 */

import { Hono } from 'hono'
import { authMiddleware } from '../../../middleware/auth'
import { SSEController } from '../controllers/SSEController'
import type { Env } from '../../../types/env'

const app = new Hono<{ Bindings: Env }>()

// Create controller instance for each request
function createController(c: any) {
  return new SSEController(c.env)
}

/**
 * SSE connection endpoint - Restaurant event stream
 * GET /api/v1/sse/events
 */
app.get('/events', authMiddleware, async (c) => {
  const controller = createController(c)
  return await controller.connect(c)
})

/**
 * Test broadcast endpoint
 * POST /api/v1/sse/test
 */
app.post('/test', authMiddleware, async (c) => {
  const controller = createController(c)
  return await controller.broadcastTest(c)
})

/**
 * Connection status endpoint
 * GET /api/v1/sse/connections
 */
app.get('/connections', authMiddleware, async (c) => {
  const controller = createController(c)
  return await controller.getConnections(c)
})

/**
 * Broadcast order update event
 * POST /api/v1/sse/broadcast/order-update
 */
app.post('/broadcast/order-update', authMiddleware, async (c) => {
  const controller = createController(c)
  return await controller.broadcastOrderUpdate(c)
})

/**
 * Broadcast menu update event
 * POST /api/v1/sse/broadcast/menu-update
 */
app.post('/broadcast/menu-update', authMiddleware, async (c) => {
  const controller = createController(c)
  return await controller.broadcastMenuUpdate(c)
})

/**
 * Broadcast system notification
 * POST /api/v1/sse/broadcast/system-notification
 */
app.post('/broadcast/system-notification', authMiddleware, async (c) => {
  const controller = createController(c)
  return await controller.broadcastSystemNotification(c)
})

/**
 * GROUP ORDERS - Broadcast group order created
 * POST /api/v1/sse/broadcast/group-created
 */
app.post('/broadcast/group-created', async (c) => {
  const controller = createController(c)
  return await controller.broadcastGroupCreated(c)
})

/**
 * GROUP ORDERS - Broadcast member joined
 * POST /api/v1/sse/broadcast/member-joined
 */
app.post('/broadcast/member-joined', async (c) => {
  const controller = createController(c)
  return await controller.broadcastMemberJoined(c)
})

/**
 * GROUP ORDERS - Broadcast cart updated
 * POST /api/v1/sse/broadcast/cart-updated
 */
app.post('/broadcast/cart-updated', async (c) => {
  const controller = createController(c)
  return await controller.broadcastCartUpdated(c)
})

export const sseRoutes = app
export default app