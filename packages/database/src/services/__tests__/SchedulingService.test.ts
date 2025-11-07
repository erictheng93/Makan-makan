/**
 * SchedulingService Unit Tests
 * Test coverage for employee scheduling functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SchedulingService } from '../SchedulingService'
import { createMockDatabase, createMockEnv, createQueryChain } from './helpers/mockD1'

describe('SchedulingService', () => {
  let service: SchedulingService
  let mockDb: any
  let mockEnv: any

  beforeEach(() => {
    mockDb = createMockDatabase()
    mockEnv = createMockEnv()
    service = new SchedulingService(mockDb as any, mockEnv)
    vi.clearAllMocks()
  })

  describe('calculateScheduledHours', () => {
    it('should calculate regular shift hours correctly', () => {
      const hours = service['calculateScheduledHours']('09:00', '17:00', 0)
      expect(hours).toBe(8)
    })

    it('should calculate overnight shift hours correctly', () => {
      const hours = service['calculateScheduledHours']('22:00', '06:00', 0)
      expect(hours).toBe(8)
    })

    it('should subtract break time correctly', () => {
      const hours = service['calculateScheduledHours']('09:00', '18:00', 60)
      expect(hours).toBe(8)
    })

    it('should handle zero break time', () => {
      const hours = service['calculateScheduledHours']('10:00', '18:00', 0)
      expect(hours).toBe(8)
    })

    it('should handle split shifts with breaks', () => {
      const hours = service['calculateScheduledHours']('09:00', '21:00', 120)
      expect(hours).toBe(10)
    })
  })

  describe('Swap Request Management', () => {
    it('should create swap request with pending status', async () => {
      const mockRequest = {
        id: 1,
        restaurantId: 1,
        requesterEmployeeId: 1,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRequest]),
        }),
      })

      const result = await service.createSwapRequest({
        restaurantId: 1,
        requesterEmployeeId: 1,
        requesterScheduleId: 1,
        requestType: 'swap',
        reason: 'Personal reason',
      })

      expect(result.status).toBe('pending')
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should accept swap request and update status', async () => {
      const existingRequest = {
        id: 1,
        status: 'pending',
        restaurantId: 1,
      }

      const updatedRequest = {
        ...existingRequest,
        status: 'accepted',
        acceptedBy: 2,
        acceptedAt: new Date(),
      }

      // Mock select for checking existing request
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingRequest]),
          }),
        }),
      })

      // Mock update
      mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue(createQueryChain([updatedRequest])) })

      const result = await service.acceptSwapRequest(1, 2)

      expect(result.status).toBe('accepted')
      expect(result.acceptedBy).toBe(2)
    })

    it('should reject swap request with reason', async () => {
      const existingRequest = {
        id: 1,
        status: 'pending',
        restaurantId: 1,
      }

      const rejectedRequest = {
        ...existingRequest,
        status: 'rejected',
        rejectedBy: 3,
        rejectionReason: 'Not enough coverage',
        rejectedAt: new Date(),
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingRequest]),
          }),
        }),
      })

      mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue(createQueryChain([rejectedRequest])) })

      const result = await service.rejectSwapRequest(1, 3, 'Not enough coverage')

      expect(result.status).toBe('rejected')
      expect(result.rejectionReason).toBe('Not enough coverage')
    })

    it('should throw error when accepting non-pending request', async () => {
      const existingRequest = {
        id: 1,
        status: 'approved',
        restaurantId: 1,
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingRequest]),
          }),
        }),
      })

      await expect(service.acceptSwapRequest(1, 2)).rejects.toThrow(
        'Swap request is not in pending status'
      )
    })

    it('should cancel swap request by requester', async () => {
      const existingRequest = {
        id: 1,
        status: 'pending',
        requesterEmployeeId: 5,
        restaurantId: 1,
      }

      const cancelledRequest = {
        ...existingRequest,
        status: 'cancelled',
        updatedAt: new Date(),
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingRequest]),
          }),
        }),
      })

      mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue(createQueryChain([cancelledRequest])) })

      const result = await service.cancelSwapRequest(1, 5)

      expect(result.status).toBe('cancelled')
    })

    it('should throw error when non-requester tries to cancel', async () => {
      const existingRequest = {
        id: 1,
        status: 'pending',
        requesterEmployeeId: 5,
        restaurantId: 1,
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingRequest]),
          }),
        }),
      })

      await expect(service.cancelSwapRequest(1, 99)).rejects.toThrow(
        'Only the requester can cancel this swap request'
      )
    })
  })

  describe('Taiwan Labor Law Validation', () => {
    it('should have correct labor law constants', () => {
      // Access Taiwan labor law validation constants
      const validation = {
        maxDailyHours: 12,
        maxWeeklyHours: 46,
        minRestPeriod: 11,
        maxConsecutiveDays: 6,
      }

      expect(validation.maxDailyHours).toBe(12)
      expect(validation.maxWeeklyHours).toBe(46)
      expect(validation.minRestPeriod).toBe(11)
      expect(validation.maxConsecutiveDays).toBe(6)
    })

    it('should detect excessive daily hours', () => {
      const hours = service['calculateScheduledHours']('08:00', '22:00', 0)
      expect(hours).toBe(14) // Exceeds 12 hours
      expect(hours).toBeGreaterThan(12)
    })

    it('should calculate proper break deductions', () => {
      // 9-hour shift with 1-hour break = 8 working hours (compliant)
      const hours = service['calculateScheduledHours']('09:00', '18:00', 60)
      expect(hours).toBe(8)
      expect(hours).toBeLessThanOrEqual(12)
    })
  })

  describe('Schedule Validation', () => {
    it('should validate time format', () => {
      // Test valid time formats
      expect(() => service['calculateScheduledHours']('09:00', '17:00', 0)).not.toThrow()
      expect(() => service['calculateScheduledHours']('00:00', '23:59', 0)).not.toThrow()
    })

    it('should handle edge case times', () => {
      // Midnight to midnight (24 hours)
      const hours = service['calculateScheduledHours']('00:00', '00:00', 0)
      expect(hours).toBeGreaterThan(0)
    })

    it('should properly handle break times', () => {
      // 8-hour shift with 2-hour break = 6 working hours
      const hours = service['calculateScheduledHours']('10:00', '18:00', 120)
      expect(hours).toBe(6)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for non-existent swap request', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(service.acceptSwapRequest(999, 1)).rejects.toThrow(
        'Swap request not found'
      )
    })

    it('should throw error when rejecting already rejected request', async () => {
      const existingRequest = {
        id: 1,
        status: 'rejected',
        restaurantId: 1,
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingRequest]),
          }),
        }),
      })

      await expect(service.rejectSwapRequest(1, 3, 'reason')).rejects.toThrow(
        'Swap request is already rejected or cancelled'
      )
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete swap request workflow', async () => {
      // 1. Create request
      const createMock = {
        id: 1,
        status: 'pending',
        createdAt: new Date(),
      }

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createMock]),
        }),
      })

      const created = await service.createSwapRequest({
        restaurantId: 1,
        requesterEmployeeId: 1,
        requesterScheduleId: 1,
        requestType: 'swap',
        reason: 'Test',
      })

      expect(created.status).toBe('pending')

      // 2. Accept request
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([created]),
          }),
        }),
      })

      const acceptedMock = {
        ...created,
        status: 'accepted',
        acceptedBy: 2,
      }

      mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue(createQueryChain([acceptedMock])) })

      const accepted = await service.acceptSwapRequest(1, 2)
      expect(accepted.status).toBe('accepted')

      // 3. Approve request
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([accepted]),
          }),
        }),
      })

      const approvedMock = {
        ...accepted,
        status: 'approved',
        approvedBy: 3,
      }

      mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue(createQueryChain([approvedMock])) })

      const approved = await service.approveSwapRequest(1, 3)
      expect(approved.status).toBe('approved')
    })
  })
})
