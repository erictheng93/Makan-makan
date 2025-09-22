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

interface iPay88Config {
  merchantCode: string
  merchantKey: string
  paymentUrl: string
  queryUrl: string
  responseUrl: string
  backendUrl: string
  testMode: boolean
  currency: string
  country: string
  language: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface iPay88Response {
  MerchantCode: string
  PaymentId: string
  RefNo: string
  Amount: string
  Currency: string
  Remark: string
  TransId: string
  AuthCode: string
  Status: string
  ErrDesc: string
  Signature: string
}

export class iPay88Provider extends PaymentProvider {
  readonly name = 'ipay88'
  readonly displayName = 'iPay88'
  readonly supportedCountries: CountryCode[] = ['MY']
  readonly supportedMethods = ['fpx', 'credit_card', 'touch_n_go']

  private ipay88Config: iPay88Config

  constructor(config: PaymentProviderConfig & { ipay88Config: iPay88Config }) {
    super(config)
    this.ipay88Config = config.ipay88Config
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // 驗證國家和貨幣
      if (request.country !== 'MY' || request.currency !== 'MYR') {
        throw new Error('iPay88 only supports Malaysia (MY) and MYR currency')
      }

      // 生成參考編號
      const refNo = this.generateRefNo(request.orderId)
      
      // 準備 iPay88 參數
      const amount = this.formatAmount(request.amount)
      const paymentId = this.mapPaymentMethod(request.method)
      
      const paymentParams = {
        MerchantCode: this.ipay88Config.merchantCode,
        PaymentId: paymentId,
        RefNo: refNo,
        Amount: amount,
        Currency: this.ipay88Config.currency,
        ProdDesc: `Order ${request.orderId} - Restaurant ${request.restaurantId}`,
        UserName: request.customerInfo?.name || '',
        UserEmail: request.customerInfo?.email || '',
        UserContact: request.customerInfo?.phone || '',
        Remark: '',
        Lang: this.ipay88Config.language,
        Signature: '',
        ResponseURL: this.ipay88Config.responseUrl,
        BackendURL: this.ipay88Config.backendUrl
      }

      // 生成簽名
      const signature = this.generateSignature(
        paymentParams.MerchantCode,
        paymentParams.PaymentId,
        paymentParams.RefNo,
        paymentParams.Amount,
        paymentParams.Currency
      )
      paymentParams.Signature = signature

      // 準備表單 HTML
      const formHtml = this.generateFormHtml(paymentParams)

      return {
        success: true,
        transactionId: refNo,
        status: 'pending',
        redirectUrl: this.ipay88Config.paymentUrl,
        metadata: {
          formHtml,
          ipay88Params: paymentParams,
          provider: 'ipay88'
        }
      }

    } catch (error) {
      console.error('iPay88 payment creation failed:', error)
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        error: {
          code: 'IPAY88_ERROR',
          message: (error as Error).message
        }
      }
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const queryParams = {
        MerchantCode: this.ipay88Config.merchantCode,
        RefNo: transactionId,
        Amount: '1.00' // 查詢時金額可以是任意值
      }

      const signature = this.generateQuerySignature(
        queryParams.MerchantCode,
        queryParams.RefNo,
        queryParams.Amount
      )

      const requestBody = new URLSearchParams({
        ...queryParams,
        Signature: signature
      })

      // 發送查詢請求到 iPay88
      const response = await fetch(this.ipay88Config.queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: requestBody.toString()
      })

      const result = await response.text()
      
      // 解析 iPay88 回應
      const lines = result.split('\n')
      const status = lines[0] // 第一行是狀態碼
      const amount = lines[1] // 第二行是金額
      const currency = lines[2] // 第三行是貨幣
      const _remark = lines[3] // 第四行是備註
      const _transId = lines[4] // 第五行是交易 ID
      const _authCode = lines[5] // 第六行是授權碼
      const responseSignature = lines[6] // 第七行是簽名

      // 驗證簽名
      const expectedSignature = this.generateQueryResponseSignature(
        this.ipay88Config.merchantCode,
        transactionId,
        amount,
        currency,
        status
      )

      if (responseSignature !== expectedSignature) {
        console.warn('iPay88 query response signature mismatch')
        return 'pending'
      }

