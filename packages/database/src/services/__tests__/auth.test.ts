/**
 * Auth Service Unit Tests
 * Comprehensive test coverage for authentication and session management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AuthService } from '../auth'
import { createMockDatabase, createMockEnv, setupMockDbResponses } from './helpers/mockD1'

// Mock bcrypt and jwt modules
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn()
  },
  compare: vi.fn(),
  hash: vi.fn()
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn()
  },
  sign: vi.fn(),
  verify: vi.fn()
}))

// Import after mocking
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'

describe('AuthService', () => {
  let authService: AuthService
  let mockDb: any
  let mockEnv: any

  beforeEach(() => {
    // Create fresh mocks for each test
    mockDb = createMockDatabase()
    mockEnv = createMockEnv({
      JWT_SECRET: 'test-jwt-secret-key-with-minimum-32-characters-for-security'
    })

    // Initialize service with mocks
    authService = new AuthService(mockDb, mockEnv)

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Login', () => {
    const validLoginData = {
      username: 'testuser',
      password: 'Test@1234',
      deviceInfo: {
        userAgent: 'Test Agent',
        ipAddress: '127.0.0.1'
      }
    }

    const mockUser = {
      id: 1,
      username: 'testuser',
      fullName: 'Test User',
      passwordHash: '$2a$10$hashedpassword',
      role: 1,
      restaurantId: 1,
      isActive: true
    }

    it('should successfully login with valid credentials', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [mockUser]
      })

      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any)

      // Mock logout to return true
      vi.spyOn(authService, 'logout').mockResolvedValue(true)
      vi.spyOn(authService, 'createSession').mockResolvedValue(undefined)

      // Act
      const result = await authService.login(validLoginData)

      // Assert
      expect(result.success).toBe(true)
      expect(result.user).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        fullName: mockUser.fullName,
        role: mockUser.role,
        restaurantId: mockUser.restaurantId,
        isActive: mockUser.isActive
      })
      expect(result.tokens).toBeDefined()
      expect(result.tokens?.accessToken).toBe('mock-token')
      expect(result.tokens?.refreshToken).toBe('mock-token')
      expect(bcrypt.compare).toHaveBeenCalledWith(validLoginData.password, mockUser.passwordHash)
    })

    it('should fail login with invalid username', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [] // No user found
      })

      // Act
      const result = await authService.login(validLoginData)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid username or password')
      expect(result.user).toBeUndefined()
      expect(result.tokens).toBeUndefined()
    })

    it('should fail login with invalid password', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [mockUser]
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      // Act
      const result = await authService.login(validLoginData)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid username or password')
    })

    it('should track failed login attempts', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [mockUser]
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      // Act
      await authService.login(validLoginData)

      // Assert
      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        `login_fail:${validLoginData.username}`,
        '1',
        { expirationTtl: 900 }
      )
    })

    it('should lock account after 5 failed attempts', async () => {
      // Arrange
      mockEnv.CACHE_KV.get.mockResolvedValue('5')

      // Act
      const result = await authService.login(validLoginData)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('temporarily locked')
    })

    it('should clear failed attempts on successful login', async () => {
      // Arrange
      mockEnv.CACHE_KV.get.mockResolvedValue('3')
      setupMockDbResponses(mockDb, {
        select: [mockUser]
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any)
      vi.spyOn(authService, 'logout').mockResolvedValue(true)
      vi.spyOn(authService, 'createSession').mockResolvedValue(undefined)

      // Act
      await authService.login(validLoginData)

      // Assert
      expect(mockEnv.CACHE_KV.delete).toHaveBeenCalledWith(`login_fail:${validLoginData.username}`)
    })

    it('should not login inactive user', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [] // Query filters out inactive users
      })

      // Act
      const result = await authService.login(validLoginData)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid username or password')
    })

    it('should create session on successful login', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [mockUser]
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any)
      vi.spyOn(authService, 'logout').mockResolvedValue(true)
      const createSessionSpy = vi.spyOn(authService, 'createSession').mockResolvedValue(undefined)

      // Act
      await authService.login(validLoginData)

      // Assert
      expect(createSessionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          token: 'mock-token',
          refreshToken: 'mock-token',
          userAgent: validLoginData.deviceInfo.userAgent,
          ipAddress: validLoginData.deviceInfo.ipAddress
        })
      )
    })
  })

  describe('Register', () => {
    const validRegisterData = {
      username: 'newuser',
      email: 'new@example.com',
      fullName: 'New User',
      password: 'Test@1234',
      role: 1,
      restaurantId: 1
    }

    it('should successfully register new user with strong password', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [], // No existing user
        insert: [{
          id: 1,
          username: validRegisterData.username,
          fullName: validRegisterData.fullName,
          role: validRegisterData.role,
          restaurantId: validRegisterData.restaurantId
        }]
      })
      vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$hashedpassword' as never)

      // Act
      const result = await authService.register(validRegisterData)

      // Assert
      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user?.username).toBe(validRegisterData.username)
      expect(bcrypt.hash).toHaveBeenCalledWith(validRegisterData.password, 10)
    })

    it('should fail if username already exists', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [{ id: 1 }] // Existing user
      })

      // Act
      const result = await authService.register(validRegisterData)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Username already exists')
    })

    it('should reject weak password for staff (too short)', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: []
      })

      // Act
      const result = await authService.register({
        ...validRegisterData,
        password: 'Test@1' // Only 6 characters
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('at least 8 characters')
    })

    it('should reject password without uppercase letter', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: []
      })

      // Act
      const result = await authService.register({
        ...validRegisterData,
        password: 'test@1234' // No uppercase
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('uppercase letter')
    })

    it('should reject password without lowercase letter', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: []
      })

      // Act
      const result = await authService.register({
        ...validRegisterData,
        password: 'TEST@1234' // No lowercase
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('lowercase letter')
    })

    it('should reject password without number', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: []
      })

      // Act
      const result = await authService.register({
        ...validRegisterData,
        password: 'Test@Test' // No number
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('number')
    })

    it('should reject password without special character', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: []
      })

      // Act
      const result = await authService.register({
        ...validRegisterData,
        password: 'Test12345' // No special char
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('special character')
    })

    it('should enforce strict password requirements for staff', async () => {
      // Arrange - test that staff (non-customer) requires complex password
      setupMockDbResponses(mockDb, {
        select: []
      })

      // Act - Try with simple password that would be valid for customers
      const result = await authService.register({
        ...validRegisterData,
        role: 1, // Staff role
        password: 'simple' // Only 6 chars, no complexity
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('at least 8 characters')
    })

    it('should accept relaxed password for customers', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: [],
        insert: [{
          id: 1,
          username: validRegisterData.username,
          fullName: validRegisterData.fullName,
          role: 5,
          restaurantId: null
        }]
      })
      vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$hashedpassword' as never)

      // Act
      const result = await authService.register({
        ...validRegisterData,
        role: 5, // Customer role
        password: 'simple' // 6 characters, no complexity required
      })

      // Assert
      expect(result.success).toBe(true)
    })

    it('should reject password over 128 characters', async () => {
      // Arrange
      setupMockDbResponses(mockDb, {
        select: []
      })
      const longPassword = 'A'.repeat(129) + '@1'

      // Act
      const result = await authService.register({
        ...validRegisterData,
        password: longPassword
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('128 characters')
    })
  })

  describe('RefreshToken', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      fullName: 'Test User',
      role: 1,
      restaurantId: 1,
      isActive: true
    }

    const mockSession = {
      id: 'session-id',
      userId: 1,
      token: 'old-access-token',
      refreshToken: 'valid-refresh-token',
      expiresAt: new Date(Date.now() + 86400000),
      isActive: true
    }

    it('should successfully refresh token with valid refresh token', async () => {
      // Arrange
      vi.mocked(jwt.verify).mockReturnValue({ userId: 1, type: 'refresh' } as any)

      // Mock two separate select queries: one for session, one for user
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockSession)
          })
        })
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockUser)
          })
        })
      })

      vi.mocked(jwt.sign).mockReturnValue('new-access-token' as any)

      // Act
      const result = await authService.refreshToken('valid-refresh-token')

      // Assert
      expect(result.success).toBe(true)
      expect(result.tokens?.accessToken).toBe('new-access-token')
      expect(result.tokens?.refreshToken).toBe('valid-refresh-token')
      expect(result.user).toEqual(mockUser)
    })

    it('should fail with invalid refresh token signature', async () => {
      // Arrange
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      // Act
      const result = await authService.refreshToken('invalid-token')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid refresh token')
    })

    it('should fail with access token instead of refresh token', async () => {
      // Arrange
      vi.mocked(jwt.verify).mockReturnValue({ userId: 1, type: 'access' } as any)

      // Act
      const result = await authService.refreshToken('access-token')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid refresh token')
    })

    it('should fail if session not found', async () => {
      // Arrange
      vi.mocked(jwt.verify).mockReturnValue({ userId: 1, type: 'refresh' } as any)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(null) // No session
          })
        })
      })

      // Act
      const result = await authService.refreshToken('valid-refresh-token')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('Session not found')
    })

    it('should fail if user is inactive', async () => {
      // Arrange
      vi.mocked(jwt.verify).mockReturnValue({ userId: 1, type: 'refresh' } as any)

      // Mock session found, but user not found (inactive)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockSession)
          })
        })
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(null) // User inactive
          })
        })
      })

      // Act
      const result = await authService.refreshToken('valid-refresh-token')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('User not found or inactive')
    })
  })

  describe('ValidateToken', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      fullName: 'Test User',
      role: 1,
      restaurantId: 1,
      isActive: true
    }

    const mockSession = {
      id: 'session-id',
      userId: 1,
      token: 'valid-token',
      expiresAt: new Date(Date.now() + 86400000),
      isActive: true,
      lastAccessedAt: new Date()
    }

    it('should successfully validate valid token', async () => {
      // Arrange
      vi.mocked(jwt.verify).mockReturnValue({ id: 1, username: 'testuser' } as any)

      // Mock two select queries: session and user
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockSession)
          })
        })
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockUser)
          })
        })
      })

      // Act
      const result = await authService.validateToken('valid-token')

      // Assert
      expect(result.valid).toBe(true)
      expect(result.user).toEqual(mockUser)
    })

    it('should fail with invalid token signature', async () => {
      // Arrange
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      // Act
      const result = await authService.validateToken('invalid-token')

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid token')
    })

    it('should fail if session not found', async () => {
      // Arrange
      vi.mocked(jwt.verify).mockReturnValue({ id: 1 } as any)
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(null)
          })
        })
      })

      // Act
      const result = await authService.validateToken('valid-token')

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Session expired or invalid')
    })

    it('should update last accessed time on validation', async () => {
      // Arrange
      vi.mocked(jwt.verify).mockReturnValue({ id: 1 } as any)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockSession)
          })
        })
      }).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockUser)
          })
        })
      })

      // Act
      await authService.validateToken('valid-token')

      // Assert
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('Logout', () => {
    it('should logout user by deactivating all sessions', async () => {
      // Arrange - mock update returning success
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      })

      // Act
      const result = await authService.logout(1)

      // Assert
      expect(result).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should logout specific session with token', async () => {
      // Arrange
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      })

      // Act
      const result = await authService.logout(1, 'specific-token')

      // Assert
      expect(result).toBe(true)
    })

    it('should throw error on database failure', async () => {
      // Arrange
      mockDb.update.mockImplementation(() => {
        throw new Error('Database error')
      })

      // Act & Assert
      await expect(authService.logout(1)).rejects.toThrow('Database operation failed: logout')
    })
  })

  describe('ChangePassword', () => {
    const mockUser = {
      passwordHash: '$2a$10$old-hashed-password'
    }

    it('should successfully change password with valid old password', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockUser)
          })
        })
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$new-hashed-password' as never)

      // Act
      const result = await authService.changePassword(1, 'OldPass@123', 'NewPass@456')

      // Assert
      expect(result.success).toBe(true)
      expect(bcrypt.compare).toHaveBeenCalledWith('OldPass@123', mockUser.passwordHash)
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass@456', 10)
    })

    it('should fail if user not found', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(null)
          })
        })
      })

      // Act
      const result = await authService.changePassword(1, 'OldPass@123', 'NewPass@456')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('User not found')
    })

    it('should fail if old password is incorrect', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockUser)
          })
        })
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      // Act
      const result = await authService.changePassword(1, 'WrongPass@123', 'NewPass@456')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Current password is incorrect')
    })

    it('should fail if new password is weak', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockUser)
          })
        })
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      // Act
      const result = await authService.changePassword(1, 'OldPass@123', 'weak')

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('at least 8 characters')
    })

    it('should invalidate all sessions after password change', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockUser)
          })
        })
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$new-hashed-password' as never)

      // Act
      await authService.changePassword(1, 'OldPass@123', 'NewPass@456')

      // Assert
      // Should be called twice: once for password update, once for session invalidation
      expect(mockDb.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('CreateSession', () => {
    it('should create new session with cleanup', async () => {
      // Arrange
      const sessionData = {
        userId: 1,
        token: 'access-token',
        refreshToken: 'refresh-token',
        userAgent: 'Test Agent',
        ipAddress: '127.0.0.1',
        deviceInfo: { platform: 'test' },
        location: { city: 'Test City' },
        expiresAt: new Date()
      }

      const cleanupSpy = vi.spyOn(authService, 'cleanupExpiredSessions').mockResolvedValue(0)

      // Act
      await authService.createSession(sessionData)

      // Assert
      expect(cleanupSpy).toHaveBeenCalledWith(sessionData.userId)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('CleanupExpiredSessions', () => {
    it('should delete expired sessions for specific user', async () => {
      // Arrange
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      })

      // Act
      const result = await authService.cleanupExpiredSessions(1)

      // Assert
      expect(mockDb.delete).toHaveBeenCalled()
      expect(result).toBe(0)
    })

    it('should delete all expired sessions if no user specified', async () => {
      // Arrange
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      })

      // Act
      const result = await authService.cleanupExpiredSessions()

      // Assert
      expect(mockDb.delete).toHaveBeenCalled()
      expect(result).toBe(0)
    })
  })

  describe('GetUserSessions', () => {
    it('should return active sessions for user', async () => {
      // Arrange
      const mockSessions = [
        {
          id: 'session-1',
          deviceInfo: { platform: 'web' },
          ipAddress: '127.0.0.1',
          location: { city: 'Test' },
          lastAccessedAt: new Date(),
          expiresAt: new Date(),
          createdAt: new Date()
        }
      ]

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockSessions)
          })
        })
      })

      // Act
      const result = await authService.getUserSessions(1)

      // Assert
      expect(result).toEqual(mockSessions)
    })
  })
})
