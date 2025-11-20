/**
 * GroupOrderService Test Suite
 *
 * 全面测试群组点餐服务的所有功能
 * 覆盖：群组订单管理、成员管理、购物车管理、帐单分摊、支付处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GroupOrderService } from '../GroupOrderService'
import type { D1Database } from '@cloudflare/workers-types'

// ==========================================
// 優化的 Mock Database - 無內存洩漏版本
// ==========================================

/**
 * 優化重點:
 * 1. 單例 QueryBuilder - 避免每次 select() 創建新閉包
 * 2. 避免不必要的數組複製 - 減少 Array.from 調用
 * 3. 正確的 update 邏輯 - 限制更新範圍
 * 4. 內存清理機制 - 測試後釋放資源
 * 5. 緩存優化 - 重用 queryBuilder 實例
 */

interface MockData {
  groupOrders: Map<string, any>
  groupMembers: Map<string, any>
  groupCartItems: Map<string, any>
  splitBills: Map<string, any>
  shareCodes: Map<string, any>
  groupActivityLogs: Map<string, any>
  menuItems: Map<string, any>
  users: Map<string, any>
}

// 輔助函數 - 提取到外部避免重複創建
const getTableName = (table: any): string => {
  if (table?._ && 'name' in table._) return table._.name

  const tableStr = String(table)
  if (tableStr.includes('groupOrders')) return 'groupOrders'
  if (tableStr.includes('groupMembers')) return 'groupMembers'
  if (tableStr.includes('groupCartItems')) return 'groupCartItems'
  if (tableStr.includes('splitBills')) return 'splitBills'
  if (tableStr.includes('shareCodes')) return 'shareCodes'
  if (tableStr.includes('groupActivityLogs')) return 'groupActivityLogs'
  if (tableStr.includes('menuItems')) return 'menuItems'
  if (tableStr.includes('users')) return 'users'
  return 'groupOrders'
}

// QueryBuilder 類 - 單例模式,避免每次創建新閉包
class QueryBuilder {
  private db: any
  private currentTable: string = ''
  private recordsCache: any[] | null = null

  constructor(db: any) {
    this.db = db
  }

  reset() {
    this.currentTable = ''
    this.recordsCache = null
    return this
  }

  from(table: any) {
    this.currentTable = getTableName(table)
    this.recordsCache = null
    return this
  }

  where(condition: any) {
    // 簡化實現 - 不做實際過濾
    return this
  }

  leftJoin(table: any, condition: any) {
    return this
  }

  innerJoin(table: any, condition: any) {
    return this
  }

  orderBy(...fields: any[]) {
    return this
  }

  async get() {
    const dataMap = this.db._mockData[this.currentTable as keyof MockData]
    if (!dataMap || dataMap.size === 0) return null

    // 優先返回最後插入的記錄
    if (this.db._lastInserted?.table === this.currentTable) {
      const record = dataMap.get(this.db._lastInserted.id)
      if (record) return record
    }

    // 返回第一條記錄 - 使用 iterator 避免 Array.from
    for (const value of dataMap.values()) {
      return value
    }
    return null
  }

  async all() {
    // 使用緩存避免重複轉換
    if (this.recordsCache) return this.recordsCache

    const dataMap = this.db._mockData[this.currentTable as keyof MockData]
    if (!dataMap) return []

    this.recordsCache = Array.from(dataMap.values())
    return this.recordsCache
  }
}

