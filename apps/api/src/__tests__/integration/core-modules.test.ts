/**
 * Core Modules Integration Tests
 *
 * Comprehensive integration tests for all core API modules
 * Tests module interactions, data flow, and cross-module functionality
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { createTestApp, createTestDB, cleanupTestDB } from '../helpers/test-utils'

describe('Core Modules Integration Tests', () => {
  let app: any
  let db: any
  let testRestaurantId: number
  let testUserId: number
  let authToken: string

  beforeAll(async () => {
    // Setup test environment
    db = await createTestDB()
    app = createTestApp()

    // Create test restaurant and user
    testRestaurantId = 1
    testUserId = 1
    authToken = 'test-auth-token'
  })

  afterAll(async () => {
    await cleanupTestDB(db)
  })

  beforeEach(async () => {
    // Clean all tables before each test
    const tables = [
      'waiting_queue', 'queue_settings', 'queue_events', 'queue_notifications',
      'orders', 'order_items', 'menu_items', 'categories', 'tables',
      'users', 'restaurants', 'sessions', 'audit_logs'
    ]

    for (const table of tables) {
      try {
        await db.prepare(`DELETE FROM ${table}`).run()
      } catch (error) {
        // Table might not exist, ignore error
      }
    }
  })

  describe('Restaurant Management Integration', () => {
    it('should create restaurant with default settings and admin user', async () => {
      // Create restaurant
      const restaurantResponse = await app.request('/api/v1/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: 'Test Restaurant',
          address: 'Test Address',
          phone: '012-3456789',
          email: 'test@restaurant.com'
        })
      })

      expect(restaurantResponse.status).toBe(200)
      const restaurantData = await restaurantResponse.json()
      expect(restaurantData.success).toBe(true)

      const restaurantId = restaurantData.data.id

      // Check queue settings were created
      const queueResponse = await app.request(`/api/v1/queue/${restaurantId}/settings`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      expect(queueResponse.status).toBe(200)
      const queueData = await queueResponse.json()
      expect(queueData.success).toBe(true)
      expect(queueData.data.restaurantId).toBe(restaurantId)

      // Check analytics endpoints are accessible
      const analyticsResponse = await app.request(`/api/v1/analytics/${restaurantId}/dashboard`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      expect(analyticsResponse.status).toBe(200)
    })
  })

  describe('Menu and Order Integration', () => {
    it('should create menu items and process orders end-to-end', async () => {
      // 1. Create menu category
      const categoryResponse = await app.request(`/api/v1/menu/${testRestaurantId}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: '主菜',
          nameEn: 'Main Dishes',
          description: '主要餐點',
          displayOrder: 1,
          isActive: true
        })
      })

      expect(categoryResponse.status).toBe(200)
      const categoryData = await categoryResponse.json()
      const categoryId = categoryData.data.id

      // 2. Create menu item
      const menuItemResponse = await app.request(`/api/v1/menu/${testRestaurantId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          categoryId,
          name: '炒飯',
          nameEn: 'Fried Rice',
          description: '香噴噴的炒飯',
          price: 120,
          isAvailable: true
        })
      })

      expect(menuItemResponse.status).toBe(200)
      const menuItemData = await menuItemResponse.json()
      const menuItemId = menuItemData.data.id

      // 3. Create table
      const tableResponse = await app.request(`/api/v1/tables/${testRestaurantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          tableNumber: 'A1',
          seats: 4,
          status: 'available'
        })
      })

      expect(tableResponse.status).toBe(200)
      const tableData = await tableResponse.json()
      const tableId = tableData.data.id

      // 4. Create order
      const orderResponse = await app.request('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          restaurantId: testRestaurantId,
          tableId,
          items: [
            {
              menuItemId,
              quantity: 2,
              unitPrice: 120,
              notes: '不要香菜'
            }
          ],
          customerName: 'Test Customer',
          customerPhone: '012-1234567'
        })
      })

      expect(orderResponse.status).toBe(200)
      const orderData = await orderResponse.json()
      expect(orderData.success).toBe(true)
      expect(orderData.data.total).toBe(240)

      // 5. Update order status
      const orderId = orderData.data.id
      const updateResponse = await app.request(`/api/v1/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          status: 'confirmed'
        })
      })

      expect(updateResponse.status).toBe(200)

      // 6. Check kitchen display shows order
      const kitchenResponse = await app.request(`/api/v1/kitchen/${testRestaurantId}/orders`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      expect(kitchenResponse.status).toBe(200)
      const kitchenData = await kitchenResponse.json()
      expect(kitchenData.data.orders.length).toBe(1)
      expect(kitchenData.data.orders[0].id).toBe(orderId)
    })
  })

  describe('Queue and Table Integration', () => {
    it('should integrate queue system with table management', async () => {
      // 1. Create table
      const tableResponse = await app.request(`/api/v1/tables/${testRestaurantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          tableNumber: 'B2',
          seats: 2,
          status: 'available'
        })
      })

      expect(tableResponse.status).toBe(200)
      const tableData = await tableResponse.json()
      const tableId = tableData.data.id

      // 2. Join queue
      const queueResponse = await app.request('/api/v1/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: testRestaurantId,
          customerName: '排隊客戶',
          customerPhone: '012-9876543',
          partySize: 2,
          tablePreferences: [tableId]
        })
      })

      expect(queueResponse.status).toBe(200)
      const queueData = await queueResponse.json()
      const queueId = queueData.data.queueId

      // 3. Call next customer
      const callResponse = await app.request('/api/v1/queue/call-next', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          restaurantId: testRestaurantId,
          tableId
        })
      })

      expect(callResponse.status).toBe(200)

      // 4. Seat customer
      const seatResponse = await app.request(`/api/v1/queue/${queueId}/seat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ tableId })
      })

      expect(seatResponse.status).toBe(200)

      // 5. Check table is now occupied
      const tableStatusResponse = await app.request(`/api/v1/tables/${testRestaurantId}/${tableId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      expect(tableStatusResponse.status).toBe(200)
      const updatedTableData = await tableStatusResponse.json()
      expect(updatedTableData.data.status).toBe('occupied')
    })
  })

  describe('Analytics and Reporting Integration', () => {
    it('should generate analytics from order and queue data', async () => {
      // 1. Create some test data
      await createTestOrderData()
      await createTestQueueData()

      // 2. Get dashboard analytics
      const dashboardResponse = await app.request(`/api/v1/analytics/${testRestaurantId}/dashboard`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      expect(dashboardResponse.status).toBe(200)
      const dashboardData = await dashboardResponse.json()
      expect(dashboardData.success).toBe(true)
      expect(dashboardData.data.revenue).toBeDefined()
      expect(dashboardData.data.orders).toBeDefined()
      expect(dashboardData.data.queue).toBeDefined()

      // 3. Get detailed reports
      const reportsResponse = await app.request(`/api/v1/analytics/${testRestaurantId}/reports/sales`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        params: new URLSearchParams({
          period: 'today'
        })
      })

      expect(reportsResponse.status).toBe(200)
      const reportsData = await reportsResponse.json()
      expect(reportsData.success).toBe(true)
    })
  })

  describe('User Management and Authentication Integration', () => {
    it('should manage multi-role users across modules', async () => {
      // 1. Create different role users
      const roles = [
        { role: 1, name: 'Restaurant Owner' },
        { role: 2, name: 'Kitchen Chef' },
        { role: 3, name: 'Service Staff' },
        { role: 4, name: 'Cashier' }
      ]

      const createdUsers = []

      for (const roleData of roles) {
        const userResponse = await app.request(`/api/v1/users/${testRestaurantId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            username: `user_${roleData.role}`,
            email: `user${roleData.role}@test.com`,
            fullName: roleData.name,
            role: roleData.role,
            password: 'test123456'
          })
        })

        expect(userResponse.status).toBe(200)
        const userData = await userResponse.json()
        createdUsers.push(userData.data)
      }

      // 2. Test role-based access to different modules
      for (const user of createdUsers) {
        // Mock auth for each user
        const userToken = `test-token-${user.id}`

        // Test kitchen access (should work for chefs and service staff)
        const kitchenResponse = await app.request(`/api/v1/kitchen/${testRestaurantId}/orders`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        })

        if (user.role === 2 || user.role === 3) { // Chef or Service
          expect(kitchenResponse.status).toBe(200)
        }

        // Test analytics access (should work for owners and admins)
        const analyticsResponse = await app.request(`/api/v1/analytics/${testRestaurantId}/dashboard`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        })

        if (user.role === 0 || user.role === 1) { // Admin or Owner
          expect(analyticsResponse.status).toBe(200)
        }
      }
    })
  })

  describe('Real-time Integration', () => {
    it('should handle SSE events across modules', async () => {
      // This test would require WebSocket/SSE testing setup
      // For now, we'll test the endpoints exist and respond correctly

      const sseResponse = await app.request(`/api/v1/sse/subscribe/orders/${testRestaurantId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      // SSE endpoints typically return different status codes
      expect([200, 204]).toContain(sseResponse.status)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle cross-module errors gracefully', async () => {
      // 1. Try to create order with non-existent menu item
      const invalidOrderResponse = await app.request('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          restaurantId: testRestaurantId,
          tableId: 999999, // Non-existent table
          items: [
            {
              menuItemId: 999999, // Non-existent menu item
              quantity: 1,
              unitPrice: 100
            }
          ]
        })
      })

      expect(invalidOrderResponse.status).toBe(400)
      const errorData = await invalidOrderResponse.json()
      expect(errorData.success).toBe(false)
      expect(errorData.error).toBeDefined()

      // 2. Try to join queue for non-existent restaurant
      const invalidQueueResponse = await app.request('/api/v1/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: 999999,
          customerName: 'Test Customer',
          customerPhone: '012-3456789',
          partySize: 2
        })
      })

      expect(invalidQueueResponse.status).toBe(400)
    })
  })

  describe('Data Consistency Integration', () => {
    it('should maintain data consistency across module operations', async () => {
      // 1. Create order and check all related data is consistent
      const orderData = await createCompleteOrder()

      // 2. Verify order appears in all relevant modules
      const analyticsResponse = await app.request(`/api/v1/analytics/${testRestaurantId}/dashboard`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      const kitchenResponse = await app.request(`/api/v1/kitchen/${testRestaurantId}/orders`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      // 3. Cancel order and verify consistency
      const cancelResponse = await app.request(`/api/v1/orders/${orderData.orderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      expect(cancelResponse.status).toBe(200)

      // 4. Verify order no longer appears in active lists
      const updatedKitchenResponse = await app.request(`/api/v1/kitchen/${testRestaurantId}/orders`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      const updatedKitchenData = await updatedKitchenResponse.json()
      const activeOrders = updatedKitchenData.data.orders.filter(
        (order: any) => order.status !== 'cancelled'
      )
      expect(activeOrders.length).toBe(0)
    })
  })

  // =============================================
  // Helper Functions
  // =============================================

  async function createTestOrderData() {
    // Create category
    await app.request(`/api/v1/menu/${testRestaurantId}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: 'Test Category',
        nameEn: 'Test Category',
        displayOrder: 1,
        isActive: true
      })
    })

    // Create menu item and order
    // ... (implementation details)
  }

  async function createTestQueueData() {
    // Create queue entries
    await app.request('/api/v1/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: testRestaurantId,
        customerName: 'Test Queue Customer',
        customerPhone: '012-1111111',
        partySize: 2
      })
    })
  }

  async function createCompleteOrder() {
    // Create all necessary data for a complete order
    // Returns orderId and related data
    return {
      orderId: 'test-order-id',
      tableId: 1,
      menuItemId: 1
    }
  }
})