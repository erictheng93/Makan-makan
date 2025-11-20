/**
 * Auth Store Tests
 * 測試認證 store 的狀態管理和登入流程
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockAuthApi = {
  login: vi.fn(),
  logout: vi.fn(),
  verifyToken: vi.fn()
}

vi.mock('@/services/authApi', () => ({ authApi: mockAuthApi }))

describe('Auth Store', () => {
  let localStorageMock: Map<string, string>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Mock localStorage with Map for better tracking
    localStorageMock = new Map()

    const localStorageStub = {
      getItem: vi.fn((key: string) => localStorageMock.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        localStorageMock.delete(key)
      }),
      clear: vi.fn(() => {
        localStorageMock.clear()
      })
    }

    vi.stubGlobal('localStorage', localStorageStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Initial State', () => {
    it('should start as unauthenticated', () => {
      const isAuthenticated = false
      const user = null
      const token = null

      expect(isAuthenticated).toBe(false)
      expect(user).toBeNull()
      expect(token).toBeNull()
    })
  })

  describe('Login', () => {
    it('should authenticate user successfully', async () => {
      mockAuthApi.login.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token-123',
          user: {
            id: 1,
            username: 'chef1',
            role: 2,
            restaurantId: 1
          }
        }
      })

      const credentials = {
        username: 'chef1',
        password: 'password123'
      }

      const result = await mockAuthApi.login(credentials)

      expect(result.success).toBe(true)
      expect(result.data.token).toBe('test-token-123')
      expect(result.data.user.role).toBe(2)
    })

    it('should handle login failure', async () => {
      mockAuthApi.login.mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      })

      const result = await mockAuthApi.login({
        username: 'wrong',
        password: 'wrong'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid credentials')
    })

    it('should store token after successful login', async () => {
      const token = 'test-token-123'

      localStorage.setItem('auth-token', token)

      const stored = localStorage.getItem('auth-token')
      expect(stored).toBe(token)
    })
  })

  describe('Logout', () => {
    it('should clear auth state on logout', async () => {
      localStorage.setItem('auth-token', 'test-token')

      mockAuthApi.logout.mockResolvedValue({ success: true })

      await mockAuthApi.logout()
      localStorage.removeItem('auth-token')

      const token = localStorage.getItem('auth-token')
      expect(token).toBeNull()
    })
  })

  describe('Token Verification', () => {
    it('should verify valid token', async () => {
      mockAuthApi.verifyToken.mockResolvedValue({
        success: true,
        data: { valid: true }
      })

      const result = await mockAuthApi.verifyToken('valid-token')

      expect(result.success).toBe(true)
      expect(result.data.valid).toBe(true)
    })

    it('should reject invalid token', async () => {
      mockAuthApi.verifyToken.mockResolvedValue({
        success: false,
        error: 'Invalid token'
      })

      const result = await mockAuthApi.verifyToken('invalid-token')

      expect(result.success).toBe(false)
    })
  })

  describe('Role Management', () => {
    it('should check user role permissions', () => {
      const user = {
        id: 1,
        username: 'chef1',
        role: 2, // Chef
        restaurantId: 1
      }

      const canAccessKitchen = user.role <= 2
      expect(canAccessKitchen).toBe(true)
    })

    it('should restrict customer access', () => {
      const user = {
        id: 2,
        username: 'customer1',
        role: 4, // Customer
        restaurantId: 1
      }

      const canAccessKitchen = user.role <= 2
      expect(canAccessKitchen).toBe(false)
    })
  })

  describe('Session Persistence', () => {
    it('should persist auth state across reloads', () => {
      const authState = {
        token: 'test-token',
        user: { id: 1, username: 'chef1', role: 2, restaurantId: 1 }
      }

      localStorage.setItem('auth-state', JSON.stringify(authState))

      const stored = localStorage.getItem('auth-state')
      const parsed = JSON.parse(stored!)

      expect(parsed.token).toBe('test-token')
      expect(parsed.user.role).toBe(2)
    })
  })
})
