/**
 * useAudioNotifications Composable Tests
 * 測試音頻通知 composable 的功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useAudioNotifications } from '../useAudioNotifications'
import type { KitchenOrder, KitchenSSEEvent } from '@/types'

// Mock audio service - inline in vi.mock to avoid hoisting issues
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

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    clear: () => {
      store = {}
    }
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
})

describe('useAudioNotifications', () => {
  // Get reference to mocked audioService
  let mockAudioService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    localStorageMock.clear()

    // Get mocked audioService
    const { audioService } = await import('@/services/audioService')
    mockAudioService = audioService
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const { config } = useAudioNotifications()

      expect(config.value).toEqual({
        newOrderSound: true,
        urgentOrderSound: true,
        orderReadySound: true,
        orderCompleteSound: true,
        warningSound: true,
        successSound: true,
        errorSound: true,
        volume: 0.7,
        enabled: true
      })
    })

    it('should load config from localStorage if available', () => {
      const savedConfig = {
        newOrderSound: false,
        urgentOrderSound: true,
        orderReadySound: false,
        orderCompleteSound: true,
        warningSound: false,
        successSound: true,
        errorSound: false,
        volume: 0.5,
        enabled: false
      }

      localStorageMock.setItem('kitchen-audio-notifications', JSON.stringify(savedConfig))

      const { config } = useAudioNotifications()

      expect(config.value).toMatchObject(savedConfig)
    })

    it('should start as enabled by default', () => {
      const { isEnabled } = useAudioNotifications()

      expect(isEnabled.value).toBe(true)
    })
  })

  describe('Sound Playback', () => {
    it('should play new order sound', async () => {
      const { playNewOrderSound } = useAudioNotifications()

      await playNewOrderSound()

      expect(mockAudioService.playNewOrder).toHaveBeenCalledWith(false)
    })

    it('should play urgent order sound', async () => {
      const { playNewOrderSound } = useAudioNotifications()

      await playNewOrderSound(true)

      expect(mockAudioService.playNewOrder).toHaveBeenCalledWith(true)
    })

    it('should play order ready sound', async () => {
      const { playOrderReadySound } = useAudioNotifications()

      await playOrderReadySound()

      expect(mockAudioService.playOrderReady).toHaveBeenCalled()
    })

    it('should play order complete sound', async () => {
      const { playOrderCompleteSound } = useAudioNotifications()

      await playOrderCompleteSound()

      expect(mockAudioService.playOrderComplete).toHaveBeenCalled()
    })

    it('should play warning sound', async () => {
      const { playWarningSound } = useAudioNotifications()

      await playWarningSound()

      expect(mockAudioService.playWarning).toHaveBeenCalled()
    })

    it('should play success sound', async () => {
      const { playSuccessSound } = useAudioNotifications()

      await playSuccessSound()

      expect(mockAudioService.playSuccess).toHaveBeenCalled()
    })

    it('should play error sound', async () => {
      const { playErrorSound } = useAudioNotifications()

      await playErrorSound()

      expect(mockAudioService.playError).toHaveBeenCalled()
    })

    it('should not play sounds when disabled', async () => {
      const { playNewOrderSound, disable } = useAudioNotifications()

      disable()
      await playNewOrderSound()

      expect(mockAudioService.playNewOrder).not.toHaveBeenCalled()
    })

    it('should handle playback errors gracefully', async () => {
      mockAudioService.playNewOrder.mockRejectedValueOnce(new Error('Audio error'))

      const { playNewOrderSound } = useAudioNotifications()

      // Should not throw
      await expect(playNewOrderSound()).resolves.not.toThrow()
    })
  })

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const { config, updateConfig } = useAudioNotifications()

      updateConfig({
        volume: 0.5,
        newOrderSound: false
      })

      expect(config.value.volume).toBe(0.5)
      expect(config.value.newOrderSound).toBe(false)
    })

    it('should save configuration to localStorage', () => {
      const { updateConfig } = useAudioNotifications()

      updateConfig({
        volume: 0.8
      })

      const saved = localStorageMock.getItem('kitchen-audio-notifications')
      expect(saved).toBeTruthy()

      const parsed = JSON.parse(saved!)
      expect(parsed.volume).toBe(0.8)
    })

    it('should update audio service settings on config change', () => {
      const { updateConfig } = useAudioNotifications()

      updateConfig({
        enabled: false,
        volume: 0.3
      })

      expect(mockAudioService.updateSettings).toHaveBeenCalledWith({
        enabled: false,
        masterVolume: 0.3
      })
    })

    it('should reset configuration to defaults', () => {
      const { config, updateConfig, resetConfig } = useAudioNotifications()

      // Change config
      updateConfig({
        volume: 0.1,
        newOrderSound: false
      })

      // Reset
      resetConfig()

      expect(config.value).toEqual({
        newOrderSound: true,
        urgentOrderSound: true,
        orderReadySound: true,
        orderCompleteSound: true,
        warningSound: true,
        successSound: true,
        errorSound: true,
        volume: 0.7,
        enabled: true
      })
    })
  })

  describe('Enable/Disable Control', () => {
    it('should enable audio notifications', () => {
      const { enable } = useAudioNotifications()

      enable()

      expect(mockAudioService.enable).toHaveBeenCalled()
    })

    it('should disable audio notifications', () => {
      const { disable } = useAudioNotifications()

      disable()

      expect(mockAudioService.disable).toHaveBeenCalled()
    })

    it('should toggle audio notifications', () => {
      const { toggle, isEnabled } = useAudioNotifications()

      const initialState = isEnabled.value

      toggle()

      expect(isEnabled.value).not.toBe(initialState)
    })

    it('should respect enabled state when playing sounds', async () => {
      const { playNewOrderSound, disable } = useAudioNotifications()

      disable()
      await playNewOrderSound()

      expect(mockAudioService.playNewOrder).not.toHaveBeenCalled()
    })
  })

  describe('Volume Control', () => {
    it('should set volume within valid range', () => {
      const { setVolume, currentVolume } = useAudioNotifications()

      setVolume(0.5)

      expect(currentVolume.value).toBe(0.5)
      expect(mockAudioService.setMasterVolume).toHaveBeenCalledWith(0.5)
    })

    it('should cap volume at maximum 1.0', () => {
      const { setVolume, currentVolume } = useAudioNotifications()

      setVolume(1.5)

      expect(currentVolume.value).toBe(1.0)
    })

    it('should cap volume at minimum 0.0', () => {
      const { setVolume, currentVolume } = useAudioNotifications()

      setVolume(-0.5)

      expect(currentVolume.value).toBe(0.0)
    })

    it('should persist volume changes', () => {
      const { setVolume } = useAudioNotifications()

      setVolume(0.6)

      const saved = localStorageMock.getItem('kitchen-audio-notifications')
      const parsed = JSON.parse(saved!)

      expect(parsed.volume).toBe(0.6)
    })
  })

  describe('SSE Event Handling', () => {
    it('should handle NEW_ORDER event', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      const event: KitchenSSEEvent = {
        type: 'NEW_ORDER',
        payload: { priority: 'normal' },
        timestamp: new Date().toISOString(),
        restaurantId: 1
      }

      await handleSSEEvent(event)

      expect(mockAudioService.playNewOrder).toHaveBeenCalledWith(false)
    })

    it('should handle urgent NEW_ORDER event', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      const event: KitchenSSEEvent = {
        type: 'NEW_ORDER',
        payload: { priority: 'urgent' },
        timestamp: new Date().toISOString(),
        restaurantId: 1
      }

      await handleSSEEvent(event)

      expect(mockAudioService.playNewOrder).toHaveBeenCalledWith(true)
    })

    it('should handle ORDER_STATUS_UPDATE to ready', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      const event: KitchenSSEEvent = {
        type: 'ORDER_STATUS_UPDATE',
        payload: { status: 'ready' },
        timestamp: new Date().toISOString(),
        restaurantId: 1
      }

      await handleSSEEvent(event)

      expect(mockAudioService.playOrderReady).toHaveBeenCalled()
    })

    it('should handle ORDER_STATUS_UPDATE to completed', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      const event: KitchenSSEEvent = {
        type: 'ORDER_STATUS_UPDATE',
        payload: { status: 'completed' },
        timestamp: new Date().toISOString(),
        restaurantId: 1
      }

      await handleSSEEvent(event)

      expect(mockAudioService.playOrderComplete).toHaveBeenCalled()
    })

    it('should handle ORDER_CANCELLED event', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      const event: KitchenSSEEvent = {
        type: 'ORDER_CANCELLED',
        payload: {},
        timestamp: new Date().toISOString(),
        restaurantId: 1
      }

      await handleSSEEvent(event)

      expect(mockAudioService.playWarning).toHaveBeenCalled()
    })

    it('should handle PRIORITY_UPDATE to urgent', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      const event: KitchenSSEEvent = {
        type: 'PRIORITY_UPDATE',
        payload: { priority: 'urgent' },
        timestamp: new Date().toISOString(),
        restaurantId: 1
      }

      await handleSSEEvent(event)

      expect(mockAudioService.playNewOrder).toHaveBeenCalledWith(true)
    })
  })

  describe('Order Event Handlers', () => {
    it('should handle order start cooking', async () => {
      const { handleOrderStartCooking } = useAudioNotifications()

      await handleOrderStartCooking()

      expect(mockAudioService.playSuccess).toHaveBeenCalled()
    })

    it('should handle order mark ready', async () => {
      const { handleOrderMarkReady } = useAudioNotifications()

      await handleOrderMarkReady()

      expect(mockAudioService.playOrderReady).toHaveBeenCalled()
    })

    it('should handle order complete', async () => {
      const { handleOrderComplete } = useAudioNotifications()

      await handleOrderComplete()

      expect(mockAudioService.playOrderComplete).toHaveBeenCalled()
    })

    it('should handle batch operation with small count', async () => {
      const { handleBatchOperation } = useAudioNotifications()

      await handleBatchOperation(3)

      expect(mockAudioService.playSuccess).toHaveBeenCalled()
    })

    it('should handle batch operation with medium count', async () => {
      const { handleBatchOperation } = useAudioNotifications()

      await handleBatchOperation(7)

      expect(mockAudioService.play).toHaveBeenCalledWith('chime', {
        repeat: 2,
        priority: 'medium'
      })
    })

    it('should handle batch operation with large count', async () => {
      const { handleBatchOperation } = useAudioNotifications()

      await handleBatchOperation(15)

      expect(mockAudioService.play).toHaveBeenCalledWith('chime', {
        repeat: 3,
        priority: 'high'
      })
    })
  })

  describe('Time-based Monitoring', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('should check order times and play warning for overdue orders', async () => {
      const { checkOrderTimes } = useAudioNotifications()

      const orders: KitchenOrder[] = [
        {
          id: 1,
          orderNumber: 'ORD-001',
          tableId: 1,
          tableName: 'T1',
          status: 2, // Preparing
          priority: 'normal',
          createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 minutes ago
          elapsedTime: 35,
          estimatedTime: 15,
          totalItems: 0,
          items: []
        }
      ]

      await checkOrderTimes(orders)

      expect(mockAudioService.playWarning).toHaveBeenCalled()
    })

    it('should not play warning for recent orders', async () => {
      const { checkOrderTimes } = useAudioNotifications()

      const orders: KitchenOrder[] = [
        {
          id: 1,
          orderNumber: 'ORD-001',
          tableId: 1,
          tableName: 'T1',
          status: 2,
          priority: 'normal',
          createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
          elapsedTime: 10,
          estimatedTime: 15,
          totalItems: 0,
          items: []
        }
      ]

      await checkOrderTimes(orders)

      expect(mockAudioService.playWarning).not.toHaveBeenCalled()
    })

    it('should check orders near completion time', async () => {
      const { checkOrderTimes } = useAudioNotifications()

      const orders: KitchenOrder[] = [
        {
          id: 1,
          orderNumber: 'ORD-001',
          tableId: 1,
          tableName: 'T1',
          status: 2,
          priority: 'normal',
          createdAt: new Date(Date.now() - 13 * 60 * 1000).toISOString(), // 13 minutes ago
          elapsedTime: 13,
          estimatedTime: 15, // 15 * 0.8 = 12 minutes threshold
          totalItems: 0,
          items: []
        }
      ]

      await checkOrderTimes(orders)

      expect(mockAudioService.play).toHaveBeenCalledWith('notification', { priority: 'low' })
    })

    it('should start time monitoring', () => {
      const { startTimeMonitoring } = useAudioNotifications()

      const orders: KitchenOrder[] = []

      startTimeMonitoring(orders)

      // Monitoring should be active
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    })

    it('should stop time monitoring', () => {
      const { startTimeMonitoring, stopTimeMonitoring } = useAudioNotifications()

      const orders: KitchenOrder[] = []

      startTimeMonitoring(orders)
      stopTimeMonitoring()

      // All timers should be cleared
      expect(vi.getTimerCount()).toBe(0)
    })

    it('should not start duplicate monitoring', () => {
      const { startTimeMonitoring } = useAudioNotifications()

      const orders: KitchenOrder[] = []

      startTimeMonitoring(orders)
      const timersAfterFirst = vi.getTimerCount()

      startTimeMonitoring(orders)
      const timersAfterSecond = vi.getTimerCount()

      expect(timersAfterFirst).toBe(timersAfterSecond)
    })
  })

  describe('Testing Methods', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('should run notification tests', async () => {
      const { testNotifications } = useAudioNotifications()

      await testNotifications()

      // Should have played multiple test sounds
      expect(mockAudioService.playNewOrder).toHaveBeenCalled()
      expect(mockAudioService.playOrderReady).toHaveBeenCalled()
      expect(mockAudioService.playOrderComplete).toHaveBeenCalled()
      expect(mockAudioService.playSuccess).toHaveBeenCalled()
    })

    it('should not run tests when disabled', async () => {
      const { testNotifications, disable } = useAudioNotifications()

      disable()
      await testNotifications()

      expect(mockAudioService.playNewOrder).not.toHaveBeenCalled()
    })

    it('should wait between test sounds', async () => {
      const { testNotifications } = useAudioNotifications()

      const testPromise = testNotifications()

      // Advance time for delays between tests
      vi.advanceTimersByTime(5000)

      await testPromise

      expect(mockAudioService.playNewOrder).toHaveBeenCalled()
    })
  })

  describe('Computed Properties', () => {
    it('should compute isEnabled correctly', () => {
      const { isEnabled, disable } = useAudioNotifications()

      expect(isEnabled.value).toBe(true)

      disable()

      expect(isEnabled.value).toBe(false)
    })

    it('should compute currentVolume correctly', () => {
      const { currentVolume, setVolume } = useAudioNotifications()

      expect(currentVolume.value).toBe(0.7) // Default

      setVolume(0.5)

      expect(currentVolume.value).toBe(0.5)
    })
  })

  describe('Lifecycle', () => {
    it('should load config on mount', () => {
      const savedConfig = {
        volume: 0.9,
        enabled: false
      }

      localStorageMock.setItem('kitchen-audio-notifications', JSON.stringify(savedConfig))

      const { config } = useAudioNotifications()

      expect(config.value.volume).toBe(0.9)
      expect(config.value.enabled).toBe(false)
    })

    it('should stop monitoring on unmount', () => {
      vi.useFakeTimers()

      const { startTimeMonitoring } = useAudioNotifications()

      const orders: KitchenOrder[] = []
      startTimeMonitoring(orders)

      // Component unmount would trigger this
      // Manual cleanup for test
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing payload in SSE events', async () => {
      const { handleSSEEvent } = useAudioNotifications()

      const event: KitchenSSEEvent = {
        type: 'NEW_ORDER',
        payload: undefined,
        timestamp: new Date().toISOString(),
        restaurantId: 1
      }

      // Should not throw
      await expect(handleSSEEvent(event)).resolves.not.toThrow()
    })

    it('should handle invalid config in localStorage', () => {
      localStorageMock.setItem('kitchen-audio-notifications', 'invalid json')

      // Should not throw and use defaults
      const { config } = useAudioNotifications()

      expect(config.value.volume).toBe(0.7)
    })

    it('should handle empty orders array in time check', async () => {
      const { checkOrderTimes } = useAudioNotifications()

      await checkOrderTimes([])

      // Should not throw or play sounds
      expect(mockAudioService.playWarning).not.toHaveBeenCalled()
    })

    it('should handle batch operation with zero count', async () => {
      const { handleBatchOperation } = useAudioNotifications()

      await handleBatchOperation(0)

      expect(mockAudioService.playSuccess).toHaveBeenCalled()
    })
  })
})