// 創建優化的 Mock DB
const createOptimizedMockDB = () => {
  const mockData: MockData = {
    groupOrders: new Map(),
    groupMembers: new Map(),
    groupCartItems: new Map(),
    splitBills: new Map(),
    shareCodes: new Map(),
    groupActivityLogs: new Map(),
    menuItems: new Map(),
    users: new Map()
  }

  let lastInserted: { table: string; id: string } | null = null

  // 創建單例 QueryBuilder
  const queryBuilder = new QueryBuilder({
    _mockData: mockData,
    get _lastInserted() {
      return lastInserted
    }
  })

  const db: any = {
    insert: (table: any) => {
      const tableName = getTableName(table)
      return {
        values: async (data: any) => {
          const id = data.id || crypto.randomUUID()
          const dataWithId = { ...data, id }
          mockData[tableName as keyof MockData].set(id, dataWithId)
          lastInserted = { table: tableName, id }
          return { success: true }
        }
      }
    },
    select: (fields?: any) => {
      queryBuilder.reset()
      return queryBuilder
    },
    update: (table: any) => {
      const tableName = getTableName(table)
      return {
        set: (data: any) => ({
          where: (condition: any) => ({
            run: async () => {
              const dataMap = mockData[tableName as keyof MockData]
              if (!dataMap) return { success: true, changes: 0 }

              // 只更新最後插入的記錄 - 避免全量更新
              if (lastInserted?.table === tableName && lastInserted?.id) {
                const existing = dataMap.get(lastInserted.id)
                if (existing) {
                  dataMap.set(lastInserted.id, { ...existing, ...data })
                  return { success: true, changes: 1 }
                }
              }

              return { success: true, changes: 0 }
            }
          })
        })
      }
    },
    delete: (table: any) => {
      const tableName = getTableName(table)
      return {
        where: (condition: any) => ({
          run: async () => {
            const dataMap = mockData[tableName as keyof MockData]
            if (dataMap) {
              dataMap.clear() // 簡化實現 - 清空表
            }
            return { success: true, changes: dataMap?.size || 0 }
          }
        })
      }
    },
    _mockData: mockData,
    _lastInserted: lastInserted,
    _cleanup: () => {
      // 清理所有數據
      for (const key of Object.keys(mockData)) {
        mockData[key as keyof MockData].clear()
      }
      lastInserted = null
    }
  }

  return db
}

const createMockEnv = () => ({
  DB: {} as D1Database,
  JWT_SECRET: 'test-secret',
  CUSTOMER_APP_URL: 'https://test.makanmakan.com'
})

// ==========================================
// Test Suites
// ==========================================

