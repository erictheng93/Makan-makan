/**
 * Authentication Feature Tests
 * Comprehensive unit tests for authentication functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Env } from '../../../shared/types'
import { AuthService } from '../services/AuthService'
import { authSchemas } from '../schemas/validation'
import type {
  LoginData,
  RegisterData,
  AuthResult,
  TokenValidation,
  UserProfile,
  SessionSummary
} from '../types'

// Mock dependencies
vi.mock('../../../core/database')
vi.mock('../../../core/cache')
vi.mock('../../../core/monitoring')
vi.mock('@makanmakan/database')
vi.mock('../../../utils/errorSanitizer')

// Import mocked modules for type safety
import * as databaseModule from '../../../core/database'
import * as cacheModule from '../../../core/cache'
import * as monitoringModule from '../../../core/monitoring'
import * as dbModule from '@makanmakan/database'

// Mock implementations
const mockDbAuthService = {
  login: vi.fn(),
  register: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  validateToken: vi.fn(),
  changePassword: vi.fn(),
  getUserSessions: vi.fn()
}

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn()
}

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

const mockPerformance = {
  startTimer: vi.fn(() => 'timer-123'),
  endTimer: vi.fn(() => 100),
  recordMetric: vi.fn()
}

// Mock environment
const mockEnv: Env = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
  API_VERSION: '1.0.0',
  DB: {} as any,
  CACHE_KV: {} as any,
  TOKEN_BLACKLIST: {} as any,
  IMAGES_BUCKET: {} as any,
  BACKUP_STORAGE: {} as any,
  JOB_QUEUE: {} as any,
  REALTIME_ORDERS: {} as any,
  ANALYTICS_ENGINE: {} as any,
  RATE_LIMIT_KV: {} as any,
  REALTIME_SESSION: {} as any
}

describe('Authentication Feature', () => {
  let authService: AuthService

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mocks
    vi.mocked(databaseModule.getDatabaseConnection).mockReturnValue({} as any)
    vi.mocked(cacheModule.KVCacheService).mockImplementation(() => mockCache as any)
    vi.mocked(monitoringModule.ConsoleLogger).mockImplementation(() => mockLogger as any)
    vi.mocked(monitoringModule.SimplePerformanceTracker).mockImplementation(() => mockPerformance as any)
    vi.mocked(dbModule.AuthService).mockImplementation(() => mockDbAuthService as any)

    authService = new AuthService(mockEnv)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('AuthService', () => {
    describe('login', () => {
      it('should successfully login a user with valid credentials', async () => {
        const loginData: LoginData = {
          username: 'testuser',
          password: 'testpass123',
          deviceInfo: {
            userAgent: 'Test Browser',
            ipAddress: '192.168.1.1',
            platform: 'desktop'
          },
          location: {
            country: 'US'
          }
        }

        // Mock database service response (raw format)
        const dbResult = {
          success: true,
          user: {
            id: 1,
            username: 'testuser',
            fullName: 'Test User',
            role: 2,
            restaurantId: 1,
            isActive: true
          },
          tokens: {
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: new Date(Date.now() + 86400000) // 24 hours from now
          }
        }

        // Expected result after AuthService transformation
        const expectedResult: AuthResult = {
          success: true,
          user: {
            id: 1,
            username: 'testuser',
            fullName: 'Test User',
            role: 2,
            restaurantId: 1,
            isActive: true,
            isVerified: false, // AuthService hardcodes to false
            twoFactorEnabled: false, // AuthService hardcodes to false
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date)
          },
          tokens: {
            accessToken: 'test-access-token',
            refreshToken: 'test-refresh-token',
            expiresAt: expect.any(Date),
            expiresIn: expect.any(Number) // Calculated dynamically
          },
          error: undefined // AuthService includes error field
        }

        mockDbAuthService.login.mockResolvedValue(dbResult)
        mockCache.set.mockResolvedValue(undefined)

        const result = await authService.login(loginData)

        expect(result).toEqual(expectedResult)
        expect(mockDbAuthService.login).toHaveBeenCalledWith(loginData)
        expect(mockCache.set).toHaveBeenCalled()
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User login successful',
          expect.objectContaining({
            userId: 1,
            username: 'testuser',
            role: 2
          })
        )
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.login.success', 1)
      })

      it('should handle login failure with invalid credentials', async () => {
        const loginData: LoginData = {
          username: 'testuser',
          password: 'wrongpassword'
        }

        const expectedResult: AuthResult = {
          success: false,
          error: 'Invalid username or password'
        }

        mockDbAuthService.login.mockResolvedValue(expectedResult)

        const result = await authService.login(loginData)

        expect(result).toEqual(expectedResult)
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.login.failed', 1)
      })

      it('should handle login errors and throw', async () => {
        const loginData: LoginData = {
          username: 'testuser',
          password: 'testpass123'
        }

        const error = new Error('Database connection failed')
        mockDbAuthService.login.mockRejectedValue(error)

        await expect(authService.login(loginData)).rejects.toThrow('Database connection failed')
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Login failed',
          error,
          { username: 'testuser' }
        )
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.login.error', 1)
      })
    })

    describe('register', () => {
      it('should successfully register a new user', async () => {
        const registerData: RegisterData = {
          username: 'newuser',
          fullName: 'New User',
          email: 'new@example.com',
          password: 'newpass123',
          role: 2,
          restaurantId: 1
        }

        // Mock database service response (raw format)
        const dbResult = {
          success: true,
          user: {
            id: 2,
            username: 'newuser',
            fullName: 'New User',
            email: 'new@example.com',
            role: 2,
            restaurantId: 1,
            isActive: true
          }
        }

        // Expected result after AuthService transformation
        const expectedResult: AuthResult = {
          success: true,
          user: {
            id: 2,
            username: 'newuser',
            fullName: 'New User',
            email: 'new@example.com',
            phone: undefined,
            role: 2,
            restaurantId: 1,
            isActive: true,
            isVerified: false, // AuthService hardcodes to false
            twoFactorEnabled: false, // AuthService hardcodes to false
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date)
          },
          tokens: undefined, // Register doesn't return tokens
          error: undefined // AuthService includes error field
        }

        mockDbAuthService.register.mockResolvedValue(dbResult)

        const result = await authService.register(registerData, 1)

        expect(result).toEqual(expectedResult)
        expect(mockDbAuthService.register).toHaveBeenCalledWith(registerData)
        expect(mockCache.delete).toHaveBeenCalledWith('user:newuser')
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User registration successful',
          expect.objectContaining({
            userId: 2,
            username: 'newuser',
            role: 2,
            createdBy: 1
          })
        )
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.register.success', 1)
      })

      it('should handle registration failure when username exists', async () => {
        const registerData: RegisterData = {
          username: 'existinguser',
          fullName: 'Existing User',
          password: 'testpass123',
          role: 2
        }

        const expectedResult: AuthResult = {
          success: false,
          error: 'Username already exists'
        }

        mockDbAuthService.register.mockResolvedValue(expectedResult)

        const result = await authService.register(registerData)

        expect(result).toEqual(expectedResult)
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.register.failed', 1)
      })
    })

    describe('refreshToken', () => {
      it('should successfully refresh a valid token', async () => {
        const refreshToken = 'valid-refresh-token'

        // Mock database service response (raw format)
        const dbResult = {
          success: true,
          user: {
            id: 1,
            username: 'testuser',
            fullName: 'Test User',
            role: 2,
            restaurantId: 1,
            isActive: true
          },
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresAt: new Date(Date.now() + 86400000) // 24 hours from now
          }
        }

        // Expected result after AuthService transformation
        const expectedResult: AuthResult = {
          success: true,
          user: {
            id: 1,
            username: 'testuser',
            fullName: 'Test User',
            role: 2,
            restaurantId: 1,
            isActive: true,
            isVerified: false, // AuthService hardcodes to false
            twoFactorEnabled: false, // AuthService hardcodes to false
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date)
          },
          tokens: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresAt: expect.any(Date),
            expiresIn: expect.any(Number) // Calculated dynamically
          },
          error: undefined // AuthService includes error field
        }

        mockDbAuthService.refreshToken.mockResolvedValue(dbResult)

        const result = await authService.refreshToken(refreshToken)

        expect(result).toEqual(expectedResult)
        expect(mockDbAuthService.refreshToken).toHaveBeenCalledWith(refreshToken)
        expect(mockCache.set).toHaveBeenCalled()
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.refreshToken.success', 1)
      })

      it('should handle invalid refresh token', async () => {
        const refreshToken = 'invalid-refresh-token'

        const expectedResult: AuthResult = {
          success: false,
          error: 'Invalid refresh token'
        }

        mockDbAuthService.refreshToken.mockResolvedValue(expectedResult)

        const result = await authService.refreshToken(refreshToken)

        expect(result).toEqual(expectedResult)
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.refreshToken.failed', 1)
      })
    })

    describe('logout', () => {
      it('should successfully logout a user', async () => {
        const userId = 1
        const token = 'access-token'

        mockDbAuthService.logout.mockResolvedValue(true)

        const result = await authService.logout(userId, token)

        expect(result).toBe(true)
        expect(mockDbAuthService.logout).toHaveBeenCalledWith(userId, token)
        expect(mockCache.delete).toHaveBeenCalledWith(`token:${token}`)
        expect(mockLogger.info).toHaveBeenCalledWith(
          'User logout successful',
          { userId, allSessions: undefined }
        )
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.logout.success', 1)
      })

      it('should handle logout failure', async () => {
        const userId = 1
        const token = 'access-token'

        mockDbAuthService.logout.mockResolvedValue(false)

        const result = await authService.logout(userId, token)

        expect(result).toBe(false)
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.logout.failed', 1)
      })
    })

    describe('validateToken', () => {
      it('should successfully validate a token', async () => {
        const token = 'valid-token'

        const dbResult = {
          valid: true,
          user: {
            id: 1,
            username: 'testuser',
            fullName: 'Test User',
            role: 2,
            restaurantId: 1,
            isActive: true
          }
        }

        mockCache.get.mockResolvedValue(null)
        mockDbAuthService.validateToken.mockResolvedValue(dbResult)

        const result = await authService.validateToken(token)

        expect(result.valid).toBe(true)
        expect(result.user).toBeDefined()
        expect(result.user?.username).toBe('testuser')
        expect(mockDbAuthService.validateToken).toHaveBeenCalledWith(token)
        expect(mockCache.set).toHaveBeenCalled()
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.validateToken.success', 1)
      })

      it('should return cached validation result', async () => {
        const token = 'valid-token'

        const cachedResult: TokenValidation = {
          valid: true,
          user: {
            id: 1,
            username: 'testuser',
            fullName: 'Test User',
            role: 2,
            restaurantId: 1,
            isActive: true,
            isVerified: true,
            twoFactorEnabled: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }

        mockCache.get.mockResolvedValue(cachedResult)

        const result = await authService.validateToken(token)

        expect(result).toEqual(cachedResult)
        expect(mockDbAuthService.validateToken).not.toHaveBeenCalled()
        expect(mockLogger.debug).toHaveBeenCalledWith('Token validation retrieved from cache')
      })

      it('should handle invalid token', async () => {
        const token = 'invalid-token'

        const dbResult = {
          valid: false,
          error: 'Token expired'
        }

        mockCache.get.mockResolvedValue(null)
        mockDbAuthService.validateToken.mockResolvedValue(dbResult)

        const result = await authService.validateToken(token)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Token expired')
        expect(mockCache.set).not.toHaveBeenCalled()
      })
    })

    describe('changePassword', () => {
      it('should successfully change password', async () => {
        const userId = 1
        const oldPassword = 'oldpass123'
        const newPassword = 'newpass123'

        const expectedResult = {
          success: true
        }

        mockDbAuthService.changePassword.mockResolvedValue(expectedResult)

        const result = await authService.changePassword(userId, oldPassword, newPassword)

        expect(result).toEqual(expectedResult)
        expect(mockDbAuthService.changePassword).toHaveBeenCalledWith(userId, oldPassword, newPassword)
        expect(mockCache.delete).toHaveBeenCalledWith(`user-profile:${userId}`)
        expect(mockCache.clear).toHaveBeenCalledWith(`user-session:${userId}`)
        expect(mockLogger.info).toHaveBeenCalledWith('Password change successful', { userId })
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.changePassword.success', 1)
      })

      it('should handle password change failure', async () => {
        const userId = 1
        const oldPassword = 'wrongpass'
        const newPassword = 'newpass123'

        const expectedResult = {
          success: false,
          error: 'Current password is incorrect'
        }

        mockDbAuthService.changePassword.mockResolvedValue(expectedResult)

        const result = await authService.changePassword(userId, oldPassword, newPassword)

        expect(result).toEqual(expectedResult)
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.changePassword.failed', 1)
      })
    })

    describe('getUserSessions', () => {
      it('should return user sessions', async () => {
        const userId = 1

        const mockSessions = [
          {
            id: 'session-1',
            deviceInfo: { platform: 'desktop' },
            location: { country: 'US' },
            lastAccessedAt: new Date(),
            expiresAt: new Date(),
            createdAt: new Date()
          }
        ]

        mockDbAuthService.getUserSessions.mockResolvedValue(mockSessions)

        const result = await authService.getUserSessions(userId)

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('session-1')
        expect(result[0].isCurrent).toBe(false)
        expect(mockDbAuthService.getUserSessions).toHaveBeenCalledWith(userId)
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.getUserSessions.success', 1)
      })

      it('should handle errors and return empty array', async () => {
        const userId = 1
        const error = new Error('Database error')

        mockDbAuthService.getUserSessions.mockRejectedValue(error)

        const result = await authService.getUserSessions(userId)

        expect(result).toEqual([])
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to get user sessions',
          error,
          { userId }
        )
        expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.getUserSessions.error', 1)
      })
    })
  })

  describe('Validation Schemas', () => {
    describe('login schema', () => {
      it('should validate correct login data', () => {
        const validData = {
          username: 'testuser',
          password: 'testpass123'
        }

        const result = authSchemas.login.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should reject invalid username', () => {
        const invalidData = {
          username: 'te', // Too short
          password: 'testpass123'
        }

        const result = authSchemas.login.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Username must be at least 3 characters')
        }
      })

      it('should reject missing password', () => {
        const invalidData = {
          username: 'testuser'
        }

        const result = authSchemas.login.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('password')
        }
      })
    })

    describe('register schema', () => {
      it('should validate correct registration data', () => {
        const validData = {
          username: 'newuser',
          fullName: 'New User',
          email: 'new@example.com',
          password: 'StrongPass123!',
          confirmPassword: 'StrongPass123!',
          role: 2,
          restaurantId: 1
        }

        const result = authSchemas.register.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should reject mismatched passwords', () => {
        const invalidData = {
          username: 'newuser',
          fullName: 'New User',
          email: 'new@example.com',
          password: 'StrongPass123!',
          confirmPassword: 'DifferentPass123!',
          role: 2
        }

        const result = authSchemas.register.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Passwords do not match')
        }
      })

      it('should reject weak password when 8+ characters', () => {
        const invalidData = {
          username: 'newuser',
          fullName: 'New User',
          email: 'new@example.com',
          password: 'weakpass', // 8+ chars but no uppercase, numbers, or symbols
          confirmPassword: 'weakpass',
          role: 2
        }

        const result = authSchemas.register.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Password must contain')
        }
      })

      it('should accept shorter passwords without strength requirements', () => {
        const validData = {
          username: 'newuser',
          fullName: 'New User',
          email: 'new@example.com',
          password: 'pass12', // 6 chars, no strength requirement
          confirmPassword: 'pass12',
          role: 2
        }

        const result = authSchemas.register.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should reject invalid email format', () => {
        const invalidData = {
          username: 'newuser',
          fullName: 'New User',
          email: 'invalid-email',
          password: 'StrongPass123!',
          confirmPassword: 'StrongPass123!',
          role: 2
        }

        const result = authSchemas.register.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Invalid email format')
        }
      })

      it('should reject invalid role', () => {
        const invalidData = {
          username: 'newuser',
          fullName: 'New User',
          email: 'new@example.com',
          password: 'StrongPass123!',
          confirmPassword: 'StrongPass123!',
          role: 999 // Invalid role
        }

        const result = authSchemas.register.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Role must be 5 or less')
        }
      })

      it('should require at least email or phone', () => {
        const invalidData = {
          username: 'newuser',
          fullName: 'New User',
          password: 'StrongPass123!',
          confirmPassword: 'StrongPass123!',
          role: 2
        }

        const result = authSchemas.register.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Either email or phone number is required')
        }
      })
    })

    describe('changePassword schema', () => {
      it('should validate correct password change data', () => {
        const validData = {
          currentPassword: 'oldpass123',
          newPassword: 'NewStrongPass123!',
          confirmPassword: 'NewStrongPass123!'
        }

        const result = authSchemas.changePassword.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should reject same old and new passwords', () => {
        const invalidData = {
          currentPassword: 'SameStrongPass123!',
          newPassword: 'SameStrongPass123!',
          confirmPassword: 'SameStrongPass123!'
        }

        const result = authSchemas.changePassword.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('New password must be different from current password')
        }
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const error = new Error('Database connection failed')
      mockDbAuthService.login.mockRejectedValue(error)

      await expect(authService.login({ username: 'test', password: 'test' }))
        .rejects.toThrow('Database connection failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Login failed',
        error,
        { username: 'test' }
      )
    })

    it('should handle cache errors gracefully', async () => {
      const cacheError = new Error('Cache unavailable')
      mockCache.get.mockRejectedValue(cacheError)
      mockCache.set.mockRejectedValue(cacheError)

      // Should still work even with cache errors
      const dbResult = {
        valid: true,
        user: { id: 1, username: 'test' }
      }
      mockDbAuthService.validateToken.mockResolvedValue(dbResult)

      const result = await authService.validateToken('test-token')
      expect(result.valid).toBe(true)
    })
  })

  describe('Performance Metrics', () => {
    it('should record performance metrics for all operations', async () => {
      mockDbAuthService.login.mockResolvedValue({ success: true })

      await authService.login({ username: 'test', password: 'test' })

      expect(mockPerformance.startTimer).toHaveBeenCalledWith('auth.login')
      expect(mockPerformance.endTimer).toHaveBeenCalledWith('timer-123')
      expect(mockPerformance.recordMetric).toHaveBeenCalledWith('auth.login.duration', 100, 'ms')
    })
  })

  describe('Security Features', () => {
    it('should log security events on login', async () => {
      const loginData: LoginData = {
        username: 'testuser',
        password: 'testpass123',
        deviceInfo: { ipAddress: '192.168.1.1' }
      }

      // Mock successful login with complete result structure
      mockDbAuthService.login.mockResolvedValue({
        success: true,
        user: {
          id: 1,
          username: 'testuser',
          fullName: 'Test User',
          role: 2,
          restaurantId: 1,
          isActive: true
        },
        tokens: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresAt: new Date(Date.now() + 86400000)
        }
      })

      await authService.login(loginData)

      // Should have logged a successful login security event
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^security-event:/),
        expect.objectContaining({
          type: 'LOGIN',
          userId: 1,
          username: 'testuser',
          severity: 'LOW'
        }),
        expect.any(Number)
      )
    })

    it('should log failed login attempts', async () => {
      const loginData: LoginData = {
        username: 'testuser',
        password: 'wrongpass',
        deviceInfo: { ipAddress: '192.168.1.1' }
      }

      mockDbAuthService.login.mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      })

      await authService.login(loginData)

      // Should have logged failed login attempt
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^failed-login:/),
        1,
        expect.any(Number)
      )

      // Should have logged security event
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^security-event:/),
        expect.objectContaining({
          type: 'LOGIN_FAILED',
          username: 'testuser',
          severity: 'MEDIUM'
        }),
        expect.any(Number)
      )
    })
  })
})