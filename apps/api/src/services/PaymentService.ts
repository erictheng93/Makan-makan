import { PaymentOrchestrator } from './PaymentOrchestrator'
import { PaymentConfigManager } from './PaymentConfigManager'
import { StripeProvider } from './providers/StripeProvider'
import { ECPayProvider } from './providers/ECPayProvider'
import { NewebPayProvider } from './providers/NewebPayProvider'
import { LinePayProvider } from './providers/LinePayProvider'
import { UniPayProvider } from './providers/UniPayProvider'
import { iPay88Provider } from './providers/iPay88Provider'
import { TouchNGoDirectProvider } from './providers/TouchNGoDirectProvider'
import { VNPayProvider } from './providers/VNPayProvider'
import {
  PaymentRequest,
  PaymentResult,
  RefundRequest,
  RefundResult,
  PaymentStatus,
  WebhookResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  PaymentTransaction,
  CountryCode
} from '@makanmakan/shared-types'

interface PaymentServiceConfig {
  database: any
  orchestratorConfig?: any
}

export class PaymentService {
  private orchestrator: PaymentOrchestrator
  private configManager: PaymentConfigManager
  private db: any

  constructor(config: PaymentServiceConfig) {
    this.db = config.database
    this.configManager = new PaymentConfigManager(this.db)
    this.orchestrator = new PaymentOrchestrator(config.orchestratorConfig)
  }

  async initialize(): Promise<void> {
    // 從資料庫載入配置
    const countryConfigs = await this.configManager.getAllCountryConfigs()
    
    // 設置國家配置到 orchestrator
    for (const [country, config] of countryConfigs) {
      this.orchestrator.setCountryConfig(country, config)
    }

    // 註冊支付提供商實例
    await this.registerPaymentProviders()
    
    console.log('PaymentService initialized successfully')
  }

  private async registerPaymentProviders(): Promise<void> {
    try {
      // 獲取所有活躍的支付提供商配置
      const providers = await this.configManager.getAllPaymentProviders()
      
      for (const providerConfig of providers) {
        try {
          switch (providerConfig.name) {
            case 'stripe':
              await this.registerStripeProvider(providerConfig)
              break
            case 'ecpay':
              await this.registerECPayProvider(providerConfig)
              break
            case 'newebpay':
              await this.registerNewebPayProvider(providerConfig)
              break
            case 'linepay':
              await this.registerLinePayProvider(providerConfig)
              break
            case 'unipay':
              await this.registerUniPayProvider(providerConfig)
              break
            case 'ipay88':
              await this.registeriPay88Provider(providerConfig)
              break
            case 'touchngo_direct':
              await this.registerTouchNGoDirectProvider(providerConfig)
              break
            case 'vnpay':
              await this.registerVNPayProvider(providerConfig)
              break
            default:
              console.warn(`Unknown payment provider: ${providerConfig.name}`)
          }
        } catch (error) {
          console.error(`Failed to register provider ${providerConfig.name}:`, error)
        }
      }
      
      console.log(`Registered ${this.orchestrator.getRegisteredProviders().length} payment providers`)
    } catch (error) {
      console.error('Failed to register payment providers:', error)
    }
  }

  private async registerStripeProvider(providerConfig: any): Promise<void> {
    // 為每個支持的國家註冊 Stripe 提供商
    for (const country of providerConfig.supportedCountries) {
      const config = await this.configManager.getProviderConfig('stripe', country)
      if (!config) continue

      try {
        const stripeProvider = new StripeProvider({
          ...providerConfig,
          stripeConfig: {
            publishableKey: config.publishableKey,
            secretKey: config.secretKey,
            webhookSecret: config.webhookSecret,
            testMode: providerConfig.testMode,
            apiVersion: '2023-10-16',
            country: country,
            currency: this.getCurrencyForCountry(country),
            paymentMethodTypes: config.paymentMethodTypes || ['card'],
            automaticTax: config.automaticTax || false,
            requireAuthentication: config.requireAuthentication || 'automatic',
            captureMethod: config.captureMethod || 'automatic',
            confirmationMethod: config.confirmationMethod || 'automatic',
            minimumAmount: config.minimumAmount || 0.5,
            maximumAmount: config.maximumAmount || 999999,
            paymentTimeout: config.paymentTimeout || 1800,
            webhookTimeout: config.webhookTimeout || 20000,
            maxRetries: config.maxRetries || 3,
            retryBackoffMs: config.retryBackoffMs || 1000,
            blockSuspiciousPayments: config.blockSuspiciousPayments || true
          }
        })

        this.orchestrator.registerProvider(stripeProvider)
        console.log(`Registered Stripe provider for ${country}`)
      } catch (error) {
        console.error(`Failed to register Stripe provider for ${country}:`, error)
      }
    }
  }