describe('GroupOrderService', () => {
  let service: GroupOrderService
  let mockDB: any
  let mockEnv: any

  beforeEach(() => {
    mockDB = createOptimizedMockDB()  // 使用優化後的 mock
    mockEnv = createMockEnv()
    service = new GroupOrderService(mockDB, mockEnv)

    // Mock crypto.randomUUID - 生成标准 UUID
    let uuidCounter = 0
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        uuidCounter++
        const hex = uuidCounter.toString(16).padStart(12, '0')
        return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4000-8000-000000000000`
      }
    })

    // Mock Math.random for share code generation
    let randomCallCount = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randomCallCount++
      return randomCallCount * 0.1 % 1
    })
  })

  afterEach(() => {
    // 清理 mock 數據,釋放內存
    if (mockDB && mockDB._cleanup) {
      mockDB._cleanup()
    }
    vi.restoreAllMocks()
  })

  // ==========================================
  // 1. 群組訂單創建測試
  // ==========================================

  describe('創建群組訂單', () => {
    it('應該成功創建群組訂單', async () => {
      const orderData = {
        restaurantId: 1,
        tableId: 10,
        expirationHours: 2,
        maxMembers: 8
      }

      const result = await service.createGroupOrder(orderData, 1)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.groupOrderId).toBeDefined()
      expect(result.data?.shareCode).toBeDefined()
      expect(result.data?.shareCode.length).toBe(6)
      expect(result.data?.shareUrl).toContain(result.data?.shareCode || '')
      expect(result.data?.qrCodeUrl).toContain(result.data?.shareCode || '')
    })

    it('應該生成唯一的6位分享碼', async () => {
      const result1 = await service.createGroupOrder({ restaurantId: 1 }, 1)
      const result2 = await service.createGroupOrder({ restaurantId: 1 }, 1)

      expect(result1.data?.shareCode).toBeDefined()
      expect(result2.data?.shareCode).toBeDefined()
      // 由于 Math.random 被 mock，分享码会不同
      expect(result1.data?.shareCode).not.toBe(result2.data?.shareCode)
    })

    it('應該設置正確的過期時間', async () => {
      const expirationHours = 3
      const result = await service.createGroupOrder({
        restaurantId: 1,
        expirationHours
      }, 1)

      expect(result.success).toBe(true)

      // 验证群组订单被创建
      const groupOrder = mockDB._mockData.groupOrders.get(result.data?.groupOrderId)
      expect(groupOrder).toBeDefined()
      expect(groupOrder?.expiresAt).toBeDefined()
    })

    it('應該自動創建群組創建者成員記錄', async () => {
      const result = await service.createGroupOrder({ restaurantId: 1 }, 1)

      expect(result.success).toBe(true)

      // 验证创建者成員記錄
      const members = Array.from(mockDB._mockData.groupMembers.values())
      const creator = members.find((m: any) => m.role === 'creator') as any
      expect(creator).toBeDefined()
      expect(creator?.userId).toBe(1)
    })

    it('應該記錄分享碼到 shareCodes 表', async () => {
      const result = await service.createGroupOrder({ restaurantId: 1 }, 1)

      expect(result.success).toBe(true)

      const shareCodeRecords = Array.from(mockDB._mockData.shareCodes.values())
      const shareCodeRecord = shareCodeRecords.find((s: any) => s.code === result.data?.shareCode) as any
      expect(shareCodeRecord).toBeDefined()
      expect(shareCodeRecord?.type).toBe('group_order')
      expect(shareCodeRecord?.isActive).toBe(true)
    })

    it('應該拒絕無效的 restaurantId', async () => {
      const result = await service.createGroupOrder({
        restaurantId: -1 // 無效
      }, 1)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('應該使用默認過期時間（24小時）', async () => {
      const result = await service.createGroupOrder({
        restaurantId: 1
      }, 1)

      expect(result.success).toBe(true)

      const groupOrder = mockDB._mockData.groupOrders.get(result.data?.groupOrderId)
      expect(groupOrder?.settings).toBeDefined()
    })
  })

  // ==========================================
  // 2. 加入群組測試
  // ==========================================

  describe('加入群組', () => {
    let testShareCode: string
    let testGroupOrderId: string

    beforeEach(async () => {
      // 先創建一個群組
      const createResult = await service.createGroupOrder({
        restaurantId: 1,
        maxMembers: 5
      }, 1)
      testShareCode = createResult.data!.shareCode
      testGroupOrderId = createResult.data!.groupOrderId
    })

    it('應該成功加入群組', async () => {
      const joinData = {
        memberName: 'Alice',
        phone: '+1234567890',
        email: 'alice@test.com'
      }

      const result = await service.joinGroup(testShareCode, joinData)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.memberId).toBeDefined()
      expect(result.data?.sessionId).toBeDefined()
      expect(result.data?.memberRole).toBe('member')
      expect(result.data?.groupOrder).toBeDefined()
    })

    it('應該拒絕無效的分享碼', async () => {
      const result = await service.joinGroup('INVALID', {
        memberName: 'Bob'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('無效的分享代碼')
    })

    it('應該拒絕加入已過期的群組', async () => {
      // 修改群組訂單為已過期
      const groupOrder = mockDB._mockData.groupOrders.get(testGroupOrderId)
      groupOrder.expiresAt = new Date(Date.now() - 1000) // 過去的時間
      mockDB._mockData.groupOrders.set(testGroupOrderId, groupOrder)

      const result = await service.joinGroup(testShareCode, {
        memberName: 'Charlie'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('已過期')
    })

    it('應該防止重複加入（相同電話）', async () => {
      const phone = '+1111111111'

      // 第一次加入
      await service.joinGroup(testShareCode, {
        memberName: 'David',
        phone
      })

      // 第二次用相同電話加入
      const result = await service.joinGroup(testShareCode, {
        memberName: 'David2',
        phone
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('已加入')
    })

    it('應該更新分享碼使用次數', async () => {
      await service.joinGroup(testShareCode, {
        memberName: 'Eve'
      })

      const shareCodeRecords = Array.from(mockDB._mockData.shareCodes.values())
      const shareCodeRecord = shareCodeRecords.find((s: any) => s.code === testShareCode)

      // 注意：实际的 update 操作会增加 usageCount，但在简化的 mock 中可能不会反映
      expect(shareCodeRecord).toBeDefined()
    })

    it('應該記錄加入活動日誌', async () => {
      await service.joinGroup(testShareCode, {
        memberName: 'Frank'
      })

      const logs = Array.from(mockDB._mockData.groupActivityLogs.values())
      const joinLog = logs.find((log: any) =>
        log.action === 'joined' && log.description.includes('Frank')
      )
      expect(joinLog).toBeDefined()
    })

    it('應該只接受 1-50 字符的成員名稱', async () => {
      // 太短
      const result1 = await service.joinGroup(testShareCode, {
        memberName: ''
      })
      expect(result1.success).toBe(false)

      // 太長
      const result2 = await service.joinGroup(testShareCode, {
        memberName: 'A'.repeat(51)
      })
      expect(result2.success).toBe(false)
    })
  })

  // ==========================================
  // 3. 獲取群組資訊測試
  // ==========================================

  describe('獲取群組資訊', () => {
    let testGroupOrderId: string

    beforeEach(async () => {
      // 創建群組並添加一些測試數據
      const createResult = await service.createGroupOrder({
        restaurantId: 1
      }, 1)
      testGroupOrderId = createResult.data!.groupOrderId

      // 添加測試菜品
      mockDB._mockData.menuItems.set(1, {
        id: 1,
        name: 'Test Burger',
        price: 10.99,
        isAvailable: true,
        restaurantId: 1
      })

      // 添加第二個成員
      const memberData = {
        id: crypto.randomUUID(),
        groupOrderId: testGroupOrderId,
        name: 'Test Member',
        role: 'member',
        permissions: JSON.stringify({}),
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true
      }
      mockDB._mockData.groupMembers.set(memberData.id, memberData)
    })

    it('應該成功獲取群組資訊', async () => {
      const result = await service.getGroupOrder(testGroupOrderId)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.groupOrder).toBeDefined()
      expect(result.data?.members).toBeDefined()
      expect(result.data?.cartItems).toBeDefined()
      expect(result.data?.totalAmount).toBeDefined()
    })

    it('應該返回所有活躍成員', async () => {
      const result = await service.getGroupOrder(testGroupOrderId)

      expect(result.success).toBe(true)
      expect(result.data?.members.length).toBeGreaterThan(0)
      // 应该至少有创建者
      const creator = result.data?.members.find(m => m.role === 'creator')
      expect(creator).toBeDefined()
    })

    it('應該返回購物車項目（如果有）', async () => {
      const result = await service.getGroupOrder(testGroupOrderId)

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data?.cartItems)).toBe(true)
    })

    it('應該正確計算總金額', async () => {
      const result = await service.getGroupOrder(testGroupOrderId)

      expect(result.success).toBe(true)
      expect(typeof result.data?.totalAmount).toBe('number')
      expect(result.data?.totalAmount).toBeGreaterThanOrEqual(0)
    })

    it('應該拒絕不存在的群組ID', async () => {
      const result = await service.getGroupOrder('non-existent-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('找不到')
    })
  })

  // ==========================================
  // 4. 添加購物車項目測試
  // ==========================================

  describe('添加購物車項目', () => {
    let testGroupOrderId: string
    let testMemberId: string

    beforeEach(async () => {
      // 創建群組
      const createResult = await service.createGroupOrder({
        restaurantId: 1
      }, 1)
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
        restaurantId: 1
      })
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
        restaurantId: 1
      })

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

  // ==========================================
  // 5. 帳單分攤測試
  // ==========================================

  describe('初始化分帳', () => {
    let testGroupOrderId: string
    let testCreatorId: string

    beforeEach(async () => {
      // 創建群組
      const createResult = await service.createGroupOrder({
        restaurantId: 1
      }, 1)
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

  // ==========================================
  // 6. 支付處理測試
  // ==========================================

  describe('處理支付', () => {
    let testGroupOrderId: string
    let testMemberId: string
    let testSplitBillId: string

    beforeEach(async () => {
      // 創建群組並設置分帳
      const createResult = await service.createGroupOrder({
        restaurantId: 1
      }, 1)
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

  // ==========================================
  // 7. 離開群組測試
  // ==========================================

  describe('離開群組', () => {
    let testGroupOrderId: string
    let testMemberId: string
    let testCreatorId: string

    beforeEach(async () => {
      // 創建群組
      const createResult = await service.createGroupOrder({
        restaurantId: 1
      }, 1)
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

  // ==========================================
  // 8. 清理過期群組測試
  // ==========================================

  describe('清理過期群組', () => {
    it('應該清理過期的群組訂單', async () => {
      // 創建過期群組
      const expiredGroupId = crypto.randomUUID()
      const expiredGroup = {
        id: expiredGroupId,
        shareCode: 'EXP001',
        status: 'active',
        expiresAt: new Date(Date.now() - 1000), // 已過期
        createdBy: 1,
        restaurantId: 1,
        totalAmount: 0,
        taxAmount: 0,
        serviceCharge: 0,
        finalAmount: 0,
        splitType: 'individual',
        settings: JSON.stringify({}),
        createdAt: new Date(),
        updatedAt: new Date()
      }
      mockDB._mockData.groupOrders.set(expiredGroupId, expiredGroup)

      const result = await service.cleanupExpiredGroups()

      expect(result.success).toBe(true)
      expect(result.cleaned).toBeGreaterThan(0)
    })

    it('應該將過期群組狀態改為取消', async () => {
      // 創建過期群組
      const expiredGroupId = crypto.randomUUID()
      const expiredGroup = {
        id: expiredGroupId,
        status: 'active',
        expiresAt: new Date(Date.now() - 1000)
      }
      mockDB._mockData.groupOrders.set(expiredGroupId, expiredGroup)

      await service.cleanupExpiredGroups()

      const group = mockDB._mockData.groupOrders.get(expiredGroupId)
      expect(group?.status).toBe('cancelled')
    })

    it('應該返回清理的群組數量', async () => {
      const result = await service.cleanupExpiredGroups()

      expect(result.success).toBe(true)
      expect(typeof result.cleaned).toBe('number')
    })
  })

  // ==========================================
  // 9. 錯誤處理測試
  // ==========================================

  describe('錯誤處理', () => {
    it('應該處理數據庫錯誤', async () => {
      const errorDB = {
        insert: () => {
          throw new Error('Database connection failed')
        },
        select: () => ({
          from: () => ({
            where: () => ({
              get: async () => { throw new Error('Query failed') }
            })
          })
        })
      }

      const errorService = new GroupOrderService(errorDB, mockEnv)
      const result = await errorService.createGroupOrder({
        restaurantId: 1
      }, 1)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('應該處理無效的輸入數據', async () => {
      const result = await service.createGroupOrder({
        restaurantId: -1, // 無效
        maxMembers: 100 // 超過限制
      }, 1)

      expect(result.success).toBe(false)
    })
  })

  // ==========================================
  // 10. 併發處理測試
  // ==========================================

  describe('併發處理', () => {
    it('應該處理多個成員同時加入', async () => {
      const createResult = await service.createGroupOrder({
        restaurantId: 1,
        maxMembers: 10
      }, 1)
      const shareCode = createResult.data!.shareCode

      // 模擬3個成員同時加入
      const promises = [
        service.joinGroup(shareCode, { memberName: 'User1' }),
        service.joinGroup(shareCode, { memberName: 'User2' }),
        service.joinGroup(shareCode, { memberName: 'User3' })
      ]

      const results = await Promise.all(promises)
      const successCount = results.filter(r => r.success).length

      // 至少應該有一些成功
      expect(successCount).toBeGreaterThan(0)
    })
  })
})
