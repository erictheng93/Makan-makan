/**
 * Group Orders Feature Tests
 * Comprehensive test suite for group orders functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GroupOrdersService } from '../services/GroupOrdersService'
import { groupOrderSchemas } from '../schemas/validation'
import type { CreateGroupOrderRequest, JoinGroupRequest } from '../types'

describe('Group Orders Feature', () => {
  let groupOrderService: GroupOrdersService
  let mockDB: any
  let mockKV: any

  beforeEach(() => {
    // Mock database
    mockDB = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          run: async () => ({ success: true, meta: { last_row_id: 1 } }),
          first: async () => ({}),
          all: async () => ({ results: [] })
        }),
        run: async () => ({ success: true }),
        first: async () => ({}),
        all: async () => ({ results: [] })
      })
    }

    // Mock KV store
    mockKV = {
      get: async () => null,
      put: async () => {},
      delete: async () => {}
    }

    groupOrderService = new GroupOrdersService(mockDB, mockKV, 'info')
  })

  describe('Group Order Creation', () => {
    it('should create a group order successfully', async () => {
      const createData: CreateGroupOrderRequest = {
        restaurantId: '1',
        tableId: 5,
        expirationHours: 24,
        maxMembers: 8,
        permissions: {
          canInviteMembers: true,
          canModifyOthersCart: false,
          canFinalizeOrder: true,
          canSplitBill: true,
          canProcessPayment: true
        }
      }

      const result = await groupOrderService.createGroupOrder(createData, 1)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.shareCode).toBeDefined()
      expect(result.data?.groupOrderId).toBeDefined()
    })

    it('should validate required fields', () => {
      const invalidData = {
        // Missing restaurantId
        tableId: 5
      }

      const result = groupOrderSchemas.createGroupOrder.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should validate expiration hours range', () => {
      const invalidData = {
        restaurantId: '1',
        expirationHours: 200 // Too long
      }

      const result = groupOrderSchemas.createGroupOrder.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('Group Joining', () => {
    it('should allow members to join with valid share code', async () => {
      const shareCode = 'ABC12345'
      const memberData: JoinGroupRequest = {
        memberName: 'John Doe',
        phone: '123-456-7890',
        email: 'john@example.com'
      }

      // Mock existing group order
      mockDB.prepare = (sql: string) => ({
        bind: (...params: any[]) => ({
          first: async () => {
            // Return different responses based on query type
            if (sql.includes('COUNT(*)')) {
              return { count: 1 } // Member count
            } else if (sql.includes('group_members') && sql.includes('name')) {
              return null // No existing member with same name
            } else if (sql.includes('group_orders')) {
              return {
                id: 'group-001',
                restaurant_id: 1,
                status: 'active',
                expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // Unix timestamp
                settings: JSON.stringify({ maxMembers: 8, permissions: {} })
              }
            } else if (sql.includes('group_members') && sql.includes('WHERE id')) {
              return {
                id: 'member-001',
                group_order_id: 'group-001',
                session_id: 'session-001',
                name: 'John Doe',
                phone: '123-456-7890',
                email: 'john@example.com',
                role: 'member',
                joined_at: Math.floor(Date.now() / 1000),
                last_active_at: Math.floor(Date.now() / 1000),
                is_active: 1,
                left_at: null
              }
            }
            return {}
          },
          all: async () => ({ results: [] }),
          run: async () => ({ success: true })
        })
      })

      const result = await groupOrderService.joinGroup(shareCode, memberData)
      expect(result.success).toBe(true)
    })

    it('should validate member name requirements', () => {
      const invalidData = {
        memberName: '', // Empty name
        phone: '123-456-7890'
      }

      const result = groupOrderSchemas.joinGroup.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should validate email format', () => {
      const invalidData = {
        memberName: 'John Doe',
        email: 'invalid-email' // Invalid format
      }

      const result = groupOrderSchemas.joinGroup.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('Cart Management', () => {
    it('should validate cart item data', () => {
      const validData = {
        memberId: '123e4567-e89b-12d3-a456-426614174000',
        menuItemId: 1,
        quantity: 2,
        customizations: { size: 'large' },
        specialInstructions: 'No onions'
      }

      const result = groupOrderSchemas.addCartItem.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject invalid member ID format', () => {
      const invalidData = {
        memberId: 'invalid-uuid',
        menuItemId: 1,
        quantity: 2
      }

      const result = groupOrderSchemas.addCartItem.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should validate quantity limits', () => {
      const invalidData = {
        memberId: '123e4567-e89b-12d3-a456-426614174000',
        menuItemId: 1,
        quantity: 0 // Invalid quantity
      }

      const result = groupOrderSchemas.addCartItem.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('Bill Splitting', () => {
    it('should validate split bill data', () => {
      const validData = {
        splitType: 'equal' as const
      }

      const result = groupOrderSchemas.splitBill.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require custom splits for custom split type', () => {
      const invalidData = {
        splitType: 'custom' as const
        // Missing customSplits
      }

      const result = groupOrderSchemas.splitBill.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should validate custom split amounts', () => {
      const validData = {
        splitType: 'custom' as const,
        customSplits: [{
          memberId: '123e4567-e89b-12d3-a456-426614174000',
          amount: 25.50,
          items: []
        }]
      }

      const result = groupOrderSchemas.splitBill.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })

  describe('Payment Processing', () => {
    it('should validate payment data', () => {
      const validData = {
        paymentMethod: 'credit_card',
        amount: 29.99,
        transactionId: 'txn_123456'
      }

      const result = groupOrderSchemas.processPayment.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject negative payment amounts', () => {
      const invalidData = {
        paymentMethod: 'credit_card',
        amount: -10.00 // Negative amount
      }

      const result = groupOrderSchemas.processPayment.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should validate payment amount limits', () => {
      const invalidData = {
        paymentMethod: 'credit_card',
        amount: 100000.00 // Too large
      }

      const result = groupOrderSchemas.processPayment.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('Parameter Validation', () => {
    it('should validate UUID parameters', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000'
      const result = groupOrderSchemas.groupOrderIdParam.safeParse({ groupOrderId: validUUID })
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID format', () => {
      const invalidUUID = 'not-a-uuid'
      const result = groupOrderSchemas.groupOrderIdParam.safeParse({ groupOrderId: invalidUUID })
      expect(result.success).toBe(false)
    })

    it('should validate share code format', () => {
      const validCode = 'ABC12345'
      const result = groupOrderSchemas.shareCodeParam.safeParse({ shareCode: validCode })
      expect(result.success).toBe(true)
    })

    it('should reject invalid share code format', () => {
      const invalidCode = 'abc123' // Should be uppercase
      const result = groupOrderSchemas.shareCodeParam.safeParse({ shareCode: invalidCode })
      expect(result.success).toBe(false)
    })
  })

  describe('Query Validation', () => {
    it('should validate activities query parameters', () => {
      const validQuery = {
        limit: 25,
        offset: 0,
        type: 'member_joined' as const
      }

      const result = groupOrderSchemas.activitiesQuery.safeParse(validQuery)
      expect(result.success).toBe(true)
    })

    it('should apply default values for optional parameters', () => {
      const minimalQuery = {}

      const result = groupOrderSchemas.activitiesQuery.safeParse(minimalQuery)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(0)
      }
    })

    it('should validate statistics query parameters', () => {
      const validQuery = {
        timeRange: 'month' as const,
        restaurantId: '1', // Schema expects string that transforms to number
        startDate: '2023-01-01T00:00:00Z',
        endDate: '2023-01-31T23:59:59Z'
      }

      const result = groupOrderSchemas.statisticsQuery.safeParse(validQuery)
      expect(result.success).toBe(true)
    })

    it('should validate date range logic', () => {
      const invalidQuery = {
        startDate: '2023-01-31T00:00:00Z',
        endDate: '2023-01-01T00:00:00Z' // End before start
      }

      const result = groupOrderSchemas.statisticsQuery.safeParse(invalidQuery)
      expect(result.success).toBe(false)
    })
  })

  describe('Service Integration', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockDB.prepare = () => ({
        bind: () => ({
          run: async () => { throw new Error('Database error') }
        })
      })

      const createData: CreateGroupOrderRequest = {
        restaurantId: '1'
      }

      const result = await groupOrderService.createGroupOrder(createData, 1)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create group order')
    })

    it('should generate unique share codes', async () => {
      const codes = new Set()

      // Generate multiple share codes and check uniqueness
      for (let i = 0; i < 100; i++) {
        const createData: CreateGroupOrderRequest = { restaurantId: '1' }
        const result = await groupOrderService.createGroupOrder(createData, 1)

        if (result.success && result.data?.shareCode) {
          codes.add(result.data.shareCode)
        }
      }

      // All codes should be unique
      expect(codes.size).toBe(100)
    })
  })
})