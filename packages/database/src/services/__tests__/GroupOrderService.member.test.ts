/**
 * GroupOrderService - 成員管理測試
 *
 * 測試範圍: 成員離開群組
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

describe('GroupOrderService - 成員管理', () => {
  let service: GroupOrderService
  let mockDB: any
  let mockEnv: any
  let testGroupOrderId: string
  let testMemberId: string
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

    const members = Array.from(mockDB._mockData.groupMembers.values())
    testCreatorId = (members[0] as any).id

    // 添加普通成員
    const memberData = {
      id: crypto.randomUUID(),
      groupOrderId: testGroupOrderId,
      role: 'member',
      isActive: true,
      name: 'Test Member'
    }
    mockDB._mockData.groupMembers.set(memberData.id, memberData)
    testMemberId = memberData.id
  })

  afterEach(() => {
    cleanupMockDB(mockDB)
  })

  it('應該成功離開群組（普通成員）', async () => {
    const result = await service.leaveGroup(testGroupOrderId, testMemberId)

    expect(result.success).toBe(true)
  })

  it('應該拒絕創建者離開群組', async () => {
    const result = await service.leaveGroup(testGroupOrderId, testCreatorId)

    expect(result.success).toBe(false)
    expect(result.error).toContain('創建者無法離開')
  })

  it('應該將成員標記為非活躍', async () => {
    await service.leaveGroup(testGroupOrderId, testMemberId)

    const member = mockDB._mockData.groupMembers.get(testMemberId)
    expect(member?.isActive).toBe(false)
    expect(member?.leftAt).toBeDefined()
  })

  it('應該移除該成員的購物車項目', async () => {
    // 先添加購物車項目
    const cartItem = {
      id: crypto.randomUUID(),
      groupOrderId: testGroupOrderId,
      memberId: testMemberId,
      menuItemId: 1,
      quantity: 1,
      totalPrice: 10,
      status: 'active'
    }
    mockDB._mockData.groupCartItems.set(cartItem.id, cartItem)

    await service.leaveGroup(testGroupOrderId, testMemberId)

    const item = mockDB._mockData.groupCartItems.get(cartItem.id)
    expect(item?.status).toBe('removed')
  })
})
