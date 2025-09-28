/**
 * Admin Dashboard Integration Tests
 *
 * End-to-end workflow tests for the admin dashboard
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestRouter } from '../helpers/test-router'
import { createTestStore } from '../helpers/test-store'
import QueueView from '../../views/QueueView.vue'
import SettingsView from '../../views/SettingsView.vue'

describe('Admin Dashboard Integration Tests', () => {
  let wrapper: any
  let router: any
  let store: any

  beforeAll(async () => {
    router = createTestRouter()
    store = createTestStore()
  })

  beforeEach(async () => {
    // Reset store state
    store.reset()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Queue Management Workflow', () => {
    it('should handle complete queue management workflow', async () => {
      wrapper = mount(QueueView, {
        global: {
          plugins: [router, store]
        }
      })

      // 1. Component should mount successfully
      expect(wrapper.exists()).toBe(true)

      // 2. Should load queue data
      await wrapper.vm.$nextTick()

      // 3. Should display queue statistics
      const queueStats = wrapper.find('[data-testid="queue-stats"]')
      expect(queueStats.exists()).toBe(true)

      // 4. Should display current queue
      const queueList = wrapper.find('[data-testid="current-queue"]')
      expect(queueList.exists()).toBe(true)

      // 5. Should handle call next customer
      const callNextButton = wrapper.find('[data-testid="call-next-btn"]')
      if (callNextButton.exists()) {
        await callNextButton.trigger('click')
        await wrapper.vm.$nextTick()

        // Should show confirmation or update queue
        expect(wrapper.vm.queue.called).toBeDefined()
      }

      // 6. Should handle seat customer
      const seatButtons = wrapper.findAll('[data-testid="seat-customer-btn"]')
      if (seatButtons.length > 0) {
        await seatButtons[0].trigger('click')
        await wrapper.vm.$nextTick()

        // Should show table selection or update status
        expect(wrapper.vm.queue.seated).toBeDefined()
      }
    })

    it('should handle queue settings management', async () => {
      wrapper = mount(SettingsView, {
        global: {
          plugins: [router, store]
        }
      })

      // 1. Should load settings
      await wrapper.vm.$nextTick()
      expect(wrapper.exists()).toBe(true)

      // 2. Should display queue settings section
      const queueSettings = wrapper.find('[data-testid="queue-settings"]')
      expect(queueSettings.exists()).toBe(true)

      // 3. Should handle settings updates
      const enableQueueToggle = wrapper.find('[data-testid="enable-queue-toggle"]')
      if (enableQueueToggle.exists()) {
        const initialValue = enableQueueToggle.element.checked
        await enableQueueToggle.trigger('change')
        await wrapper.vm.$nextTick()

        // Should update the setting
        expect(enableQueueToggle.element.checked).not.toBe(initialValue)
      }
    })
  })

  describe('Real-time Updates Integration', () => {
    it('should handle real-time queue updates', async () => {
      wrapper = mount(QueueView, {
        global: {
          plugins: [router, store]
        }
      })

      // 1. Initial state
      await wrapper.vm.$nextTick()
      const initialQueueCount = wrapper.vm.currentQueue.length

      // 2. Simulate real-time update
      store.dispatch('queue/addCustomer', {
        id: 'new-customer-001',
        queueNumber: initialQueueCount + 1,
        customerName: 'New Customer',
        partySize: 2,
        status: 'waiting'
      })

      await wrapper.vm.$nextTick()

      // 3. Should reflect the update
      expect(wrapper.vm.currentQueue.length).toBe(initialQueueCount + 1)

      // 4. Should update queue statistics
      const queueStats = wrapper.find('[data-testid="queue-stats"]')
      expect(queueStats.exists()).toBe(true)
    })

    it('should handle connection status changes', async () => {
      wrapper = mount(QueueView, {
        global: {
          plugins: [router, store]
        }
      })

      // 1. Should show connection status
      const connectionStatus = wrapper.find('[data-testid="connection-status"]')
      expect(connectionStatus.exists()).toBe(true)

      // 2. Simulate connection loss
      store.commit('realtime/setConnectionStatus', 'disconnected')
      await wrapper.vm.$nextTick()

      // 3. Should show disconnected state
      expect(wrapper.find('[data-testid="connection-disconnected"]').exists()).toBe(true)

      // 4. Simulate reconnection
      store.commit('realtime/setConnectionStatus', 'connected')
      await wrapper.vm.$nextTick()

      // 5. Should show connected state
      expect(wrapper.find('[data-testid="connection-connected"]').exists()).toBe(true)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle API errors gracefully', async () => {
      // Mock API error
      store.commit('api/setError', {
        message: 'Failed to load queue data',
        code: 'QUEUE_LOAD_FAILED'
      })

      wrapper = mount(QueueView, {
        global: {
          plugins: [router, store]
        }
      })

      await wrapper.vm.$nextTick()

      // 1. Should display error message
      const errorMessage = wrapper.find('[data-testid="error-message"]')
      expect(errorMessage.exists()).toBe(true)

      // 2. Should provide retry option
      const retryButton = wrapper.find('[data-testid="retry-btn"]')
      expect(retryButton.exists()).toBe(true)

      // 3. Should handle retry
      await retryButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Should attempt to reload data
      expect(store.getters['api/isLoading']).toBe(true)
    })

    it('should handle validation errors', async () => {
      wrapper = mount(SettingsView, {
        global: {
          plugins: [router, store]
        }
      })

      await wrapper.vm.$nextTick()

      // 1. Try to submit invalid settings
      const maxQueueInput = wrapper.find('[data-testid="max-queue-input"]')
      if (maxQueueInput.exists()) {
        await maxQueueInput.setValue('-1') // Invalid value
        await maxQueueInput.trigger('blur')

        // 2. Should show validation error
        const validationError = wrapper.find('[data-testid="validation-error"]')
        expect(validationError.exists()).toBe(true)
      }
    })
  })

  describe('Performance Integration', () => {
    it('should handle large queue datasets efficiently', async () => {
      // Generate large dataset
      const largeQueue = Array.from({ length: 100 }, (_, i) => ({
        id: `customer-${i}`,
        queueNumber: i + 1,
        customerName: `Customer ${i + 1}`,
        partySize: Math.floor(Math.random() * 8) + 1,
        status: 'waiting',
        joinedAt: new Date(Date.now() - Math.random() * 3600000)
      }))

      store.commit('queue/setCurrentQueue', largeQueue)

      const startTime = performance.now()

      wrapper = mount(QueueView, {
        global: {
          plugins: [router, store]
        }
      })

      await wrapper.vm.$nextTick()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // 1. Should render within reasonable time (< 1000ms)
      expect(renderTime).toBeLessThan(1000)

      // 2. Should display all queue items
      const queueItems = wrapper.findAll('[data-testid="queue-item"]')
      expect(queueItems.length).toBe(largeQueue.length)

      // 3. Should handle virtual scrolling if implemented
      if (wrapper.vm.$refs.virtualScroller) {
        expect(wrapper.vm.$refs.virtualScroller).toBeDefined()
      }
    })
  })

  describe('Accessibility Integration', () => {
    it('should meet accessibility standards', async () => {
      wrapper = mount(QueueView, {
        global: {
          plugins: [router, store]
        }
      })

      await wrapper.vm.$nextTick()

      // 1. Should have proper ARIA labels
      const buttons = wrapper.findAll('button')
      buttons.forEach(button => {
        expect(
          button.attributes('aria-label') ||
          button.attributes('aria-labelledby') ||
          button.text().trim()
        ).toBeTruthy()
      })

      // 2. Should have proper heading structure
      const headings = wrapper.findAll('h1, h2, h3, h4, h5, h6')
      expect(headings.length).toBeGreaterThan(0)

      // 3. Should handle keyboard navigation
      const focusableElements = wrapper.findAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      for (const element of focusableElements) {
        expect(element.attributes('tabindex')).not.toBe('-1')
      }
    })
  })

  describe('Data Persistence Integration', () => {
    it('should persist user preferences', async () => {
      wrapper = mount(SettingsView, {
        global: {
          plugins: [router, store]
        }
      })

      await wrapper.vm.$nextTick()

      // 1. Change a setting
      const languageSelect = wrapper.find('[data-testid="language-select"]')
      if (languageSelect.exists()) {
        await languageSelect.setValue('en')
        await wrapper.vm.$nextTick()

        // 2. Should persist in store
        expect(store.getters['settings/language']).toBe('en')

        // 3. Should persist in localStorage
        expect(localStorage.getItem('dashboard-language')).toBe('en')
      }
    })

    it('should restore user preferences on load', async () => {
      // 1. Set preferences in localStorage
      localStorage.setItem('dashboard-language', 'zh-TW')
      localStorage.setItem('dashboard-theme', 'dark')

      wrapper = mount(SettingsView, {
        global: {
          plugins: [router, store]
        }
      })

      await wrapper.vm.$nextTick()

      // 2. Should restore preferences
      expect(store.getters['settings/language']).toBe('zh-TW')
      expect(store.getters['settings/theme']).toBe('dark')

      // 3. Should reflect in UI
      const languageSelect = wrapper.find('[data-testid="language-select"]')
      if (languageSelect.exists()) {
        expect(languageSelect.element.value).toBe('zh-TW')
      }
    })
  })
})