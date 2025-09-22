import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Stripe from 'stripe'
import { StripeProvider } from '../StripeProvider'
import { StripeErrorHandler } from '../StripeErrorHandler'
import { StripeCurrencyManager } from '../StripeCurrencyManager'
import {
  PaymentRequest,
  PaymentResult,
  RefundRequest,
  PaymentProviderConfig
} from '@makanmakan/shared-types'
import { StripeConfig } from '@makanmakan/shared-types'

// Mock Stripe SDK
vi.mock('stripe', () => {
  const mockStripe = {
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn()
    },
    refunds: {
      create: vi.fn()
    },
    webhooks: {
      constructEvent: vi.fn()
    }
  }
  return {
    default: vi.fn(() => mockStripe)
  }
})

describe('StripeProvider', () => {
  let stripeProvider: StripeProvider
  let mockStripe: any
  let testConfig: PaymentProviderConfig & { stripeConfig: StripeConfig }

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks()

    // 測試配置
    testConfig = {
      name: 'stripe',
      displayName: 'Stripe',
      isActive: true,
      supportedCountries: ['TW', 'MY', 'VN'],
      supportedMethods: ['credit_card', 'debit_card'],
      testMode: true,
      config: {},
      stripeConfig: {
        publishableKey: 'pk_test_123',
        secretKey: 'sk_test_123',
        webhookSecret: 'whsec_123',
        accountId: 'acct_123',
        applicationFee: 2.5,
        testMode: true,
        apiVersion: '2023-10-16',
        country: 'TW',
        currency: 'TWD',
        paymentMethodTypes: ['card'],
        automaticTax: false,
        requireAuthentication: 'automatic',
        captureMethod: 'automatic',
        confirmationMethod: 'automatic',
        minimumAmount: 1,
        maximumAmount: 1000000,
        paymentTimeout: 30000,
        webhookTimeout: 20000,
        maxRetries: 3,
        retryBackoffMs: 1000,
        radarRules: [],
        blockSuspiciousPayments: true
      }
    }

    // 建立 mock Stripe 實例
    mockStripe = {
      paymentIntents: {
        create: vi.fn(),
        retrieve: vi.fn()
      },
      refunds: {
        create: vi.fn()
      },
      webhooks: {
        constructEvent: vi.fn()
      }
    }

    // Mock Stripe 構造函數
    ;(Stripe as any).mockImplementation(() => mockStripe)

    stripeProvider = new StripeProvider(testConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      expect(stripeProvider.validateConfig()).toBe(true)
    })

    it('should reject invalid secret key format', () => {
      const invalidConfig = {
        ...testConfig,
        stripeConfig: {
          ...testConfig.stripeConfig,
          secretKey: 'invalid_key'
        }
      }
      
      const provider = new StripeProvider(invalidConfig)
      expect(provider.validateConfig()).toBe(false)
    })

    it('should reject mismatched test mode', () => {
      const mismatchConfig = {
        ...testConfig,
        stripeConfig: {
          ...testConfig.stripeConfig,
          secretKey: 'sk_live_123',
          testMode: true // 不匹配
        }
      }
      
      const provider = new StripeProvider(mismatchConfig)
      expect(provider.validateConfig()).toBe(false)
    })
  })

  describe('Payment Creation', () => {
    const basePaymentRequest: PaymentRequest = {
      orderId: 'order_123',
      restaurantId: 1,
      country: 'TW',
      currency: 'TWD',
      amount: 350,
      method: 'credit_card',
      customerInfo: {
        name: '張小明',
        email: 'zhang@example.com',
        phone: '+886912345678'
      }
    }

    it('should create payment successfully for Taiwan', async () => {
      // Mock 成功的 PaymentIntent
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'requires_confirmation',
        client_secret: 'pi_123_secret',
        amount: 350,
        currency: 'twd'
      }
      
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent)

      const result = await stripeProvider.createPayment(basePaymentRequest)

      expect(result.success).toBe(true)
      expect(result.transactionId).toBe('pi_123')
      expect(result.clientSecret).toBe('pi_123_secret')
      expect(result.status).toBe('pending')
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 350, // TWD 是零小數貨幣
          currency: 'twd',
          metadata: expect.objectContaining({
            orderId: 'order_123',
            restaurantId: '1',
            country: 'TW'
          })
        })
      )
    })

    it('should create payment successfully for Malaysia', async () => {
      const malaysiaRequest: PaymentRequest = {
        ...basePaymentRequest,
        country: 'MY',
        currency: 'MYR',
        amount: 45.50
      }

      const mockPaymentIntent = {
        id: 'pi_myr_123',
        status: 'succeeded',
        amount: 4550, // MYR * 100
        currency: 'myr'
      }
      
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent)

      const result = await stripeProvider.createPayment(malaysiaRequest)

      expect(result.success).toBe(true)
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4550, // MYR 需要乘以 100
          currency: 'myr'
        })
      )
    })

    it('should create payment successfully for Vietnam', async () => {
      const vietnamRequest: PaymentRequest = {
        ...basePaymentRequest,
        country: 'VN',
        currency: 'VND',
        amount: 285000
      }

      const mockPaymentIntent = {
        id: 'pi_vnd_123',
        status: 'succeeded',
        amount: 285000, // VND 是零小數貨幣
        currency: 'vnd'
      }
      
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent)

      const result = await stripeProvider.createPayment(vietnamRequest)

      expect(result.success).toBe(true)
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 285000, // VND 直接使用
          currency: 'vnd'
        })
      )
    })

    it('should handle payment with redirect requirement', async () => {
      const mockPaymentIntent = {
        id: 'pi_redirect_123',
        status: 'requires_action',
        client_secret: 'pi_123_secret',
        next_action: {
          redirect_to_url: {
            url: 'https://stripe.com/redirect'
          }
        }
      }
      
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent)

      const result = await stripeProvider.createPayment(basePaymentRequest)

      expect(result.success).toBe(true)
      expect(result.redirectUrl).toBe('https://stripe.com/redirect')
      expect(result.status).toBe('processing')
    })

    it('should handle unsupported country', async () => {
      const invalidRequest: PaymentRequest = {
        ...basePaymentRequest,
        country: 'US' as any,
        currency: 'USD' as any
      }

      const result = await stripeProvider.createPayment(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('not supported')
    })
  })

  describe('Payment Status Retrieval', () => {
    it('should retrieve payment status successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'succeeded'
      }
      
      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent)

      const status = await stripeProvider.getPaymentStatus('pi_123')

      expect(status).toBe('completed')
      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_123')
    })

    it('should map various Stripe statuses correctly', async () => {
      const statusMappings = [
        { stripeStatus: 'succeeded', expected: 'completed' },
        { stripeStatus: 'processing', expected: 'processing' },
        { stripeStatus: 'requires_payment_method', expected: 'failed' },
        { stripeStatus: 'requires_confirmation', expected: 'pending' },
        { stripeStatus: 'requires_action', expected: 'processing' },
        { stripeStatus: 'canceled', expected: 'cancelled' },
        { stripeStatus: 'unknown_status', expected: 'pending' }
      ]

      for (const { stripeStatus, expected } of statusMappings) {
        mockStripe.paymentIntents.retrieve.mockResolvedValue({
          id: 'pi_test',
          status: stripeStatus
        })

        const status = await stripeProvider.getPaymentStatus('pi_test')
        expect(status).toBe(expected)
      }
    })

    it('should handle retrieval errors gracefully', async () => {
      mockStripe.paymentIntents.retrieve.mockRejectedValue(new Error('Not found'))

      const status = await stripeProvider.getPaymentStatus('pi_invalid')

      expect(status).toBe('pending')
    })
  })

  describe('Refund Processing', () => {
    it('should process full refund successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'succeeded',
        amount: 350,
        currency: 'twd',
        latest_charge: 'ch_123'
      }

      const mockRefund = {
        id: 'ref_123',
        amount: 350,
        status: 'succeeded'
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent)
      mockStripe.refunds.create.mockResolvedValue(mockRefund)

      const refundRequest: RefundRequest = {
        transactionId: 'pi_123',
        reason: 'Customer requested'
      }

      const result = await stripeProvider.refundPayment(refundRequest)

      expect(result.success).toBe(true)
      expect(result.refundId).toBe('ref_123')
      expect(result.amount).toBe(350)
      expect(result.status).toBe('completed')
    })

    it('should process partial refund successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'succeeded',
        amount: 35000, // MYR 350.00 in Stripe format
        currency: 'myr',
        latest_charge: 'ch_123'
      }

      const mockRefund = {
        id: 'ref_partial',
        amount: 10000, // MYR 100.00 in Stripe format
        status: 'succeeded'
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent)
      mockStripe.refunds.create.mockResolvedValue(mockRefund)

      const refundRequest: RefundRequest = {
        transactionId: 'pi_123',
        amount: 100, // Partial refund
        reason: 'Partial cancellation'
      }

      const result = await stripeProvider.refundPayment(refundRequest)

      expect(result.success).toBe(true)
      expect(result.amount).toBe(100) // Converted back from Stripe format
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        charge: 'ch_123',
        amount: 10000, // MYR 100.00 in Stripe format
        reason: 'requested_by_customer',
        metadata: expect.any(Object)
      })
    })

    it('should handle refund of non-succeeded payment', async () => {
      const mockPaymentIntent = {
        id: 'pi_123',
        status: 'requires_payment_method', // Not succeeded
        amount: 350,
        currency: 'twd'
      }

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent)

      const refundRequest: RefundRequest = {
        transactionId: 'pi_123'
      }

      const result = await stripeProvider.refundPayment(refundRequest)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Cannot refund payment with status')
    })
  })

  describe('Webhook Processing', () => {
    it('should process payment_intent.succeeded webhook', async () => {
      const mockEvent = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_123',
            status: 'succeeded'
          }
        }
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)

      const result = await stripeProvider.handleWebhook(
        JSON.stringify(mockEvent), 
        'stripe_signature'
      )

      expect(result.processed).toBe(true)
      expect(result.transactionId).toBe('pi_123')
      expect(result.newStatus).toBe('completed')
      expect(result.shouldUpdateOrder).toBe(true)
    })

    it('should process payment_intent.payment_failed webhook', async () => {
      const mockEvent = {
        id: 'evt_failed',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_failed',
            status: 'requires_payment_method'
          }
        }
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)

      const result = await stripeProvider.handleWebhook(
        JSON.stringify(mockEvent),
        'stripe_signature'
      )

      expect(result.processed).toBe(true)
      expect(result.transactionId).toBe('pi_failed')
      expect(result.newStatus).toBe('failed')
      expect(result.shouldUpdateOrder).toBe(true)
    })

    it('should handle charge dispute webhook', async () => {
      const mockEvent = {
        id: 'evt_dispute',
        type: 'charge.dispute.created',
        data: {
          object: {
            id: 'dp_123',
            charge: 'ch_123'
          }
        }
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)

      const result = await stripeProvider.handleWebhook(
        JSON.stringify(mockEvent),
        'stripe_signature'
      )

      expect(result.processed).toBe(true)
      expect(result.shouldUpdateOrder).toBe(false) // 爭議不需要立即更新訂單
    })

    it('should handle invalid webhook signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const result = await stripeProvider.handleWebhook(
        '{"invalid": "payload"}',
        'invalid_signature'
      )

      expect(result.processed).toBe(false)
      expect(result.error).toBe('Invalid signature')
    })

    it('should handle missing webhook signature', async () => {
      const result = await stripeProvider.handleWebhook(
        '{"test": "payload"}'
        // No signature provided
      )

      expect(result.processed).toBe(false)
      expect(result.error).toBe('Missing webhook signature')
    })

    it('should handle unrecognized webhook events', async () => {
      const mockEvent = {
        id: 'evt_unknown',
        type: 'unknown.event.type',
        data: {
          object: {
            id: 'obj_123'
          }
        }
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent)

      const result = await stripeProvider.handleWebhook(
        JSON.stringify(mockEvent),
        'stripe_signature'
      )

      expect(result.processed).toBe(true)
      expect(result.shouldUpdateOrder).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle card declined error', async () => {
      const cardError = new Stripe.StripeCardError({
        type: 'card_error',
        code: 'card_declined',
        decline_code: 'generic_decline',
        message: 'Your card was declined.'
      })

      mockStripe.paymentIntents.create.mockRejectedValue(cardError)

      const result = await stripeProvider.createPayment(basePaymentRequest)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('CARD_ERROR')
      expect(result.error?.message).toContain('拒絕')
    })

    it('should handle insufficient funds error', async () => {
      const cardError = new Stripe.StripeCardError({
        type: 'card_error',
        code: 'card_declined',
        decline_code: 'insufficient_funds',
        message: 'Your card has insufficient funds.'
      })

      mockStripe.paymentIntents.create.mockRejectedValue(cardError)

      const result = await stripeProvider.createPayment(basePaymentRequest)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INSUFFICIENT_FUNDS')
      expect(result.error?.message).toContain('餘額不足')
    })

    it('should handle rate limit error', async () => {
      const rateLimitError = new Stripe.StripeRateLimitError({
        type: 'rate_limit_error',
        message: 'Too many requests'
      })

      mockStripe.paymentIntents.create.mockRejectedValue(rateLimitError)

      const result = await stripeProvider.createPayment(basePaymentRequest)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('RATE_LIMITED')
      expect(result.error?.message).toContain('繁忙')
    })

    it('should handle API error', async () => {
      const apiError = new Stripe.StripeAPIError({
        type: 'api_error',
        message: 'Service temporarily unavailable'
      })

      mockStripe.paymentIntents.create.mockRejectedValue(apiError)

      const result = await stripeProvider.createPayment(basePaymentRequest)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('SERVICE_UNAVAILABLE')
      expect(result.error?.message).toContain('暫時不可用')
    })
  })

  describe('Currency and Amount Handling', () => {
    it('should handle zero-decimal currencies correctly', () => {
      const testCases = [
        { currency: 'TWD', amount: 350, expected: 350 },
        { currency: 'VND', amount: 285000, expected: 285000 }
      ]

      testCases.forEach(({ currency, amount, expected }) => {
        // 測試私有方法需要通過 any 類型轉換
        const result = (stripeProvider as any).convertToStripeAmount(amount, currency)
        expect(result).toBe(expected)
      })
    })

    it('should handle decimal currencies correctly', () => {
      const testCases = [
        { currency: 'MYR', amount: 45.50, expected: 4550 }
      ]

      testCases.forEach(({ currency, amount, expected }) => {
        const result = (stripeProvider as any).convertToStripeAmount(amount, currency)
        expect(result).toBe(expected)
      })
    })

    it('should validate supported countries and currencies', () => {
      expect(stripeProvider.supportedCountries).toContain('TW')
      expect(stripeProvider.supportedCountries).toContain('MY')
      expect(stripeProvider.supportedCountries).toContain('VN')
    })
  })

  describe('Integration Tests', () => {
    it('should complete full payment flow', async () => {
      // 1. 創建支付
      const mockPaymentIntent = {
        id: 'pi_integration_123',
        status: 'requires_confirmation',
        client_secret: 'pi_123_secret'
      }
      
      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent)

      const createResult = await stripeProvider.createPayment(basePaymentRequest)
      expect(createResult.success).toBe(true)

      // 2. 查詢狀態
      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        ...mockPaymentIntent,
        status: 'succeeded'
      })

      const status = await stripeProvider.getPaymentStatus(createResult.transactionId)
      expect(status).toBe('completed')

      // 3. 處理 webhook
      const webhookEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: mockPaymentIntent
        }
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookEvent)

      const webhookResult = await stripeProvider.handleWebhook(
        JSON.stringify(webhookEvent),
        'signature'
      )
      
      expect(webhookResult.processed).toBe(true)
      expect(webhookResult.shouldUpdateOrder).toBe(true)
    })
  })
})