  private async registerECPayProvider(providerConfig: any): Promise<void> {
    const config = await this.configManager.getProviderConfig('ecpay', 'TW')
    if (!config) return

    try {
      const ecpayProvider = new ECPayProvider({
        ...providerConfig,
        ecpayConfig: {
          merchantId: config.merchantId,
          hashKey: config.hashKey,
          hashIV: config.hashIV,
          checkoutUrl: config.checkoutUrl || 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
          queryUrl: config.queryUrl || 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
          testMode: providerConfig.testMode,
          returnUrl: config.returnUrl,
          notifyUrl: config.notifyUrl,
          clientBackUrl: config.clientBackUrl,
          itemName: config.itemName || 'MakanMakan Order',
          paymentTimeout: config.paymentTimeout || 1800
        }
      })

      this.orchestrator.registerProvider(ecpayProvider)
      console.log('Registered ECPay provider for TW')
    } catch (error) {
      console.error('Failed to register ECPay provider:', error)
    }
  }

  private async registeriPay88Provider(providerConfig: any): Promise<void> {
    const config = await this.configManager.getProviderConfig('ipay88', 'MY')
    if (!config) return

    try {
      const ipay88Provider = new iPay88Provider({
        ...providerConfig,
        ipay88Config: {
          merchantCode: config.merchantCode,
          merchantKey: config.merchantKey,
          paymentUrl: config.paymentUrl || 'https://payment.ipay88.com.my/epayment/entry.asp',
          queryUrl: config.queryUrl || 'https://payment.ipay88.com.my/epayment/enquiry.asp',
          responseUrl: config.responseUrl,
          backendUrl: config.backendUrl,
          testMode: providerConfig.testMode,
          currency: 'MYR',
          country: 'MY',
          language: config.language || 'UTF-8'
        }
      })

      this.orchestrator.registerProvider(ipay88Provider)
      console.log('Registered iPay88 provider for MY')
    } catch (error) {
      console.error('Failed to register iPay88 provider:', error)
    }
  }

