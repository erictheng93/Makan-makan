/**
 * Orders Validation Schemas Tests
 * Comprehensive tests for all order validation schemas and helper functions
 */

import { describe, it, expect } from 'vitest'
import {
  createOrderSchema,
  updateOrderStatusSchema,
  updateOrderSchema,
  updatePaymentStatusSchema,
  orderFilterSchema,
  orderSearchSchema,
  previewCouponSchema,
  bulkOrderOperationSchema,
  orderStatsQuerySchema,
  popularItemsQuerySchema,
  exportOrdersSchema,
  generateReceiptSchema,
  updateOrderItemSchema,
  orderSubscriptionSchema,
  orderIdParamSchema,
  orderBatchIdParamSchema,
  orderItemIdParamSchema,
  addOrderReviewSchema,
  modifyOrderSchema,
  notificationPreferencesSchema,
  kitchenOrderFilterSchema,
  advancedOrderQuerySchema,
  validateOrderStatusTransition,
  validateUserPermission,
  orderErrorSchema,
  validateBulkOrderIds,
  validateOrderTiming,
  validateOrderAmount,
  orderSchemas
} from '../schemas/validation'

describe('Orders Validation Schemas', () => {
  describe('createOrderSchema', () => {
    it('should validate valid order data', () => {
      const validData = {
        restaurantId: 1,
        tableId: 1,
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        items: [{ menuItemId: 1, quantity: 2, price: 1000 }],
        orderType: 'dine_in'
      }
      const result = createOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject negative restaurantId', () => {
      const invalidData = {
        restaurantId: -1,
        items: [{ menuItemId: 1, quantity: 1 }]
      }
      const result = createOrderSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject empty items array', () => {
      const invalidData = {
        restaurantId: 1,
        items: []
      }
      const result = createOrderSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject items exceeding max limit', () => {
      const items = Array(51).fill({ menuItemId: 1, quantity: 1 })
      const invalidData = {
        restaurantId: 1,
        items
      }
      const result = createOrderSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should validate order with customizations', () => {
      const validData = {
        restaurantId: 1,
        items: [{
          menuItemId: 1,
          quantity: 1,
          customizations: {
            size: { id: 'large', name: 'Large', priceAdjustment: 200 },
            options: [{ id: 'opt1', optionName: 'Spice', choiceId: 'hot', choiceName: 'Hot' }],
            addOns: [{ id: 'addon1', name: 'Extra Cheese', unitPrice: 100, quantity: 1, totalPrice: 100 }],
            specialInstructions: 'No onions'
          }
        }],
        orderType: 'dine_in'
      }
      const result = createOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should validate all order types', () => {
      const orderTypes = ['dine_in', 'takeaway', 'delivery']
      orderTypes.forEach(orderType => {
        const data = {
          restaurantId: 1,
          items: [{ menuItemId: 1, quantity: 1 }],
          orderType
        }
        const result = createOrderSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid order type', () => {
      const invalidData = {
        restaurantId: 1,
        items: [{ menuItemId: 1, quantity: 1 }],
        orderType: 'invalid_type'
      }
      const result = createOrderSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should validate scheduled time', () => {
      const validData = {
        restaurantId: 1,
        items: [{ menuItemId: 1, quantity: 1 }],
        scheduledTime: '2025-12-25T12:00:00Z'
      }
      const result = createOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should validate customer info object', () => {
      const validData = {
        restaurantId: 1,
        items: [{ menuItemId: 1, quantity: 1 }],
        customerInfo: {
          name: 'John',
          phone: '+1234567890',
          email: 'john@example.com',
          address: '123 Main St'
        }
      }
      const result = createOrderSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject quantity exceeding max', () => {
      const invalidData = {
        restaurantId: 1,
        items: [{ menuItemId: 1, quantity: 100 }]
      }
      const result = createOrderSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('updateOrderStatusSchema', () => {
    it('should validate all valid statuses', () => {
      const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'paid', 'cancelled']
      statuses.forEach(status => {
        const result = updateOrderStatusSchema.safeParse({ status })
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid status', () => {
      const result = updateOrderStatusSchema.safeParse({ status: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('should validate with notes', () => {
      const result = updateOrderStatusSchema.safeParse({
        status: 'confirmed',
        notes: 'Order confirmed by manager'
      })
      expect(result.success).toBe(true)
    })

    it('should reject notes exceeding max length', () => {
      const result = updateOrderStatusSchema.safeParse({
        status: 'confirmed',
        notes: 'a'.repeat(501)
      })
      expect(result.success).toBe(false)
    })

    it('should validate with estimatedReadyTime', () => {
      const result = updateOrderStatusSchema.safeParse({
        status: 'preparing',
        estimatedReadyTime: '2025-12-08T15:00:00Z'
      })
      expect(result.success).toBe(true)
    })

    it('should validate with actualPrepTime', () => {
      const result = updateOrderStatusSchema.safeParse({
        status: 'ready',
        actualPrepTime: 25
      })
      expect(result.success).toBe(true)
    })

    it('should reject actualPrepTime exceeding max', () => {
      const result = updateOrderStatusSchema.safeParse({
        status: 'ready',
        actualPrepTime: 1000
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateOrderSchema', () => {
    it('should validate partial update', () => {
      const result = updateOrderSchema.safeParse({
        notes: 'Updated notes'
      })
      expect(result.success).toBe(true)
    })

    it('should validate payment status update', () => {
      const result = updateOrderSchema.safeParse({
        paymentStatus: 'paid',
        paymentMethod: 'card'
      })
      expect(result.success).toBe(true)
    })

    it('should validate rating', () => {
      const result = updateOrderSchema.safeParse({
        rating: 5,
        reviewComment: 'Great service!'
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid rating', () => {
      const result = updateOrderSchema.safeParse({ rating: 6 })
      expect(result.success).toBe(false)
    })
  })

  describe('updatePaymentStatusSchema', () => {
    it('should validate payment status update', () => {
      const result = updatePaymentStatusSchema.safeParse({
        paymentStatus: 'paid',
        paymentMethod: 'card',
        transactionId: 'txn_123'
      })
      expect(result.success).toBe(true)
    })

    it('should validate with metadata', () => {
      const result = updatePaymentStatusSchema.safeParse({
        paymentStatus: 'paid',
        metadata: { gateway: 'stripe', receiptUrl: 'https://...' }
      })
      expect(result.success).toBe(true)
    })
  })

  describe('orderFilterSchema', () => {
    it('should validate empty filters', () => {
      const result = orderFilterSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should transform restaurantId string to number', () => {
      const result = orderFilterSchema.safeParse({ restaurantId: '1' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.restaurantId).toBe(1)
      }
    })

    it('should validate single status', () => {
      const result = orderFilterSchema.safeParse({ status: 'pending' })
      expect(result.success).toBe(true)
    })

    it('should validate comma-separated statuses', () => {
      const result = orderFilterSchema.safeParse({ status: 'pending,confirmed,preparing' })
      expect(result.success).toBe(true)
    })

    it('should validate date range', () => {
      const result = orderFilterSchema.safeParse({
        dateFrom: '2024-01-01T00:00:00Z',
        dateTo: '2024-12-31T23:59:59Z'
      })
      expect(result.success).toBe(true)
    })

    it('should validate amount range', () => {
      const result = orderFilterSchema.safeParse({
        minAmount: '10.00',
        maxAmount: '100.00'
      })
      expect(result.success).toBe(true)
    })

    it('should validate pagination', () => {
      const result = orderFilterSchema.safeParse({
        page: '2',
        limit: '50'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(2)
        expect(result.data.limit).toBe(50)
      }
    })

    it('should validate sort options', () => {
      const result = orderFilterSchema.safeParse({
        sortBy: 'totalAmount',
        sortOrder: 'desc'
      })
      expect(result.success).toBe(true)
    })

    it('should validate hasNotes filter', () => {
      const result = orderFilterSchema.safeParse({ hasNotes: 'true' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hasNotes).toBe(true)
      }
    })

    it('should validate rating filter', () => {
      const result = orderFilterSchema.safeParse({ rating: '4,5' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.rating).toEqual([4, 5])
      }
    })
  })

  describe('orderSearchSchema', () => {
    it('should validate search query', () => {
      const result = orderSearchSchema.safeParse({
        query: 'ORD-001',
        searchFields: ['orderNumber', 'customerName']
      })
      expect(result.success).toBe(true)
    })

    it('should validate fuzzy search', () => {
      const result = orderSearchSchema.safeParse({
        query: 'john',
        fuzzy: 'true'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fuzzy).toBe(true)
      }
    })

    it('should reject query exceeding max length', () => {
      const result = orderSearchSchema.safeParse({
        query: 'a'.repeat(101)
      })
      expect(result.success).toBe(false)
    })
  })

  describe('previewCouponSchema', () => {
    it('should validate coupon preview request', () => {
      const result = previewCouponSchema.safeParse({
        restaurantId: 1,
        couponCode: 'SAVE10',
        orderAmount: 2000
      })
      expect(result.success).toBe(true)
    })

    it('should validate with menu items', () => {
      const result = previewCouponSchema.safeParse({
        restaurantId: 1,
        couponCode: 'SAVE10',
        orderAmount: 2000,
        menuItems: [
          { menuItemId: 1, quantity: 2 },
          { menuItemId: 2, quantity: 1 }
        ]
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty coupon code', () => {
      const result = previewCouponSchema.safeParse({
        restaurantId: 1,
        couponCode: '',
        orderAmount: 2000
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative order amount', () => {
      const result = previewCouponSchema.safeParse({
        restaurantId: 1,
        couponCode: 'SAVE10',
        orderAmount: -100
      })
      expect(result.success).toBe(false)
    })
  })

  describe('bulkOrderOperationSchema', () => {
    it('should validate bulk status update', () => {
      const result = bulkOrderOperationSchema.safeParse({
        action: 'update_status',
        orderIds: [1, 2, 3],
        data: { status: 'confirmed' }
      })
      expect(result.success).toBe(true)
    })

    it('should validate bulk cancel', () => {
      const result = bulkOrderOperationSchema.safeParse({
        action: 'cancel',
        orderIds: [1, 2],
        data: { reason: 'Out of stock' }
      })
      expect(result.success).toBe(true)
    })

    it('should validate bulk export', () => {
      const result = bulkOrderOperationSchema.safeParse({
        action: 'export',
        orderIds: [1, 2, 3, 4, 5],
        data: { format: 'csv' }
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty orderIds', () => {
      const result = bulkOrderOperationSchema.safeParse({
        action: 'update_status',
        orderIds: []
      })
      expect(result.success).toBe(false)
    })

    it('should reject orderIds exceeding max', () => {
      const orderIds = Array(101).fill(1).map((_, i) => i + 1)
      const result = bulkOrderOperationSchema.safeParse({
        action: 'update_status',
        orderIds
      })
      expect(result.success).toBe(false)
    })

    it('should validate with batchId', () => {
      const result = bulkOrderOperationSchema.safeParse({
        action: 'archive',
        orderIds: [1, 2],
        batchId: '550e8400-e29b-41d4-a716-446655440000'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('orderStatsQuerySchema', () => {
    it('should validate stats query', () => {
      const result = orderStatsQuerySchema.safeParse({
        restaurantId: '1',
        timeRange: 'week'
      })
      expect(result.success).toBe(true)
    })

    it('should validate groupBy option', () => {
      const result = orderStatsQuerySchema.safeParse({
        groupBy: 'hour'
      })
      expect(result.success).toBe(true)
    })

    it('should validate include options', () => {
      const result = orderStatsQuerySchema.safeParse({
        includeItems: 'true',
        includeCustomers: 'true'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeItems).toBe(true)
        expect(result.data.includeCustomers).toBe(true)
      }
    })
  })

  describe('popularItemsQuerySchema', () => {
    it('should validate popular items query', () => {
      const result = popularItemsQuerySchema.safeParse({
        restaurantId: 1,
        timeRange: 'month',
        limit: '20'
      })
      expect(result.success).toBe(true)
    })

    it('should validate minQuantity', () => {
      const result = popularItemsQuerySchema.safeParse({
        restaurantId: 1,
        minQuantity: '5'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.minQuantity).toBe(5)
      }
    })
  })

  describe('exportOrdersSchema', () => {
    it('should validate CSV export', () => {
      const result = exportOrdersSchema.safeParse({ format: 'csv' })
      expect(result.success).toBe(true)
    })

    it('should validate Excel export', () => {
      const result = exportOrdersSchema.safeParse({ format: 'excel' })
      expect(result.success).toBe(true)
    })

    it('should validate PDF export', () => {
      const result = exportOrdersSchema.safeParse({ format: 'pdf' })
      expect(result.success).toBe(true)
    })

    it('should validate with columns selection', () => {
      const result = exportOrdersSchema.safeParse({
        format: 'csv',
        columns: ['orderNumber', 'customerName', 'totalAmount']
      })
      expect(result.success).toBe(true)
    })

    it('should validate include options', () => {
      const result = exportOrdersSchema.safeParse({
        format: 'csv',
        includeItems: 'true',
        includeCustomerInfo: 'false'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('generateReceiptSchema', () => {
    it('should validate receipt generation', () => {
      const result = generateReceiptSchema.safeParse({
        format: 'pdf',
        includeQR: 'true',
        language: 'en'
      })
      expect(result.success).toBe(true)
    })

    it('should validate all formats', () => {
      const formats = ['pdf', 'html', 'json']
      formats.forEach(format => {
        const result = generateReceiptSchema.safeParse({ format })
        expect(result.success).toBe(true)
      })
    })

    it('should validate all languages', () => {
      const languages = ['en', 'zh', 'ms']
      languages.forEach(language => {
        const result = generateReceiptSchema.safeParse({ language })
        expect(result.success).toBe(true)
      })
    })

    it('should validate all templates', () => {
      const templates = ['default', 'thermal', 'a4']
      templates.forEach(template => {
        const result = generateReceiptSchema.safeParse({ template })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('updateOrderItemSchema', () => {
    it('should validate item status update', () => {
      const result = updateOrderItemSchema.safeParse({
        status: 'preparing'
      })
      expect(result.success).toBe(true)
    })

    it('should validate quantity update', () => {
      const result = updateOrderItemSchema.safeParse({
        quantity: 3
      })
      expect(result.success).toBe(true)
    })

    it('should reject quantity exceeding max', () => {
      const result = updateOrderItemSchema.safeParse({
        quantity: 100
      })
      expect(result.success).toBe(false)
    })

    it('should validate all item statuses', () => {
      const statuses = ['pending', 'preparing', 'ready', 'delivered']
      statuses.forEach(status => {
        const result = updateOrderItemSchema.safeParse({ status })
        expect(result.success).toBe(true)
      })
    })
  })

  describe('orderSubscriptionSchema', () => {
    it('should validate subscription', () => {
      const result = orderSubscriptionSchema.safeParse({
        restaurantId: 1,
        roles: [0, 1, 2]
      })
      expect(result.success).toBe(true)
    })

    it('should validate with events filter', () => {
      const result = orderSubscriptionSchema.safeParse({
        restaurantId: 1,
        roles: [1],
        events: ['ORDER_CREATED', 'ORDER_STATUS_CHANGED']
      })
      expect(result.success).toBe(true)
    })

    it('should validate with tableIds filter', () => {
      const result = orderSubscriptionSchema.safeParse({
        restaurantId: 1,
        roles: [3],
        tableIds: [1, 2, 3]
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty roles', () => {
      const result = orderSubscriptionSchema.safeParse({
        restaurantId: 1,
        roles: []
      })
      expect(result.success).toBe(false)
    })

    it('should reject roles exceeding max', () => {
      const result = orderSubscriptionSchema.safeParse({
        restaurantId: 1,
        roles: [0, 1, 2, 3, 4, 5]
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Parameter Schemas', () => {
    describe('orderIdParamSchema', () => {
      it('should validate order ID', () => {
        const result = orderIdParamSchema.safeParse({ id: '123' })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.id).toBe(123)
        }
      })

      it('should reject non-numeric ID', () => {
        const result = orderIdParamSchema.safeParse({ id: 'abc' })
        expect(result.success).toBe(false)
      })
    })

    describe('orderBatchIdParamSchema', () => {
      it('should validate batch ID', () => {
        const result = orderBatchIdParamSchema.safeParse({
          batchId: '550e8400-e29b-41d4-a716-446655440000'
        })
        expect(result.success).toBe(true)
      })

      it('should reject invalid UUID', () => {
        const result = orderBatchIdParamSchema.safeParse({
          batchId: 'invalid-uuid'
        })
        expect(result.success).toBe(false)
      })
    })

    describe('orderItemIdParamSchema', () => {
      it('should validate order and item IDs', () => {
        const result = orderItemIdParamSchema.safeParse({
          orderId: '1',
          itemId: '2'
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.orderId).toBe(1)
          expect(result.data.itemId).toBe(2)
        }
      })
    })
  })

  describe('addOrderReviewSchema', () => {
    it('should validate review', () => {
      const result = addOrderReviewSchema.safeParse({
        rating: 5,
        comment: 'Excellent food!'
      })
      expect(result.success).toBe(true)
    })

    it('should validate with item ratings', () => {
      const result = addOrderReviewSchema.safeParse({
        rating: 4,
        itemRatings: [
          { itemId: 1, rating: 5, comment: 'Delicious' },
          { itemId: 2, rating: 3 }
        ]
      })
      expect(result.success).toBe(true)
    })

    it('should reject rating below 1', () => {
      const result = addOrderReviewSchema.safeParse({ rating: 0 })
      expect(result.success).toBe(false)
    })

    it('should reject rating above 5', () => {
      const result = addOrderReviewSchema.safeParse({ rating: 6 })
      expect(result.success).toBe(false)
    })

    it('should reject comment exceeding max length', () => {
      const result = addOrderReviewSchema.safeParse({
        rating: 5,
        comment: 'a'.repeat(501)
      })
      expect(result.success).toBe(false)
    })
  })

  describe('modifyOrderSchema', () => {
    it('should validate adding items', () => {
      const result = modifyOrderSchema.safeParse({
        addItems: [{ menuItemId: 1, quantity: 1 }],
        reason: 'Customer request'
      })
      expect(result.success).toBe(true)
    })

    it('should validate removing items', () => {
      const result = modifyOrderSchema.safeParse({
        removeItems: [1, 2],
        reason: 'Out of stock'
      })
      expect(result.success).toBe(true)
    })

    it('should validate updating items', () => {
      const result = modifyOrderSchema.safeParse({
        updateItems: [{ itemId: 1, quantity: 3 }],
        reason: 'Quantity change'
      })
      expect(result.success).toBe(true)
    })

    it('should require reason', () => {
      const result = modifyOrderSchema.safeParse({
        addItems: [{ menuItemId: 1, quantity: 1 }]
      })
      expect(result.success).toBe(false)
    })
  })

  describe('notificationPreferencesSchema', () => {
    it('should validate notification preferences', () => {
      const result = notificationPreferencesSchema.safeParse({
        enablePush: true,
        enableEmail: true,
        enableSMS: false
      })
      expect(result.success).toBe(true)
    })

    it('should validate with status updates filter', () => {
      const result = notificationPreferencesSchema.safeParse({
        statusUpdates: ['confirmed', 'ready', 'delivered']
      })
      expect(result.success).toBe(true)
    })

    it('should validate with roles filter', () => {
      const result = notificationPreferencesSchema.safeParse({
        roles: [0, 1, 2]
      })
      expect(result.success).toBe(true)
    })
  })

  describe('kitchenOrderFilterSchema', () => {
    it('should validate kitchen filter', () => {
      const result = kitchenOrderFilterSchema.safeParse({
        restaurantId: 1
      })
      expect(result.success).toBe(true)
    })

    it('should validate with status filter', () => {
      const result = kitchenOrderFilterSchema.safeParse({
        restaurantId: 1,
        status: ['confirmed', 'preparing']
      })
      expect(result.success).toBe(true)
    })

    it('should validate priority filter', () => {
      const result = kitchenOrderFilterSchema.safeParse({
        restaurantId: 1,
        priority: 'urgent'
      })
      expect(result.success).toBe(true)
    })

    it('should validate preparationTime filter', () => {
      const result = kitchenOrderFilterSchema.safeParse({
        restaurantId: 1,
        preparationTime: 'overdue'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('advancedOrderQuerySchema', () => {
    it('should validate advanced query', () => {
      const result = advancedOrderQuerySchema.safeParse({
        includeItems: 'true',
        includeCustomer: 'true',
        includeRestaurant: 'true'
      })
      expect(result.success).toBe(true)
    })

    it('should validate fields selection', () => {
      const result = advancedOrderQuerySchema.safeParse({
        fields: 'id,orderNumber,status'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fields).toEqual(['id', 'orderNumber', 'status'])
      }
    })

    it('should validate excludeFields', () => {
      const result = advancedOrderQuerySchema.safeParse({
        excludeFields: 'internalNotes,createdBy'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Helper Functions', () => {
    describe('validateOrderStatusTransition', () => {
      it('should allow pending to confirmed', () => {
        expect(validateOrderStatusTransition('pending', 'confirmed')).toBe(true)
      })

      it('should allow pending to cancelled', () => {
        expect(validateOrderStatusTransition('pending', 'cancelled')).toBe(true)
      })

      it('should allow confirmed to preparing', () => {
        expect(validateOrderStatusTransition('confirmed', 'preparing')).toBe(true)
      })

      it('should allow confirmed to cancelled', () => {
        expect(validateOrderStatusTransition('confirmed', 'cancelled')).toBe(true)
      })

      it('should allow preparing to ready', () => {
        expect(validateOrderStatusTransition('preparing', 'ready')).toBe(true)
      })

      it('should allow ready to delivered', () => {
        expect(validateOrderStatusTransition('ready', 'delivered')).toBe(true)
      })

      it('should allow delivered to paid', () => {
        expect(validateOrderStatusTransition('delivered', 'paid')).toBe(true)
      })

      it('should not allow paid to any status', () => {
        expect(validateOrderStatusTransition('paid', 'cancelled')).toBe(false)
        expect(validateOrderStatusTransition('paid', 'pending')).toBe(false)
      })

      it('should not allow cancelled to any status', () => {
        expect(validateOrderStatusTransition('cancelled', 'pending')).toBe(false)
        expect(validateOrderStatusTransition('cancelled', 'confirmed')).toBe(false)
      })

      it('should not allow skipping statuses', () => {
        expect(validateOrderStatusTransition('pending', 'ready')).toBe(false)
        expect(validateOrderStatusTransition('pending', 'delivered')).toBe(false)
      })

      it('should handle invalid current status', () => {
        expect(validateOrderStatusTransition('invalid', 'confirmed')).toBe(false)
      })
    })

    describe('validateUserPermission', () => {
      it('should allow admin for any role', () => {
        expect(validateUserPermission(0, [1, 2, 3])).toBe(true)
        expect(validateUserPermission(0, [])).toBe(true)
      })

      it('should allow user with matching role', () => {
        expect(validateUserPermission(1, [1, 2])).toBe(true)
        expect(validateUserPermission(2, [1, 2])).toBe(true)
      })

      it('should deny user without matching role', () => {
        expect(validateUserPermission(3, [1, 2])).toBe(false)
        expect(validateUserPermission(4, [1, 2])).toBe(false)
      })
    })

    describe('validateBulkOrderIds', () => {
      it('should validate unique order IDs', () => {
        const result = validateBulkOrderIds.safeParse([1, 2, 3, 4, 5])
        expect(result.success).toBe(true)
      })

      it('should reject duplicate order IDs', () => {
        const result = validateBulkOrderIds.safeParse([1, 2, 2, 3])
        expect(result.success).toBe(false)
      })

      it('should reject empty array', () => {
        const result = validateBulkOrderIds.safeParse([])
        expect(result.success).toBe(false)
      })

      it('should reject array exceeding max', () => {
        const ids = Array(101).fill(0).map((_, i) => i + 1)
        const result = validateBulkOrderIds.safeParse(ids)
        expect(result.success).toBe(false)
      })
    })

    describe('validateOrderTiming', () => {
      it('should return true for no scheduled time', () => {
        expect(validateOrderTiming(undefined)).toBe(true)
      })

      it('should return true for future scheduled time', () => {
        const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
        expect(validateOrderTiming(futureTime)).toBe(true)
      })

      it('should return false for past scheduled time', () => {
        const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
        expect(validateOrderTiming(pastTime)).toBe(false)
      })

      it('should return false for time less than 15 minutes from now', () => {
        const soonTime = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
        expect(validateOrderTiming(soonTime)).toBe(false)
      })

      it('should accept custom current time', () => {
        const currentTime = new Date('2025-01-01T12:00:00Z')
        const scheduledTime = '2025-01-01T13:00:00Z' // 1 hour later
        expect(validateOrderTiming(scheduledTime, currentTime)).toBe(true)
      })
    })

    describe('validateOrderAmount', () => {
      it('should return true when total meets minimum', () => {
        const items = [
          { price: 1000, quantity: 2 },
          { price: 500, quantity: 1 }
        ]
        expect(validateOrderAmount(items, 2000)).toBe(true)
      })

      it('should return false when total below minimum', () => {
        const items = [
          { price: 500, quantity: 1 }
        ]
        expect(validateOrderAmount(items, 1000)).toBe(false)
      })

      it('should return true with no minimum', () => {
        const items = [{ price: 100, quantity: 1 }]
        expect(validateOrderAmount(items)).toBe(true)
      })

      it('should handle empty items', () => {
        expect(validateOrderAmount([], 0)).toBe(true)
        expect(validateOrderAmount([], 100)).toBe(false)
      })
    })
  })

  describe('orderErrorSchema', () => {
    it('should validate error object', () => {
      const result = orderErrorSchema.safeParse({
        code: 'ORDER_NOT_FOUND',
        message: 'Order with ID 123 not found'
      })
      expect(result.success).toBe(true)
    })

    it('should validate error with field', () => {
      const result = orderErrorSchema.safeParse({
        code: 'VALIDATION_ERROR',
        message: 'Invalid value',
        field: 'status',
        value: 'invalid'
      })
      expect(result.success).toBe(true)
    })

    it('should validate error with details', () => {
      const result = orderErrorSchema.safeParse({
        code: 'BULK_OPERATION_PARTIAL',
        message: 'Some operations failed',
        details: {
          succeeded: [1, 2],
          failed: [3, 4]
        }
      })
      expect(result.success).toBe(true)
    })
  })

  describe('orderSchemas export', () => {
    it('should export all required schemas', () => {
      expect(orderSchemas.createOrder).toBeDefined()
      expect(orderSchemas.updateOrder).toBeDefined()
      expect(orderSchemas.updateOrderStatus).toBeDefined()
      expect(orderSchemas.orderFilter).toBeDefined()
      expect(orderSchemas.orderFilters).toBeDefined()
      expect(orderSchemas.couponPreview).toBeDefined()
      expect(orderSchemas.previewCoupon).toBeDefined()
      expect(orderSchemas.bulkOrderOperation).toBeDefined()
      expect(orderSchemas.bulkOperation).toBeDefined()
      expect(orderSchemas.orderStatsQuery).toBeDefined()
      expect(orderSchemas.stats).toBeDefined()
      expect(orderSchemas.analytics).toBeDefined()
      expect(orderSchemas.popularItemsQuery).toBeDefined()
      expect(orderSchemas.params).toBeDefined()
      expect(orderSchemas.export).toBeDefined()
    })

    it('should have aliases pointing to same schemas', () => {
      expect(orderSchemas.orderFilter).toBe(orderSchemas.orderFilters)
      expect(orderSchemas.couponPreview).toBe(orderSchemas.previewCoupon)
      expect(orderSchemas.bulkOrderOperation).toBe(orderSchemas.bulkOperation)
      expect(orderSchemas.orderStatsQuery).toBe(orderSchemas.stats)
      expect(orderSchemas.orderStatsQuery).toBe(orderSchemas.analytics)
    })
  })
})
