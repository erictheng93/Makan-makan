/**
 * Notification Store Tests
 * 測試通知 store 的功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotificationStore } from '../notification'
import type { Notification } from '../notification'

describe('Notification Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initial State', () => {
    it('should have empty notifications array', () => {
      const store = useNotificationStore()
      expect(store.notifications).toEqual([])
    })

    it('should have sound enabled by default', () => {
      const store = useNotificationStore()
      expect(store.soundEnabled).toBe(true)
    })

    it('should have zero unread count', () => {
      const store = useNotificationStore()
      expect(store.unreadCount).toBe(0)
    })
  })

  describe('addNotification', () => {
    it('should add notification successfully', () => {
      const store = useNotificationStore()

      const id = store.addNotification({
        type: 'success',
        title: 'Success',
        message: 'Operation completed'
      })

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].title).toBe('Success')
      expect(id).toBeTruthy()
    })

    it('should generate unique IDs for notifications', () => {
      const store = useNotificationStore()

      const id1 = store.addNotification({
        type: 'info',
        title: 'Info 1',
        message: 'Message 1'
      })

      const id2 = store.addNotification({
        type: 'info',
        title: 'Info 2',
        message: 'Message 2'
      })

      expect(id1).not.toBe(id2)
    })

    it('should add new notifications at the beginning', () => {
      const store = useNotificationStore()

      store.addNotification({
        type: 'info',
        title: 'First',
        message: 'Message 1'
      })

      store.addNotification({
        type: 'info',
        title: 'Second',
        message: 'Message 2'
      })

      expect(store.notifications[0].title).toBe('Second')
      expect(store.notifications[1].title).toBe('First')
    })

    it('should mark notifications as unread by default', () => {
      const store = useNotificationStore()

      store.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test message'
      })

      expect(store.notifications[0].read).toBe(false)
      expect(store.unreadCount).toBe(1)
    })

    it('should auto-remove non-persistent notifications', () => {
      const store = useNotificationStore()

      store.addNotification({
        type: 'success',
        title: 'Auto Remove',
        message: 'This will be removed',
        persistent: false
      })

      expect(store.notifications).toHaveLength(1)

      vi.advanceTimersByTime(5000)

      expect(store.notifications).toHaveLength(0)
    })

    it('should keep persistent notifications', () => {
      const store = useNotificationStore()

      store.addNotification({
        type: 'warning',
        title: 'Persistent',
        message: 'This stays',
        persistent: true
      })

      vi.advanceTimersByTime(10000)

      expect(store.notifications).toHaveLength(1)
    })

    it('should include notification data', () => {
      const store = useNotificationStore()

      store.addNotification({
        type: 'order_ready',
        title: 'Order Ready',
        message: 'Table 5',
        data: {
          orderNumber: 'ORD-001',
          tableNumber: 5
        }
      })

      expect(store.notifications[0].data?.orderNumber).toBe('ORD-001')
      expect(store.notifications[0].data?.tableNumber).toBe(5)
    })
  })

  describe('removeNotification', () => {
    it('should remove notification by ID', () => {
      const store = useNotificationStore()

      const id = store.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test'
      })

      store.removeNotification(id)

      expect(store.notifications).toHaveLength(0)
    })

    it('should not fail when removing non-existent notification', () => {
      const store = useNotificationStore()

      store.removeNotification('non-existent-id')

      expect(store.notifications).toHaveLength(0)
    })

    it('should only remove specified notification', () => {
      const store = useNotificationStore()

      const id1 = store.addNotification({
        type: 'info',
        title: 'First',
        message: 'First'
      })

      const id2 = store.addNotification({
        type: 'info',
        title: 'Second',
        message: 'Second'
      })

      store.removeNotification(id1)

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].id).toBe(id2)
    })
  })

  describe('markAsRead', () => {
    it('should mark notification as read', () => {
      const store = useNotificationStore()

      const id = store.addNotification({
        type: 'info',
        title: 'Test',
        message: 'Test'
      })

      store.markAsRead(id)

      expect(store.notifications[0].read).toBe(true)
      expect(store.unreadCount).toBe(0)
    })

    it('should not fail when marking non-existent notification', () => {
      const store = useNotificationStore()

      store.markAsRead('non-existent-id')

      expect(store.unreadCount).toBe(0)
    })
  })

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', () => {
      const store = useNotificationStore()

      store.addNotification({ type: 'info', title: 'A', message: 'A' })
      store.addNotification({ type: 'info', title: 'B', message: 'B' })
      store.addNotification({ type: 'info', title: 'C', message: 'C' })

      expect(store.unreadCount).toBe(3)

      store.markAllAsRead()

      expect(store.unreadCount).toBe(0)
      expect(store.notifications.every(n => n.read)).toBe(true)
    })
  })

  describe('clearAll', () => {
    it('should clear all notifications', () => {
      const store = useNotificationStore()

      store.addNotification({ type: 'info', title: 'A', message: 'A' })
      store.addNotification({ type: 'info', title: 'B', message: 'B' })

      store.clearAll()

      expect(store.notifications).toHaveLength(0)
      expect(store.unreadCount).toBe(0)
    })
  })

  describe('clearRead', () => {
    it('should only clear read notifications', () => {
      const store = useNotificationStore()

      const id1 = store.addNotification({
        type: 'info',
        title: 'Read',
        message: 'Will be removed'
      })

      store.addNotification({
        type: 'info',
        title: 'Unread',
        message: 'Will stay'
      })

      store.markAsRead(id1)
      store.clearRead()

      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].title).toBe('Unread')
    })

    it('should not remove unread notifications', () => {
      const store = useNotificationStore()

      store.addNotification({ type: 'info', title: 'A', message: 'A' })
      store.addNotification({ type: 'info', title: 'B', message: 'B' })

      store.clearRead()

      expect(store.notifications).toHaveLength(2)
    })
  })

  describe('toggleSound', () => {
    it('should toggle sound state', () => {
      const store = useNotificationStore()

      expect(store.soundEnabled).toBe(true)

      store.toggleSound()
      expect(store.soundEnabled).toBe(false)

      store.toggleSound()
      expect(store.soundEnabled).toBe(true)
    })

    it('should save sound preference to localStorage', () => {
      const store = useNotificationStore()

      store.toggleSound()

      expect(localStorage.getItem('notification_sound')).toBe('false')
    })
  })

  describe('Unread Count', () => {
    it('should count unread notifications correctly', () => {
      const store = useNotificationStore()

      store.addNotification({ type: 'info', title: 'A', message: 'A' })
      store.addNotification({ type: 'info', title: 'B', message: 'B' })
      store.addNotification({ type: 'info', title: 'C', message: 'C' })

      expect(store.unreadCount).toBe(3)

      const id = store.notifications[0].id
      store.markAsRead(id)

      expect(store.unreadCount).toBe(2)
    })

    it('should update unread count when clearing', () => {
      const store = useNotificationStore()

      store.addNotification({ type: 'info', title: 'A', message: 'A' })
      store.addNotification({ type: 'info', title: 'B', message: 'B' })

      expect(store.unreadCount).toBe(2)

      store.clearAll()

      expect(store.unreadCount).toBe(0)
    })
  })

  describe('Notification Types', () => {
    it('should handle different notification types', () => {
      const store = useNotificationStore()

      const types: Array<Notification['type']> = [
        'success',
        'error',
        'warning',
        'info',
        'order_ready',
        'order_urgent'
      ]

      types.forEach(type => {
        store.addNotification({
          type,
          title: `${type} notification`,
          message: 'Test'
        })
      })

      expect(store.notifications).toHaveLength(6)
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid notifications', () => {
      const store = useNotificationStore()

      for (let i = 0; i < 100; i++) {
        store.addNotification({
          type: 'info',
          title: `Notification ${i}`,
          message: `Message ${i}`
        })
      }

      expect(store.notifications).toHaveLength(100)
    })

    it('should handle concurrent operations', () => {
      const store = useNotificationStore()

      const id1 = store.addNotification({
        type: 'info',
        title: 'A',
        message: 'A'
      })

      const id2 = store.addNotification({
        type: 'info',
        title: 'B',
        message: 'B'
      })

      store.markAsRead(id1)
      store.removeNotification(id2)

      expect(store.notifications).toHaveLength(1)
      expect(store.unreadCount).toBe(0)
    })
  })
})
