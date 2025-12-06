/**
 * WaitingListService Unit Tests
 * 測試候位系統服務的核心功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WaitingListService } from '../WaitingListService'
import type { WaitingStatus } from '@makanmakan/shared-types'

describe('WaitingListService', () => {
  let service: WaitingListService
  let mockDB: any
  let mockEnv: any

  beforeEach(() => {
    mockDB = createMockDB()
    mockEnv = createMockEnv()
    service = new WaitingListService(mockDB, mockEnv)
    vi.clearAllMocks()
  })

  // ==========================================
  // 候位管理測試
  // ==========================================

  describe('joinWaitingList - 加入候位', () => {
    it('應該成功加入候位列表', async () => {
      const request = {
        restaurantId: 'R-001',
        customerName: '張三',
        customerPhone: '0912345678',
        partySize: 4,
      }

      const result = await service.joinWaitingList(request)

      expect(result).toBeDefined()
      expect(result.customerName).toBe('張三')
      expect(result.partySize).toBe(4)
      expect(result.status).toBe('waiting')
      expect(result.queueNumber).toBeGreaterThan(0)
    })

    it('應該拒絕無效的電話號碼', async () => {
      const request = {
        restaurantId: 'R-001',
        customerName: '張三',
        customerPhone: '123', // 無效
        partySize: 4,
      }

      await expect(service.joinWaitingList(request)).rejects.toThrow()
    })

    it('應該拒絕無效的用餐人數', async () => {
      const request = {
        restaurantId: 'R-001',
        customerName: '張三',
        customerPhone: '0912345678',
        partySize: 25, // 超過上限
      }

      await expect(service.joinWaitingList(request)).rejects.toThrow()
    })

    it('應該防止重複排隊', async () => {
      const request = {
        restaurantId: 'R-001',
        customerName: '張三',
        customerPhone: '0912345678',
        partySize: 4,
      }

      // 設置已存在的記錄
      mockDB._mockData.waitingList.set('existing', {
        restaurant_id: 'R-001',
        customer_phone: '0912345678',
        status: 'waiting',
      })

      await expect(service.joinWaitingList(request)).rejects.toThrow(
        '您已在候位列表中'
      )
    })

    it('應該生成正確的排隊號碼', async () => {
      const request1 = {
        restaurantId: 'R-001',
        customerName: '張三',
        customerPhone: '0912345678',
        partySize: 2,
      }

      const request2 = {
        restaurantId: 'R-001',
        customerName: '李四',
        customerPhone: '0923456789',
        partySize: 2,
      }

      const result1 = await service.joinWaitingList(request1)
      const result2 = await service.joinWaitingList(request2)

      expect(result2.queueNumber).toBeGreaterThan(result1.queueNumber)
      expect(result1.queueLetter).toBe('A') // 2人桌
      expect(result2.queueLetter).toBe('A')
    })
  })

  describe('callWaiting - 叫號', () => {
    it('應該成功叫號', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'waiting',
        party_size: 4,
        restaurant_id: 'R-001',
      })

      mockDB._mockData.tables.set(1, {
        id: 1,
        current_status: 'available',
        capacity: 6,
      })

      const result = await service.callWaiting(entryId, { tableId: 1 })

      expect(result.status).toBe('called')
      expect(result.tableId).toBe(1)
      expect(result.calledAt).toBeDefined()
      expect(result.timeoutAt).toBeDefined()
    })

    it('應該拒絕叫號非等待狀態的候位', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'seated', // 已入座
        restaurant_id: 'R-001',
      })

      await expect(
        service.callWaiting(entryId, { tableId: 1 })
      ).rejects.toThrow()
    })

    it('應該驗證桌位可用性', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'waiting',
        party_size: 4,
        restaurant_id: 'R-001',
      })

      mockDB._mockData.tables.set(1, {
        id: 1,
        current_status: 'occupied', // 已佔用
        capacity: 6,
      })

      await expect(
        service.callWaiting(entryId, { tableId: 1 })
      ).rejects.toThrow('桌位不可用')
    })

    it('應該驗證桌位容量', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'waiting',
        party_size: 6,
        restaurant_id: 'R-001',
      })

      mockDB._mockData.tables.set(1, {
        id: 1,
        current_status: 'available',
        capacity: 4, // 容量不足
      })

      await expect(
        service.callWaiting(entryId, { tableId: 1 })
      ).rejects.toThrow('桌位容量不足')
    })
  })

  describe('confirmWaiting - 確認候位', () => {
    it('應該成功確認', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'called',
        timeout_at: Date.now() + 300000, // 5分鐘後
        restaurant_id: 'R-001',
      })

      const result = await service.confirmWaiting(entryId)

      expect(result.status).toBe('confirmed')
      expect(result.confirmedAt).toBeDefined()
    })

    it('應該拒絕確認未叫號的候位', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'waiting',
        restaurant_id: 'R-001',
      })

      await expect(service.confirmWaiting(entryId)).rejects.toThrow(
        '此候位尚未叫號'
      )
    })

    it('應該檢查超時', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'called',
        timeout_at: Date.now() - 1000, // 已超時
        restaurant_id: 'R-001',
      })

      await expect(service.confirmWaiting(entryId)).rejects.toThrow('已超時')
    })
  })

  describe('markSeated - 標記入座', () => {
    it('應該成功標記入座', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'confirmed',
        table_id: 1,
        restaurant_id: 'R-001',
      })

      const result = await service.markSeated(entryId)

      expect(result.status).toBe('seated')
      expect(result.seatedAt).toBeDefined()
    })

    it('應該更新桌位狀態為佔用', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'confirmed',
        table_id: 1,
        restaurant_id: 'R-001',
      })

      await service.markSeated(entryId)

      // 驗證桌位狀態已更新（需要 mock 實現）
      expect(mockDB._updateCalled).toBe(true)
    })
  })

  describe('cancelWaiting - 取消候位', () => {
    it('應該成功取消候位', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'waiting',
        restaurant_id: 'R-001',
      })

      const result = await service.cancelWaiting(entryId)

      expect(result.status).toBe('cancelled')
      expect(result.cancelledAt).toBeDefined()
    })

    it('應該釋放已分配的桌位', async () => {
      const entryId = 'wait-001'
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: 'called',
        table_id: 1,
        restaurant_id: 'R-001',
      })

      await service.cancelWaiting(entryId)

      expect(mockDB._updateCalled).toBe(true)
    })
  })

  // ==========================================
  // 等待時間預估測試
  // ==========================================

  describe('estimateWaitTime - 預估等待時間', () => {
    it('應該計算基本等待時間', async () => {
      const request = {
        restaurantId: 'R-001',
        partySize: 4,
      }

      const result = await service.estimateWaitTime(request)

      expect(result.estimatedWaitMinutes).toBeGreaterThanOrEqual(0)
      expect(result.partiesAhead).toBeGreaterThanOrEqual(0)
      expect(result.availableTables).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('應該在沒有排隊時返回短等待時間', async () => {
      // 設置有空桌且無人排隊
      mockDB._mockData.tables.set(1, {
        id: 1,
        capacity: 4,
        current_status: 'available',
      })

      const result = await service.estimateWaitTime({
        restaurantId: 'R-001',
        partySize: 4,
      })

      expect(result.estimatedWaitMinutes).toBeLessThan(10)
      expect(result.partiesAhead).toBe(0)
      expect(result.availableTables).toBeGreaterThan(0)
    })

    it('應該根據前方人數調整時間', async () => {
      // 設置多組人在排隊
      for (let i = 0; i < 5; i++) {
        mockDB._mockData.waitingList.set(`wait-${i}`, {
          id: `wait-${i}`,
          status: 'waiting',
          party_size: 4,
          restaurant_id: 'R-001',
        })
      }

      const result = await service.estimateWaitTime({
        restaurantId: 'R-001',
        partySize: 4,
      })

      expect(result.partiesAhead).toBe(5)
      expect(result.estimatedWaitMinutes).toBeGreaterThan(10)
    })

    it('應該考慮尖峰時段調整', async () => {
      // Mock 當前時間為尖峰時段（晚上7點）
      vi.setSystemTime(new Date('2024-01-01T19:00:00'))

      const result = await service.estimateWaitTime({
        restaurantId: 'R-001',
        partySize: 4,
      })

      // 尖峰時段應該有較長等待時間
      expect(result.estimatedWaitMinutes).toBeGreaterThan(0)

      vi.useRealTimers()
    })
  })

  describe('getQueueStatus - 隊列狀態', () => {
    it('應該返回完整的隊列狀態', async () => {
      const result = await service.getQueueStatus('R-001')

      expect(result.restaurantId).toBe('R-001')
      expect(result.totalWaiting).toBeGreaterThanOrEqual(0)
      expect(result.averageWaitMinutes).toBeGreaterThanOrEqual(0)
      expect(result.availableTables).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(result.byTableType)).toBe(true)
    })

    it('應該按桌型分類統計', async () => {
      const result = await service.getQueueStatus('R-001')

      expect(result.byTableType.length).toBeGreaterThan(0)
      result.byTableType.forEach((type) => {
        expect(type.type).toBeDefined()
        expect(type.waiting).toBeGreaterThanOrEqual(0)
        expect(type.averageWait).toBeGreaterThanOrEqual(0)
      })
    })
  })

  // ==========================================
  // 統計分析測試
  // ==========================================

  describe('getWaitingStats - 候位統計', () => {
    it('應該返回今日統計', async () => {
      const result = await service.getWaitingStats('R-001')

      expect(result.restaurantId).toBe('R-001')
      expect(result.totalWaiting).toBeGreaterThanOrEqual(0)
      expect(result.seatedCount).toBeGreaterThanOrEqual(0)
      expect(result.expiredCount).toBeGreaterThanOrEqual(0)
      expect(result.cancelledCount).toBeGreaterThanOrEqual(0)
      expect(result.avgWaitMinutes).toBeGreaterThanOrEqual(0)
      expect(result.expireRate).toBeGreaterThanOrEqual(0)
    })

    it('應該支持指定日期查詢', async () => {
      const result = await service.getWaitingStats('R-001', '2024-01-01')

      expect(result.date).toBe('2024-01-01')
    })
  })

  // ==========================================
  // 輔助方法測試
  // ==========================================

  describe('Helper Methods', () => {
    it('應該正確驗證候位資料', () => {
      const validData = {
        restaurantId: 'R-001',
        customerName: '張三',
        customerPhone: '0912345678',
        partySize: 4,
      }

      expect(() => {
        service['validateWaitingListData'](validData)
      }).not.toThrow()
    })

    it('應該拒絕空白姓名', () => {
      const invalidData = {
        restaurantId: 'R-001',
        customerName: '',
        customerPhone: '0912345678',
        partySize: 4,
      }

      expect(() => {
        service['validateWaitingListData'](invalidData)
      }).toThrow('顧客姓名為必填')
    })

    it('應該根據人數生成正確的隊列字母', async () => {
      const result2 = await service['generateQueueNumber']('R-001', 2)
      expect(result2.letter).toBe('A') // 2人桌

      const result4 = await service['generateQueueNumber']('R-001', 4)
      expect(result4.letter).toBe('B') // 4人桌

      const result6 = await service['generateQueueNumber']('R-001', 6)
      expect(result6.letter).toBe('C') // 6人+桌
    })

    it('應該計算前方組數', async () => {
      // 設置測試數據
      mockDB._mockData.waitingList.set('wait-1', {
        restaurant_id: 'R-001',
        status: 'waiting',
        queue_number: 1,
        party_size: 4,
      })
      mockDB._mockData.waitingList.set('wait-2', {
        restaurant_id: 'R-001',
        status: 'waiting',
        queue_number: 2,
        party_size: 4,
      })

      const count = await service['getPartiesAhead']('R-001', 3, 4)

      expect(count).toBe(2)
    })
  })

  // ==========================================
  // 錯誤處理測試
  // ==========================================

  describe('Error Handling', () => {
    it('應該處理資料庫錯誤', async () => {
      const errorDB = {
        get: async () => {
          throw new Error('Database error')
        },
        all: async () => {
          throw new Error('Database error')
        },
        run: async () => {
          throw new Error('Database error')
        },
      }

      const errorService = new WaitingListService(errorDB, mockEnv)

      await expect(
        errorService.joinWaitingList({
          restaurantId: 'R-001',
          customerName: 'Test',
          customerPhone: '0912345678',
          partySize: 4,
        })
      ).rejects.toThrow()
    })

    it('應該處理不存在的候位記錄', async () => {
      const result = await service.getWaitingListEntryById('non-existent')

      expect(result).toBeNull()
    })
  })
})

// ==========================================
// Mock Helpers
// ==========================================

function createMockDB() {
  const mockData = {
    waitingList: new Map(),
    tables: new Map(),
    orders: new Map(),
    restaurants: new Map(),
  }

  let _updateCalled = false

  return {
    get: async (query: any) => {
      const tableName = extractTableNameFromQuery(query)
      const data = mockData[tableName as keyof typeof mockData]
      if (data && data.size > 0) {
        return Array.from(data.values())[0]
      }
      return null
    },
    all: async (query: any) => {
      const tableName = extractTableNameFromQuery(query)
      const data = mockData[tableName as keyof typeof mockData]
      if (data) {
        return Array.from(data.values())
      }
      return []
    },
    run: async (query: any) => {
      _updateCalled = true
      return { success: true }
    },
    _mockData: mockData,
    _updateCalled,
  }
}

function extractTableNameFromQuery(query: any): string {
  const queryString = query.toString()
  if (queryString.includes('waiting_list')) return 'waitingList'
  if (queryString.includes('tables')) return 'tables'
  if (queryString.includes('orders')) return 'orders'
  return 'waitingList'
}

function createMockEnv() {
  return {
    JWT_SECRET: 'test-secret',
  }
}
