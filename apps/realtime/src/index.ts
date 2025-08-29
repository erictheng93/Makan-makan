import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types/env'

// Import Durable Objects
export { RealtimeSession } from './durableObjects/RealtimeSession'

const app = new Hono<{ Bindings: Env }>()

// CORS configuration
app.use('*', cors({
  origin: ['https://customer.makanmakan.com', 'https://admin.makanmakan.com', 'https://kitchen.makanmakan.com'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Upgrade', 'Connection', 'Sec-WebSocket-Key', 'Sec-WebSocket-Version'],
  credentials: true
}))

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'makanmakan-realtime',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development'
  })
})

// WebSocket connection endpoint for customers
app.get('/customer/:tableId', async (c) => {
  const tableId = c.req.param('tableId')
  
  if (!tableId) {
    return c.json({ error: 'Table ID is required' }, 400)
  }

  // Get Durable Object instance
  const id = c.env.REALTIME_SESSION.idFromName(`customer:${tableId}`)
  const durableObject = c.env.REALTIME_SESSION.get(id)

  // Forward the request to the Durable Object
  return durableObject.fetch(c.req.raw)
})

// WebSocket connection endpoint for admin dashboard
app.get('/admin/:restaurantId', async (c) => {
  const restaurantId = c.req.param('restaurantId')
  
  if (!restaurantId) {
    return c.json({ error: 'Restaurant ID is required' }, 400)
  }

  // Get Durable Object instance
  const id = c.env.REALTIME_SESSION.idFromName(`admin:${restaurantId}`)
  const durableObject = c.env.REALTIME_SESSION.get(id)

  return durableObject.fetch(c.req.raw)
})

// WebSocket connection endpoint for kitchen display
app.get('/kitchen/:restaurantId', async (c) => {
  const restaurantId = c.req.param('restaurantId')
  
  if (!restaurantId) {
    return c.json({ error: 'Restaurant ID is required' }, 400)
  }

  // Get Durable Object instance
  const id = c.env.REALTIME_SESSION.idFromName(`kitchen:${restaurantId}`)
  const durableObject = c.env.REALTIME_SESSION.get(id)

  return durableObject.fetch(c.req.raw)
})

// Broadcast message to specific room (used by API server)
app.post('/broadcast/:roomType/:roomId', async (c) => {
  const roomType = c.req.param('roomType') // customer, admin, kitchen
  const roomId = c.req.param('roomId') // tableId or restaurantId
  
  try {
    const body = await c.req.json()
    
    // Get Durable Object instance
    const id = c.env.REALTIME_SESSION.idFromName(`${roomType}:${roomId}`)
    const durableObject = c.env.REALTIME_SESSION.get(id)

    // Send broadcast request to Durable Object
    const response = await durableObject.fetch(new Request('http://localhost/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }))

    return c.json(await response.json())
  } catch (error) {
    console.error('Broadcast error:', error)
    return c.json({ error: 'Failed to broadcast message' }, 500)
  }
})

// Get connection statistics
app.get('/stats/:roomType/:roomId', async (c) => {
  const roomType = c.req.param('roomType')
  const roomId = c.req.param('roomId')
  
  try {
    const id = c.env.REALTIME_SESSION.idFromName(`${roomType}:${roomId}`)
    const durableObject = c.env.REALTIME_SESSION.get(id)

    const response = await durableObject.fetch(new Request('http://localhost/stats', {
      method: 'GET'
    }))

    return c.json(await response.json())
  } catch (error) {
    console.error('Stats error:', error)
    return c.json({ error: 'Failed to get statistics' }, 500)
  }
})

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Realtime endpoint not found',
    path: c.req.path,
    availableEndpoints: [
      '/customer/:tableId',
      '/admin/:restaurantId', 
      '/kitchen/:restaurantId',
      '/broadcast/:roomType/:roomId',
      '/stats/:roomType/:roomId',
      '/health'
    ]
  }, 404)
})

// Error handler
app.onError((error, c) => {
  console.error('Realtime service error:', error)
  return c.json({
    error: 'Internal server error',
    message: c.env.ENVIRONMENT === 'development' ? error.message : 'Something went wrong'
  }, 500)
})

export default {
  fetch: app.fetch
}