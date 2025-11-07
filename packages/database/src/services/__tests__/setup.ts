/**
 * Test Setup for Database Services
 * Mocks drizzle-orm to work with test mocks
 */

import { vi, beforeEach } from 'vitest'

// Mock drizzle-orm/d1 module
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn((d1: any) => {
    // Return the mock database object as-is
    // This allows tests to directly control the database behavior
    return d1
  })
}))

// Mock connection manager
vi.mock('../../utils/connection-manager', () => ({
  getConnectionManager: vi.fn(() => ({
    getConnection: vi.fn(),
    releaseConnection: vi.fn(),
    closeAll: vi.fn()
  }))
}))

// Mock query cache
vi.mock('../../utils/query-cache', () => ({
  QueryCache: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
    invalidatePattern: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})