  private async registerTouchNGoDirectProvider(providerConfig: any): Promise<void> {
    const config = await this.configManager.getProviderConfig('touchngo_direct', 'MY')
    if (!config) return

    try {
      const touchngoProvider = new TouchNGoDirectProvider({
        ...providerConfig,
        touchngoConfig: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          merchantId: config.merchantId,
          apiKey: config.apiKey,
          apiUrl: config.apiUrl || (providerConfig.testMode 
            ? 'https://sandbox-api.touchngo.com.my' 
            : 'https://api.touchngo.com.my'),
          environment: providerConfig.testMode ? 'sandbox' : 'production',
          webhookUrl: config.webhookUrl,
          redirectUrl: config.redirectUrl,
          version: config.version || '1.0'
        }
      })

      this.orchestrator.registerProvider(touchngoProvider)
      console.log('Registered TouchNGo Direct provider for MY')
    } catch (error) {
      console.error('Failed to register TouchNGo Direct provider:', error)
    }
  }

  private async registerNewebPayProvider(providerConfig: any): Promise<void> {
    const config = await this.configManager.getProviderConfig('newebpay', 'TW')
    if (!config) return

    try {
      const newebpayProvider = new NewebPayProvider({
        ...providerConfig,
        newebpayConfig: {
          merchantId: config.merchantId,
          hashKey: config.hashKey,
          hashIV: config.hashIV,
          paymentUrl: config.paymentUrl || 'https://ccore.newebpay.com/MPG/mpg_gateway',
          queryUrl: config.queryUrl || 'https://ccore.newebpay.com/API/QueryTradeInfo',
          version: config.version || '2.0',
          notifyUrl: config.notifyUrl,
          returnUrl: config.returnUrl,
          email: config.email,
          loginType: config.loginType || 0,
          testMode: providerConfig.testMode,
          clientBackUrl: config.clientBackUrl || config.returnUrl,
          paymentTimeout: config.paymentTimeout || 1800
        }
      })

      this.orchestrator.registerProvider(newebpayProvider)
      console.log('Registered NewebPay provider for TW')
    } catch (error) {
      console.error('Failed to register NewebPay provider:', error)
    }
  }

  private async registerLinePayProvider(providerConfig: any): Promise<void> {
    const config = await this.configManager.getProviderConfig('linepay', 'TW')
    if (!config) return

    try {
      const linepayProvider = new LinePayProvider({
        ...providerConfig,
        linepayConfig: {
          channelId: config.channelId,
          channelSecret: config.channelSecret,
          merchantId: config.merchantId,
          apiUrl: config.apiUrl || 'https://sandbox-api-pay.line.me',
          version: config.version || 'v3',
          environment: config.environment || 'SANDBOX',
          confirmUrl: config.confirmUrl,
          cancelUrl: config.cancelUrl,
          locale: config.locale || 'zh_TW',
          currency: config.currency || 'TWD'
        }
      })

      this.orchestrator.registerProvider(linepayProvider)
      console.log('Registered LINE Pay provider for TW')
    } catch (error) {
      console.error('Failed to register LINE Pay provider:', error)
    }
  }

  private async registerUniPayProvider(providerConfig: any): Promise<void> {
    const config = await this.configManager.getProviderConfig('unipay', 'TW')
    if (!config) return

    try {
      const unipayProvider = new UniPayProvider({
        ...providerConfig,
        unipayConfig: {
          merchantId: config.merchantId,
          hashKey: config.hashKey,
          hashIV: config.hashIV,
          paymentUrl: config.paymentUrl || 'https://payment.unipay.com.tw/UniPay/CheckOut',
          queryUrl: config.queryUrl || 'https://payment.unipay.com.tw/UniPay/QueryTradeInfo',
          version: config.version || '1.0',
          notifyUrl: config.notifyUrl,
          returnUrl: config.returnUrl,
          testMode: providerConfig.testMode,
          clientBackUrl: config.clientBackUrl || config.returnUrl,
          paymentTimeout: config.paymentTimeout || 1800,
          itemName: config.itemName || 'MakanMakan Order'
        }
      })

      this.orchestrator.registerProvider(unipayProvider)
      console.log('Registered UniPay provider for TW')
    } catch (error) {
      console.error('Failed to register UniPay provider:', error)
    }
  }

  private async registerVNPayProvider(providerConfig: any): Promise<void> {
    const config = await this.configManager.getProviderConfig('vnpay', 'VN')
    if (!config) return

    try {
      const vnpayProvider = new VNPayProvider({
        ...providerConfig,
        vnpayConfig: {
          tmnCode: config.tmnCode,
          hashSecret: config.hashSecret,
          paymentUrl: config.paymentUrl || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
          returnUrl: config.returnUrl,
          ipnUrl: config.ipnUrl,
          version: config.version || '2.1.0',
          command: config.command || 'pay',
          orderType: config.orderType || 'other',
          locale: config.locale || 'vn',
          currCode: config.currCode || 'VND',
          timeZone: config.timeZone || '+07:00'
        }
      })

      this.orchestrator.registerProvider(vnpayProvider)
      console.log('Registered VNPay provider for VN')
    } catch (error) {
      console.error('Failed to register VNPay provider:', error)
    }
  }

  private getCurrencyForCountry(country: string): string {
    const currencyMap: Record<string, string> = {
      'TW': 'TWD',
      'MY': 'MYR',
      'VN': 'VND'
    }
    return currencyMap[country] || 'USD'
  }

  // =============================================
  // 支付處理
  // =============================================

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // 生成內部交易 ID
      const transactionId = this.generateTransactionId()
      
      // 記錄交易開始
      await this.createPaymentTransaction({
        transactionId,
        orderId: request.orderId,
        restaurantId: request.restaurantId,
        method: request.method,
        amount: request.amount,
        currency: request.currency,
        country: request.country,
        customerInfo: request.customerInfo,
        status: 'pending'
      })

      // 處理支付
      const result = await this.orchestrator.processPayment(request)

      // 更新交易狀態
      await this.updatePaymentTransaction(transactionId, {
        status: result.status,
        providerTransactionId: result.transactionId,
        metadata: result.metadata,
        error: result.error
      })

      return {
        ...result,
        transactionId // 返回內部交易 ID
      }

    } catch (error) {
      console.error('Payment creation failed:', error)
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        error: {
          code: 'SERVICE_ERROR',
          message: (error as Error).message
        }
      }
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      // 首先從資料庫獲取交易資訊
      const transaction = await this.getPaymentTransaction(transactionId)
      if (!transaction) {
        throw new Error('Transaction not found')
      }

      // 如果交易已經是最終狀態，直接返回
      if (['completed', 'failed', 'cancelled', 'refunded'].includes(transaction.status)) {
        return transaction.status as PaymentStatus
      }

      // 否則從提供商查詢最新狀態
      const status = await this.orchestrator.getPaymentStatus(
        transaction.providerTransactionId || transaction.transactionId,
        transaction.providerId
      )

      // 如果狀態有變化，更新資料庫
      if (status !== transaction.status) {
        await this.updatePaymentTransaction(transactionId, { status })
      }

      return status
    } catch (error) {
      console.error('Failed to get payment status:', error)
      return 'pending'
    }
  }

  async refundPayment(request: RefundRequest & { transactionId: string }): Promise<RefundResult> {
    try {
      // 獲取原始交易
      const transaction = await this.getPaymentTransaction(request.transactionId)
      if (!transaction) {
        throw new Error('Original transaction not found')
      }

      if (transaction.status !== 'completed') {
        throw new Error('Cannot refund non-completed transaction')
      }

      // 建立退款交易記錄
      const refundId = this.generateRefundId()
      await this.createRefundTransaction({
        refundId,
        paymentTransactionId: request.transactionId,
        amount: request.amount || transaction.amount,
        reason: request.reason,
        status: 'pending'
      })

      // 執行退款
      const refundRequest: RefundRequest = {
        transactionId: transaction.providerTransactionId || transaction.transactionId,
        amount: request.amount,
        reason: request.reason,
        metadata: request.metadata
      }

      const result = await this.orchestrator.refundPayment(refundRequest, transaction.providerId)

      // 更新退款記錄
      await this.updateRefundTransaction(refundId, {
        status: result.status,
        providerRefundId: result.refundId,
        error: result.error
      })

      // 如果退款成功，更新原始交易狀態
      if (result.success) {
        const newStatus = (result.amount === transaction.amount) ? 'refunded' : 'partial_refunded'
        await this.updatePaymentTransaction(request.transactionId, { status: newStatus })
      }

      return result
    } catch (error) {
      console.error('Refund failed:', error)
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

  // =============================================
  // Webhook 處理
  // =============================================

  async handleWebhook(providerId: string, payload: any, signature?: string): Promise<WebhookResult> {
    try {
      // 記錄 webhook 事件
      await this.logWebhookEvent(providerId, payload, signature)

      // 處理 webhook
      const result = await this.orchestrator.handleWebhook(providerId, payload, signature)

      if (result.processed && result.transactionId && result.newStatus) {
        // 更新交易狀態
        await this.updatePaymentTransactionByProviderTxnId(
          result.transactionId,
          providerId,
          { status: result.newStatus }
        )
      }

      return result
    } catch (error) {
      console.error('Webhook handling failed:', error)
      return {
        processed: false,
        error: (error as Error).message
      }
    }
  }

  // =============================================
  // 資料庫操作
  // =============================================

  private async createPaymentTransaction(data: {
    transactionId: string
    orderId: string
    restaurantId: number
    method: string
    amount: number
    currency: string
    country: string
    customerInfo?: any
    status: string
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO payment_transactions (
        transaction_id, order_id, restaurant_id, provider_name, 
        payment_method, amount, currency, country_code, status,
        customer_name, customer_email, customer_phone, created_at
      ) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    stmt.run(
      data.transactionId,
      data.orderId,
      data.restaurantId,
      data.method,
      data.amount,
      data.currency,
      data.country,
      data.status,
      data.customerInfo?.name,
      data.customerInfo?.email,
      data.customerInfo?.phone
    )
  }

  private async updatePaymentTransaction(transactionId: string, updates: {
    status?: string
    providerId?: string
    providerTransactionId?: string
    metadata?: any
    error?: any
  }): Promise<void> {
    const setParts: string[] = []
    const values: any[] = []

    if (updates.status) {
      setParts.push('status = ?')
      values.push(updates.status)

      if (updates.status === 'completed') {
        setParts.push('completed_at = CURRENT_TIMESTAMP')
      } else if (updates.status === 'failed') {
        setParts.push('failed_at = CURRENT_TIMESTAMP')
      }
    }

    if (updates.providerId) {
      setParts.push('provider_name = ?')
      values.push(updates.providerId)
    }

    if (updates.providerTransactionId) {
      setParts.push('provider_transaction_id = ?')
      values.push(updates.providerTransactionId)
    }

    if (updates.metadata) {
      setParts.push('metadata = ?')
      values.push(JSON.stringify(updates.metadata))
    }

    if (updates.error) {
      setParts.push('error_code = ?', 'error_message = ?')
      values.push(updates.error.code, updates.error.message)
    }

    if (setParts.length === 0) return

    setParts.push('updated_at = CURRENT_TIMESTAMP')
    values.push(transactionId)

    const stmt = this.db.prepare(`
      UPDATE payment_transactions 
      SET ${setParts.join(', ')} 
      WHERE transaction_id = ?
    `)

    stmt.run(...values)
  }

  private async updatePaymentTransactionByProviderTxnId(
    providerTransactionId: string,
    providerId: string,
    updates: { status?: string }
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE payment_transactions 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE provider_transaction_id = ? AND provider_name = ?
    `)

    stmt.run(updates.status, providerTransactionId, providerId)
  }

  private async getPaymentTransaction(transactionId: string): Promise<any> {
    const stmt = this.db.prepare(`
      SELECT * FROM payment_transactions WHERE transaction_id = ?
    `)
    return stmt.get(transactionId)
  }

  private async createRefundTransaction(data: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO refund_transactions (
        refund_id, payment_transaction_id, amount, reason, status, created_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    stmt.run(
      data.refundId,
      data.paymentTransactionId,
      data.amount,
      data.reason,
      data.status
    )
  }

  private async updateRefundTransaction(refundId: string, updates: any): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE refund_transactions 
      SET status = ?, provider_refund_id = ?, error_code = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE refund_id = ?
    `)

    stmt.run(
      updates.status,
      updates.providerRefundId,
      updates.error?.code,
      updates.error?.message,
      refundId
    )
  }

  private async logWebhookEvent(providerId: string, payload: any, signature?: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO webhook_events (
        provider_name, event_type, payload, signature, created_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)

    stmt.run(
      providerId,
      payload.type || 'unknown',
      JSON.stringify(payload),
      signature
    )
  }

  // =============================================
  // 工具方法
  // =============================================

  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 9)
    return `txn_${timestamp}_${random}`
  }

  private generateRefundId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 9)
    return `ref_${timestamp}_${random}`
  }

  // =============================================
  // 管理方法
  // =============================================

  async getPaymentStatistics(
    startDate: Date,
    endDate: Date,
    countryCode?: CountryCode
  ): Promise<any> {
    let sql = `
      SELECT 
        country_code,
        provider_name,
        payment_method,
        COUNT(*) as total_transactions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_transactions,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_transactions,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_amount
      FROM payment_transactions
      WHERE created_at BETWEEN ? AND ?
    `

    const params: any[] = [startDate, endDate]

    if (countryCode) {
      sql += ' AND country_code = ?'
      params.push(countryCode)
    }

    sql += ' GROUP BY country_code, provider_name, payment_method'

    const stmt = this.db.prepare(sql)
    return stmt.all(...params)
  }

  getConfigManager(): PaymentConfigManager {
    return this.configManager
  }
}