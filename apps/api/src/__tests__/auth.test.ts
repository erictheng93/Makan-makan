import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import authRouter from '../routes/auth'
import { createMockContext, mockEnv } from './setup'
import * as bcrypt from 'bcryptjs'

// Mock @makanmakan/database to provide AuthService
vi.mock('@makanmakan/database', () => {
  return {
    AuthService: vi.fn().mockImplementation(() => ({
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      validateToken: vi.fn(),
      refreshToken: vi.fn()
    }))
  }
})

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
  hash: vi.fn()
}))

// Import after mocking
import { AuthService } from '@makanmakan/database'

describe('Auth Routes', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>
  let mockAuthServiceInstance: any

  beforeEach(() => {
    app = new Hono<{ Bindings: typeof mockEnv }>()
    app.route('/auth', authRouter)

    // Get the mock AuthService instance
    mockAuthServiceInstance = {
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      validateToken: vi.fn(),
      refreshToken: vi.fn()
    }

    // Configure AuthService mock to return our instance
    vi.mocked(AuthService).mockImplementation(() => mockAuthServiceInstance)

    vi.clearAllMocks()
  })

  describe('POST /login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        role: 1,
        restaurantId: 1
      }

      // Mock AuthService.login to return success
      mockAuthServiceInstance.login.mockResolvedValue({
        success: true,
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresAt: Date.now() + 3600000
        },
        user: mockUser
      })

      const req = new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123'
        })
      })

      const response = await app.request(req, { env: mockEnv } as any)
      const result = await response.json() as any

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.token).toBe('mock-access-token')
      expect(result.data.user.username).toBe('testuser')
      expect(result.data.user.role).toBe(1)
    })

    it('should reject login with invalid credentials', async () => {
      // Mock AuthService.login to return failure
      mockAuthServiceInstance.login.mockResolvedValue({
        success: false,
        error: 'Invalid username or password'
      })

      const req = new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'nonexistent',
          password: 'wrongpassword'
        })
      })

      const response = await app.request(req, { env: mockEnv } as any)
      const result = await response.json() as any

      expect(response.status).toBe(401)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid username or password')
    })

    it('should reject login with wrong password', async () => {
      // Mock AuthService.login to return failure for wrong password
      mockAuthServiceInstance.login.mockResolvedValue({
        success: false,
        error: 'Invalid username or password'
      })

      const req = new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'wrongpassword'
        })
      })

      const response = await app.request(req, { env: mockEnv } as any)
      const result = await response.json() as any

      expect(response.status).toBe(401)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid username or password')
    })

    it('should reject login with missing credentials', async () => {
      const req = new Request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser'
          // missing password
        })
      })

      const response = await app.request(req, { env: mockEnv } as any)
      const result = await response.json() as any

      expect(response.status).toBe(400)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Username and password are required')
    })
  })

  describe('POST /register', () => {
    it('should reject registration without authentication', async () => {
      const req = new Request('http://localhost/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'newuser',
          password: 'password123',
          role: 2
        })
      })

      const response = await app.request(req, { env: mockEnv } as any)
      const result = await response.json() as any

      expect(response.status).toBe(401)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Authorization')
    })

    // Note: Testing authenticated routes would require mocking the auth middleware
    // This would be expanded in a full test suite
  })

  describe('GET /me', () => {
    it('should reject request without authentication', async () => {
      const req = new Request('http://localhost/auth/me', {
        method: 'GET'
      })

      const response = await app.request(req, { env: mockEnv } as any)
      const result = await response.json() as any

      expect(response.status).toBe(401)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Authorization')
    })
  })
})