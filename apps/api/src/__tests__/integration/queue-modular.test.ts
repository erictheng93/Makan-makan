/**
 * Queue Modular API Integration Tests
 *
 * Comprehensive test suite for the new modular queue system
 * Tests all endpoints, data flow, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { createTestApp, createTestDB, cleanupTestDB } from '../helpers/test-utils'
import { QueueServiceModular } from '@makanmakan/database'
import {
  JoinQueueRequest,
  CallNextRequest,
  QueueStatus,
  QueueType,
  NotificationType,
  validateJoinQueue,
  validateCallNext
} from '@makanmakan/queue-core'

describe('Queue Modular API Integration Tests', () => {
  let app: any
  let db: any
  let queueService: QueueServiceModular
  let testRestaurantId: number
  let testUserId: number
  let authToken: string

  beforeAll(async () => {
    // Setup test environment
    db = await createTestDB()
    app = createTestApp()
    queueService = new QueueServiceModular(db)

    // Create test restaurant and user
    testRestaurantId = 1
    testUserId = 1
    authToken = 'test-auth-token'
  })

  afterAll(async () => {
    await cleanupTestDB(db)
  })

  beforeEach(async () => {
    // Clean queue data before each test
    await db.prepare('DELETE FROM waiting_queue').run()
    await db.prepare('DELETE FROM queue_settings').run()
    await db.prepare('DELETE FROM queue_events').run()
    await db.prepare('DELETE FROM queue_notifications').run()
  })

  describe('Queue Settings Management', () => {
    it('should create default settings for new restaurant', async () => {
      const result = await queueService.getQueueSettings(testRestaurantId)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.restaurantId).toBe(testRestaurantId)
      expect(result.data?.isEnabled).toBe(true)
      expect(result.data?.maxQueueSize).toBe(50)
      expect(result.data?.avgServiceTime).toBe(45)
    })

    it('should return existing settings', async () => {
      // Create settings first
      await queueService.getQueueSettings(testRestaurantId)

      const result = await queueService.getQueueSettings(testRestaurantId)

      expect(result.success).toBe(true)
      expect(result.data?.restaurantId).toBe(testRestaurantId)
    })
  })

  describe('Join Queue Functionality', () => {
    it('should successfully add customer to queue', async () => {
      const joinData: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '測試顧客',
        customerPhone: '012-3456789',
        customerEmail: 'test@example.com',
        partySize: 4,
        specialRequests: '需要兒童座椅',
        queueType: QueueType.ONLINE,
        tablePreferences: [1, 2],
        notificationMethods: [NotificationType.SMS]
      }

      const result = await queueService.joinQueue(joinData)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.queueNumber).toBe(1)
      expect(result.data?.estimatedWaitMinutes).toBeGreaterThan(0)
      expect(result.data?.checkInCode).toBeDefined()
      expect(result.data?.queueId).toBeDefined()
    })

    it('should validate join queue data', () => {
      const validData: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '測試顧客',
        customerPhone: '012-3456789',
        partySize: 2
      }

      expect(() => validateJoinQueue(validData)).not.toThrow()

      const invalidData = {
        restaurantId: 'invalid',
        customerName: '',
        partySize: 0
      }

      expect(() => validateJoinQueue(invalidData as any)).toThrow()
    })

    it('should reject when queue is disabled', async () => {
      // Disable queue
      await db.prepare(`
        INSERT INTO queue_settings (
          restaurant_id, is_enabled, max_queue_size, avg_service_time,
          max_wait_time, min_advance_notice, notification_methods,
          auto_call_enabled, auto_call_interval, no_show_timeout,
          queue_number_reset, priority_rules, table_assignment_rules,
          notification_templates, business_hours, holiday_settings,
          display_settings, integration_settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        testRestaurantId, false, 50, 45, 120, 5, '["sms"]',
        true, 10, 15, 'daily', '{}', '{}', '{}', '{}', '{}', '{}', '{}'
      ).run()

      const joinData: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '測試顧客',
        customerPhone: '012-3456789',
        partySize: 2
      }

      const result = await queueService.joinQueue(joinData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('候位系統目前未開放')
    })

    it('should reject when queue is full', async () => {
      // Set small queue size
      await db.prepare(`
        INSERT INTO queue_settings (
          restaurant_id, is_enabled, max_queue_size, avg_service_time,
          max_wait_time, min_advance_notice, notification_methods,
          auto_call_enabled, auto_call_interval, no_show_timeout,
          queue_number_reset, priority_rules, table_assignment_rules,
          notification_templates, business_hours, holiday_settings,
          display_settings, integration_settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        testRestaurantId, true, 1, 45, 120, 5, '["sms"]',
        true, 10, 15, 'daily', '{}', '{}', '{}', '{}', '{}', '{}', '{}'
      ).run()

      // Add first customer
      const firstJoin: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '第一位顧客',
        customerPhone: '012-1111111',
        partySize: 2
      }
      await queueService.joinQueue(firstJoin)

      // Try to add second customer (should fail)
      const secondJoin: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '第二位顧客',
        customerPhone: '012-2222222',
        partySize: 2
      }

      const result = await queueService.joinQueue(secondJoin)
      expect(result.success).toBe(false)
      expect(result.error).toContain('候位隊列已滿')
    })

    it('should generate incremental queue numbers', async () => {
      const customers = [
        { name: '顧客一', phone: '012-1111111' },
        { name: '顧客二', phone: '012-2222222' },
        { name: '顧客三', phone: '012-3333333' }
      ]

      const results = []
      for (const customer of customers) {
        const joinData: JoinQueueRequest = {
          restaurantId: testRestaurantId,
          customerName: customer.name,
          customerPhone: customer.phone,
          partySize: 2
        }
        const result = await queueService.joinQueue(joinData)
        results.push(result)
      }

      expect(results[0].data?.queueNumber).toBe(1)
      expect(results[1].data?.queueNumber).toBe(2)
      expect(results[2].data?.queueNumber).toBe(3)
    })
  })

  describe('Queue Position Tracking', () => {
    it('should correctly calculate queue position', async () => {
      // Add multiple customers
      const customers = [
        { name: '顧客一', phone: '012-1111111', priority: 0 },
        { name: '顧客二', phone: '012-2222222', priority: 1 }, // VIP
        { name: '顧客三', phone: '012-3333333', priority: 0 }
      ]

      const queueIds = []
      for (const customer of customers) {
        const joinData: JoinQueueRequest = {
          restaurantId: testRestaurantId,
          customerName: customer.name,
          customerPhone: customer.phone,
          partySize: 2
        }
        const result = await queueService.joinQueue(joinData)
        queueIds.push(result.data?.queueId)
      }

      // Check positions (VIP should be first)
      const position1 = await queueService.getQueuePosition(queueIds[0]!)
      const position2 = await queueService.getQueuePosition(queueIds[1]!)
      const position3 = await queueService.getQueuePosition(queueIds[2]!)

      expect(position1.data?.currentPosition).toBe(2) // Regular customer
      expect(position2.data?.currentPosition).toBe(1) // VIP first
      expect(position3.data?.currentPosition).toBe(3) // Last regular customer
    })

    it('should return error for non-existent queue ID', async () => {
      const result = await queueService.getQueuePosition('non-existent-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('找不到排隊記錄')
    })

    it('should handle non-waiting status correctly', async () => {
      // Add and call customer
      const joinData: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '測試顧客',
        customerPhone: '012-3456789',
        partySize: 2
      }
      const joinResult = await queueService.joinQueue(joinData)

      // Call the customer
      const callData: CallNextRequest = {
        restaurantId: testRestaurantId,
        specificQueueId: joinResult.data?.queueId
      }
      await queueService.callNext(callData, testUserId)

      // Check position should be 0 for called customer
      const position = await queueService.getQueuePosition(joinResult.data!.queueId)

      expect(position.success).toBe(true)
      expect(position.data?.currentPosition).toBe(0)
      expect(position.data?.canCancel).toBe(false)
    })
  })

  describe('Call Next Customer', () => {
    it('should call next waiting customer', async () => {
      // Add customers
      const joinData1: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '第一位顧客',
        customerPhone: '012-1111111',
        partySize: 2
      }
      const joinData2: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '第二位顧客',
        customerPhone: '012-2222222',
        partySize: 3
      }

      await queueService.joinQueue(joinData1)
      await queueService.joinQueue(joinData2)

      // Call next customer
      const callData: CallNextRequest = {
        restaurantId: testRestaurantId
      }
      const result = await queueService.callNext(callData, testUserId)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.status).toBe(QueueStatus.CALLED)
      expect(result.data?.customerName).toBe('第一位顧客')
      expect(result.data?.servedBy).toBe(testUserId)
    })

    it('should call specific customer by ID', async () => {
      // Add customers
      const joinData1: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '第一位顧客',
        customerPhone: '012-1111111',
        partySize: 2
      }
      const joinData2: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '第二位顧客',
        customerPhone: '012-2222222',
        partySize: 3
      }

      const result1 = await queueService.joinQueue(joinData1)
      const result2 = await queueService.joinQueue(joinData2)

      // Call specific customer (second one)
      const callData: CallNextRequest = {
        restaurantId: testRestaurantId,
        specificQueueId: result2.data?.queueId
      }
      const callResult = await queueService.callNext(callData, testUserId)

      expect(callResult.success).toBe(true)
      expect(callResult.data?.customerName).toBe('第二位顧客')
      expect(callResult.data?.status).toBe(QueueStatus.CALLED)
    })

    it('should handle no waiting customers', async () => {
      const callData: CallNextRequest = {
        restaurantId: testRestaurantId
      }
      const result = await queueService.callNext(callData, testUserId)

      expect(result.success).toBe(false)
      expect(result.error).toContain('沒有候位客戶')
    })

    it('should validate call next data', () => {
      const validData: CallNextRequest = {
        restaurantId: testRestaurantId,
        tableId: 1
      }

      expect(() => validateCallNext(validData)).not.toThrow()

      const invalidData = {
        restaurantId: 'invalid'
      }

      expect(() => validateCallNext(invalidData as any)).toThrow()
    })

    it('should assign table when provided', async () => {
      // Add customer
      const joinData: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '測試顧客',
        customerPhone: '012-3456789',
        partySize: 2
      }
      await queueService.joinQueue(joinData)

      // Call with table assignment
      const callData: CallNextRequest = {
        restaurantId: testRestaurantId,
        tableId: 5
      }
      const result = await queueService.callNext(callData, testUserId)

      expect(result.success).toBe(true)
      expect(result.data?.assignedTableId).toBe(5)
    })
  })

  describe('Priority Handling', () => {
    it('should prioritize customers correctly', async () => {
      // Add regular customer first
      const regular: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '一般顧客',
        customerPhone: '012-1111111',
        partySize: 2
      }
      const regularResult = await queueService.joinQueue(regular)

      // Add VIP customer (with special requests)
      const vip: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: 'VIP顧客',
        customerPhone: '012-2222222',
        partySize: 8, // Large party gets priority
        specialRequests: '輪椅通道', // Special needs get priority
        queueType: QueueType.PHONE // Phone orders get priority
      }
      const vipResult = await queueService.joinQueue(vip)

      // Call next should get VIP first despite joining later
      const callResult = await queueService.callNext({
        restaurantId: testRestaurantId
      }, testUserId)

      expect(callResult.success).toBe(true)
      expect(callResult.data?.customerName).toBe('VIP顧客')
    })
  })

  describe('API Endpoints', () => {
    it('should handle join queue POST request', async () => {
      const response = await app.request('/api/v1/queue-modular/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          restaurantId: testRestaurantId,
          customerName: '測試顧客',
          customerPhone: '012-3456789',
          partySize: 2
        })
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.queueNumber).toBe(1)
    })

    it('should handle get queue status request', async () => {
      // Add some customers first
      await queueService.joinQueue({
        restaurantId: testRestaurantId,
        customerName: '測試顧客',
        customerPhone: '012-3456789',
        partySize: 2
      })

      const response = await app.request(`/api/v1/queue-modular/${testRestaurantId}/status`)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.queue).toBeDefined()
      expect(data.data.activity).toBeDefined()
      expect(data.data.settings).toBeDefined()
    })

    it('should handle get current queue request', async () => {
      // Add customers
      await queueService.joinQueue({
        restaurantId: testRestaurantId,
        customerName: '測試顧客',
        customerPhone: '012-3456789',
        partySize: 2
      })

      const response = await app.request(`/api/v1/queue-modular/${testRestaurantId}/current`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data.queue)).toBe(true)
      expect(data.data.queue.length).toBe(1)
    })

    it('should handle call next request', async () => {
      // Add customer first
      await queueService.joinQueue({
        restaurantId: testRestaurantId,
        customerName: '測試顧客',
        customerPhone: '012-3456789',
        partySize: 2
      })

      const response = await app.request('/api/v1/queue-modular/call-next', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          restaurantId: testRestaurantId
        })
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.status).toBe(QueueStatus.CALLED)
    })

    it('should handle validation errors', async () => {
      const response = await app.request('/api/v1/queue-modular/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          restaurantId: 'invalid',
          customerName: '',
          partySize: 0
        })
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })
  })

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await app.request('/api/v1/queue-modular/health')

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.service).toBe('queue-modular')
      expect(data.data.status).toBe('healthy')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close database to simulate error
      await db.close()

      const joinData: JoinQueueRequest = {
        restaurantId: testRestaurantId,
        customerName: '測試顧客',
        customerPhone: '012-3456789',
        partySize: 2
      }

      const result = await queueService.joinQueue(joinData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()

      // Recreate database for cleanup
      db = await createTestDB()
    })
  })

  describe('Data Consistency', () => {
    it('should maintain data integrity across operations', async () => {
      // Join queue
      const joinResult = await queueService.joinQueue({
        restaurantId: testRestaurantId,
        customerName: '測試顧客',
        customerPhone: '012-3456789',
        partySize: 2
      })

      expect(joinResult.success).toBe(true)
      const queueId = joinResult.data!.queueId

      // Get position
      const positionResult = await queueService.getQueuePosition(queueId)
      expect(positionResult.success).toBe(true)
      expect(positionResult.data?.queueNumber).toBe(joinResult.data?.queueNumber)

      // Call customer
      const callResult = await queueService.callNext({
        restaurantId: testRestaurantId,
        specificQueueId: queueId
      }, testUserId)

      expect(callResult.success).toBe(true)
      expect(callResult.data?.id).toBe(queueId)
      expect(callResult.data?.status).toBe(QueueStatus.CALLED)

      // Verify position updated
      const updatedPosition = await queueService.getQueuePosition(queueId)
      expect(updatedPosition.data?.status).toBe(QueueStatus.CALLED)
    })
  })
})