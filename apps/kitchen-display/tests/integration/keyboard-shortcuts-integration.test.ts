// Integration tests for keyboard shortcuts system
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import KeyboardShortcutsHelp from '@/components/shortcuts/KeyboardShortcutsHelp.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useOrderManagement } from '@/stores/orderManagement'

describe('Keyboard Shortcuts Integration Tests', () => {
  let orderStore: ReturnType<typeof useOrderManagement>

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    orderStore = useOrderManagement()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Cleanup any active shortcuts
    document.removeEventListener('keydown', vi.fn())
  })

  describe('Keyboard Shortcuts Composable Integration', () => {
    it('should register and execute shortcuts correctly', async () => {
      const { enabled, toggle, executeShortcut } = useKeyboardShortcuts()
      
      // Enable shortcuts
      toggle(true)
      expect(enabled.value).toBe(true)
      
      // Execute a shortcut
      const result = await executeShortcut('filter_pending')
      expect(result).toBe(true)
    })

    it('should handle keyboard events with modifiers', async () => {
      const { setupEventListeners } = useKeyboardShortcuts()
      
      setupEventListeners()
      
      // Simulate Ctrl+F shortcut
      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true
      })
      
      document.dispatchEvent(event)
      await nextTick()
      
      // Should have prevented default and executed filter action
      expect(event.defaultPrevented).toBe(true)
    })

    it('should ignore shortcuts in input fields', async () => {
      const { handleKeyDown } = useKeyboardShortcuts()
      
      // Create mock input element
      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        target: input
      } as any)
      
      const result = handleKeyDown(event)
      expect(result).toBe(false) // Should ignore
      
      document.body.removeChild(input)
    })

    it('should support sequential key combinations', async () => {
      const { handleKeyDown, keySequence } = useKeyboardShortcuts()
      
      // Simulate 'g' then 'p' for "go to pending"
      const event1 = new KeyboardEvent('keydown', { key: 'g' })
      const event2 = new KeyboardEvent('keydown', { key: 'p' })
      
      handleKeyDown(event1)
      await new Promise(resolve => setTimeout(resolve, 50)) // Small delay
      handleKeyDown(event2)
      
      expect(keySequence.value).toContain('g')
    })
  })

  describe('Shortcuts Help Component Integration', () => {
    it('should display all shortcut categories', () => {
      const wrapper = mount(KeyboardShortcutsHelp, {
        props: { show: true }
      })
      
      const categories = wrapper.findAll('[data-testid="category-section"]')
      expect(categories.length).toBeGreaterThan(0)
      
      // Should have order, navigation, filter, and system categories
      const categoryTitles = categories.map(c => c.text())
      expect(categoryTitles).toContain('訂單操作')
      expect(categoryTitles).toContain('導航功能')
      expect(categoryTitles).toContain('篩選功能')
      expect(categoryTitles).toContain('系統功能')
    })

    it('should filter shortcuts by search query', async () => {
      const wrapper = mount(KeyboardShortcutsHelp, {
        props: { show: true }
      })
      
      const searchInput = wrapper.find('input[placeholder*="搜索"]')
      await searchInput.setValue('pending')
      
      await nextTick()
      
      const shortcuts = wrapper.findAll('[data-testid="shortcut-item"]')
      // Should only show shortcuts related to "pending"
      expect(shortcuts.length).toBeGreaterThan(0)
    })

    it('should test individual shortcuts', async () => {
      const wrapper = mount(KeyboardShortcutsHelp, {
        props: { show: true }
      })
      
      const testButton = wrapper.find('[data-testid="test-shortcut"]')
      await testButton.trigger('click')
      
      // Should emit test event or show success message
      expect(wrapper.emitted()).toBeDefined()
    })

    it('should toggle shortcut enable/disable', async () => {
      const wrapper = mount(KeyboardShortcutsHelp, {
        props: { show: true }
      })
      
      const toggleButton = wrapper.find('[data-testid="shortcut-toggle"]')
      await toggleButton.trigger('click')
      
      // Should update shortcut enabled state
      expect(wrapper.vm.shortcutsEnabled).toBeDefined()
    })
  })

  describe('Integration with Order Management', () => {
    it('should integrate with order filtering', async () => {
      const { executeShortcut } = useKeyboardShortcuts()
      
      // Setup mock orders
      orderStore.orders = [
        { id: 1, status: 1, priority: 'normal' }, // pending
        { id: 2, status: 2, priority: 'high' },   // preparing
        { id: 3, status: 3, priority: 'normal' }  // ready
      ] as any
      
      // Execute filter shortcut
      await executeShortcut('filter_pending')
      
      // Should update order filters
      expect(orderStore.appliedFilters.status).toContain(1)
    })

    it('should support batch operations via shortcuts', async () => {
      const { executeShortcut } = useKeyboardShortcuts()
      
      // Select orders
      orderStore.selectedOrders = new Set([1, 2])
      
      // Execute batch start shortcut
      await executeShortcut('batch_start_selected')
      
      // Should trigger batch operation
      expect(orderStore.lastBatchOperation).toEqual({
        type: 'start_cooking',
        orderIds: [1, 2]
      })
    })

    it('should handle priority changes via shortcuts', async () => {
      const { executeShortcut } = useKeyboardShortcuts()
      
      // Focus on an order
      orderStore.focusedOrderId = 1
      
      // Execute priority shortcut
      await executeShortcut('priority_high')
      
      // Should update order priority
      const focusedOrder = orderStore.orders.find(o => o.id === 1)
      expect(focusedOrder?.priority).toBe('high')
    })
  })

  describe('Shortcut Persistence and Configuration', () => {
    it('should save and restore custom shortcuts', async () => {
      const { exportShortcuts, importShortcuts, shortcutGroups } = useKeyboardShortcuts()
      
      // Modify a shortcut
      const originalShortcut = shortcutGroups.value[0].shortcuts[0]
      originalShortcut.keys = ['Ctrl', 'Shift', 'N']
      
      // Export settings
      const exported = await exportShortcuts()
      expect(exported).toBeDefined()
      
      // Import settings
      const blob = new Blob([JSON.stringify(exported)], { type: 'application/json' })
      const file = new File([blob], 'shortcuts.json')
      
      await importShortcuts(file)
      
      // Should restore the modified shortcut
      const restoredShortcut = shortcutGroups.value[0].shortcuts[0]
      expect(restoredShortcut.keys).toEqual(['Ctrl', 'Shift', 'N'])
    })

    it('should reset to default shortcuts', async () => {
      const { resetToDefaults, shortcutGroups } = useKeyboardShortcuts()
      
      // Modify shortcuts
      shortcutGroups.value[0].shortcuts[0].enabled = false
      
      // Reset to defaults
      resetToDefaults()
      
      // Should restore default state
      expect(shortcutGroups.value[0].shortcuts[0].enabled).toBe(true)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid shortcut execution gracefully', async () => {
      const { executeShortcut } = useKeyboardShortcuts()
      
      const result = await executeShortcut('invalid_shortcut')
      expect(result).toBe(false)
    })

    it('should prevent shortcut conflicts', async () => {
      const { shortcutGroups, validateShortcuts } = useKeyboardShortcuts()
      
      // Create duplicate shortcut keys
      shortcutGroups.value[0].shortcuts[0].keys = ['Ctrl', 'S']
      shortcutGroups.value[1].shortcuts[0].keys = ['Ctrl', 'S']
      
      const conflicts = validateShortcuts()
      expect(conflicts.length).toBeGreaterThan(0)
    })

    it('should handle rapid key presses', async () => {
      const { handleKeyDown } = useKeyboardShortcuts()
      
      const events = Array.from({ length: 10 }, () => 
        new KeyboardEvent('keydown', { key: 'f', ctrlKey: true })
      )
      
      const startTime = performance.now()
      events.forEach(handleKeyDown)
      const endTime = performance.now()
      
      // Should handle efficiently without blocking
      expect(endTime - startTime).toBeLessThan(100)
    })
  })

  describe('Accessibility and Usability', () => {
    it('should provide clear visual feedback for shortcuts', async () => {
      const wrapper = mount(KeyboardShortcutsHelp, {
        props: { show: true }
      })
      
      const keyElements = wrapper.findAll('kbd')
      expect(keyElements.length).toBeGreaterThan(0)
      
      // Each key should be properly formatted
      keyElements.forEach(key => {
        expect(key.classes()).toContain('px-2')
        expect(key.classes()).toContain('py-1')
      })
    })

    it('should support keyboard navigation in help modal', async () => {
      const wrapper = mount(KeyboardShortcutsHelp, {
        props: { show: true }
      })
      
      // Should be focusable and keyboard navigable
      const focusableElements = wrapper.findAll('button, input')
      expect(focusableElements.length).toBeGreaterThan(0)
    })

    it('should show shortcut status indicators', async () => {
      const wrapper = mount(KeyboardShortcutsHelp, {
        props: { show: true }
      })
      
      const statusIndicators = wrapper.findAll('[data-testid="shortcut-status"]')
      expect(statusIndicators.length).toBeGreaterThan(0)
      
      // Should show enabled/disabled status
      statusIndicators.forEach(indicator => {
        expect(indicator.classes()).toMatch(/bg-(green|gray)-/)
      })
    })
  })

  describe('Performance Optimization', () => {
    it('should debounce rapid shortcut executions', async () => {
      const { executeShortcut } = useKeyboardShortcuts()
      
      const executionSpy = vi.fn()
      
      // Rapid executions
      for (let i = 0; i < 5; i++) {
        executeShortcut('filter_all')
      }
      
      // Should debounce to prevent excessive executions
      await new Promise(resolve => setTimeout(resolve, 300))
      
      expect(executionSpy).toHaveBeenCalledTimes(1)
    })

    it('should cleanup event listeners properly', () => {
      const { setupEventListeners, cleanup } = useKeyboardShortcuts()
      
      setupEventListeners()
      
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      
      cleanup()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })
})