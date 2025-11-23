/**
 * Verification Routes Integration Tests
 * Tests for password reset, email verification, and phone verification endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import verificationRouter from '../routes/verification'
import { createMockContext, mockEnv } from './setup'

// Mock @makanmakan/database to provide VerificationService
vi.mock('@makanmakan/database', () => {
  return {
    VerificationService: vi.fn().mockImplementation(() => ({
      requestPasswordReset: vi.fn(),
      verifyResetToken: vi.fn(),
      resetPassword: vi.fn(),
      sendEmailVerification: vi.fn(),
      verifyEmail: vi.fn(),
      sendPhoneVerification: vi.fn(),
      verifyPhone: vi.fn(),
    })),
  }
})

// Import after mocking
import { VerificationService } from '@makanmakan/database'

describe('Verification Routes', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>
  let mockVerificationService: any

  beforeEach(() => {
    app = new Hono<{ Bindings: typeof mockEnv }>()

    // Add middleware to inject mockEnv into context
    app.use('*', async (c, next) => {
      if (!c.env) {
        (c as any).env = {}
      }
      Object.assign(c.env, mockEnv)
      await next()
    })

    app.route('/auth', verificationRouter)

    // Get the mock VerificationService instance
    mockVerificationService = {
      requestPasswordReset: vi.fn(),
      verifyResetToken: vi.fn(),
      resetPassword: vi.fn(),
      sendEmailVerification: vi.fn(),
      verifyEmail: vi.fn(),
      sendPhoneVerification: vi.fn(),
      verifyPhone: vi.fn(),
    }

    // Mock the constructor to return our mock instance
    vi.mocked(VerificationService).mockImplementation(() => mockVerificationService)

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ========================================
  // Password Reset Tests
  // ========================================

  describe('POST /auth/forgot-password', () => {
    it('should successfully request password reset via email', async () => {
      mockVerificationService.requestPasswordReset.mockResolvedValue({
        success: true,
        message: '重設連結已發送至您的 Email',
      })

      const res = await app.request('/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: 'test@example.com',
          method: 'email',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('重設連結已發送')
      expect(mockVerificationService.requestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'test@example.com',
          method: 'email',
        })
      )
    })

    it('should validate required fields', async () => {
      const res = await app.request('/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Missing identifier and method
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
    })

    it('should handle user not found error', async () => {
      mockVerificationService.requestPasswordReset.mockResolvedValue({
        success: false,
        error: '找不到用戶',
      })

      const res = await app.request('/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: 'nonexistent@example.com',
          method: 'email',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('找不到用戶')
    })
  })

  describe('GET /auth/reset-password/verify', () => {
    it('should verify valid reset token', async () => {
      mockVerificationService.verifyResetToken.mockResolvedValue({
        valid: true,
        userId: 1,
        email: 'te***@example.com',
      })

      const res = await app.request(
        '/auth/reset-password/verify?token=12345678-1234-1234-1234-123456789abc',
        {
          method: 'GET',
        }
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.valid).toBe(true)
      expect(data.userId).toBe(1)
    })

    it('should reject invalid token', async () => {
      mockVerificationService.verifyResetToken.mockResolvedValue({
        valid: false,
        error: 'Token 無效或已過期',
      })

      const res = await app.request('/auth/reset-password/verify?token=invalid-token', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.valid).toBe(false)
      expect(data.error).toBeDefined()
    })

    it('should require token parameter', async () => {
      const res = await app.request('/auth/reset-password/verify', {
        method: 'GET',
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
    })
  })

  describe('POST /auth/reset-password', () => {
    it('should successfully reset password', async () => {
      mockVerificationService.resetPassword.mockResolvedValue({
        success: true,
        message: '密碼已成功重設',
      })

      const res = await app.request('/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: '12345678-1234-1234-1234-123456789abc',
          newPassword: 'NewPass@123',
          confirmPassword: 'NewPass@123',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('密碼已成功重設')
    })

    it('should validate password match', async () => {
      const res = await app.request('/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: '12345678-1234-1234-1234-123456789abc',
          newPassword: 'NewPass@123',
          confirmPassword: 'DifferentPass@123',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('密碼不一致')
    })

    it('should validate password length', async () => {
      const res = await app.request('/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: '12345678-1234-1234-1234-123456789abc',
          newPassword: '123',
          confirmPassword: '123',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
    })
  })

  // ========================================
  // Email Verification Tests
  // ========================================

  describe('POST /auth/verify-email/send', () => {
    it('should send email verification', async () => {
      mockVerificationService.sendEmailVerification.mockResolvedValue({
        success: true,
        message: '驗證郵件已發送',
      })

      const res = await app.request('/auth/verify-email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          userId: 1,
          email: 'test@example.com',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  describe('GET /auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      mockVerificationService.verifyEmail.mockResolvedValue({
        success: true,
        message: 'Email 驗證成功',
      })

      const res = await app.request(
        '/auth/verify-email?token=12345678-1234-1234-1234-123456789abc',
        {
          method: 'GET',
        }
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  // ========================================
  // Phone Verification Tests
  // ========================================

  describe('POST /auth/verify-phone/send', () => {
    it('should send phone verification OTP', async () => {
      mockVerificationService.sendPhoneVerification.mockResolvedValue({
        success: true,
        message: '驗證碼已發送',
      })

      const res = await app.request('/auth/verify-phone/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          userId: 1,
          phone: '+60123456789',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  describe('POST /auth/verify-phone', () => {
    it('should verify phone with correct OTP', async () => {
      mockVerificationService.verifyPhone.mockResolvedValue({
        success: true,
        message: '手機驗證成功',
      })

      const res = await app.request('/auth/verify-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          userId: 1,
          phone: '+60123456789',
          otpCode: '123456',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('should reject incorrect OTP', async () => {
      mockVerificationService.verifyPhone.mockResolvedValue({
        success: false,
        error: '驗證碼錯誤',
      })

      const res = await app.request('/auth/verify-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          userId: 1,
          phone: '+60123456789',
          otpCode: '000000',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
    })
  })
})
