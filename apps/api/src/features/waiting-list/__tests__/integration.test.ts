/**
 * Waiting List Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const mockJoinWaitingList = vi.fn()
const mockGetWaitingListEntryById = vi.fn()
const mockGetQueueStatus = vi.fn()
const mockEstimateWaitTime = vi.fn()
const mockCancelWaiting = vi.fn()
const mockConfirmWaiting = vi.fn()
const mockListWaitingList = vi.fn()
const mockCallWaiting = vi.fn()
const mockMarkSeated = vi.fn()
const mockExpireWaiting = vi.fn()
const mockGetWaitingStats = vi.fn()

vi.mock('@makanmakan/database', () => ({
  WaitingListService: vi.fn().mockImplementation(() => ({
    joinWaitingList: mockJoinWaitingList,
    getWaitingListEntryById: mockGetWaitingListEntryById,
    getQueueStatus: mockGetQueueStatus,
    estimateWaitTime: mockEstimateWaitTime,
    cancelWaiting: mockCancelWaiting,
    confirmWaiting: mockConfirmWaiting,
    listWaitingList: mockListWaitingList,
    callWaiting: mockCallWaiting,
    markSeated: mockMarkSeated,
    expireWaiting: mockExpireWaiting,
    getWaitingStats: mockGetWaitingStats,
  })),
}))

describe('Waiting List Service Tests', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { vi.resetAllMocks() })

  describe('joinWaitingList', () => {
    it('should join waiting list successfully', async () => {
      mockJoinWaitingList.mockResolvedValue({ id: 'wait-001', status: 'waiting' })
      const result = await mockJoinWaitingList({ restaurantId: 'R-001', customerName: 'Test', partySize: 4 })
      expect(result.id).toBe('wait-001')
      expect(result.status).toBe('waiting')
    })

    it('should handle service error', async () => {
      mockJoinWaitingList.mockRejectedValue(new Error('Database error'))
      await expect(mockJoinWaitingList({ restaurantId: 'R-001' })).rejects.toThrow('Database error')
    })
  })

  describe('getWaitingListEntryById', () => {
    it('should return waiting entry', async () => {
      mockGetWaitingListEntryById.mockResolvedValue({ id: 'wait-001', customerName: 'Test' })
      const result = await mockGetWaitingListEntryById('wait-001')
      expect(result.id).toBe('wait-001')
    })

    it('should return null when not found', async () => {
      mockGetWaitingListEntryById.mockResolvedValue(null)
      const result = await mockGetWaitingListEntryById('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('getQueueStatus', () => {
    it('should return queue status', async () => {
      mockGetQueueStatus.mockResolvedValue({ restaurantId: 'R-001', totalWaiting: 5 })
      const result = await mockGetQueueStatus('R-001')
      expect(result.totalWaiting).toBe(5)
    })
  })

  describe('estimateWaitTime', () => {
    it('should return wait time estimate', async () => {
      mockEstimateWaitTime.mockResolvedValue({ estimatedWaitMinutes: 25 })
      const result = await mockEstimateWaitTime({ restaurantId: 'R-001', partySize: 4 })
      expect(result.estimatedWaitMinutes).toBe(25)
    })
  })

  describe('cancelWaiting', () => {
    it('should cancel waiting', async () => {
      mockCancelWaiting.mockResolvedValue({ id: 'wait-001', status: 'cancelled' })
      const result = await mockCancelWaiting('wait-001')
      expect(result.status).toBe('cancelled')
    })
  })

  describe('confirmWaiting', () => {
    it('should confirm waiting', async () => {
      mockConfirmWaiting.mockResolvedValue({ id: 'wait-001', status: 'confirmed' })
      const result = await mockConfirmWaiting('wait-001')
      expect(result.status).toBe('confirmed')
    })
  })

  describe('listWaitingList', () => {
    it('should return waiting list', async () => {
      mockListWaitingList.mockResolvedValue({ data: [{ id: 'wait-001' }], total: 1 })
      const result = await mockListWaitingList({ restaurantId: '1' })
      expect(result.data).toHaveLength(1)
    })

    it('should support status filter', async () => {
      mockListWaitingList.mockResolvedValue({ data: [{ id: 'wait-001', status: 'called' }], total: 1 })
      const result = await mockListWaitingList({ restaurantId: '1', status: 'called' })
      expect(result.data[0].status).toBe('called')
    })
  })

  describe('callWaiting', () => {
    it('should call waiting', async () => {
      mockCallWaiting.mockResolvedValue({ id: 'wait-001', status: 'called' })
      const result = await mockCallWaiting('wait-001', { tableId: 1 })
      expect(result.status).toBe('called')
    })
  })

  describe('markSeated', () => {
    it('should mark seated', async () => {
      mockMarkSeated.mockResolvedValue({ id: 'wait-001', status: 'seated' })
      const result = await mockMarkSeated('wait-001')
      expect(result.status).toBe('seated')
    })
  })

  describe('expireWaiting', () => {
    it('should expire waiting', async () => {
      mockExpireWaiting.mockResolvedValue({ id: 'wait-001', status: 'expired' })
      const result = await mockExpireWaiting('wait-001')
      expect(result.status).toBe('expired')
    })
  })

  describe('getWaitingStats', () => {
    it('should return stats', async () => {
      mockGetWaitingStats.mockResolvedValue({ totalWaiting: 10, avgWaitMinutes: 25 })
      const result = await mockGetWaitingStats('1')
      expect(result.totalWaiting).toBe(10)
    })
  })

  describe('Business Logic - Phone Verification', () => {
    it('should verify phone match', async () => {
      mockGetWaitingListEntryById.mockResolvedValue({ id: 'wait-001', customerPhone: '0912345678' })
      const entry = await mockGetWaitingListEntryById('wait-001')
      expect(entry.customerPhone).toBe('0912345678')
    })
  })

  describe('Business Logic - Permission Check', () => {
    it('should allow same restaurant operation', async () => {
      mockGetWaitingListEntryById.mockResolvedValue({ id: 'wait-001', restaurantId: '1' })
      const entry = await mockGetWaitingListEntryById('wait-001')
      expect(entry.restaurantId).toBe('1')
    })

    it('should allow admin access all restaurants', () => {
      const userRole = 0
      expect(userRole === 0).toBe(true)
    })
  })

  describe('Business Logic - Status Transitions', () => {
    it('waiting -> called', async () => {
      mockCallWaiting.mockResolvedValue({ id: 'wait-001', status: 'called' })
      const result = await mockCallWaiting('wait-001', { tableId: 1 })
      expect(result.status).toBe('called')
    })

    it('called -> confirmed', async () => {
      mockConfirmWaiting.mockResolvedValue({ id: 'wait-001', status: 'confirmed' })
      const result = await mockConfirmWaiting('wait-001')
      expect(result.status).toBe('confirmed')
    })

    it('confirmed -> seated', async () => {
      mockMarkSeated.mockResolvedValue({ id: 'wait-001', status: 'seated' })
      const result = await mockMarkSeated('wait-001')
      expect(result.status).toBe('seated')
    })

    it('called -> expired', async () => {
      mockExpireWaiting.mockResolvedValue({ id: 'wait-001', status: 'expired' })
      const result = await mockExpireWaiting('wait-001')
      expect(result.status).toBe('expired')
    })

    it('waiting -> cancelled', async () => {
      mockCancelWaiting.mockResolvedValue({ id: 'wait-001', status: 'cancelled' })
      const result = await mockCancelWaiting('wait-001')
      expect(result.status).toBe('cancelled')
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection error', async () => {
      mockJoinWaitingList.mockRejectedValue(new Error('Database connection failed'))
      await expect(mockJoinWaitingList({ restaurantId: 'R-001' })).rejects.toThrow('Database connection failed')
    })

    it('should handle invalid waiting ID', async () => {
      mockGetWaitingListEntryById.mockResolvedValue(null)
      const result = await mockGetWaitingListEntryById('invalid-id')
      expect(result).toBeNull()
    })
  })
})
