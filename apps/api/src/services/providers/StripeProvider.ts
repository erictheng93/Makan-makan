import Stripe from 'stripe'
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
import {
  StripeConfig,
  StripePaymentIntentOptions,
  StripeWebhookEvent,
  StripeErrorDetails,
  STRIPE_PAYMENT_METHOD_MAP,
  STRIPE_COUNTRY_METHODS,
  STRIPE_CURRENCY_UNITS,
  StripeCountryConfig
} from '@makanmakan/shared-types'

export class StripeProvider extends PaymentProvider {
  readonly name = 'stripe'
  readonly displayName = 'Stripe'
  readonly supportedCountries: CountryCode[] = ['TW', 'MY', 'VN']
  readonly supportedMethods = ['credit_card', 'debit_card']

  private stripe: Stripe
  private stripeConfig: StripeConfig

  constructor(config: PaymentProviderConfig & { stripeConfig: StripeConfig }) {
    super(config)
    this.stripeConfig = config.stripeConfig
    
    // 初始化 Stripe 客戶端
    this.stripe = new Stripe(this.stripeConfig.secretKey, {
      apiVersion: this.stripeConfig.apiVersion as Stripe.LatestApiVersion,
      typescript: true,
      timeout: this.stripeConfig.webhookTimeout || 20000,
      maxNetworkRetries: this.stripeConfig.maxRetries || 3,
      telemetry: false // 關閉遙測以提高隱私
    })
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // 驗證國家和貨幣
      this.validateCountryAndCurrency(request.country, request.currency)
      
      // 轉換支付方式到 Stripe 格式
      const stripePaymentMethods = this.mapToStripePaymentMethods(
        request.method, 
        request.country
      )
      
      // 轉換金額到 Stripe 格式 (考慮貨幣最小單位)
      const stripeAmount = this.convertToStripeAmount(request.amount, request.currency)
      
      // 準備 PaymentIntent 選項
      const paymentIntentOptions: StripePaymentIntentOptions = {
        amount: stripeAmount,
        currency: request.currency.toLowerCase(),
        paymentMethodTypes: stripePaymentMethods,
        captureMethod: this.stripeConfig.captureMethod,
        confirmationMethod: this.stripeConfig.confirmationMethod,
        description: `Order ${request.orderId} - Restaurant ${request.restaurantId}`,
        metadata: {
          orderId: request.orderId,
          restaurantId: request.restaurantId.toString(),
          country: request.country,
          originalAmount: request.amount.toString(),
          ...request.metadata
        }
      }

      // 設置客戶資訊
      if (request.customerInfo) {
        if (request.customerInfo.email) {
          paymentIntentOptions.customerEmail = request.customerInfo.email
          paymentIntentOptions.receiptEmail = request.customerInfo.email
        }
        if (request.customerInfo.name) {
          paymentIntentOptions.customerName = request.customerInfo.name
        }
        if (request.customerInfo.phone) {
          paymentIntentOptions.customerPhone = request.customerInfo.phone
        }
      }

      // 設置帳單描述符 (顯示在客戶信用卡帳單上)
      paymentIntentOptions.statementDescriptor = this.generateStatementDescriptor(
        request.restaurantId
      )

      // 設置返回 URL (用於需要重定向的支付方式)
      if (request.returnUrl) {
        paymentIntentOptions.returnUrl = request.returnUrl
      }

      // 設置自動稅務 (如果啟用)
      if (this.stripeConfig.automaticTax) {
        paymentIntentOptions.automaticTax = { enabled: true }
      }

      // 設置平台手續費 (如果是平台模式)
      if (this.stripeConfig.applicationFee) {
        paymentIntentOptions.applicationFeeAmount = Math.round(
          stripeAmount * (this.stripeConfig.applicationFee / 100)
        )
      }

      // 創建 PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.create(
        paymentIntentOptions as Stripe.PaymentIntentCreateParams
      )