// 額外的工具測試
describe('StripeCurrencyManager', () => {
  let currencyManager: StripeCurrencyManager

  beforeEach(() => {
    currencyManager = new StripeCurrencyManager()
  })

  describe('Amount Formatting', () => {
    it('should format TWD amounts correctly', () => {
      const formatted = currencyManager.formatAmount(1234, 'TWD')
      expect(formatted).toBe('NT$ 1,234')
    })

    it('should format MYR amounts correctly', () => {
      const formatted = currencyManager.formatAmount(1234.56, 'MYR')
      expect(formatted).toBe('RM 1,234.56')
    })

    it('should format VND amounts correctly', () => {
      const formatted = currencyManager.formatAmount(1234567, 'VND')
      expect(formatted).toBe('1.234.567 ₫')
    })
  })

  describe('Tax Calculations', () => {
    it('should calculate Taiwan tax correctly', () => {
      const breakdown = currencyManager.calculateAmountBreakdown(
        100, 'TWD', 'TW', false // 未含稅
      )

      expect(breakdown.subtotal).toBe(100)
      expect(breakdown.taxAmount).toBe(5) // 5% 稅
      expect(breakdown.totalAmount).toBe(105)
      expect(breakdown.taxRate).toBe(0.05)
    })

    it('should calculate Vietnam tax correctly', () => {
      const breakdown = currencyManager.calculateAmountBreakdown(
        100000, 'VND', 'VN', true // 含稅
      )

      expect(breakdown.totalAmount).toBe(100000)
      expect(Math.round(breakdown.subtotal)).toBe(90909) // 反推未稅價
      expect(Math.round(breakdown.taxAmount)).toBe(9091) // 10% 稅
    })

    it('should handle Malaysia (no tax)', () => {
      const breakdown = currencyManager.calculateAmountBreakdown(
        100, 'MYR', 'MY'
      )

      expect(breakdown.subtotal).toBe(100)
      expect(breakdown.taxAmount).toBe(0)
      expect(breakdown.totalAmount).toBe(100)
    })
  })

  describe('Amount Validation', () => {
    it('should validate minimum amounts', () => {
      const validations = [
        { currency: 'TWD' as CurrencyCode, amount: 0.5, expected: false },
        { currency: 'TWD' as CurrencyCode, amount: 1, expected: true },
        { currency: 'MYR' as CurrencyCode, amount: 0.3, expected: false },
        { currency: 'MYR' as CurrencyCode, amount: 0.5, expected: true }
      ]

      validations.forEach(({ currency, amount, expected }) => {
        const result = currencyManager.validateAmount(amount, currency)
        expect(result.valid).toBe(expected)
      })
    })
  })
})