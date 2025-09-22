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

interface UniPayConfig {
  merchantId: string
  hashKey: string
  hashIV: string
  paymentUrl: string
  queryUrl: string
  notifyUrl: string
  returnUrl: string
  version: string
  testMode: boolean
  clientBackUrl: string
  paymentTimeout: number
  itemName: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface UniPayResponse {
  MerchantID: string
  MerchantTradeNo: string
  TradeNo: string
  TradeAmt: string
  PaymentDate: string
  PaymentType: string
  RtnCode: number
  RtnMsg: string
  CheckMacValue: string
  CustomField1?: string
  CustomField2?: string
  CustomField3?: string
  CustomField4?: string
}

export class UniPayProvider extends PaymentProvider {
  readonly name = 'unipay'
  readonly displayName = '統一金流'
  readonly supportedCountries: CountryCode[] = ['TW']
  readonly supportedMethods = ['unipay', 'credit_card', 'bank_transfer', 'digital_wallet']

  private unipayConfig: UniPayConfig

  constructor(config: PaymentProviderConfig & { unipayConfig: UniPayConfig }) {
    super(config)
    this.unipayConfig = config.unipayConfig
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // 驗證國家和貨幣
      if (request.country !== 'TW' || request.currency !== 'TWD') {
        throw new Error('UniPay only supports Taiwan (TW) and TWD currency')
      }

      // 生成商家訂單編號
      const merchantTradeNo = this.generateMerchantTradeNo(request.orderId)
      
      // 準備統一金流參數
      const unipayParams = {
        MerchantID: this.unipayConfig.merchantId,
        MerchantTradeNo: merchantTradeNo,
        MerchantTradeDate: this.formatDate(new Date()),
        PaymentType: 'aio',
        TotalAmount: Math.round(request.amount).toString(),
        TradeDesc: `Order ${request.orderId}`,
        ItemName: this.unipayConfig.itemName || `Restaurant ${request.restaurantId} Order`,
        ReturnURL: this.unipayConfig.notifyUrl,
        ChoosePayment: this.mapPaymentMethod(request.method),
        ClientBackURL: request.returnUrl || this.unipayConfig.clientBackUrl,
        ItemURL: '',
        Remark: '',
        ChooseSubPayment: '',
        OrderResultURL: '',
        NeedExtraPaidInfo: 'N',
        DeviceSource: '',
        IgnorePayment: '',
        PlatformID: '',
        InvoiceMark: 'N',
        CustomField1: request.restaurantId.toString(),
        CustomField2: request.orderId,
        CustomField3: request.customerInfo?.name || '',
        CustomField4: request.customerInfo?.email || '',
        EncryptType: 1
      }

      // 生成檢查碼
      const checkMacValue = this.generateCheckMacValue(unipayParams)
      unipayParams['CheckMacValue'] = checkMacValue

      // 準備表單 HTML
      const formHtml = this.generateFormHtml(unipayParams)

      return {
        success: true,
        transactionId: merchantTradeNo,
        status: 'pending',
        redirectUrl: this.unipayConfig.paymentUrl,
        metadata: {
          formHtml,
          unipayParams,
          provider: 'unipay'
        }
      }

    } catch (error) {
      console.error('UniPay payment creation failed:', error)
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        error: {
          code: 'UNIPAY_ERROR',
          message: (error as Error).message
        }
      }
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const queryParams = {
        MerchantID: this.unipayConfig.merchantId,
        MerchantTradeNo: transactionId,
        TimeStamp: Math.floor(Date.now() / 1000).toString()
      }

      const checkMacValue = this.generateCheckMacValue(queryParams)
      queryParams['CheckMacValue'] = checkMacValue

      // 發送查詢請求到統一金流
      const response = await fetch(this.unipayConfig.queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(queryParams).toString()
      })

      const result = await response.text()
      
      // 解析統一金流回應（通常是 URL encoded 格式）
      const params = new URLSearchParams(result)
      const rtnCode = params.get('RtnCode')
      const paymentDate = params.get('PaymentDate')

      if (rtnCode === '1' && paymentDate) {
        return 'completed'
      } else if (rtnCode === '0') {
        return 'failed'
      }
      
