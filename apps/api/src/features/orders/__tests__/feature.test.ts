/**
 * Orders Feature Tests
 * Comprehensive unit tests for the Orders feature module
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../../../shared/types'
import { OrdersService } from '../services/OrdersService'
import ordersRoutes from '../routes'
import type { CreateOrderData, Order, CouponPreviewRequest } from '../types'
import { OrderStatus, OrderPaymentStatus } from '@makanmakan/shared-types'
import { orderSchemas } from '../schemas/validation'
import * as dbModule from '@makanmakan/database'

// Mock dependencies
vi.mock('@makanmakan/database', () => ({
  OrderService: vi.fn().mockImplementation(() => ({
    createOrder: vi.fn(),
    getOrder: vi.fn(),
    getOrders: vi.fn(),
    updateOrderStatus: vi.fn(),
    cancelOrder: vi.fn(),
    getDailyOrderStats: vi.fn()
  })),
  CouponService: vi.fn().mockImplementation(() => ({
    validateCoupon: vi.fn()
  }))
}))

vi.mock('../../../core/monitoring', () => ({
  ConsoleLogger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

vi.mock('../../../core/cache', () => ({
  CacheService: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }))
}))

// Test fixtures
const mockEnv: Env = {
  DB: {} as D1Database,
  CACHE_KV: {} as KVNamespace,
  API_BASE_URL: 'http://localhost:8787',
  INTERNAL_API_TOKEN: 'test-token'
} as Env

const mockUser = {
  id: 1,
  role: 1, // Shop Owner
  restaurantId: 1,
  username: 'testuser',
  email: 'test@example.com'
}

const mockOrder = {
  id: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  restaurantId: 1,
  tableId: 1,
  customerId: 1,
  orderNumber: 'ORD-001',
  customerName: 'John Doe',
  customerPhone: '+1234567890',
  customerInfo: { email: 'john@example.com' },
  subtotal: 2000, // $20.00
  taxAmount: 200, // $2.00
  serviceCharge: 100, // $1.00
  discountAmount: 0,
  totalAmount: 2300, // $23.00
  status: OrderStatus.PENDING,
  paymentStatus: OrderPaymentStatus.PENDING,
  paymentMethod: 'card',
  orderType: 'dine_in',
  notes: 'Test order',
  items: [],
  couponCode: undefined,
  couponDiscount: 0
} as Order

const mockCreateOrderData: CreateOrderData = {
  restaurantId: 1,
  tableId: 1,
  customerInfo: {
    name: 'John Doe',
    phone: '+1234567890',
    email: 'john@example.com'
  },
  items: [
    {
      menuItemId: 1,
      quantity: 2,
      price: 1000, // $10.00
      notes: 'Extra spicy'
    }
  ],
  notes: 'Test order',
  orderType: 'dine_in'
}

describe('Orders Feature', () => {
  let ordersService: OrdersService
  let mockOrderService: any
  let mockCouponService: any
  let app: Hono<{ Bindings: Env }>

  beforeEach(() => {
    vi.clearAllMocks()
    ordersService = new OrdersService(mockEnv)
    
    // Get mocked services
    const { OrderService, CouponService } = vi.mocked(dbModule)
    mockOrderService = new OrderService({} as any)
    mockCouponService = new CouponService({} as any)
    
    // Setup Hono app
    app = new Hono<{ Bindings: Env }>()
    app.route('/orders', ordersRoutes)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('OrdersService', () => {
    describe('createOrder', () => {
      it('should create order successfully', async () => {
        // Arrange
        mockOrderService.createOrder.mockResolvedValue(mockOrder)

        // Act
        const result = await ordersService.createOrder(mockCreateOrderData, mockUser.id)

        // Assert
        expect(mockOrderService.createOrder).toHaveBeenCalledWith({
          restaurantId: mockCreateOrderData.restaurantId,
          tableId: mockCreateOrderData.tableId,
          customerInfo: mockCreateOrderData.customerInfo,
          items: mockCreateOrderData.items.map(item => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            customizations: item.customizations,
            notes: item.notes
          })),
          notes: mockCreateOrderData.notes,
          couponCode: mockCreateOrderData.couponCode
        })
        expect(result).toEqual(expect.objectContaining({
          id: mockOrder.id,
          restaurantId: mockOrder.restaurantId,
          status: mockOrder.status
        }))
      })

      it('should handle coupon validation during order creation', async () => {
        // Arrange
        const orderDataWithCoupon = {
          ...mockCreateOrderData,
          couponCode: 'SAVE10'
        }
        
        mockCouponService.validateCoupon.mockResolvedValue({
          valid: true,
          coupon: {
            code: 'SAVE10',
            name: 'Save $10',
            discountType: 'fixed_amount',
            discountValue: 1000 // $10.00
          },
          discountAmount: 1000,
          finalAmount: 1000
        })
        
        mockOrderService.createOrder.mockResolvedValue({
          ...mockOrder,
          couponCode: 'SAVE10',
          discountAmount: 1000,
          totalAmount: 1300 // Reduced by discount
        })

        // Act
        const result = await ordersService.createOrder(orderDataWithCoupon, mockUser.id)

        // Assert
        expect(mockCouponService.validateCoupon).toHaveBeenCalledWith(
          'SAVE10',
          '1',
          expect.any(Number),
          undefined,
          expect.any(Array)
        )
        expect(result.discountAmount).toBeGreaterThan(0)
        expect(result.discountAmount).toBe(1000)
      })

      it('should throw error for invalid coupon', async () => {
        // Arrange
        const orderDataWithCoupon = {
          ...mockCreateOrderData,
          couponCode: 'INVALID'
        }
        
        mockCouponService.validateCoupon.mockResolvedValue({
          valid: false,
          error: 'Coupon not found'
        })

        // Act & Assert
        await expect(ordersService.createOrder(orderDataWithCoupon, mockUser.id))
          .rejects.toThrow('Invalid coupon: Coupon not found')
      })
    })

    describe('getOrder', () => {
      it('should get order by ID from cache', async () => {
        // Arrange
        const mockCache = ordersService['cacheKV']
        mockCache.get.mockResolvedValue(mockOrder)

        // Act
        const result = await ordersService.getOrder(1)

        // Assert
        expect(mockCache.get).toHaveBeenCalledWith('order:1')
        expect(result).toEqual(mockOrder)
        expect(mockOrderService.getOrder).not.toHaveBeenCalled()
      })

      it('should get order by ID from database when not cached', async () => {
        // Arrange
        const mockCache = ordersService['cacheKV']
        mockCache.get.mockResolvedValue(null)
        mockOrderService.getOrder.mockResolvedValue(mockOrder)

        // Act
        const result = await ordersService.getOrder(1)

        // Assert
        expect(mockCache.get).toHaveBeenCalledWith('order:1')
        expect(mockOrderService.getOrder).toHaveBeenCalledWith(1)
        expect(mockCache.set).toHaveBeenCalledWith('order:1', expect.any(Object), 300)
        expect(result).toEqual(expect.objectContaining({
          id: mockOrder.id,
          restaurantId: mockOrder.restaurantId
        }))
      })

      it('should return null for non-existent order', async () => {
        // Arrange
        const mockCache = ordersService['cacheKV']
        mockCache.get.mockResolvedValue(null)
        mockOrderService.getOrder.mockResolvedValue(null)

        // Act
        const result = await ordersService.getOrder(999)

        // Assert
        expect(result).toBeNull()
      })
    })

    describe('getOrders', () => {
      it('should get orders with filters', async () => {
        // Arrange
        const filters = {
          restaurantId: 1,
          status: [OrderStatus.PENDING],
          page: 1,
          limit: 20
        }
        
        mockOrderService.getOrders.mockResolvedValue({
          orders: [mockOrder],
          total: 1,
          pagination: {
            page: 1,
            limit: 20,
            totalPages: 1
          }
        })

        // Act
        const result = await ordersService.getOrders(filters)

        // Assert
        expect(mockOrderService.getOrders).toHaveBeenCalledWith(
          expect.objectContaining({
            restaurantId: 1,
            status: [OrderStatus.PENDING]
          }),
          1,
          20
        )
        expect(result.orders).toHaveLength(1)
        expect(result.total).toBe(1)
      })
    })

    describe('updateOrderStatus', () => {
      it('should update order status successfully', async () => {
        // Arrange
        mockOrderService.getOrder.mockResolvedValue(mockOrder)
        mockOrderService.updateOrderStatus.mockResolvedValue({
          ...mockOrder,
          status: OrderStatus.CONFIRMED
        })

        // Act
        const result = await ordersService.updateOrderStatus(1, {
          status: OrderStatus.CONFIRMED,
          notes: 'Order confirmed'
        })

        // Assert
        expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith(1, {
          status: OrderStatus.CONFIRMED,
          notes: 'Order confirmed'
        })
        expect(result?.status).toBe(OrderStatus.CONFIRMED)
      })

      it('should return null for non-existent order', async () => {
        // Arrange
        mockOrderService.getOrder.mockResolvedValue(null)

        // Act
        const result = await ordersService.updateOrderStatus(999, {
          status: OrderStatus.CONFIRMED
        })

        // Assert
        expect(result).toBeNull()
      })
    })

    describe('cancelOrder', () => {
      it('should cancel order successfully', async () => {
        // Arrange
        mockOrderService.getOrder.mockResolvedValue(mockOrder)
        mockOrderService.cancelOrder.mockResolvedValue({
          ...mockOrder,
          status: OrderStatus.CANCELLED
        })

        // Act
        const result = await ordersService.cancelOrder(1, 'Customer request')

        // Assert
        expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(1, 'Customer request')
        expect(result?.status).toBe(OrderStatus.CANCELLED)
      })

      it('should not allow cancellation of completed orders', async () => {
        // Arrange
        const completedOrder = { ...mockOrder, status: 'completed' }
        mockOrderService.getOrder.mockResolvedValue(completedOrder)

        // Act & Assert
        await expect(ordersService.cancelOrder(1, 'Test cancellation'))
          .rejects.toThrow('Order cannot be cancelled in current status')
      })
    })

    describe('previewCoupon', () => {
      it('should preview valid coupon', async () => {
        // Arrange
        const previewRequest: CouponPreviewRequest = {
          restaurantId: 1,
          couponCode: 'SAVE10',
          orderAmount: 2000,
          userId: 1
        }
        
        mockCouponService.validateCoupon.mockResolvedValue({
          valid: true,
          coupon: {
            code: 'SAVE10',
            name: 'Save $10',
            discountType: 'fixed_amount',
            discountValue: 1000
          },
          discountAmount: 1000,
          finalAmount: 1000
        })

        // Act
        const result = await ordersService.previewCoupon(previewRequest)

        // Assert
        expect(result.valid).toBe(true)
        expect(result.discountAmount).toBe(1000)
        expect(result.finalAmount).toBe(1000)
        expect(result.coupon?.code).toBe('SAVE10')
      })

      it('should preview invalid coupon', async () => {
        // Arrange
        const previewRequest: CouponPreviewRequest = {
          restaurantId: 1,
          couponCode: 'INVALID',
          orderAmount: 2000
        }
        
        mockCouponService.validateCoupon.mockResolvedValue({
          valid: false,
          error: 'Coupon expired'
        })

        // Act
        const result = await ordersService.previewCoupon(previewRequest)

        // Assert
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Coupon expired')
        expect(result.discountAmount).toBe(0)
        expect(result.finalAmount).toBe(2000)
      })
    })

    describe('validateOrderTransition', () => {
      it.skip('should validate allowed status transitions for admin', async () => {
        // TODO: Implement validateOrderTransition method
        // Act & Assert
        // expect(ordersService.validateOrderTransition('pending', 'confirmed', 0)).toBe(true)
        // expect(ordersService.validateOrderTransition('confirmed', 'preparing', 0)).toBe(true)
        // expect(ordersService.validateOrderTransition('preparing', 'cancelled', 0)).toBe(true)
      })

      it.skip('should validate allowed status transitions for owner', async () => {
        // TODO: Implement validateOrderTransition method
        // Act & Assert
        // expect(ordersService.validateOrderTransition('pending', 'confirmed', 1)).toBe(true)
        // expect(ordersService.validateOrderTransition('confirmed', 'cancelled', 1)).toBe(true)
        // expect(ordersService.validateOrderTransition('confirmed', 'preparing', 1)).toBe(false) // Not allowed for owner
      })

      it.skip('should validate allowed status transitions for chef', async () => {
        // TODO: Implement validateOrderTransition method
        // Act & Assert
        // expect(ordersService.validateOrderTransition('confirmed', 'preparing', 2)).toBe(true)
        // expect(ordersService.validateOrderTransition('preparing', 'ready', 2)).toBe(true)
        // expect(ordersService.validateOrderTransition('pending', 'confirmed', 2)).toBe(false) // Not allowed for chef
      })
    })
  })

  describe('Validation Schemas', () => {
    describe('createOrderSchema', () => {
      it('should validate valid create order data', () => {
        // Arrange
        const validData = {
          restaurantId: 1,
          tableId: 1,
          customerName: 'John Doe',
          customerPhone: '+1234567890',
          items: [
            {
              menuItemId: 1,
              quantity: 2,
              price: 1000
            }
          ],
          orderType: 'dine_in'
        }

        // Act
        const result = orderSchemas.createOrder.safeParse(validData)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.restaurantId).toBe(1)
          expect(result.data.items).toHaveLength(1)
          expect(result.data.orderType).toBe('dine_in')
        }
      })

      it('should reject invalid create order data', () => {
        // Arrange
        const invalidData = {
          restaurantId: -1, // Invalid negative ID
          items: [] // Empty items array
        }

        // Act
        const result = orderSchemas.createOrder.safeParse(invalidData)

        // Assert
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                path: ['restaurantId']
              }),
              expect.objectContaining({
                path: ['items']
              })
            ])
          )
        }
      })
    })

    describe('updateOrderStatusSchema', () => {
      it('should validate valid status update data', () => {
        // Arrange
        const validData = {
          status: OrderStatus.CONFIRMED,
          notes: 'Order confirmed by restaurant'
        }

        // Act
        const result = orderSchemas.updateOrderStatus.safeParse(validData)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.status).toBe(OrderStatus.CONFIRMED)
          expect(result.data.notes).toBe('Order confirmed by restaurant')
        }
      })

      it('should reject invalid status', () => {
        // Arrange
        const invalidData = {
          status: 'invalid_status'
        }

        // Act
        const result = orderSchemas.updateOrderStatus.safeParse(invalidData)

        // Assert
        expect(result.success).toBe(false)
      })
    })

    describe('couponPreviewSchema', () => {
      it('should validate valid coupon preview data', () => {
        // Arrange
        const validData = {
          restaurantId: 1,
          couponCode: 'SAVE10',
          orderAmount: 2000,
          userId: 1
        }

        // Act
        const result = orderSchemas.couponPreview.safeParse(validData)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.orderAmount).toBe(2000)
        }
      })

      it('should reject invalid coupon preview data', () => {
        // Arrange
        const invalidData = {
          restaurantId: -1,
          couponCode: '', // Empty code
          orderAmount: -100 // Negative amount
        }

        // Act
        const result = orderSchemas.couponPreview.safeParse(invalidData)

        // Assert
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      mockOrderService.createOrder.mockRejectedValue(new Error('Database connection failed'))

      // Act & Assert
      await expect(ordersService.createOrder(mockCreateOrderData, mockUser.id))
        .rejects.toThrow('Database connection failed')
    })

    it('should handle validation errors', async () => {
      // Arrange
      const invalidOrderData = {
        ...mockCreateOrderData,
        restaurantId: -1 // Invalid ID
      }

      // Act & Assert
      await expect(ordersService.createOrder(invalidOrderData, mockUser.id))
        .rejects.toThrow()
    })

    it('should handle coupon service errors gracefully', async () => {
      // Arrange
      const previewRequest: CouponPreviewRequest = {
        restaurantId: 1,
        couponCode: 'ERROR',
        orderAmount: 2000
      }
      
      mockCouponService.validateCoupon.mockRejectedValue(new Error('Coupon service unavailable'))

      // Act
      const result = await ordersService.previewCoupon(previewRequest)

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Failed to validate coupon')
    })
  })

  describe('Cache Management', () => {
    it('should cache orders after retrieval', async () => {
      // Arrange
      const mockCache = ordersService['cacheKV']
      mockCache.get.mockResolvedValue(null)
      mockOrderService.getOrder.mockResolvedValue(mockOrder)

      // Act
      await ordersService.getOrder(1)

      // Assert
      expect(mockCache.set).toHaveBeenCalledWith(
        'order:1',
        expect.any(Object),
        300
      )
    })

    it('should invalidate cache after order updates', async () => {
      // Arrange
      const mockCache = ordersService['cacheKV']
      mockOrderService.getOrder.mockResolvedValue(mockOrder)
      mockOrderService.updateOrderStatus.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED
      })

      // Act
      await ordersService.updateOrderStatus(1, { status: OrderStatus.CONFIRMED })

      // Assert
      expect(mockCache.delete).toHaveBeenCalledWith('order:1')
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete order lifecycle', async () => {
      // Arrange - Create order
      mockOrderService.createOrder.mockResolvedValue(mockOrder)
      const createdOrder = await ordersService.createOrder(mockCreateOrderData, mockUser.id)
      expect(createdOrder.status).toBe(OrderStatus.PENDING)

      // Act & Assert - Update to confirmed
      mockOrderService.getOrder.mockResolvedValue(createdOrder)
      mockOrderService.updateOrderStatus.mockResolvedValue({
        ...createdOrder,
        status: OrderStatus.CONFIRMED
      })
      const confirmedOrder = await ordersService.updateOrderStatus(1, { status: OrderStatus.CONFIRMED })
      expect(confirmedOrder?.status).toBe(OrderStatus.CONFIRMED)

      // Act & Assert - Update to preparing
      mockOrderService.getOrder.mockResolvedValue(confirmedOrder!)
      mockOrderService.updateOrderStatus.mockResolvedValue({
        ...confirmedOrder!,
        status: OrderStatus.PREPARING
      })
      const preparingOrder = await ordersService.updateOrderStatus(1, { status: OrderStatus.PREPARING })
      expect(preparingOrder?.status).toBe(OrderStatus.PREPARING)

      // Act & Assert - Cancel order
      mockOrderService.getOrder.mockResolvedValue(preparingOrder!)
      mockOrderService.cancelOrder.mockResolvedValue({
        ...preparingOrder!,
        status: OrderStatus.CANCELLED
      })
      const cancelledOrder = await ordersService.cancelOrder(1, 'Customer request')
      expect(cancelledOrder?.status).toBe(OrderStatus.CANCELLED)
    })
  })
})

describe('Orders Feature Performance', () => {
  it('should handle concurrent order creation', async () => {
    // This would test concurrent access patterns
    // Implementation depends on specific performance requirements
  })

  it('should handle large order lists efficiently', async () => {
    // This would test pagination and filtering performance
    // Implementation depends on specific performance requirements
  })
})

describe('Orders Feature Security', () => {
  it('should prevent unauthorized access to orders', async () => {
    // This would test authorization and access control
    // Implementation depends on specific security requirements
  })

  it('should sanitize order data inputs', async () => {
    // This would test input sanitization and XSS prevention
    // Implementation depends on specific security requirements
  })
})