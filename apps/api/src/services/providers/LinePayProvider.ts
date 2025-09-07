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

interface LinePayConfig {
  channelId: string
  channelSecret: string
  merchantId: string
  apiUrl: string
  version: string
  environment: 'SANDBOX' | 'REAL'
  confirmUrl: string
  cancelUrl: string
  locale: string
  currency: string
}

interface LinePayApiRequest {
  amount: number
  currency: string
  orderId: string
  packages: Array<{
    id: string
    amount: number
    name: string
    products: Array<{
      id?: string
      name: string
      imageUrl?: string
      quantity: number
      price: number
    }>
  }>
  redirectUrls: {
    confirmUrl: string
    cancelUrl: string
  }
  options?: {
    payment?: {
      capture?: boolean
      payType?: string
    }
    display?: {
      locale?: string
      checkConfirmUrlBrowser?: boolean
    }
    shipping?: {
      type?: string
      feeAmount?: number
    }
    extra?: {
      branchName?: string
      branchId?: string
    }
  }
}

interface LinePayResponse {
  returnCode: string
  returnMessage: string
  info?: {
    transactionId: number
    paymentAccessToken: string
    paymentUrl: {
      web: string
      app: string
    }
  }
}

export class LinePayProvider extends PaymentProvider {
  readonly name = 'linepay'
  readonly displayName = 'LINE Pay'
  readonly supportedCountries: CountryCode[] = ['TW']
  readonly supportedMethods = ['line_pay']

  private linepayConfig: LinePayConfig

