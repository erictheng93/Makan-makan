/**
 * Verification Routes
 * Handles password reset, email verification, and phone verification
 * With rate limiting to prevent abuse
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../types/env'
import { VerificationService } from '@makanmakan/database'
import { rateLimitMiddleware, RateLimitPresets } from '../middleware/rateLimiter'

const app = new Hono<{ Bindings: Env }>()

// ========================================
// Validation Schemas
// ========================================

const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, '請輸入 Email 或手機號碼'),
  method: z.enum(['email', 'sms'], {
    errorMap: () => ({ message: '請選擇 Email 或 SMS 方式' }),
  }),
})

const verifyResetTokenSchema = z.object({
  token: z.string().uuid('無效的 Token 格式'),
})

const resetPasswordSchema = z.object({
  token: z.string().uuid('無效的 Token 格式'),
  newPassword: z
    .string()
    .min(6, '密碼至少需要 6 個字符')
    .max(100, '密碼最多 100 個字符'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: '兩次輸入的密碼不一致',
  path: ['confirmPassword'],
})

const sendEmailVerificationSchema = z.object({
  email: z.string().email('無效的 Email 格式'),
})

const verifyEmailSchema = z.object({
  token: z.string().uuid('無效的 Token 格式'),
})

const sendPhoneVerificationSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, '請輸入有效的國際手機號碼（例如：+60123456789）'),
})

const verifyPhoneSchema = z.object({
  phone: z.string(),
  otpCode: z
    .string()
    .length(6, '驗證碼必須是 6 位數字')
    .regex(/^\d{6}$/, '驗證碼只能包含數字'),
})

// ========================================
// Helper Functions
// ========================================

function getClientInfo(c: any) {
  return {
    ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown',
    userAgent: c.req.header('user-agent') || 'unknown',
  }
}

// ========================================
// Password Reset Routes
// ========================================

/**
 * POST /forgot-password
 * Request password reset link/OTP
 * Rate limit: 5 requests per hour per IP
 */
app.post('/forgot-password', rateLimitMiddleware(RateLimitPresets.passwordReset), async (c) => {
  try {
    const body = await c.req.json()
    const validation = forgotPasswordSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        400
      )
    }

    const { identifier, method } = validation.data
    const { ipAddress, userAgent } = getClientInfo(c)

    const service = new VerificationService(c.env.DB, c.env)
    const result = await service.requestPasswordReset({
      identifier,
      method,
      ipAddress,
      userAgent,
    })

    // Send alert for failed attempts (user not found)
    if (!result.success && result.error?.includes('找不到用戶')) {
      const alertService = new AlertService(c.env)
      await alertService.passwordResetAttempt(identifier, ipAddress, false)
    }

    return c.json(result, result.success ? 200 : 500)
  } catch (error) {
    console.error('Forgot password error:', error)
    return c.json(
      {
        success: false,
        error: '處理請求時發生錯誤',
      },
      500
    )
  }
})

/**
 * GET /reset-password/verify?token=xxx
 * Verify reset token validity
 */
app.get('/reset-password/verify', async (c) => {
  try {
    const token = c.req.query('token')

    if (!token) {
      return c.json(
        {
          valid: false,
          error: '缺少 Token 參數',
        },
        400
      )
    }

    const validation = verifyResetTokenSchema.safeParse({ token })

    if (!validation.success) {
      return c.json(
        {
          valid: false,
          error: validation.error.errors[0].message,
        },
        400
      )
    }

    const { ipAddress } = getClientInfo(c)
    const service = new VerificationService(c.env.DB, c.env)
    const result = await service.verifyResetToken({
      token,
      ipAddress,
    })

    return c.json(result, result.valid ? 200 : 400)
  } catch (error) {
    console.error('Verify reset token error:', error)
    return c.json(
      {
        valid: false,
        error: '驗證 Token 時發生錯誤',
      },
      500
    )
  }
})

/**
 * POST /reset-password
 * Reset password using token
 */
