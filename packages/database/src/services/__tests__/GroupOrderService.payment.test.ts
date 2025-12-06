/**
 * GroupOrderService - 支付處理測試
 *
 * 測試範圍: 處理群組成員支付
 * 測試數量: 4 個測試
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GroupOrderService } from '../GroupOrderService'
import {
  createOptimizedMockDB,
  createMockEnv,
  setupUUIDMock,
  setupRandomMock,
  cleanupMockDB
} from './test-helpers'

describe('GroupOrderService - 支付處理', () => {
  let service: GroupOrderService
  let mockDB: any
  let mockEnv: any
  let testGroupOrderId: string
  let testMemberId: string
  let testSplitBillId: string

  beforeEach(async () => {
    // 先設置 mock,再創建 service
    setupUUIDMock()
    setupRandomMock()

    mockDB = createOptimizedMockDB()
    mockEnv = createMockEnv()
    service = new GroupOrderService(mockDB, mockEnv)

    // 創建群組並設置分帳
    const createResult = await service.createGroupOrder({
      restaurantId: 'R-001' }, 1)
    testGroupOrderId = createResult.data!.groupOrderId

    const members = Array.from(mockDB._mockData.groupMembers.values())
    testMemberId = (members[0] as any).id

    // 創建待支付的分帳記錄
    testSplitBillId = crypto.randomUUID()
    const splitBillData = {
      id: testSplitBillId,
      groupOrderId: testGroupOrderId,
      memberId: testMemberId,
      totalAmount: 50,
      paymentStatus: 'pending',
      items: JSON.stringify([]),
      subtotal: 50,
      taxAmount: 0,
      serviceCharge: 0,
      discountAmount: 0,
      tipAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    mockDB._mockData.splitBills.set(testSplitBillId, splitBillData)
  })

  afterEach(() => {
    cleanupMockDB(mockDB)
  })

  it('應該成功處理支付', async () => {
    const paymentData = {
      paymentMethod: 'credit_card',
      transactionId: 'txn_12345'
    }

    const result = await service.processPayment(
      testGroupOrderId,
      testMemberId,
      paymentData
    )

    expect(result.success).toBe(true)
  })

  it('應該更新支付狀態為已付款', async () => {
    await service.processPayment(
      testGroupOrderId,
      testMemberId,
      { paymentMethod: 'cash' }
    )

    const splitBill = mockDB._mockData.splitBills.get(testSplitBillId)
    expect(splitBill?.paymentStatus).toBe('paid')
  })

  it('應該記錄支付方法', async () => {
    const paymentMethod = 'alipay'
    await service.processPayment(
      testGroupOrderId,
      testMemberId,
      { paymentMethod }
    )

    const splitBill = mockDB._mockData.splitBills.get(testSplitBillId)
    expect(splitBill?.paymentMethod).toBe(paymentMethod)
  })

  it('應該拒絕找不到的分帳記錄', async () => {
    const result = await service.processPayment(
      testGroupOrderId,
      'non-existent-member',
      { paymentMethod: 'cash' }
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('找不到')
  })
})
