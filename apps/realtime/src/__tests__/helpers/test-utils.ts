/**
 * Test Utilities for Realtime Tests
 *
 * Provides helper functions to create properly typed test data
 */

import type { RealtimeAuthPayload } from '@makanmakan/shared-types'

/**
 * Convert numeric role (UserRole enum) to string role for RealtimeAuthPayload
 */
export function getStringRole(numericRole: number): 'customer' | 'staff' | 'admin' {
  if (numericRole === 4) return 'customer'  // Customer
  if (numericRole === 0 || numericRole === 1) return 'admin'  // Admin or Owner
  return 'staff'  // Chef (2), Service (3)
}

/**
 * Create a properly typed RealtimeAuthPayload for testing
 */
export function createTestAuthPayload(
  roomType: 'customer' | 'admin' | 'kitchen' | 'restaurant',
  roomId: string,
  restaurantId: string,
  numericRole: number,
  options?: {
    tableId?: string
    seatId?: string
    userId?: number
  }
): RealtimeAuthPayload {
  return {
    roomType,
    roomId,
    restaurantId,
    role: getStringRole(numericRole),
    tableId: options?.tableId,
    seatId: options?.seatId,
    userId: options?.userId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  }
}

/**
 * Mock WebSocketPair for testing
 */
export class MockWebSocketPair {
  [0]: WebSocket
  [1]: WebSocket

  constructor() {
    this[0] = {} as WebSocket
    this[1] = {} as WebSocket
  }
}

// Make MockWebSocketPair available globally for tests
if (typeof globalThis !== 'undefined') {
  (globalThis as any).WebSocketPair = MockWebSocketPair
}
