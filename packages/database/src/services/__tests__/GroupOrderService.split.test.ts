/**
 * GroupOrderService - 帳單分攤測試
 *
 * 測試範圍: 初始化分帳邏輯
 * 測試數量: 5 個測試
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

describe('GroupOrderService - 帳單分攤', () => {
  let service: GroupOrderService
  let mockDB: any
  let mockEnv: any
  let testGroupOrderId: string
  let testCreatorId: string

  beforeEach(async () => {
    // 先設置 mock,再創建 service
    setupUUIDMock()
    setupRandomMock()

    mockDB = createOptimizedMockDB()
    mockEnv = createMockEnv()
    service = new GroupOrderService(mockDB, mockEnv)

    // 創建群組
    const createResult = await service.createGroupOrder({
      restaurantId: 'R-001' }, 1)
    testGroupOrderId = createResult.data!.groupOrderId

    // 獲取創建者ID
    const members = Array.from(mockDB._mockData.groupMembers.values())
    testCreatorId = (members[0] as any).id

    // 添加測試菜品和購物車項目
    mockDB._mockData.menuItems.set(1, {
      id: 1,
      name: 'Test Item',
      price: 10,
      isAvailable: true
    })

    // 添加購物車項目
    const cartItem = {
      id: crypto.randomUUID(),
      groupOrderId: testGroupOrderId,
      memberId: testCreatorId,
      menuItemId: 1,
      quantity: 2,
      unitPrice: 10,
      totalPrice: 20,
      customizations: JSON.stringify({}),
      status: 'active',
      addedAt: new Date(),
      updatedAt: new Date()
    }
    mockDB._mockData.groupCartItems.set(cartItem.id, cartItem)
  })

  afterEach(() => {
    cleanupMockDB(mockDB)
  })

  it('應該成功初始化平均分帳', async () => {
    const result = await service.initiateSplit(
      testGroupOrderId,
      { splitType: 'equal' },
      testCreatorId
    )

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data!.length).toBeGreaterThan(0)
  })

  it('應該成功初始化個人項目分帳', async () => {
    const result = await service.initiateSplit(
      testGroupOrderId,
      { splitType: 'individual' },
      testCreatorId
    )

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
  })

  it('應該鎖定群組訂單狀態', async () => {
    await service.initiateSplit(
      testGroupOrderId,
      { splitType: 'equal' },
      testCreatorId
    )

    const groupOrder = mockDB._mockData.groupOrders.get(testGroupOrderId)
    expect(groupOrder?.status).toBe('checkout')
  })

  it('應該拒絕非創建者/管理員執行分帳', async () => {
    // 添加一個普通成員
    const memberData = {
      id: crypto.randomUUID(),
      groupOrderId: testGroupOrderId,
      role: 'member',
      isActive: true
    }
    mockDB._mockData.groupMembers.set(memberData.id, memberData)

    const result = await service.initiateSplit(
      testGroupOrderId,
      { splitType: 'equal' },
      memberData.id
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('沒有權限')
  })

  it('平均分帳應該正確計算每人金額', async () => {
    const result = await service.initiateSplit(
      testGroupOrderId,
      { splitType: 'equal' },
      testCreatorId
    )

    expect(result.success).toBe(true)

    const totalAmount = 20 // 來自購物車項目
    const memberCount = mockDB._mockData.groupMembers.size
    const perPersonAmount = totalAmount / memberCount

    result.data?.forEach(bill => {
      expect(bill.subtotal).toBeCloseTo(perPersonAmount, 2)
    })
  })
})