      // 根據狀態碼返回支付狀態
      switch (status) {
        case '1': return 'completed' // 成功
        case '0': return 'failed' // 失敗
        case '6': return 'pending' // 等待中
        default: return 'pending'
      }

    } catch (error) {
      console.error('Failed to query iPay88 payment status:', error)
      return 'pending'
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    // iPay88 的退款通常需要通過後台管理介面手動處理
    // 或者使用專門的退款 API
    return {
      success: false,
      refundId: '',
      amount: request.amount || 0,
      status: 'failed',
      error: {
        code: 'REFUND_NOT_SUPPORTED',
        message: 'iPay88 refunds must be processed through merchant backend'
      }
    }
  }

  async handleWebhook(payload: any, _signature?: string): Promise<WebhookResult> {
    try {
      // iPay88 會以 POST 表單格式發送通知
      const params = typeof payload === 'string' 
        ? new URLSearchParams(payload)
        : new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v)]))

      const merchantCode = params.get('MerchantCode')
      const paymentId = params.get('PaymentId')
      const refNo = params.get('RefNo')
      const amount = params.get('Amount')
      const currency = params.get('Currency')
      const _remark = params.get('Remark')
      const _transId = params.get('TransId')
      const _authCode = params.get('AuthCode')
      const status = params.get('Status')
      const errDesc = params.get('ErrDesc')
      const receivedSignature = params.get('Signature')

      if (!receivedSignature || !merchantCode || !refNo || !amount || !currency || !status) {
        throw new Error('Missing required fields in iPay88 notification')
      }

      // 驗證簽名
      const expectedSignature = this.generateResponseSignature(
        merchantCode,
        paymentId || '',
        refNo,
        amount,
        currency,
        status
      )

      if (receivedSignature !== expectedSignature) {
        throw new Error('Invalid signature in iPay88 notification')
      }

      // 解析支付結果
      let newStatus: PaymentStatus = 'pending'
      switch (status) {
        case '1':
          newStatus = 'completed'
          break
        case '0':
          newStatus = 'failed'
          break
        case '6':
          newStatus = 'pending'
          break
        default:
          newStatus = 'failed'
      }

      return {
        processed: true,
        transactionId: refNo,
        newStatus,
        shouldUpdateOrder: newStatus === 'completed',
        metadata: {
          ipay88TransId: transId,
          authCode: authCode,
          paymentId: paymentId,
          errorDescription: errDesc
        }
      }

    } catch (error) {
      console.error('iPay88 webhook processing error:', error)
      return {
        processed: false,
        error: (error as Error).message
      }
    }
  }

  validateConfig(): boolean {
    try {
      const required = ['merchantCode', 'merchantKey', 'paymentUrl', 'responseUrl', 'backendUrl']
      for (const key of required) {
        if (!this.ipay88Config[key as keyof iPay88Config]) {
          console.error(`Missing required iPay88 config: ${key}`)
          return false
        }
      }

      // 檢查商家代碼格式
      if (!/^[A-Z0-9]+$/.test(this.ipay88Config.merchantCode)) {
        console.error('Invalid iPay88 Merchant Code format')
        return false
      }

      return true
    } catch (error) {
      console.error('iPay88 config validation error:', error)
      return false
    }
  }

  // =============================================
  // 私有方法
  // =============================================

  private generateRefNo(orderId: string): string {
    // iPay88 參考編號：最長20字符
    const timestamp = Date.now().toString()
    const randomStr = Math.random().toString(36).substring(2, 6)
    return `MM${orderId}_${timestamp}_${randomStr}`.substring(0, 20)
  }

  private formatAmount(amount: number): string {
    // iPay88 金額格式：保留兩位小數
    return amount.toFixed(2)
  }

  private mapPaymentMethod(method: string): string {
    // iPay88 支付方式 ID 對應
    const methodMap: Record<string, string> = {
      'fpx': '6',        // FPX (網路銀行)
      'credit_card': '2', // Credit Card
      'touch_n_go': '161' // Touch 'n Go eWallet
    }
    
    return methodMap[method] || '6' // 預設 FPX
  }

  private generateSignature(
    merchantCode: string,
    paymentId: string,
    refNo: string,
    amount: string,
    currency: string
  ): string {
    // iPay88 簽名格式：MerchantKey + MerchantCode + PaymentId + RefNo + Amount + Currency
    const signatureString = this.ipay88Config.merchantKey + merchantCode + paymentId + refNo + amount + currency
    
    return crypto
      .createHash('sha256')
      .update(signatureString, 'utf8')
      .digest('hex')
  }

  private generateQuerySignature(
    merchantCode: string,
    refNo: string,
    amount: string
  ): string {
    // 查詢簽名格式：MerchantKey + MerchantCode + RefNo + Amount
    const signatureString = this.ipay88Config.merchantKey + merchantCode + refNo + amount
    
    return crypto
      .createHash('sha256')
      .update(signatureString, 'utf8')
      .digest('hex')
  }

  private generateQueryResponseSignature(
    merchantCode: string,
    refNo: string,
    amount: string,
    currency: string,
    status: string
  ): string {
    // 查詢回應簽名格式：MerchantKey + MerchantCode + RefNo + Amount + Currency + Status
    const signatureString = this.ipay88Config.merchantKey + merchantCode + refNo + amount + currency + status
    
    return crypto
      .createHash('sha256')
      .update(signatureString, 'utf8')
      .digest('hex')
  }

  private generateResponseSignature(
    merchantCode: string,
    paymentId: string,
    refNo: string,
    amount: string,
    currency: string,
    status: string
  ): string {
    // 回應簽名格式：MerchantKey + MerchantCode + PaymentId + RefNo + Amount + Currency + Status
    const signatureString = this.ipay88Config.merchantKey + merchantCode + paymentId + refNo + amount + currency + status
    
    return crypto
      .createHash('sha256')
      .update(signatureString, 'utf8')
      .digest('hex')
  }

  private generateFormHtml(params: Record<string, any>): string {
    const inputs = Object.entries(params)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}">`)
      .join('\n        ')

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Redirecting to iPay88...</title>
</head>
<body>
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
        <h2>Redirecting to Payment Page...</h2>
        <p>If the page doesn't redirect automatically, please click the button below</p>
        <form id="ipay88Form" method="post" action="${this.ipay88Config.paymentUrl}">
        ${inputs}
            <button type="submit" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                Proceed to Payment
            </button>
        </form>
    </div>
    <script>
        // Auto-submit form
        setTimeout(function() {
            document.getElementById('ipay88Form').submit();
        }, 1000);
    </script>
</body>
</html>`
  }
}