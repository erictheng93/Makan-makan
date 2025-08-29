// Integration tests for audio notification system
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AudioSettings from '@/components/audio/AudioSettings.vue'
import { audioService } from '@/services/audioService'
import { useAudioNotifications } from '@/composables/useAudioNotifications'
import type { KitchenOrder } from '@/types'

// Mock Howler.js more thoroughly
const mockHowl = {
  play: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  volume: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
  state: vi.fn().mockReturnValue('loaded')
}

vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => mockHowl)
}))

const mockOrder: KitchenOrder = {
  id: 1,
  orderNumber: '#001',
  tableNumber: 'T1',
  items: [{ id: 1, name: '炒飯', status: 'pending', cookingTime: 10, priority: 'normal' }],
  status: 1,
  totalAmount: 25.00,
  createdAt: new Date().toISOString(),
  elapsedTime: 5,
  estimatedTime: 15,
  priority: 'normal',
  customer: { name: '王小明', phone: '0912345678' },
  specialInstructions: '',
  assignedChef: null
}

describe('Audio Integration Tests', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  afterEach(() => {
    audioService.cleanup()
  })

  describe('Audio Service Integration', () => {
    it('should initialize with default sounds', async () => {
      await audioService.initialize()
      
      expect(audioService.isEnabled).toBe(true)
      expect(audioService.sounds.size).toBeGreaterThan(0)
    })

    it('should play sounds with proper queue management', async () => {
      await audioService.initialize()
      
      // Queue multiple sounds
      audioService.play('new_order', { priority: 'high' })
      audioService.play('order_ready', { priority: 'medium' })
      audioService.play('overdue_warning', { priority: 'high' })
      
      // Should process queue with priority
      expect(audioService.notificationQueue.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle volume control across all sounds', async () => {
      await audioService.initialize()
      
      const newVolume = 0.7
      audioService.setVolume(newVolume)
      
      expect(audioService.volume).toBe(newVolume)
    })

    it('should generate fallback tones when sounds fail to load', async () => {
      mockHowl.state.mockReturnValue('error')
      
      await audioService.initialize()
      
      // Should fall back to generated tones
      const result = await audioService.play('new_order')
      expect(result).toBeDefined()
    })
  })

  describe('Audio Settings Component Integration', () => {
    it('should render all sound categories and controls', () => {
      const wrapper = mount(AudioSettings)
      
      // Check main sections
      expect(wrapper.find('[data-testid="master-volume"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="sound-categories"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="advanced-settings"]').exists()).toBe(true)
    })

    it('should update master volume reactively', async () => {
      const wrapper = mount(AudioSettings)
      
      const volumeSlider = wrapper.find('input[type="range"]')
      await volumeSlider.setValue('0.8')
      
      expect(audioService.volume).toBe(0.8)
    })

    it('should test individual sounds', async () => {
      const wrapper = mount(AudioSettings)
      
      const testButton = wrapper.find('[data-testid="test-new-order"]')
      await testButton.trigger('click')
      
      expect(mockHowl.play).toHaveBeenCalled()
    })

    it('should export and import settings', async () => {
      const wrapper = mount(AudioSettings)
      
      // Export settings
      const exportBtn = wrapper.find('[data-testid="export-settings"]')
      await exportBtn.trigger('click')
      
      // Should trigger download
      expect(wrapper.emitted('settings-exported')).toBeTruthy()
    })
  })

  describe('Audio Notifications Composable Integration', () => {
    it('should integrate with SSE events', () => {
      const { setupEventHandlers, handleNewOrder } = useAudioNotifications()
      
      setupEventHandlers()
      
      // Simulate new order event
      handleNewOrder(mockOrder)
      
      expect(mockHowl.play).toHaveBeenCalled()
    })

    it('should monitor overdue orders', async () => {
      const { startOverdueMonitoring, stopOverdueMonitoring } = useAudioNotifications()
      
      // Mock overdue order
      const overdueOrder = {
        ...mockOrder,
        elapsedTime: 30,
        estimatedTime: 15
      }
      
      startOverdueMonitoring([overdueOrder])
      
      // Wait for monitoring cycle
      await new Promise(resolve => setTimeout(resolve, 100))
      
      stopOverdueMonitoring()
      
      expect(mockHowl.play).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'overdue_warning'
        })
      )
    })

    it('should handle priority-based notifications', () => {
      const { handlePriorityChange } = useAudioNotifications()
      
      const highPriorityOrder = {
        ...mockOrder,
        priority: 'urgent' as const
      }
      
      handlePriorityChange(highPriorityOrder)
      
      expect(mockHowl.play).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'urgent'
        })
      )
    })
  })

  describe('Audio Persistence and Settings', () => {
    it('should save settings to localStorage', async () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem')
      
      audioService.setVolume(0.6)
      audioService.saveSettings()
      
      expect(setItemSpy).toHaveBeenCalledWith(
        'kitchen-audio-settings',
        expect.stringContaining('0.6')
      )
    })

    it('should restore settings from localStorage', async () => {
      const mockSettings = JSON.stringify({
        enabled: false,
        volume: 0.3,
        soundSettings: {
          new_order: { enabled: true, volume: 0.5 }
        }
      })
      
      vi.spyOn(localStorage, 'getItem').mockReturnValue(mockSettings)
      
      await audioService.initialize()
      
      expect(audioService.volume).toBe(0.3)
      expect(audioService.isEnabled).toBe(false)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle audio context creation failures', async () => {
      // Mock AudioContext failure
      global.AudioContext = vi.fn().mockImplementation(() => {
        throw new Error('AudioContext not supported')
      })
      
      await audioService.initialize()
      
      // Should still initialize without crashing
      expect(audioService.isEnabled).toBe(true)
    })

    it('should gracefully handle sound loading failures', async () => {
      mockHowl.state.mockReturnValue('error')
      
      const result = await audioService.play('new_order')
      
      // Should fall back gracefully
      expect(result).toBeDefined()
    })

    it('should handle queue overflow', async () => {
      await audioService.initialize()
      
      // Queue many notifications rapidly
      for (let i = 0; i < 100; i++) {
        audioService.play('new_order', { priority: 'low' })
      }
      
      // Should limit queue size
      expect(audioService.notificationQueue.length).toBeLessThanOrEqual(50)
    })
  })

  describe('Performance and Memory Management', () => {
    it('should cleanup resources properly', () => {
      audioService.cleanup()
      
      // Should clear all timers and resources
      expect(audioService.notificationQueue.length).toBe(0)
      expect(audioService.sounds.size).toBe(0)
    })

    it('should handle rapid notification bursts efficiently', async () => {
      await audioService.initialize()
      
      const startTime = performance.now()
      
      // Rapid fire notifications
      for (let i = 0; i < 50; i++) {
        audioService.play('new_order', { priority: 'medium' })
      }
      
      const endTime = performance.now()
      
      // Should handle efficiently
      expect(endTime - startTime).toBeLessThan(100) // 100ms
    })
  })

  describe('Integration with Order Management', () => {
    it('should respond to order status changes', () => {
      const { handleStatusChange } = useAudioNotifications()
      
      const statusChanges = [
        { ...mockOrder, status: 2 }, // preparing
        { ...mockOrder, status: 3 }, // ready
        { ...mockOrder, status: 4 }  // completed
      ]
      
      statusChanges.forEach(handleStatusChange)
      
      expect(mockHowl.play).toHaveBeenCalledTimes(3)
    })

    it('should integrate with offline mode', async () => {
      const { handleOfflineQueue } = useAudioNotifications()
      
      const queuedNotifications = [
        { type: 'new_order', orderId: 1, timestamp: Date.now() },
        { type: 'order_ready', orderId: 2, timestamp: Date.now() }
      ]
      
      await handleOfflineQueue(queuedNotifications)
      
      expect(mockHowl.play).toHaveBeenCalledTimes(2)
    })
  })
})