app.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json()
    const validation = resetPasswordSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        400
      )
    }

    const { token, newPassword } = validation.data
    const { ipAddress, userAgent } = getClientInfo(c)

    const service = new VerificationService(c.env.DB, c.env)
    const result = await service.resetPassword({
      token,
      newPassword,
      ipAddress,
      userAgent,
    })

    return c.json(result, result.success ? 200 : 400)
  } catch (error) {
    console.error('Reset password error:', error)
    return c.json(
      {
        success: false,
        error: '重設密碼時發生錯誤',
      },
      500
    )
  }
})

// ========================================
// Email Verification Routes
// ========================================

/**
 * POST /verify-email/send
 * Send email verification link
 */
app.post('/verify-email/send', rateLimitMiddleware(RateLimitPresets.emailVerification), async (c) => {
  try {
    // Get user from auth middleware (assumed to be set)
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          success: false,
          error: '請先登入',
        },
        401
      )
    }

    const body = await c.req.json()
    const validation = sendEmailVerificationSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        400
      )
    }

    const { email } = validation.data
    const { ipAddress } = getClientInfo(c)

    const service = new VerificationService(c.env.DB, c.env)
    const result = await service.sendEmailVerification({
      userId: user.id,
      email,
      ipAddress,
    })

    return c.json(result, result.success ? 200 : 500)
  } catch (error) {
    console.error('Send email verification error:', error)
    return c.json(
      {
        success: false,
        error: '發送驗證郵件時發生錯誤',
      },
      500
    )
  }
})

/**
 * GET /verify-email?token=xxx
 * Verify email using token
 */
app.get('/verify-email', async (c) => {
  try {
    const token = c.req.query('token')

    if (!token) {
      return c.json(
        {
          success: false,
          error: '缺少 Token 參數',
        },
        400
      )
    }

    const validation = verifyEmailSchema.safeParse({ token })

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        400
      )
    }

    const { ipAddress } = getClientInfo(c)
    const service = new VerificationService(c.env.DB, c.env)
    const result = await service.verifyEmail({
      token,
      ipAddress,
    })

    return c.json(result, result.success ? 200 : 400)
  } catch (error) {
    console.error('Verify email error:', error)
    return c.json(
      {
        success: false,
        error: 'Email 驗證時發生錯誤',
      },
      500
    )
  }
})

// ========================================
// Phone Verification Routes
// ========================================

/**
 * POST /verify-phone/send
 * Send phone verification OTP
 */
app.post('/verify-phone/send', rateLimitMiddleware(RateLimitPresets.smsOTP), async (c) => {
  try {
    // Get user from auth middleware
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          success: false,
          error: '請先登入',
        },
        401
      )
    }

    const body = await c.req.json()
    const validation = sendPhoneVerificationSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        400
      )
    }

    const { phone } = validation.data
    const { ipAddress } = getClientInfo(c)

    const service = new VerificationService(c.env.DB, c.env)
    const result = await service.sendPhoneVerification({
      userId: user.id,
      phone,
      ipAddress,
    })

    return c.json(result, result.success ? 200 : 500)
  } catch (error) {
    console.error('Send phone verification error:', error)
    return c.json(
      {
        success: false,
        error: '發送驗證碼時發生錯誤',
      },
      500
    )
  }
})

/**
 * POST /verify-phone
 * Verify phone using OTP
 */
app.post('/verify-phone', async (c) => {
  try {
    // Get user from auth middleware
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          success: false,
          error: '請先登入',
        },
        401
      )
    }

    const body = await c.req.json()
    const validation = verifyPhoneSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        400
      )
    }

    const { phone, otpCode } = validation.data
    const { ipAddress } = getClientInfo(c)

    const service = new VerificationService(c.env.DB, c.env)
    const result = await service.verifyPhone({
      userId: user.id,
      phone,
      otpCode,
      ipAddress,
    })

    return c.json(result, result.success ? 200 : 400)
  } catch (error) {
    console.error('Verify phone error:', error)
    return c.json(
      {
        success: false,
        error: '手機驗證時發生錯誤',
      },
      500
    )
  }
})

export default app
