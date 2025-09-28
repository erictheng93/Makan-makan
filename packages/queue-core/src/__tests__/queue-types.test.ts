/**
 * Queue Core Types Tests
 */

import { describe, it, expect } from 'vitest'
import {
  QueueStatus,
  QueueType,
  NotificationType,
  validateJoinQueue,
  validateCallNext,
  QueueError,
  QueueNotFoundError,
  isQueueError,
  formatErrorResponse
} from '../index'

describe('Queue Core Types', () => {
  describe('Enums', () => {
    it('should have correct QueueStatus values', () => {
      expect(QueueStatus.WAITING).toBe('waiting')
      expect(QueueStatus.CALLED).toBe('called')
      expect(QueueStatus.SEATED).toBe('seated')
      expect(QueueStatus.CANCELLED).toBe('cancelled')
      expect(QueueStatus.NO_SHOW).toBe('no_show')
    })

    it('should have correct QueueType values', () => {
      expect(QueueType.WALKIN).toBe('walkin')
      expect(QueueType.ONLINE).toBe('online')
      expect(QueueType.PHONE).toBe('phone')
      expect(QueueType.RESERVATION).toBe('reservation')
    })

    it('should have correct NotificationType values', () => {
      expect(NotificationType.SMS).toBe('sms')
      expect(NotificationType.PUSH).toBe('push')
      expect(NotificationType.EMAIL).toBe('email')
      expect(NotificationType.CALL).toBe('call')
    })
  })

  describe('Validators', () => {
    describe('validateJoinQueue', () => {
      it('should validate valid join queue request', () => {
        const validRequest = {
          restaurantId: 1,
          customerName: 'John Doe',
          customerPhone: '+1234567890',
          partySize: 4,
          queueType: QueueType.ONLINE,
          notificationMethods: [NotificationType.SMS]
        }

        expect(() => validateJoinQueue(validRequest)).not.toThrow()
      })

      it('should throw on invalid restaurant ID', () => {
        const invalidRequest = {
          restaurantId: -1,
          customerName: 'John Doe',
          partySize: 4
        }

        expect(() => validateJoinQueue(invalidRequest)).toThrow()
      })

      it('should throw on empty customer name', () => {
        const invalidRequest = {
          restaurantId: 1,
          customerName: '',
          partySize: 4
        }

        expect(() => validateJoinQueue(invalidRequest)).toThrow()
      })

      it('should throw on invalid party size', () => {
        const invalidRequest = {
          restaurantId: 1,
          customerName: 'John Doe',
          partySize: 0
        }

        expect(() => validateJoinQueue(invalidRequest)).toThrow()
      })
    })

    describe('validateCallNext', () => {
      it('should validate valid call next request', () => {
        const validRequest = {
          restaurantId: 1,
          tableId: 5
        }

        expect(() => validateCallNext(validRequest)).not.toThrow()
      })

      it('should validate request with specific queue ID', () => {
        const validRequest = {
          restaurantId: 1,
          specificQueueId: '550e8400-e29b-41d4-a716-446655440000'
        }

        expect(() => validateCallNext(validRequest)).not.toThrow()
      })

      it('should throw on invalid restaurant ID', () => {
        const invalidRequest = {
          restaurantId: -1
        }

        expect(() => validateCallNext(invalidRequest)).toThrow()
      })
    })
  })

  describe('Error Handling', () => {
    describe('QueueError', () => {
      it('should create QueueError with correct properties', () => {
        const error = new QueueError('Test error', 'TEST_ERROR', 400, { test: true })

        expect(error.message).toBe('Test error')
        expect(error.code).toBe('TEST_ERROR')
        expect(error.statusCode).toBe(400)
        expect(error.details).toEqual({ test: true })
      })
    })

    describe('QueueNotFoundError', () => {
      it('should create QueueNotFoundError with correct properties', () => {
        const queueId = '550e8400-e29b-41d4-a716-446655440000'
        const error = new QueueNotFoundError(queueId)

        expect(error.message).toBe(`Queue with ID ${queueId} not found`)
        expect(error.code).toBe('QUEUE_NOT_FOUND')
        expect(error.statusCode).toBe(404)
        expect(error.details).toEqual({ queueId })
      })
    })

    describe('isQueueError', () => {
      it('should return true for QueueError instances', () => {
        const error = new QueueError('Test', 'TEST', 400)
        expect(isQueueError(error)).toBe(true)
      })

      it('should return false for regular Error instances', () => {
        const error = new Error('Test')
        expect(isQueueError(error)).toBe(false)
      })

      it('should return false for non-error values', () => {
        expect(isQueueError('test')).toBe(false)
        expect(isQueueError(null)).toBe(false)
        expect(isQueueError(undefined)).toBe(false)
      })
    })

    describe('formatErrorResponse', () => {
      it('should format QueueError correctly', () => {
        const error = new QueueError('Test error', 'TEST_ERROR', 400, { test: true })
        const response = formatErrorResponse(error)

        expect(response).toEqual({
          success: false,
          error: 'Test error',
          code: 'TEST_ERROR',
          details: { test: true }
        })
      })

      it('should format regular Error correctly', () => {
        const error = new Error('Regular error')
        const response = formatErrorResponse(error)

        expect(response).toEqual({
          success: false,
          error: 'Regular error',
          code: 'UNKNOWN_ERROR'
        })
      })

      it('should format unknown errors correctly', () => {
        const response = formatErrorResponse('string error')

        expect(response).toEqual({
          success: false,
          error: 'An unknown error occurred',
          code: 'UNKNOWN_ERROR'
        })
      })
    })
  })
})