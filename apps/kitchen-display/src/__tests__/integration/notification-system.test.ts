/**
 * Notification System Integration Tests
 * 測試通知系統的完整整合
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAudioNotifications } from '@/composables/useAudioNotifications'
import type { KitchenSSEEvent, KitchenOrder } from '@/types'

// Helper function to create SSE events with required fields
function createSSEEvent(overrides: Partial<KitchenSSEEvent> & { type: KitchenSSEEvent['type']; payload: any }): KitchenSSEEvent {
  return {
    timestamp: new Date().toISOString(),
    restaurantId: 1,
    ...overrides
  } as KitchenSSEEvent
}

// Helper function to create orders with required fields
function createMockOrder(overrides: Partial<KitchenOrder> = {}): KitchenOrder {
  return {
    id: 1,
    orderNumber: 'ORD-001',
    tableId: 1,
    tableName: 'T1',
    status: 1,
    priority: 'normal',
    createdAt: new Date().toISOString(),
    elapsedTime: 0,
    estimatedTime: 15,
    totalItems: 0,
    items: [],
    ...overrides
  }
}

// Mock audio service - inline definition to avoid hoisting issues
vi.mock('@/services/audioService', () => ({
  audioService: {
    playNewOrder: vi.fn().mockResolvedValue(undefined),
    playOrderReady: vi.fn().mockResolvedValue(undefined),
    playOrderComplete: vi.fn().mockResolvedValue(undefined),
    playWarning: vi.fn().mockResolvedValue(undefined),
    playSuccess: vi.fn().mockResolvedValue(undefined),
    playError: vi.fn().mockResolvedValue(undefined),
    play: vi.fn().mockResolvedValue(undefined),
    enable: vi.fn(),
    disable: vi.fn(),
    setMasterVolume: vi.fn(),
    updateSettings: vi.fn()
  }
}))

describe('Notification System Integration', () => {
  let mockAudioService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()

    // Get mocked audioService
    const { audioService } = await import('@/services/audioService')
    mockAudioService = audioService
  })

  describe('Event-based Notifications', () => {
    it('should play notification for new order', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      await handleSSEEvent(createSSEEvent({
        type: 'NEW_ORDER',
        payload: { priority: 'normal' }
      }))

      expect(mockAudioService.playNewOrder).toHaveBeenCalledWith(false)
    })

    it('should play urgent notification for urgent orders', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      await handleSSEEvent(createSSEEvent({
        type: 'NEW_ORDER',
        payload: { priority: 'urgent' }
      }))

      expect(mockAudioService.playNewOrder).toHaveBeenCalledWith(true)
    })

    it('should play notification when order ready', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      await handleSSEEvent(createSSEEvent({
        type: 'ORDER_STATUS_UPDATE',
        payload: { status: 'ready' }
      }))

      expect(mockAudioService.playOrderReady).toHaveBeenCalled()
    })

    it('should play warning for cancelled orders', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      await handleSSEEvent(createSSEEvent({
        type: 'ORDER_CANCELLED',
        payload: {}
      }))

      expect(mockAudioService.playWarning).toHaveBeenCalled()
    })
  })

  describe('Notification Settings', () => {
    it('should respect user notification preferences', async () => {
      const { updateConfig, handleSSEEvent } = useAudioNotifications()

      updateConfig({ newOrderSound: false })

      await handleSSEEvent(createSSEEvent({
        type: 'NEW_ORDER',
        payload: { priority: 'normal' }
      }))

      expect(mockAudioService.playNewOrder).not.toHaveBeenCalled()
    })

    it('should control volume level', () => {
      const { setVolume } = useAudioNotifications()

      setVolume(0.5)

      expect(mockAudioService.setMasterVolume).toHaveBeenCalledWith(0.5)
    })

    it('should enable/disable all notifications', async () => {
      const { disable, handleSSEEvent } = useAudioNotifications()

      disable()

      await handleSSEEvent(createSSEEvent({
        type: 'NEW_ORDER',
        payload: {}
      }))

      expect(mockAudioService.playNewOrder).not.toHaveBeenCalled()
    })
  })

  describe('Batch Notifications', () => {
    it('should handle batch operations with appropriate sound', async () => {
      const { handleBatchOperation } = useAudioNotifications()

      await handleBatchOperation(3)
      expect(mockAudioService.playSuccess).toHaveBeenCalled()

      vi.clearAllMocks()

      await handleBatchOperation(15)
      expect(mockAudioService.play).toHaveBeenCalledWith('chime', {
        repeat: 3,
        priority: 'high'
      })
    })
  })

  describe('User Actions Feedback', () => {
    it('should play success sound on action completion', async () => {
      const { handleOrderStartCooking } = useAudioNotifications()

      await handleOrderStartCooking()

      expect(mockAudioService.playSuccess).toHaveBeenCalled()
    })

    it('should play ready sound when marking order ready', async () => {
      const { handleOrderMarkReady } = useAudioNotifications()

      await handleOrderMarkReady()

      expect(mockAudioService.playOrderReady).toHaveBeenCalled()
    })

    it('should play complete sound on order completion', async () => {
      const { handleOrderComplete } = useAudioNotifications()

      await handleOrderComplete()

      expect(mockAudioService.playOrderComplete).toHaveBeenCalled()
    })
  })

  describe('Time-based Notifications', () => {
    it('should notify about overdue orders', async () => {
      vi.useFakeTimers()
      const { checkOrderTimes } = useAudioNotifications()

      const overdueOrders = [createMockOrder({
        id: 1,
        orderNumber: 'ORD-001',
        status: 2,
        createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        elapsedTime: 35,
        estimatedTime: 15,
        items: []
      })]

      await checkOrderTimes(overdueOrders)

      expect(mockAudioService.playWarning).toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('Notification Persistence', () => {
    it('should save notification settings to localStorage', () => {
      const { updateConfig } = useAudioNotifications()

      updateConfig({ volume: 0.8, newOrderSound: false })

      const saved = localStorage.getItem('kitchen-audio-notifications')
      expect(saved).toBeTruthy()

      const parsed = JSON.parse(saved!)
      expect(parsed.volume).toBe(0.8)
      expect(parsed.newOrderSound).toBe(false)
    })

    it('should load notification settings from localStorage', () => {
      localStorage.setItem('kitchen-audio-notifications', JSON.stringify({
        volume: 0.6,
        enabled: false
      }))

      const { config } = useAudioNotifications()

      expect(config.value.volume).toBe(0.6)
      expect(config.value.enabled).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle playback errors gracefully', async () => {
      mockAudioService.playNewOrder.mockRejectedValueOnce(new Error('Audio error'))

      const { playNewOrderSound } = useAudioNotifications()

      await expect(playNewOrderSound()).resolves.not.toThrow()
    })

    it('should continue processing after failed notification', async () => {
      mockAudioService.playNewOrder.mockRejectedValueOnce(new Error('Failed'))

      const { handleSSEEvent } = useAudioNotifications()

      await handleSSEEvent(createSSEEvent({ type: 'NEW_ORDER', payload: {} }))
      await handleSSEEvent(createSSEEvent({ type: 'NEW_ORDER', payload: {} }))

      expect(mockAudioService.playNewOrder).toHaveBeenCalledTimes(2)
    })
  })
})
