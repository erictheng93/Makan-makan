import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import authRouter from '../routes/auth'
import { createMockContext, mockEnv } from './setup'
import * as bcrypt from 'bcryptjs'

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
  hash: vi.fn()
}))

describe('Auth Routes', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>

  beforeEach(() => {
    app = new Hono<{ Bindings: typeof mockEnv }>()
    app.route('/auth', authRouter)
    vi.clearAllMocks()
  })

  describe('POST /login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        password: '$2b$12$hashedpassword',
        role: 1,
        restaurant_id: 1,
        status: 'active',
        created_at: new Date().toISOString()
      }

      // Mock database response
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockUser)
        })
      })
      
      const mockRun = vi.fn().mockResolvedValue({ success: true })
      mockEnv.DB.prepare = mockPrepare

      // Mock bcrypt comparison
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any)

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
      expect(result.data.token).toBeDefined()
      expect(result.data.user.username).toBe('testuser')
      expect(result.data.user.role).toBe(1)
    })

    it('should reject login with invalid credentials', async () => {
      // Mock database response - user not found
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null)
        })
      })
      
      mockEnv.DB.prepare = mockPrepare

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
      const mockUser = {
        id: 1,
        username: 'testuser',
        password: '$2b$12$hashedpassword',
        role: 1,
        restaurant_id: 1,
        status: 'active',
        created_at: new Date().toISOString()
      }

      // Mock database response
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockUser)
        })
      })
      
      mockEnv.DB.prepare = mockPrepare

      // Mock bcrypt comparison to return false
      vi.mocked(bcrypt.compare).mockResolvedValue(false as any)

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