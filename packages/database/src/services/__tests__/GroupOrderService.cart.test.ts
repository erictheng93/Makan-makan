/**
 * GroupOrderService - 購物車操作測試
 *
 * 測試範圍: 添加、更新、刪除購物車項目
 * 測試數量: 6 個測試
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

describe('GroupOrderService - 購物車操作', () => {
  let service: GroupOrderService
  let mockDB: any
  let mockEnv: any
  let testGroupOrderId: string
  let testMemberId: string

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

    // 獲取創建者成員ID
    const members = Array.from(mockDB._mockData.groupMembers.values())
    testMemberId = (members[0] as any).id

    // 添加測試菜品
    mockDB._mockData.menuItems.set(1, {
      id: 1,
      name: 'Test Pizza',
      price: 15.99,
      isAvailable: true,
      restaurantId: 'R-001' })
  })

  afterEach(() => {
    cleanupMockDB(mockDB)
  })

  it('應該成功添加購物車項目', async () => {
    const itemData = {
      memberId: testMemberId,
      menuItemId: 1,
      quantity: 2,
      customizations: { size: 'large', extra_cheese: true },
      specialInstructions: 'Extra crispy'
    }

    const result = await service.addCartItem(testGroupOrderId, itemData)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.menuItemId).toBe(1)
    expect(result.data?.quantity).toBe(2)
    expect(result.data?.unitPrice).toBeGreaterThan(0)
    expect(result.data?.totalPrice).toBeGreaterThan(0)
  })

  it('應該正確計算項目總價', async () => {
    const itemData = {
      memberId: testMemberId,
      menuItemId: 1,
      quantity: 3
    }

    const result = await service.addCartItem(testGroupOrderId, itemData)

    expect(result.success).toBe(true)
    expect(result.data?.totalPrice).toBe(15.99 * 3)
  })

  it('應該拒絕無效的成員ID', async () => {
    const result = await service.addCartItem(testGroupOrderId, {
      memberId: 'invalid-member-id',
      menuItemId: 1,
      quantity: 1
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('無效的成員')
  })

  it('應該拒絕不可用的菜品', async () => {
    // 添加一個不可用的菜品
    mockDB._mockData.menuItems.set(999, {
      id: 999,
      name: 'Unavailable Item',
      price: 10,
      isAvailable: false,
      restaurantId: 'R-001' })

    const result = await service.addCartItem(testGroupOrderId, {
      memberId: testMemberId,
      menuItemId: 999,
      quantity: 1
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('不存在或不可用')
  })

  it('應該記錄添加項目的活動日誌', async () => {
    await service.addCartItem(testGroupOrderId, {
      memberId: testMemberId,
      menuItemId: 1,
      quantity: 1
    })

    const logs = Array.from(mockDB._mockData.groupActivityLogs.values())
    const addLog = logs.find((log: any) => log.action === 'added_item')
    expect(addLog).toBeDefined()
  })

  it('應該拒絕負數或零數量', async () => {
    const result = await service.addCartItem(testGroupOrderId, {
      memberId: testMemberId,
      menuItemId: 1,
      quantity: 0
    })

    expect(result.success).toBe(false)
  })
})
