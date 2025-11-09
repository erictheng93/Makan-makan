/**
 * Error Tracking Unit Tests
 * Comprehensive test coverage for error tracking system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ErrorTracker,
  getErrorTracker,
  resetErrorTracker,
  type ErrorContext,
  type ErrorBreadcrumb,
  type TrackedError,
  type ErrorTrackingOptions,
  type ErrorSeverity
} from '../error-tracking'

describe('ErrorTracker', () => {
  let tracker: ErrorTracker

  beforeEach(() => {
    tracker = new ErrorTracker({
      enabled: true,
      debug: false,
      captureConsoleErrors: false, // Disable global handlers in tests
      captureUnhandledRejections: false
    })
  })

  afterEach(() => {
    tracker.clearErrors()
    tracker.clearBreadcrumbs()
  })

  describe('Error Capture', () => {
    it('should capture error object', () => {
      // Arrange
      const error = new Error('Test error')

      // Act
      const errorId = tracker.captureError(error)

      // Assert
      expect(errorId).toBeTruthy()
      const captured = tracker.getError(errorId)
      expect(captured).toBeDefined()
      expect(captured?.message).toBe('Test error')
      expect(captured?.name).toBe('Error')
    })

    it('should capture error string', () => {
      // Act
      const errorId = tracker.captureError('String error message')

      // Assert
      const captured = tracker.getError(errorId)
      expect(captured?.message).toBe('String error message')
    })

    it('should capture error with custom severity', () => {
      // Arrange
      const error = new Error('Critical failure')

      // Act
      const errorId = tracker.captureError(error, {
        severity: 'critical'
      })

      // Assert
      const captured = tracker.getError(errorId)
      expect(captured?.severity).toBe('critical')
    })

    it('should capture error with custom category', () => {
      // Arrange
      const error = new Error('Database connection failed')

      // Act
      const errorId = tracker.captureError(error, {
        category: 'database'
      })

      // Assert
      const captured = tracker.getError(errorId)
      expect(captured?.category).toBe('database')
    })

    it('should capture error with custom context', () => {
      // Arrange
      const error = new Error('Test error')
      const context: Partial<ErrorContext> = {
        user: { id: 123, role: 'admin' },
        request: { url: '/api/test', method: 'GET' }
      }

      // Act
      const errorId = tracker.captureError(error, { context })

      // Assert
      const captured = tracker.getError(errorId)
      expect(captured?.context.user?.id).toBe(123)
      expect(captured?.context.request?.url).toBe('/api/test')
    })
  })

  describe('Error Deduplication', () => {
    it('should increment occurrence count for duplicate errors', () => {
      // Arrange
      const error = new Error('Duplicate error')

      // Act
      const id1 = tracker.captureError(error)
      const id2 = tracker.captureError(error)
      const id3 = tracker.captureError(error)

      // Assert
      expect(id1).toBe(id2)
      expect(id2).toBe(id3)

      const captured = tracker.getError(id1)
      expect(captured?.occurrenceCount).toBe(3)
    })

    it('should update lastOccurrence timestamp on duplicates', () => {
      // Arrange
      const error = new Error('Test error')
      vi.useFakeTimers()

      // Act
      const id1 = tracker.captureError(error)
      const captured1 = tracker.getError(id1)!
      const firstTimestamp = captured1.lastOccurrence

      vi.advanceTimersByTime(1000)
      tracker.captureError(error)
      const captured2 = tracker.getError(id1)!

      // Assert
      expect(captured2.lastOccurrence).toBeGreaterThan(firstTimestamp)

      // Cleanup
      vi.useRealTimers()
    })

    it('should keep firstOccurrence unchanged on duplicates', () => {
      // Arrange
      const error = new Error('Test error')
      vi.useFakeTimers()

      // Act
      const id = tracker.captureError(error)
      const captured1 = tracker.getError(id)!
      const firstTimestamp = captured1.firstOccurrence

      vi.advanceTimersByTime(1000)
      tracker.captureError(error)
      const captured2 = tracker.getError(id)!

      // Assert
      expect(captured2.firstOccurrence).toBe(firstTimestamp)

      // Cleanup
      vi.useRealTimers()
    })
  })

  describe('captureException', () => {
    it('should capture exception with high severity', () => {
      // Arrange
      const error = new Error('Exception occurred')

      // Act
      const errorId = tracker.captureException(error)

      // Assert
      const captured = tracker.getError(errorId)
      expect(captured?.severity).toBe('high')
      expect(captured?.category).toBe('system')
    })

    it('should accept additional context', () => {
      // Arrange
      const error = new Error('Exception')
      const context: Partial<ErrorContext> = {
        extra: { component: 'PaymentProcessor' }
      }

      // Act
      const errorId = tracker.captureException(error, context)

      // Assert
      const captured = tracker.getError(errorId)
      expect(captured?.context.extra?.component).toBe('PaymentProcessor')
    })
  })

  describe('captureMessage', () => {
    it('should capture message with default low severity', () => {
      // Act
      const errorId = tracker.captureMessage('Info message')

      // Assert
      const captured = tracker.getError(errorId)
      expect(captured?.message).toBe('Info message')
      expect(captured?.severity).toBe('low')
    })

    it('should capture message with custom severity', () => {
      // Act
      const errorId = tracker.captureMessage('Warning message', 'medium')

      // Assert
      const captured = tracker.getError(errorId)
      expect(captured?.severity).toBe('medium')
    })

    it('should accept context', () => {
      // Act
      const errorId = tracker.captureMessage('Message', 'low', {
        extra: { source: 'UserService' }
      })

      // Assert
      const captured = tracker.getError(errorId)
      expect(captured?.context.extra?.source).toBe('UserService')
    })
  })

  describe('Context Management', () => {
    it('should set and merge global context', () => {
      // Arrange
      tracker.setContext({
        app: { version: '1.0.0', environment: 'test' }
      })

      // Act - Shallow merge replaces nested objects
      tracker.setContext({
        app: { version: '2.0.0', environment: 'test' } // Must include all fields for shallow merge
      })

      const errorId = tracker.captureError(new Error('Test'))
      const captured = tracker.getError(errorId)

      // Assert - Shallow merge behavior
      expect(captured?.context.app?.version).toBe('2.0.0')
      expect(captured?.context.app?.environment).toBe('test')
    })

    it('should set user context', () => {
      // Arrange
      tracker.setUser({
        id: 456,
        role: 'user',
        email: 'test@example.com'
      })

      // Act
      const errorId = tracker.captureError(new Error('Test'))
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.context.user?.id).toBe(456)
      expect(captured?.context.user?.email).toBe('test@example.com')
    })

    it('should inherit global context in captured errors', () => {
      // Arrange
      tracker.setContext({
        app: { version: '3.0.0' },
        extra: { session: 'abc123' }
      })

      // Act
      const errorId = tracker.captureError(new Error('Test'))
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.context.app?.version).toBe('3.0.0')
      expect(captured?.context.extra?.session).toBe('abc123')
    })
  })

  describe('Breadcrumbs', () => {
    it('should add breadcrumb', () => {
      // Act
      tracker.addBreadcrumb({
        category: 'navigation',
        message: 'User clicked button',
        level: 'info'
      })

      const errorId = tracker.captureError(new Error('Test'))
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.breadcrumbs).toHaveLength(1)
      expect(captured?.breadcrumbs[0].message).toBe('User clicked button')
      expect(captured?.breadcrumbs[0].category).toBe('navigation')
    })

    it('should include breadcrumb timestamp', () => {
      // Act
      tracker.addBreadcrumb({
        category: 'test',
        message: 'Test breadcrumb',
        level: 'debug'
      })

      const errorId = tracker.captureError(new Error('Test'))
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.breadcrumbs[0].timestamp).toBeGreaterThan(0)
    })

    it('should limit breadcrumbs to maxBreadcrumbs', () => {
      // Arrange
      const limitedTracker = new ErrorTracker({
        maxBreadcrumbs: 3,
        captureConsoleErrors: false,
        captureUnhandledRejections: false
      })

      // Act - Add 5 breadcrumbs
      for (let i = 1; i <= 5; i++) {
        limitedTracker.addBreadcrumb({
          category: 'test',
          message: `Breadcrumb ${i}`,
          level: 'info'
        })
      }

      const errorId = limitedTracker.captureError(new Error('Test'))
      const captured = limitedTracker.getError(errorId)

      // Assert - Should only keep last 3
      expect(captured?.breadcrumbs).toHaveLength(3)
      expect(captured?.breadcrumbs[0].message).toBe('Breadcrumb 3')
      expect(captured?.breadcrumbs[2].message).toBe('Breadcrumb 5')

      // Cleanup
      limitedTracker.clearErrors()
    })

    it('should clear breadcrumbs', () => {
      // Arrange
      tracker.addBreadcrumb({
        category: 'test',
        message: 'Test',
        level: 'info'
      })

      // Act
      tracker.clearBreadcrumbs()
      const errorId = tracker.captureError(new Error('Test'))
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.breadcrumbs).toHaveLength(0)
    })

    it('should include breadcrumb data', () => {
      // Act
      tracker.addBreadcrumb({
        category: 'api',
        message: 'API call',
        level: 'info',
        data: {
          endpoint: '/api/users',
          status: 200,
          duration: 150
        }
      })

      const errorId = tracker.captureError(new Error('Test'))
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.breadcrumbs[0].data?.endpoint).toBe('/api/users')
      expect(captured?.breadcrumbs[0].data?.status).toBe(200)
    })
  })

  describe('Error Categorization', () => {
    it('should auto-categorize network errors', () => {
      // Arrange
      const error = new Error('Network request failed')

      // Act
      const errorId = tracker.captureError(error)
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.category).toBe('network')
    })

    it('should auto-categorize validation errors', () => {
      // Arrange
      const error = new Error('Validation failed: invalid email')

      // Act
      const errorId = tracker.captureError(error)
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.category).toBe('validation')
    })

    it('should auto-categorize database errors', () => {
      // Arrange
      const error = new Error('Database query failed')

      // Act
      const errorId = tracker.captureError(error)
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.category).toBe('database')
    })

    it('should auto-categorize authentication errors', () => {
      // Arrange
      const error = new Error('Unauthorized access')

      // Act
      const errorId = tracker.captureError(error)
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.category).toBe('authentication')
    })
  })

  describe('Severity Categorization', () => {
    it('should categorize critical errors', () => {
      // Arrange
      const error = new Error('Critical system failure')

      // Act
      const errorId = tracker.captureError(error)
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.severity).toBe('critical')
    })

    it('should categorize medium severity errors', () => {
      // Arrange
      const error = new Error('Network timeout')

      // Act
      const errorId = tracker.captureError(error)
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.severity).toBe('medium')
    })

    it('should categorize low severity errors', () => {
      // Arrange
      const error = new Error('Validation error')

      // Act
      const errorId = tracker.captureError(error)
      const captured = tracker.getError(errorId)

      // Assert
      expect(captured?.severity).toBe('low')
    })
  })

  describe('Error Management', () => {
    it('should get all errors', () => {
      // Arrange
      tracker.captureError(new Error('Error 1'))
      tracker.captureError(new Error('Error 2'))
      tracker.captureError(new Error('Error 3'))

      // Act
      const errors = tracker.getErrors()

      // Assert
      expect(errors).toHaveLength(3)
    })

    it('should resolve error by ID', () => {
      // Arrange
      const errorId = tracker.captureError(new Error('Test'))
      expect(tracker.getError(errorId)?.resolved).toBe(false)

      // Act
      tracker.resolveError(errorId)

      // Assert
      expect(tracker.getError(errorId)?.resolved).toBe(true)
    })

    it('should clear all errors', () => {
      // Arrange
      tracker.captureError(new Error('Error 1'))
      tracker.captureError(new Error('Error 2'))

      // Act
      tracker.clearErrors()

      // Assert
      expect(tracker.getErrors()).toHaveLength(0)
    })
  })

  describe('Statistics', () => {
    it('should calculate error statistics', () => {
      // Arrange
      tracker.captureError(new Error('Critical failure'), { severity: 'critical' })
      tracker.captureError(new Error('Network error'), { severity: 'high', category: 'network' })
      tracker.captureError(new Error('Validation error'), { severity: 'low', category: 'validation' })

      // Act
      const stats = tracker.getStats()

      // Assert
      expect(stats.total).toBe(3)
      expect(stats.unresolved).toBe(3)
      expect(stats.bySeverity.critical).toBe(1)
      expect(stats.bySeverity.high).toBe(1)
      expect(stats.bySeverity.low).toBe(1)
      expect(stats.byCategory.network).toBe(1)
      expect(stats.byCategory.validation).toBe(1)
    })

    it('should count unresolved errors', () => {
      // Arrange
      const id1 = tracker.captureError(new Error('Error 1'))
      const id2 = tracker.captureError(new Error('Error 2'))
      tracker.resolveError(id1)

      // Act
      const stats = tracker.getStats()

      // Assert
      expect(stats.total).toBe(2)
      expect(stats.unresolved).toBe(1)
    })

    it('should count breadcrumbs', () => {
      // Arrange
      tracker.addBreadcrumb({ category: 'test', message: 'Test 1', level: 'info' })
      tracker.addBreadcrumb({ category: 'test', message: 'Test 2', level: 'info' })

      // Act
      const stats = tracker.getStats()

      // Assert
      expect(stats.breadcrumbCount).toBe(2)
    })
  })

  describe('Hooks and Options', () => {
    it('should call beforeSend hook', () => {
      // Arrange
      const beforeSend = vi.fn((error: TrackedError): TrackedError => ({
        ...error,
        severity: 'critical' as ErrorSeverity // Modify severity
      }))

      const hookedTracker = new ErrorTracker({
        beforeSend,
        captureConsoleErrors: false,
        captureUnhandledRejections: false
      })

      // Act
      const errorId = hookedTracker.captureError(new Error('Test'))
      const captured = hookedTracker.getError(errorId)

      // Assert
      expect(beforeSend).toHaveBeenCalled()
      expect(captured?.severity).toBe('critical')

      // Cleanup
      hookedTracker.clearErrors()
    })

    it('should filter errors when beforeSend returns null', () => {
      // Arrange
      const beforeSend = vi.fn(() => null) // Filter out all errors

      const hookedTracker = new ErrorTracker({
        beforeSend,
        captureConsoleErrors: false,
        captureUnhandledRejections: false
      })

      // Act
      const errorId = hookedTracker.captureError(new Error('Test'))

      // Assert
      expect(beforeSend).toHaveBeenCalled()
      expect(hookedTracker.getError(errorId)).toBeUndefined()

      // Cleanup
      hookedTracker.clearErrors()
    })

    it('should call onError callback', async () => {
      // Arrange
      const onError = vi.fn()
      const callbackTracker = new ErrorTracker({
        onError,
        captureConsoleErrors: false,
        captureUnhandledRejections: false
      })

      // Act
      callbackTracker.captureError(new Error('Test'))

      // Wait for async callback
      await new Promise(resolve => setTimeout(resolve, 10))

      // Assert
      expect(onError).toHaveBeenCalled()
      expect(onError.mock.calls[0][0].message).toBe('Test')

      // Cleanup
      callbackTracker.clearErrors()
    })

    it('should respect sample rate', () => {
      // Arrange
      const zeroSampleTracker = new ErrorTracker({
        sampleRate: 0, // Capture nothing
        captureConsoleErrors: false,
        captureUnhandledRejections: false
      })

      // Act
      const errorId = zeroSampleTracker.captureError(new Error('Test'))

      // Assert
      expect(errorId).toBe('')
      expect(zeroSampleTracker.getErrors()).toHaveLength(0)

      // Cleanup
      zeroSampleTracker.clearErrors()
    })

    it('should respect enabled option', () => {
      // Arrange
      const disabledTracker = new ErrorTracker({
        enabled: false
      })

      // Act
      const errorId = disabledTracker.captureError(new Error('Test'))

      // Assert
      expect(errorId).toBe('')
      expect(disabledTracker.getErrors()).toHaveLength(0)
    })
  })

  describe('Debug Mode', () => {
    let consoleLogSpy: any

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleLogSpy.mockRestore()
    })

    it('should log breadcrumbs in debug mode', () => {
      // Arrange
      const debugTracker = new ErrorTracker({
        debug: true,
        captureConsoleErrors: false,
        captureUnhandledRejections: false
      })

      // Act
      debugTracker.addBreadcrumb({
        category: 'test',
        message: 'Test breadcrumb',
        level: 'info'
      })

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ErrorTracker] Breadcrumb:',
        expect.objectContaining({
          message: 'Test breadcrumb'
        })
      )

      // Cleanup
      debugTracker.clearErrors()
    })

    it('should log captured errors in debug mode', () => {
      // Arrange
      const debugTracker = new ErrorTracker({
        debug: true,
        captureConsoleErrors: false,
        captureUnhandledRejections: false
      })

      // Act
      debugTracker.captureError(new Error('Test'))

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ErrorTracker] Captured error:',
        expect.objectContaining({
          message: 'Test'
        })
      )

      // Cleanup
      debugTracker.clearErrors()
    })
  })
})

describe('Global Error Tracker', () => {
  beforeEach(() => {
    resetErrorTracker()
  })

  afterEach(() => {
    resetErrorTracker()
  })

  it('should return same instance on multiple calls', () => {
    // Act
    const instance1 = getErrorTracker()
    const instance2 = getErrorTracker()

    // Assert
    expect(instance1).toBe(instance2)
  })

  it('should create new instance after reset', () => {
    // Arrange
    const instance1 = getErrorTracker()

    // Act
    resetErrorTracker()
    const instance2 = getErrorTracker()

    // Assert
    expect(instance1).not.toBe(instance2)
  })

  it('should accept options on first call', () => {
    // Act
    const tracker = getErrorTracker({
      maxBreadcrumbs: 25,
      captureConsoleErrors: false,
      captureUnhandledRejections: false
    })

    tracker.addBreadcrumb({ category: 'test', message: 'Test', level: 'info' })
    const errorId = tracker.captureError(new Error('Test'))
    const stats = tracker.getStats()

    // Assert
    expect(stats.breadcrumbCount).toBe(1)

    // Cleanup
    tracker.clearErrors()
  })
})

describe('Error ID Generation', () => {
  let tracker: ErrorTracker

  beforeEach(() => {
    tracker = new ErrorTracker({
      captureConsoleErrors: false,
      captureUnhandledRejections: false
    })
  })

  afterEach(() => {
    tracker.clearErrors()
  })

  it('should generate consistent IDs for identical errors', () => {
    // Arrange
    const error1 = new Error('Same error')
    const error2 = new Error('Same error')

    // Act
    const id1 = tracker.captureError(error1)
    const id2 = tracker.captureError(error2)

    // Assert
    expect(id1).toBe(id2)
  })

  it('should generate different IDs for different errors', () => {
    // Arrange
    const error1 = new Error('Error 1')
    const error2 = new Error('Error 2')

    // Act
    const id1 = tracker.captureError(error1)
    const id2 = tracker.captureError(error2)

    // Assert
    expect(id1).not.toBe(id2)
  })
})
