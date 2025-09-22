import Stripe from 'stripe'
import { PaymentResult } from '@makanmakan/shared-types'
import { StripeErrorDetails } from '@makanmakan/shared-types'

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  exponentialBackoff: boolean
  retryableErrorCodes: string[]
}

export interface ErrorContext {
  operation: string
  attempt: number
  maxAttempts: number
  country: string
  currency: string
  amount: number
  orderId: string
}

export class StripeErrorHandler {
  private retryConfig: RetryConfig

  constructor(config?: Partial<RetryConfig>) {
    this.retryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      exponentialBackoff: true,
      retryableErrorCodes: [
        'rate_limit_error',
        'api_error',
        'idempotency_error',
        'invalid_request_error' // 某些情況下可重試
      ],
      ...config
    }
  }

  /**
   * 執行帶重試的 Stripe 操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries + 1; attempt++) {
      try {
        const result = await operation()
        
        // 如果是重試成功，記錄日誌
        if (attempt > 1) {
          console.log(`Stripe operation succeeded on attempt ${attempt}:`, {
            operation: context.operation,
            orderId: context.orderId,
            totalAttempts: attempt
          })
        }

        return result
      } catch (error) {
        lastError = error as Error
        
        // 記錄錯誤
        console.warn(`Stripe operation failed (attempt ${attempt}):`, {
          operation: context.operation,
          orderId: context.orderId,
          error: error instanceof Stripe.StripeError ? {
            type: error.type,
            code: error.code,
            message: error.message
          } : (error as Error).message
        })

        // 最後一次嘗試失敗
        if (attempt === this.retryConfig.maxRetries + 1) {
          break
        }

        // 檢查是否可以重試
        if (!this.isRetryableError(error as Error)) {
          console.log(`Non-retryable error, stopping retries:`, error)
          break
        }

        // 計算延遲時間並等待
        const delay = this.calculateDelay(attempt)
        console.log(`Retrying in ${delay}ms...`)
        await this.sleep(delay)
      }
    }

    // 所有重試都失敗，拋出最後的錯誤
    throw lastError
  }

  /**
   * 將 Stripe 錯誤轉換為統一的支付結果
   */
  handleStripeError(error: Stripe.StripeError, context?: ErrorContext): PaymentResult {
    const errorDetails = this.extractErrorDetails(error)
    const { friendlyMessage, errorCode, shouldRetry } = this.categorizeError(error, context)

    // 記錄詳細錯誤資訊
    console.error('Stripe error handled:', {
      type: error.type,
      code: error.code,
      declineCode: error.decline_code,
      message: error.message,
      context,
      shouldRetry
    })

    return {
      success: false,
      transactionId: '',
      status: 'failed',
      error: {
        code: errorCode,
        message: friendlyMessage,
        details: errorDetails
      }
    }
  }

  /**
   * 檢查錯誤是否可以重試
   */
  private isRetryableError(error: Error): boolean {
    // 網路相關錯誤通常可以重試
    if (error.message.includes('network') || 
        error.message.includes('timeout') ||
        error.message.includes('connection')) {
      return true
    }

    // Stripe 特定錯誤
    if (error instanceof Stripe.StripeError) {
      // Rate limiting 錯誤可以重試
      if (error.type === 'rate_limit_error') {
        return true
      }

      // API 錯誤 (Stripe 服務暫時不可用) 可以重試
      if (error.type === 'api_error') {
        return true
      }

      // 冪等性錯誤可以重試 (通常是併發導致)
      if (error.code === 'idempotency_error') {
        return true
      }

      // 某些無效請求錯誤可能是暫時的
      if (error.type === 'invalid_request_error' && 
          error.code && this.isTemporaryInvalidRequest(error.code)) {
        return true
      }

      // 卡片錯誤不應該重試 (用戶需要更正資訊)
      if (error.type === 'card_error') {
        return false
      }

      // 認證錯誤不應該重試
      if (error.type === 'authentication_error') {
        return false
      }
    }

    return false
  }

  /**
   * 判斷是否為暫時性的無效請求
   */
  private isTemporaryInvalidRequest(errorCode: string): boolean {
    const temporaryCodes = [
      'missing',           // 參數暫時缺失
      'processing_error',  // 處理錯誤
      'setup_intent_invalid_state' // Setup Intent 狀態問題
    ]

    return temporaryCodes.includes(errorCode)
  }

  /**
   * 計算重試延遲時間
   */
  private calculateDelay(attempt: number): number {
    if (!this.retryConfig.exponentialBackoff) {
      return this.retryConfig.baseDelayMs
    }

    // 指數退避算法: delay = baseDelay * (2 ^ (attempt - 2))
    const exponentialDelay = this.retryConfig.baseDelayMs * Math.pow(2, attempt - 2)
    
    // 添加隨機 jitter 以避免雷群效應
    const jitter = Math.random() * 0.3 * exponentialDelay
    const totalDelay = exponentialDelay + jitter

    // 限制最大延遲
    return Math.min(totalDelay, this.retryConfig.maxDelayMs)
  }

  /**
   * 延遲執行
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 提取詳細錯誤資訊
   */
  private extractErrorDetails(error: Stripe.StripeError): StripeErrorDetails {
    return {
      type: error.type,
      code: error.code,
      decline_code: error.decline_code,
      param: error.param,
      message: error.message,
      doc_url: error.doc_url,
      charge: error.charge,
      payment_intent: error.payment_intent ? {
        id: error.payment_intent.id,
        status: error.payment_intent.status
      } : undefined,
      payment_method: error.payment_method ? {
        id: error.payment_method.id,
        type: error.payment_method.type
      } : undefined
    }
  }

  /**
   * 分類錯誤並提供友善訊息
   */
  private categorizeError(error: Stripe.StripeError, context?: ErrorContext): {
    friendlyMessage: string
    errorCode: string
    shouldRetry: boolean
  } {
    const { type, code: _code, decline_code: _decline_code } = error

    // 處理卡片錯誤
    if (type === 'card_error') {
      return this.handleCardError(error, context)
    }

    // 處理 Rate Limiting
    if (type === 'rate_limit_error') {
      return {
        friendlyMessage: '系統繁忙中，請稍後再試',
        errorCode: 'RATE_LIMITED',
        shouldRetry: true
      }
    }

    // 處理 API 錯誤
    if (type === 'api_error') {
      return {
        friendlyMessage: '支付服務暫時不可用，請稍後再試',
        errorCode: 'SERVICE_UNAVAILABLE',
        shouldRetry: true
      }
    }

    // 處理認證錯誤
    if (type === 'authentication_error') {
      return {
        friendlyMessage: '支付配置錯誤，請聯繫客服',
        errorCode: 'CONFIG_ERROR',
        shouldRetry: false
      }
    }

    // 處理無效請求錯誤
    if (type === 'invalid_request_error') {
      return this.handleInvalidRequestError(error, context)
    }

    // 預設錯誤處理
    return {
      friendlyMessage: error.message || '支付過程發生錯誤，請稍後再試',
      errorCode: 'UNKNOWN_ERROR',
      shouldRetry: false
    }
  }

  /**
   * 處理卡片錯誤
   */
  private handleCardError(error: Stripe.StripeError, context?: ErrorContext): {
    friendlyMessage: string
    errorCode: string
    shouldRetry: boolean
  } {
    const { decline_code, code } = error

    switch (decline_code) {
      case 'insufficient_funds':
        return {
          friendlyMessage: '卡片餘額不足，請使用其他支付方式或聯繫銀行',
          errorCode: 'INSUFFICIENT_FUNDS',
          shouldRetry: false
        }

      case 'expired_card':
        return {
          friendlyMessage: '卡片已過期，請更新卡片資訊',
          errorCode: 'CARD_EXPIRED',
          shouldRetry: false
        }

      case 'incorrect_cvc':
        return {
          friendlyMessage: 'CVC 安全碼錯誤，請檢查後重新輸入',
          errorCode: 'INVALID_CVC',
          shouldRetry: false
        }

      case 'card_not_supported':
        return {
          friendlyMessage: '此卡片類型不支援，請使用其他卡片',
          errorCode: 'CARD_NOT_SUPPORTED',
          shouldRetry: false
        }

      case 'currency_not_supported':
        return {
          friendlyMessage: `此卡片不支援 ${context?.currency || ''} 幣別交易`,
          errorCode: 'CURRENCY_NOT_SUPPORTED',
          shouldRetry: false
        }

      case 'do_not_honor':
      case 'generic_decline':
        return {
          friendlyMessage: '銀行拒絕此交易，請聯繫發卡銀行或使用其他支付方式',
          errorCode: 'BANK_DECLINED',
          shouldRetry: false
        }

      case 'fraudulent':
        return {
          friendlyMessage: '交易被識別為可疑，請聯繫銀行確認',
          errorCode: 'FRAUD_SUSPECTED',
          shouldRetry: false
        }

      case 'lost_card':
      case 'stolen_card':
        return {
          friendlyMessage: '卡片已被報失，請使用其他支付方式',
          errorCode: 'CARD_BLOCKED',
          shouldRetry: false
        }

      case 'pickup_card':
        return {
          friendlyMessage: '請聯繫發卡銀行，卡片可能需要處理',
          errorCode: 'CARD_RESTRICTED',
          shouldRetry: false
        }

      case 'processing_error':
        return {
          friendlyMessage: '處理過程中發生錯誤，請稍後再試',
          errorCode: 'PROCESSING_ERROR',
          shouldRetry: true
        }
    }

    // 根據 code 處理其他卡片錯誤
    switch (code) {
      case 'card_declined':
        return {
          friendlyMessage: '卡片交易被拒絕，請檢查卡片資訊或使用其他支付方式',
          errorCode: 'CARD_DECLINED',
          shouldRetry: false
        }

      case 'incorrect_number':
        return {
          friendlyMessage: '卡片號碼錯誤，請檢查後重新輸入',
          errorCode: 'INVALID_CARD_NUMBER',
          shouldRetry: false
        }

      case 'invalid_expiry_month':
      case 'invalid_expiry_year':
        return {
          friendlyMessage: '卡片到期日錯誤，請檢查後重新輸入',
          errorCode: 'INVALID_EXPIRY',
          shouldRetry: false
        }
    }

    // 預設卡片錯誤
    return {
      friendlyMessage: '卡片驗證失敗，請檢查卡片資訊或使用其他支付方式',
      errorCode: 'CARD_ERROR',
      shouldRetry: false
    }
  }

  /**
   * 處理無效請求錯誤
   */
  private handleInvalidRequestError(error: Stripe.StripeError, context?: ErrorContext): {
    friendlyMessage: string
    errorCode: string
    shouldRetry: boolean
  } {
    const { code, param } = error

    switch (code) {
      case 'amount_too_small':
        return {
          friendlyMessage: `支付金額太小，最小金額為 ${this.getMinimumAmount(context?.currency)}`,
          errorCode: 'AMOUNT_TOO_SMALL',
          shouldRetry: false
        }

      case 'amount_too_large':
        return {
          friendlyMessage: `支付金額超過限制，最大金額為 ${this.getMaximumAmount(context?.currency)}`,
          errorCode: 'AMOUNT_TOO_LARGE',
          shouldRetry: false
        }

      case 'currency_not_supported':
        return {
          friendlyMessage: `不支援 ${context?.currency || ''} 幣別`,
          errorCode: 'CURRENCY_NOT_SUPPORTED',
          shouldRetry: false
        }

      case 'email_invalid':
        return {
          friendlyMessage: '電子郵件格式錯誤，請檢查後重新輸入',
          errorCode: 'INVALID_EMAIL',
          shouldRetry: false
        }

      case 'idempotency_key_in_use':
        return {
          friendlyMessage: '重複的請求，請等待前一個請求完成',
          errorCode: 'DUPLICATE_REQUEST',
          shouldRetry: true
        }

      case 'payment_intent_invalid_parameter':
        return {
          friendlyMessage: '支付參數錯誤，請重新嘗試',
          errorCode: 'INVALID_PARAMETERS',
          shouldRetry: false
        }

      case 'payment_method_not_available':
        return {
          friendlyMessage: '選擇的支付方式暫時不可用，請使用其他方式',
          errorCode: 'PAYMENT_METHOD_UNAVAILABLE',
          shouldRetry: false
        }
    }

    return {
      friendlyMessage: `請求參數錯誤: ${param || '未知參數'}`,
      errorCode: 'INVALID_REQUEST',
      shouldRetry: false
    }
  }

  /**
   * 獲取貨幣的最小金額
   */
  private getMinimumAmount(currency?: string): string {
    const amounts: Record<string, string> = {
      TWD: 'NT$ 1',
      MYR: 'RM 0.50',
      VND: '₫ 10,000'
    }
    return amounts[currency || ''] || '請參考相關規定'
  }

  /**
   * 獲取貨幣的最大金額
   */
  private getMaximumAmount(currency?: string): string {
    const amounts: Record<string, string> = {
      TWD: 'NT$ 1,000,000',
      MYR: 'RM 50,000',
      VND: '₫ 50,000,000'
    }
    return amounts[currency || ''] || '請參考相關規定'
  }

  /**
   * 檢查錯誤是否為暫時性錯誤
   */
  isTemporaryError(error: Error): boolean {
    if (error instanceof Stripe.StripeError) {
      return error.type === 'rate_limit_error' || 
             error.type === 'api_error' ||
             (error.type === 'card_error' && error.decline_code === 'processing_error')
    }

    return error.message.includes('network') || 
           error.message.includes('timeout') ||
           error.message.includes('connection')
  }

  /**
   * 獲取重試配置
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig }
  }

  /**
   * 更新重試配置
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config }
  }
}