import crypto from 'crypto'
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  WebhookResult,
  PaymentStatus,
  CountryCode,
  PaymentProviderConfig
} from '@makanmakan/shared-types'

interface TouchNGoConfig {
  clientId: string
  clientSecret: string
  merchantId: string
  apiKey: string
  apiUrl: string          // https://api.touchngo.com.my or sandbox
  environment: 'sandbox' | 'production'
  webhookUrl: string
  redirectUrl: string
  version: string         // API version
}

interface TouchNGoPaymentRequest {
  merchant_id: string
  reference_id: string
  amount: number
  currency: string
  description: string
  redirect_url: string
  webhook_url: string
  metadata?: Record<string, any>
}

interface TouchNGoPaymentResponse {
  status: string
  transaction_id: string
  payment_url: string
  qr_code?: string
  expires_at: string
  reference_id: string
}

export class TouchNGoDirectProvider extends PaymentProvider {
  readonly name = 'touchngo_direct'
  readonly displayName = 'Touch \'n Go eWallet Direct'
  readonly supportedCountries: CountryCode[] = ['MY']
  readonly supportedMethods = ['touch_n_go']

  private tngConfig: TouchNGoConfig
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor(config: PaymentProviderConfig & { touchngoConfig: TouchNGoConfig }) {
    super(config)
    this.tngConfig = config.touchngoConfig
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // 驗證國家和貨幣
      if (request.country !== 'MY' || request.currency !== 'MYR') {
        throw new Error('Touch \'n Go Direct only supports Malaysia (MY) and MYR currency')
      }

      // 確保有有效的 access token
      await this.ensureValidToken()

      // 生成參考編號
      const referenceId = this.generateReferenceId(request.orderId)
      
      // 準備 Touch 'n Go API 請求
      const paymentRequest: TouchNGoPaymentRequest = {
        merchant_id: this.tngConfig.merchantId,
        reference_id: referenceId,
        amount: Math.round(request.amount * 100), // 轉換為分
        currency: request.currency,
        description: `Order ${request.orderId} - Restaurant ${request.restaurantId}`,
        redirect_url: request.returnUrl || this.tngConfig.redirectUrl,
        webhook_url: this.tngConfig.webhookUrl,
        metadata: {
          order_id: request.orderId,
          restaurant_id: request.restaurantId.toString(),
          customer_name: request.customerInfo?.name,
          customer_email: request.customerInfo?.email
        }
      }

      // 生成請求簽名
      const signature = this.generateSignature(paymentRequest)

      // 發送支付請求
      const response = await fetch(`${this.tngConfig.apiUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Signature': signature,
          'X-Timestamp': Date.now().toString()
        },
        body: JSON.stringify(paymentRequest)
      })

      const result: TouchNGoPaymentResponse = await response.json()

      if (response.ok && result.status === 'pending') {
        return {
          success: true,
          transactionId: result.transaction_id,
          status: 'pending',
          redirectUrl: result.payment_url,
          qrCodeData: result.qr_code,
          metadata: {
            touchngoTransactionId: result.transaction_id,
            referenceId: result.reference_id,
            expiresAt: result.expires_at,
            provider: 'touchngo_direct'
          }
        }
      } else {
        throw new Error(`Touch 'n Go API error: ${result.status}`)
      }

    } catch (error) {
      console.error('Touch \'n Go Direct payment creation failed:', error)
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        error: {
          code: 'TOUCHNGO_ERROR',
          message: (error as Error).message
        }
      }
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      await this.ensureValidToken()