      // 處理不同的支付狀態
      return this.handlePaymentIntentResult(paymentIntent, request)

    } catch (error) {
      console.error('Stripe payment creation failed:', error)
      return this.handleStripeError(error as Stripe.StripeError)
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId)
      return this.mapStripeStatusToPaymentStatus(paymentIntent.status)
    } catch (error) {
      console.error('Failed to get Stripe payment status:', error)
      return 'pending'
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    try {
      // 首先獲取原始 PaymentIntent 以確認狀態
      const paymentIntent = await this.stripe.paymentIntents.retrieve(request.transactionId)
      
      if (paymentIntent.status !== 'succeeded') {
        throw new Error(`Cannot refund payment with status: ${paymentIntent.status}`)
      }

      // 取得最新的 charge (Stripe 中實際的扣款記錄)
      const charge = paymentIntent.latest_charge as Stripe.Charge
      if (!charge) {
        throw new Error('No charge found for this payment')
      }

      // 計算退款金額 (如果未指定則全額退款)
      const refundAmount = request.amount 
        ? this.convertToStripeAmount(request.amount, paymentIntent.currency.toUpperCase() as any)
        : paymentIntent.amount

      // 創建退款
      const refund = await this.stripe.refunds.create({
        charge: typeof charge === 'string' ? charge : charge.id,
        amount: refundAmount,
        reason: this.mapRefundReason(request.reason),
        metadata: {
          originalTransactionId: request.transactionId,
          refundReason: request.reason || 'requested_by_customer',
          ...request.metadata
        }
      })

      return {
        success: true,
        refundId: refund.id,
        amount: this.convertFromStripeAmount(refund.amount, paymentIntent.currency.toUpperCase() as any),
        status: refund.status === 'succeeded' ? 'completed' : 'pending'
      }

    } catch (error) {
      console.error('Stripe refund failed:', error)
      return {
        success: false,
        refundId: '',
        amount: request.amount || 0,
        status: 'failed',
        error: {
          code: 'REFUND_FAILED',
          message: (error as Error).message
        }
      }
    }
  }

  async handleWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    try {
      if (!signature) {
        throw new Error('Missing webhook signature')
      }

      // 驗證 webhook 簽名
      let event: StripeWebhookEvent
      try {
        event = this.stripe.webhooks.constructEvent(
          payload,
          signature,
          this.stripeConfig.webhookSecret
        ) as StripeWebhookEvent
      } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return {
          processed: false,
          error: 'Invalid signature'
        }
      }

      // 處理不同類型的 webhook 事件
      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentSucceeded(event)
        
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailed(event)
        
        case 'payment_intent.requires_action':
          return await this.handlePaymentRequiresAction(event)
        
        case 'payment_intent.canceled':
          return await this.handlePaymentCanceled(event)
        
        case 'charge.dispute.created':
          return await this.handleChargeDispute(event)
        
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
          return await this.handleInvoicePayment(event)
        
        default:
          console.log(`Unhandled webhook event type: ${event.type}`)
          return {
            processed: true,
            transactionId: this.extractTransactionId(event),
            shouldUpdateOrder: false
          }
      }

    } catch (error) {
      console.error('Webhook processing error:', error)
      return {
        processed: false,
        error: (error as Error).message
      }
    }
  }

  validateConfig(): boolean {
    try {
      // 檢查必要的配置
      const required = ['publishableKey', 'secretKey', 'webhookSecret', 'currency', 'country']
      for (const key of required) {
        if (!this.stripeConfig[key as keyof StripeConfig]) {
          console.error(`Missing required Stripe config: ${key}`)
          return false
        }
      }

      // 檢查金鑰格式
      const secretKey = this.stripeConfig.secretKey
      if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
        console.error('Invalid Stripe secret key format')
        return false
      }

      // 檢查測試/生產環境一致性
      const isTestKey = secretKey.startsWith('sk_test_')
      if (isTestKey !== this.stripeConfig.testMode) {
        console.error('Stripe test mode configuration mismatch')
        return false
      }

      // 檢查國家和貨幣匹配
      const countryConfig = this.getCountryConfig(this.stripeConfig.country)
      if (countryConfig.currency !== this.stripeConfig.currency) {
        console.error(`Currency ${this.stripeConfig.currency} not supported for country ${this.stripeConfig.country}`)
        return false
      }

      return true
    } catch (error) {
      console.error('Stripe config validation error:', error)
      return false
    }
  }

  // =============================================
  // 私有方法
  // =============================================

  private validateCountryAndCurrency(country: CountryCode, currency: string): void {
    if (!this.supportedCountries.includes(country)) {
      throw new Error(`Country ${country} is not supported by Stripe provider`)
    }

    const countryConfig = this.getCountryConfig(country)
    if (countryConfig.currency !== currency) {
      throw new Error(`Currency ${currency} is not supported for country ${country}`)
    }
  }

  private mapToStripePaymentMethods(method: string, country: CountryCode): string[] {
    // 獲取該國支援的 Stripe 支付方式
    const countryMethods = STRIPE_COUNTRY_METHODS[country] || ['card']
    
    // 映射支付方式
    const stripeMethod = STRIPE_PAYMENT_METHOD_MAP[method as keyof typeof STRIPE_PAYMENT_METHOD_MAP]
    if (stripeMethod && countryMethods.includes(stripeMethod)) {
      return [stripeMethod]
    }

    // 預設返回信用卡支付
    return ['card']
  }

  private convertToStripeAmount(amount: number, currency: string): number {
    const unit = STRIPE_CURRENCY_UNITS[currency as keyof typeof STRIPE_CURRENCY_UNITS]
    return Math.round(amount * unit)
  }

  private convertFromStripeAmount(stripeAmount: number, currency: string): number {
    const unit = STRIPE_CURRENCY_UNITS[currency as keyof typeof STRIPE_CURRENCY_UNITS]
    return stripeAmount / unit
  }

  private generateStatementDescriptor(restaurantId: number): string {
    // Stripe 限制: 最多 22 個字符，只能包含字母、數字、空格、破折號
    const descriptor = `MakanMakan R${restaurantId}`
    return descriptor.substring(0, 22)
  }

  private handlePaymentIntentResult(paymentIntent: Stripe.PaymentIntent, _request: PaymentRequest): PaymentResult {
    const status = this.mapStripeStatusToPaymentStatus(paymentIntent.status)
    
    const result: PaymentResult = {
      success: status === 'completed' || status === 'processing',
      transactionId: paymentIntent.id,
      status,
      metadata: {
        stripePaymentIntentId: paymentIntent.id,
        stripeStatus: paymentIntent.status,
        paymentMethod: paymentIntent.payment_method_types[0]
      }
    }

    // 如果需要客戶端確認 (如 3D Secure)
    if (paymentIntent.client_secret) {
      result.clientSecret = paymentIntent.client_secret
    }

    // 如果需要重定向 (某些支付方式)
    if (paymentIntent.next_action?.redirect_to_url) {
      result.redirectUrl = paymentIntent.next_action.redirect_to_url.url
    }

    return result
  }

  private mapStripeStatusToPaymentStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'succeeded': return 'completed'
      case 'processing': return 'processing'
      case 'requires_payment_method': return 'failed'
      case 'requires_confirmation': return 'pending'
      case 'requires_action': return 'processing'
      case 'canceled': return 'cancelled'
      case 'requires_capture': return 'processing'
      default: return 'pending'
    }
  }

  private mapRefundReason(reason?: string): 'duplicate' | 'fraudulent' | 'requested_by_customer' {
    if (!reason) return 'requested_by_customer'
    
    if (reason.includes('fraud') || reason.includes('suspicious')) return 'fraudulent'
    if (reason.includes('duplicate') || reason.includes('重複')) return 'duplicate'
    
    return 'requested_by_customer'
  }

  private handleStripeError(error: Stripe.StripeError): PaymentResult {
    const errorDetails: StripeErrorDetails = {
      type: error.type,
      code: error.code,
      message: error.message,
      decline_code: error.decline_code,
      param: error.param,
      doc_url: error.doc_url
    }

    // 根據錯誤類型提供更友善的訊息
    let friendlyMessage = error.message
    let errorCode = 'STRIPE_ERROR'

    switch (error.type) {
      case 'card_error':
        errorCode = 'CARD_ERROR'
        if (error.decline_code === 'insufficient_funds') {
          friendlyMessage = '卡片餘額不足，請使用其他支付方式'
        } else if (error.decline_code === 'expired_card') {
          friendlyMessage = '卡片已過期，請更新卡片資訊'
        } else if (error.decline_code === 'incorrect_cvc') {
          friendlyMessage = 'CVC 驗證碼錯誤，請檢查後重試'
        }
        break
      
      case 'rate_limit_error':
        errorCode = 'RATE_LIMIT'
        friendlyMessage = '系統繁忙，請稍後再試'
        break
      
      case 'api_error':
        errorCode = 'API_ERROR'
        friendlyMessage = '支付服務暫時不可用，請稍後再試'
        break
    }

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

  private getCountryConfig(country: CountryCode): StripeCountryConfig {
    const configs: Record<CountryCode, StripeCountryConfig> = {
      TW: {
        country: 'TW',
        currency: 'TWD',
        supportedMethods: ['card', 'alipay'],
        minimumAmount: 1,
        maximumAmount: 1000000,
        feeStructure: { percentage: 3.4, fixedAmount: 10 },
        taxRate: 0.05,
        requiresBusiness: true,
        invoiceRequired: true,
        localRegulations: ['business_registration', 'invoice_system']
      },
      MY: {
        country: 'MY',
        currency: 'MYR',
        supportedMethods: ['card', 'grabpay', 'alipay'],
        minimumAmount: 0.5,
        maximumAmount: 50000,
        feeStructure: { percentage: 3.4, fixedAmount: 1.5 },
        taxRate: 0,
        requiresBusiness: true,
        invoiceRequired: false,
        localRegulations: ['business_registration']
      },
      VN: {
        country: 'VN',
        currency: 'VND',
        supportedMethods: ['card', 'alipay'],
        minimumAmount: 10000,
        maximumAmount: 50000000,
        feeStructure: { percentage: 3.4, fixedAmount: 0 },
        taxRate: 0.1,
        requiresBusiness: true,
        invoiceRequired: false,
        localRegulations: ['business_registration', 'foreign_investment']
      }
    }

    return configs[country]
  }

  // Webhook 事件處理方法
  private async handlePaymentSucceeded(event: StripeWebhookEvent): Promise<WebhookResult> {
    const paymentIntent = event.data.object
    return {
      processed: true,
      transactionId: paymentIntent.id,
      newStatus: 'completed',
      shouldUpdateOrder: true
    }
  }

  private async handlePaymentFailed(event: StripeWebhookEvent): Promise<WebhookResult> {
    const paymentIntent = event.data.object
    return {
      processed: true,
      transactionId: paymentIntent.id,
      newStatus: 'failed',
      shouldUpdateOrder: true
    }
  }

  private async handlePaymentRequiresAction(event: StripeWebhookEvent): Promise<WebhookResult> {
    const paymentIntent = event.data.object
    return {
      processed: true,
      transactionId: paymentIntent.id,
      newStatus: 'processing',
      shouldUpdateOrder: false // 不需要立即更新訂單，等待用戶完成認證
    }
  }

  private async handlePaymentCanceled(event: StripeWebhookEvent): Promise<WebhookResult> {
    const paymentIntent = event.data.object
    return {
      processed: true,
      transactionId: paymentIntent.id,
      newStatus: 'cancelled',
      shouldUpdateOrder: true
    }
  }

  private async handleChargeDispute(event: StripeWebhookEvent): Promise<WebhookResult> {
    const dispute = event.data.object
    console.warn('Charge dispute created:', dispute.id)
    // 這裡可以添加爭議處理邏輯，如通知管理員
    return {
      processed: true,
      shouldUpdateOrder: false
    }
  }

  private async handleInvoicePayment(_event: StripeWebhookEvent): Promise<WebhookResult> {
    // 處理發票支付事件 (主要用於訂閱支付)
    return {
      processed: true,
      shouldUpdateOrder: false
    }
  }

  private extractTransactionId(event: StripeWebhookEvent): string | undefined {
    const obj = event.data.object
    if (obj.object === 'payment_intent') {
      return obj.id
    }
    if (obj.object === 'charge') {
      return obj.payment_intent
    }
    return undefined
  }
}