  constructor(config: PaymentProviderConfig & { linepayConfig: LinePayConfig }) {
    super(config)
    this.linepayConfig = config.linepayConfig
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // 驗證國家和貨幣
      if (request.country !== 'TW' || request.currency !== 'TWD') {
        throw new Error('LINE Pay only supports Taiwan (TW) and TWD currency')
      }

      // 生成訂單編號
      const orderId = this.generateOrderId(request.orderId)
      
      // 準備 LINE Pay API 請求
      const apiRequest: LinePayApiRequest = {
        amount: Math.round(request.amount),
        currency: this.linepayConfig.currency,
        orderId: orderId,
        packages: [{
          id: `pkg_${request.restaurantId}`,
          amount: Math.round(request.amount),
          name: `Restaurant ${request.restaurantId} Order`,
          products: [{
            name: `Order ${request.orderId}`,
            quantity: 1,
            price: Math.round(request.amount)
          }]
        }],
        redirectUrls: {
          confirmUrl: request.returnUrl || this.linepayConfig.confirmUrl,
          cancelUrl: request.cancelUrl || this.linepayConfig.cancelUrl
        },
        options: {
          payment: {
            capture: true,
            payType: 'NORMAL'
          },
          display: {
            locale: this.linepayConfig.locale,
            checkConfirmUrlBrowser: true
          },
          extra: {
            branchName: `Restaurant ${request.restaurantId}`,
            branchId: request.restaurantId.toString()
          }
        }
      }

      // 生成請求簽名
      const nonce = this.generateNonce()
      const timestamp = Date.now().toString()
      const signature = this.generateSignature('POST', '/v3/payments/request', JSON.stringify(apiRequest), nonce, timestamp)

      // 發送 LINE Pay 請求
      const response = await fetch(`${this.linepayConfig.apiUrl}/v3/payments/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LINE-ChannelId': this.linepayConfig.channelId,
          'X-LINE-Authorization-Nonce': nonce,
          'X-LINE-Authorization': signature,
          'X-LINE-MerchantDeviceType': 'WEB'
        },
        body: JSON.stringify(apiRequest)
      })

      const result: LinePayResponse = await response.json()

      if (result.returnCode === '0000' && result.info) {
        return {
          success: true,
          transactionId: result.info.transactionId.toString(),
          status: 'pending',
          redirectUrl: result.info.paymentUrl.web,
          metadata: {
            linePayTransactionId: result.info.transactionId,
            paymentAccessToken: result.info.paymentAccessToken,
            appUrl: result.info.paymentUrl.app,
            provider: 'linepay'
          }
        }
      } else {
        throw new Error(`LINE Pay API error: ${result.returnCode} - ${result.returnMessage}`)
      }

    } catch (error) {
      console.error('LINE Pay payment creation failed:', error)
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        error: {
          code: 'LINEPAY_ERROR',
          message: (error as Error).message
        }
      }
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      // 生成請求簽名
      const nonce = this.generateNonce()
      const timestamp = Date.now().toString()
      const requestUri = `/v3/payments/${transactionId}/check`
      const signature = this.generateSignature('GET', requestUri, '', nonce, timestamp)

      // 查詢 LINE Pay 交易狀態
      const response = await fetch(`${this.linepayConfig.apiUrl}${requestUri}`, {
        method: 'GET',
        headers: {
          'X-LINE-ChannelId': this.linepayConfig.channelId,
          'X-LINE-Authorization-Nonce': nonce,
          'X-LINE-Authorization': signature
        }
      })

      const result = await response.json()

      if (result.returnCode === '0000' && result.info) {
        const paymentInfo = result.info[0]
        
        // LINE Pay 交易狀態對應
        switch (paymentInfo.transactionType) {
          case 'PAYMENT':
            return 'completed'
          case 'PARTIAL_REFUND':
            return 'partial_refunded'
          case 'REFUND':
            return 'refunded'
          case 'VOID':
            return 'cancelled'
          default:
            return 'pending'
        }
      } else {
        return 'pending'
      }

    } catch (error) {
      console.error('Failed to query LINE Pay payment status:', error)
      return 'pending'
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    try {
      const refundRequest = {
        refundAmount: Math.round(request.amount || 0)
      }

      // 生成請求簽名
      const nonce = this.generateNonce()
      const timestamp = Date.now().toString()
      const requestUri = `/v3/payments/${request.transactionId}/refund`
      const signature = this.generateSignature('POST', requestUri, JSON.stringify(refundRequest), nonce, timestamp)

      // 發送退款請求
      const response = await fetch(`${this.linepayConfig.apiUrl}${requestUri}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LINE-ChannelId': this.linepayConfig.channelId,
          'X-LINE-Authorization-Nonce': nonce,
          'X-LINE-Authorization': signature
        },
        body: JSON.stringify(refundRequest)
      })

      const result = await response.json()

      if (result.returnCode === '0000' && result.info) {
        return {
          success: true,
          refundId: result.info.refundTransactionId?.toString() || request.transactionId,
          amount: request.amount || 0,
          status: 'completed'
        }
      } else {
        return {
          success: false,
          refundId: '',
          amount: request.amount || 0,
          status: 'failed',
          error: {
            code: result.returnCode,
            message: result.returnMessage
          }
        }
      }

    } catch (error) {
      console.error('LINE Pay refund failed:', error)
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

  async handleWebhook(payload: any, _signature?: string): Promise<WebhookResult> {
    try {
      // LINE Pay 沒有標準的 webhook，通常透過 confirm API 來確認支付
      // 這裡處理的是支付確認回調
      const confirmData = typeof payload === 'object' ? payload : JSON.parse(payload)
      
      if (confirmData.transactionId && confirmData.orderId) {
        // 確認支付
        const confirmed = await this.confirmPayment(confirmData.transactionId, confirmData.orderId, confirmData.amount || 0)
        
        if (confirmed.success) {
          return {
            processed: true,
            transactionId: confirmData.transactionId.toString(),
            newStatus: 'completed',
            shouldUpdateOrder: true,
            metadata: {
              linePayTransactionId: confirmData.transactionId,
              orderId: confirmData.orderId,
              paymentInfo: confirmed.paymentInfo
            }
          }
        }
      }

      return {
        processed: false,
        error: 'Invalid webhook payload or confirmation failed'
      }

    } catch (error) {
      console.error('LINE Pay webhook processing error:', error)
      return {
        processed: false,
        error: (error as Error).message
      }
    }
  }

  validateConfig(): boolean {
    try {
      const required = ['channelId', 'channelSecret', 'merchantId', 'apiUrl', 'confirmUrl']
      for (const key of required) {
        if (!this.linepayConfig[key as keyof LinePayConfig]) {
          console.error(`Missing required LINE Pay config: ${key}`)
          return false
        }
      }

      // 檢查 Channel ID 格式
      if (!/^\d+$/.test(this.linepayConfig.channelId)) {
        console.error('Invalid LINE Pay Channel ID format (should be numeric)')
        return false
      }

      return true
    } catch (error) {
      console.error('LINE Pay config validation error:', error)
      return false
    }
  }

  // =============================================
  // 私有方法
  // =============================================

  private generateOrderId(orderId: string): string {
    // LINE Pay 訂單號：英數字，最長40字元
    const timestamp = Date.now().toString()
    const randomStr = Math.random().toString(36).substring(2, 8)
    return `LP${orderId}_${timestamp}_${randomStr}`.substring(0, 40)
  }

  private generateNonce(): string {
    return crypto.randomUUID()
  }

  private generateSignature(method: string, uri: string, body: string, nonce: string, timestamp: string): string {
    // LINE Pay 簽名格式
    const message = [
      this.linepayConfig.channelSecret,
      uri,
      body,
      nonce,
      timestamp
    ].join('')

    return crypto
      .createHmac('sha256', this.linepayConfig.channelSecret)
      .update(message, 'utf8')
      .digest('base64')
  }

  private async confirmPayment(transactionId: string, orderId: string, amount: number): Promise<{success: boolean, paymentInfo?: any}> {
    try {
      const confirmRequest = {
        amount,
        currency: this.linepayConfig.currency
      }

      // 生成請求簽名
      const nonce = this.generateNonce()
      const timestamp = Date.now().toString()
      const requestUri = `/v3/payments/${transactionId}/confirm`
      const signature = this.generateSignature('POST', requestUri, JSON.stringify(confirmRequest), nonce, timestamp)

      // 發送確認請求
      const response = await fetch(`${this.linepayConfig.apiUrl}${requestUri}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LINE-ChannelId': this.linepayConfig.channelId,
          'X-LINE-Authorization-Nonce': nonce,
          'X-LINE-Authorization': signature
        },
        body: JSON.stringify(confirmRequest)
      })

      const result = await response.json()

      if (result.returnCode === '0000' && result.info) {
        return {
          success: true,
          paymentInfo: result.info
        }
      } else {
        console.error('LINE Pay confirm failed:', result.returnMessage)
        return { success: false }
      }

    } catch (error) {
      console.error('LINE Pay confirm payment error:', error)
      return { success: false }
    }
  }
}