      const response = await fetch(`${this.tngConfig.apiUrl}/v1/payments/${transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (response.ok) {
        // Touch 'n Go 狀態映射
        switch (result.status) {
          case 'completed':
          case 'success':
            return 'completed'
          case 'failed':
          case 'error':
            return 'failed'
          case 'cancelled':
          case 'expired':
            return 'cancelled'
          case 'pending':
          case 'processing':
          default:
            return 'pending'
        }
      } else {
        return 'pending'
      }

    } catch (error) {
      console.error('Failed to query Touch \'n Go payment status:', error)
      return 'pending'
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    try {
      await this.ensureValidToken()

      const refundRequest = {
        transaction_id: request.transactionId,
        amount: Math.round((request.amount || 0) * 100), // 轉換為分
        reason: request.reason || 'Customer request'
      }

      const signature = this.generateSignature(refundRequest)

      const response = await fetch(`${this.tngConfig.apiUrl}/v1/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Signature': signature,
          'X-Timestamp': Date.now().toString()
        },
        body: JSON.stringify(refundRequest)
      })

      const result = await response.json()

      if (response.ok && result.status === 'success') {
        return {
          success: true,
          refundId: result.refund_id,
          amount: result.amount / 100, // 轉換回原幣值
          status: 'completed'
        }
      } else {
        return {
          success: false,
          refundId: '',
          amount: request.amount || 0,
          status: 'failed',
          error: {
            code: 'REFUND_FAILED',
            message: result.message || 'Refund failed'
          }
        }
      }

    } catch (error) {
      console.error('Touch \'n Go refund failed:', error)
      return {
        success: false,
        refundId: '',
        amount: request.amount || 0,
        status: 'failed',
        error: {
          code: 'REFUND_ERROR',
          message: (error as Error).message
        }
      }
    }
  }

  async handleWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    try {
      // 驗證 webhook 簽名
      if (signature) {
        const expectedSignature = this.generateWebhookSignature(payload)
        if (signature !== expectedSignature) {
          throw new Error('Invalid webhook signature')
        }
      }

      const webhookData = typeof payload === 'object' ? payload : JSON.parse(payload)

      let newStatus: PaymentStatus = 'pending'
      switch (webhookData.status) {
        case 'completed':
        case 'success':
          newStatus = 'completed'
          break
        case 'failed':
        case 'error':
          newStatus = 'failed'
          break
        case 'cancelled':
        case 'expired':
          newStatus = 'cancelled'
          break
        default:
          newStatus = 'pending'
      }

      return {
        processed: true,
        transactionId: webhookData.transaction_id,
        newStatus,
        shouldUpdateOrder: newStatus === 'completed',
        metadata: {
          touchngoTransactionId: webhookData.transaction_id,
          referenceId: webhookData.reference_id,
          amount: webhookData.amount / 100, // 轉換回原幣值
          processedAt: webhookData.processed_at
        }
      }

    } catch (error) {
      console.error('Touch \'n Go webhook processing error:', error)
      return {
        processed: false,
        error: (error as Error).message
      }
    }
  }

  validateConfig(): boolean {
    try {
      const required = ['clientId', 'clientSecret', 'merchantId', 'apiKey', 'apiUrl']
      for (const key of required) {
        if (!this.tngConfig[key as keyof TouchNGoConfig]) {
          console.error(`Missing required Touch 'n Go config: ${key}`)
          return false
        }
      }

      // 檢查 API URL 格式
      if (!this.tngConfig.apiUrl.startsWith('https://')) {
        console.error('Touch \'n Go API URL must use HTTPS')
        return false
      }

      return true
    } catch (error) {
      console.error('Touch \'n Go config validation error:', error)
      return false
    }
  }

  // =============================================
  // 私有方法
  // =============================================

  private generateReferenceId(orderId: string): string {
    const timestamp = Date.now().toString()
    const randomStr = Math.random().toString(36).substring(2, 8)
    return `TNG${orderId}_${timestamp}_${randomStr}`.substring(0, 50)
  }

  private async ensureValidToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return // Token 仍然有效
    }

    // 獲取新的 access token
    const tokenResponse = await fetch(`${this.tngConfig.apiUrl}/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: this.tngConfig.clientId,
        client_secret: this.tngConfig.clientSecret,
        grant_type: 'client_credentials'
      })
    })

    const tokenData = await tokenResponse.json()

    if (tokenResponse.ok) {
      this.accessToken = tokenData.access_token
      this.tokenExpiresAt = Date.now() + (tokenData.expires_in * 1000)
    } else {
      throw new Error('Failed to obtain Touch \'n Go access token')
    }
  }

  private generateSignature(data: any): string {
    const jsonString = JSON.stringify(data)
    const timestamp = Date.now().toString()
    const stringToSign = `${timestamp}${jsonString}`

    return crypto
      .createHmac('sha256', this.tngConfig.apiKey)
      .update(stringToSign)
      .digest('hex')
  }

  private generateWebhookSignature(payload: any): string {
    const jsonString = typeof payload === 'string' ? payload : JSON.stringify(payload)
    
    return crypto
      .createHmac('sha256', this.tngConfig.apiKey)
      .update(jsonString)
      .digest('hex')
  }
}