      return 'pending'

    } catch (error) {
      console.error('Failed to query UniPay payment status:', error)
      return 'pending'
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    // 統一金流的退款通常需要通過後台管理介面或專門的 API
    return {
      success: false,
      refundId: '',
      amount: request.amount || 0,
      status: 'failed',
      error: {
        code: 'REFUND_NOT_SUPPORTED',
        message: 'UniPay refunds must be processed through merchant backend'
      }
    }
  }

  async handleWebhook(payload: any, _signature?: string): Promise<WebhookResult> {
    try {
      // 統一金流會以 POST 表單格式發送通知
      const params = typeof payload === 'string' 
        ? new URLSearchParams(payload)
        : new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v)]))

      const receivedCheckMac = params.get('CheckMacValue')
      if (!receivedCheckMac) {
        throw new Error('Missing CheckMacValue in UniPay notification')
      }

      // 移除 CheckMacValue 後重新計算
      const paramObj: Record<string, any> = {}
      params.forEach((value, key) => {
        if (key !== 'CheckMacValue') {
          paramObj[key] = value
        }
      })

      // 驗證檢查碼
      const expectedCheckMac = this.generateCheckMacValue(paramObj)
      if (receivedCheckMac !== expectedCheckMac) {
        throw new Error('Invalid CheckMacValue in UniPay notification')
      }

      // 解析支付結果
      const rtnCode = params.get('RtnCode')
      const merchantTradeNo = params.get('MerchantTradeNo')
      const tradeNo = params.get('TradeNo')
      
      let newStatus: PaymentStatus = 'pending'
      if (rtnCode === '1') {
        newStatus = 'completed'
      } else if (rtnCode === '0') {
        newStatus = 'failed'
      }

      return {
        processed: true,
        transactionId: merchantTradeNo || '',
        newStatus,
        shouldUpdateOrder: newStatus === 'completed',
        metadata: {
          unipayTradeNo: tradeNo,
          paymentDate: params.get('PaymentDate'),
          paymentType: params.get('PaymentType'),
          customField1: params.get('CustomField1'),
          customField2: params.get('CustomField2'),
          customField3: params.get('CustomField3'),
          customField4: params.get('CustomField4')
        }
      }

    } catch (error) {
      console.error('UniPay webhook processing error:', error)
      return {
        processed: false,
        error: (error as Error).message
      }
    }
  }

  validateConfig(): boolean {
    try {
      const required = ['merchantId', 'hashKey', 'hashIV', 'paymentUrl', 'notifyUrl']
      for (const key of required) {
        if (!this.unipayConfig[key as keyof UniPayConfig]) {
          console.error(`Missing required UniPay config: ${key}`)
          return false
        }
      }

      // 檢查商家 ID 格式
      if (!/^\d{7}$/.test(this.unipayConfig.merchantId)) {
        console.error('Invalid UniPay Merchant ID format (should be 7 digits)')
        return false
      }

      return true
    } catch (error) {
      console.error('UniPay config validation error:', error)
      return false
    }
  }

  // =============================================
  // 私有方法
  // =============================================

  private generateMerchantTradeNo(orderId: string): string {
    // 統一金流要求：英數字，長度20字元內
    const timestamp = Date.now().toString()
    const randomStr = Math.random().toString(36).substring(2, 8)
    return `UP${orderId}_${timestamp}_${randomStr}`.substring(0, 20)
  }

  private formatDate(date: Date): string {
    // 統一金流要求格式：yyyy/MM/dd HH:mm:ss
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
  }

  private mapPaymentMethod(method: string): string {
    // 統一金流支付方式對應
    const methodMap: Record<string, string> = {
      'credit_card': 'Credit',
      'bank_transfer': 'ATM',
      'digital_wallet': 'WebATM',
      'unipay': 'ALL'
    }
    
    return methodMap[method] || 'ALL'
  }

  private generateCheckMacValue(params: Record<string, any>): string {
    // 1. 參數排序（按照 key 的英文字母排序）
    const sortedKeys = Object.keys(params).sort()
    
    // 2. 組成字串，格式：key1=value1&key2=value2...
    const queryString = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&')
    
    // 3. 前後加上 HashKey 和 HashIV
    const stringToHash = `HashKey=${this.unipayConfig.hashKey}&${queryString}&HashIV=${this.unipayConfig.hashIV}`
    
    // 4. URL encode
    const encodedString = encodeURIComponent(stringToHash)
      .replace(/%20/g, '+')      // 空格轉換為 +
      .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    
    // 5. 轉小寫
    const lowerCaseString = encodedString.toLowerCase()
    
    // 6. SHA256 hash
    const hash = crypto.createHash('sha256').update(lowerCaseString).digest('hex')
    
    // 7. 轉大寫
    return hash.toUpperCase()
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
    <title>正在跳轉到統一金流支付頁面...</title>
</head>
<body>
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
        <h2>正在跳轉到支付頁面...</h2>
        <p>如果頁面沒有自動跳轉，請點擊下方按鈕</p>
        <form id="unipayForm" method="post" action="${this.unipayConfig.paymentUrl}">
        ${inputs}
            <button type="submit" style="background: #e53e3e; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
                前往統一金流付款
            </button>
        </form>
    </div>
    <script>
        // 自動提交表單
        setTimeout(function() {
            document.getElementById('unipayForm').submit();
        }, 1000);
    </script>
</body>
</html>`
  }
}