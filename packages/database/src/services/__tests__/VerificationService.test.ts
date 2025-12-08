/**
 * VerificationService Unit Tests
 * Simplified test coverage focusing on core functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VerificationService } from '../VerificationService'
import { NotificationService } from '../NotificationService'
import { createMockDatabase, createMockEnv } from './helpers/mockD1'

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
  },
  hash: vi.fn(),
}))

import * as bcrypt from 'bcryptjs'

describe('VerificationService', () => {
  let verificationService: VerificationService
  let mockDb: any
  let mockEnv: any

  beforeEach(() => {
    // Create fresh mocks for each test
    mockDb = createMockDatabase()
    mockEnv = createMockEnv({
      JWT_SECRET: 'test-jwt-secret-key',
      API_BASE_URL: 'http://localhost:3000',
      NOTIFICATION_FROM_EMAIL: 'test@makanmakan.com',
    })

    // Initialize service
    verificationService = new VerificationService(mockDb, mockEnv)

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========================================
  // Password Reset Tests
  // ========================================

  describe('requestPasswordReset', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      phone: '+60123456789',
      fullName: 'Test User',
    }

    it('should successfully request password reset via email', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockUser),
          }),
        }),
      })

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(undefined),
        }),
      })

      // Mock NotificationService
      vi.spyOn(NotificationService.prototype, 'sendNotification').mockResolvedValue({ success: true, errors: [] })

      // Act
      const result = await verificationService.requestPasswordReset({
        identifier: 'test@example.com',
        method: 'email',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.message).toContain('重設連結已發送')
    })

    it('should fail if user not found', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(null),
          }),
        }),
      })

      // Act
      const result = await verificationService.requestPasswordReset({
        identifier: 'nonexistent@example.com',
        method: 'email',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle errors gracefully', async () => {
      // Arrange
      mockDb.select.mockImplementation(() => {
        throw new Error('Database error')
      })

      // Act
      const result = await verificationService.requestPasswordReset({
        identifier: 'test@example.com',
        method: 'email',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('verifyResetToken', () => {
    const validToken = '12345678-1234-1234-1234-123456789abc'
    const mockTokenRecord = {
      id: 1,
      userId: 1,
      expiresAt: Math.floor(Date.now() / 1000) + 900, // 15 minutes from now
      usedAt: null,
      userEmail: 'test@example.com',
    }

    it('should successfully verify valid token', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTokenRecord),
            }),
          }),
        }),
      })

      // Act
      const result = await verificationService.verifyResetToken({
        token: validToken,
        ipAddress: '127.0.0.1',
      })

      // Assert
      expect(result.valid).toBe(true)
      expect(result.userId).toBe(mockTokenRecord.userId)
    })

    it('should fail if token is expired', async () => {
      // Arrange
      const expiredToken = {
        ...mockTokenRecord,
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(expiredToken),
            }),
          }),
        }),
      })

      // Act
      const result = await verificationService.verifyResetToken({
        token: validToken,
        ipAddress: '127.0.0.1',
      })

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Token 已過期')
    })

    it('should fail if token already used', async () => {
      // Arrange
      const usedToken = {
        ...mockTokenRecord,
        usedAt: Math.floor(Date.now() / 1000) - 60,
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(usedToken),
            }),
          }),
        }),
      })

      // Act
      const result = await verificationService.verifyResetToken({
        token: validToken,
        ipAddress: '127.0.0.1',
      })

      // Assert
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Token 已被使用')
    })
  })

  describe('resetPassword', () => {
    const validToken = '12345678-1234-1234-1234-123456789abc'
    const newPassword = 'NewPass@123'

    const mockTokenRecord = {
      id: 1,
      userId: 1,
      expiresAt: Math.floor(Date.now() / 1000) + 900,
      usedAt: null,
      tokenType: 'email',
      userEmail: 'test@example.com',
      userFullName: 'Test User',
    }

    it('should successfully reset password', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTokenRecord),
            }),
          }),
        }),
      })

      vi.mocked(bcrypt.hash).mockResolvedValue('$2a$10$hashedpassword' as never)

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(undefined),
        }),
      })

      vi.spyOn(NotificationService.prototype, 'sendNotification').mockResolvedValue({ success: true, errors: [] })

      // Act
      const result = await verificationService.resetPassword({
        token: validToken,
        newPassword,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.message).toContain('密碼已成功重設')
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10)
    })

    it('should fail with weak password', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTokenRecord),
            }),
          }),
        }),
      })

      // Act
      const result = await verificationService.resetPassword({
        token: validToken,
        newPassword: '123', // Too short
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('密碼至少需要 6 個字符')
    })
  })

  // ========================================
  // Email Verification Tests
  // ========================================

  describe('sendEmailVerification', () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      fullName: 'Test User',
    }

    it('should successfully send email verification', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(mockUser),
          }),
        }),
      })

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(undefined),
        }),
      })

      vi.spyOn(NotificationService.prototype, 'sendNotification').mockResolvedValue({ success: true, errors: [] })

      // Act
      const result = await verificationService.sendEmailVerification({
        userId: 1,
        email: 'test@example.com',
        ipAddress: '127.0.0.1',
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.message).toContain('驗證郵件已發送')
    })
  })

  describe('verifyEmail', () => {
    const validToken = '12345678-1234-1234-1234-123456789abc'

    const mockTokenRecord = {
      id: 1,
      userId: 1,
      email: 'test@example.com',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
      verifiedAt: null,
      userFullName: 'Test User',
    }

    it('should successfully verify email', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTokenRecord),
            }),
          }),
        }),
      })

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })

      vi.spyOn(NotificationService.prototype, 'sendNotification').mockResolvedValue({ success: true, errors: [] })

      // Act
      const result = await verificationService.verifyEmail({
        token: validToken,
        ipAddress: '127.0.0.1',
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.message).toContain('Email 驗證成功')
    })

    it('should fail if token is expired', async () => {
      // Arrange
      const expiredToken = {
        ...mockTokenRecord,
        expiresAt: Math.floor(Date.now() / 1000) - 3600,
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(expiredToken),
            }),
          }),
        }),
      })

      // Act
      const result = await verificationService.verifyEmail({
        token: validToken,
        ipAddress: '127.0.0.1',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('Token 已過期')
    })
  })

  // ========================================
  // Phone Verification Tests
  // ========================================

  describe('verifyPhone', () => {
    const validOtp = '123456'

    const mockTokenRecord = {
      id: 1,
      userId: 1,
      phone: '+60123456789',
      otpCode: validOtp,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      verifiedAt: null,
      attemptCount: 0,
      userFullName: 'Test User',
    }

    it('should successfully verify phone with correct OTP', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTokenRecord),
            }),
          }),
        }),
      })

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })

      vi.spyOn(NotificationService.prototype, 'sendNotification').mockResolvedValue({ success: true, errors: [] })

      // Act
      const result = await verificationService.verifyPhone({
        userId: 1,
        phone: '+60123456789',
        otpCode: validOtp,
        ipAddress: '127.0.0.1',
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.message).toContain('手機驗證成功')
    })

    it('should fail with incorrect OTP', async () => {
      // Arrange
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(mockTokenRecord),
            }),
          }),
        }),
      })

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })

      // Act
      const result = await verificationService.verifyPhone({
        userId: 1,
        phone: '+60123456789',
        otpCode: '000000', // Wrong OTP
        ipAddress: '127.0.0.1',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('驗證碼錯誤')
    })

    it('should fail after 3 failed attempts', async () => {
      // Arrange
      const lockedToken = {
        ...mockTokenRecord,
        attemptCount: 3,
      }

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue(lockedToken),
            }),
          }),
        }),
      })

      // Act
      const result = await verificationService.verifyPhone({
        userId: 1,
        phone: '+60123456789',
        otpCode: '123456',
        ipAddress: '127.0.0.1',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('驗證次數已達上限')
    })
  })

  // ========================================
  // Cleanup Tests
  // ========================================

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      // Arrange
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(undefined),
        }),
      })

      // Act
      await verificationService.cleanupExpiredTokens()

      // Assert
      expect(mockDb.delete).toHaveBeenCalled()
    })
  })
})
