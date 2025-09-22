import { CountryCode, CurrencyCode } from '@makanmakan/shared-types'

export interface CurrencyConfig {
  code: CurrencyCode
  symbol: string
  name: string
  decimalPlaces: number
  stripeMultiplier: number       // Stripe 最小單位轉換 (如 MYR 需要 * 100)
  thousandSeparator: string
  decimalSeparator: string
  symbolPosition: 'before' | 'after'
  minimumAmount: number
  maximumAmount: number
}

export interface TaxConfig {
  country: CountryCode
  defaultTaxRate: number         // 預設稅率 (小數形式，如 0.05 = 5%)
  taxName: string               // 稅種名稱
  taxIncluded: boolean          // 預設是否含稅
  taxDisplayName: string        // 顯示名稱
  exemptCategories: string[]    // 免稅類別
  businessTaxId?: string        // 商業稅號格式說明
}

export interface ExchangeRate {
  fromCurrency: CurrencyCode
  toCurrency: CurrencyCode
  rate: number
  timestamp: number
  source: string
}

export interface AmountBreakdown {
  subtotal: number              // 未含稅金額
  taxAmount: number             // 稅額
  totalAmount: number           // 含稅總額
  currency: CurrencyCode
  taxRate: number
  formatted: {
    subtotal: string
    taxAmount: string
    totalAmount: string
  }
}

export class StripeCurrencyManager {
  private currencyConfigs: Map<CurrencyCode, CurrencyConfig>
  private taxConfigs: Map<CountryCode, TaxConfig>
  private exchangeRates: Map<string, ExchangeRate>
  private ratesCacheExpiry: number = 3600000 // 1 小時

  constructor() {
    this.currencyConfigs = new Map()
    this.taxConfigs = new Map()
    this.exchangeRates = new Map()
    this.initializeConfigs()
  }

  private initializeConfigs(): void {
    // 初始化貨幣配置
    this.currencyConfigs.set('TWD', {
      code: 'TWD',
      symbol: 'NT$',
      name: '新台幣',
      decimalPlaces: 0,           // 台幣通常不使用小數
      stripeMultiplier: 1,        // TWD 是零小數貨幣
      thousandSeparator: ',',
      decimalSeparator: '.',
      symbolPosition: 'before',
      minimumAmount: 1,
      maximumAmount: 1000000
    })

    this.currencyConfigs.set('MYR', {
      code: 'MYR',
      symbol: 'RM',
      name: '馬來西亞令吉',
      decimalPlaces: 2,
      stripeMultiplier: 100,      // MYR 需要轉換為分
      thousandSeparator: ',',
      decimalSeparator: '.',
      symbolPosition: 'before',
      minimumAmount: 0.5,
      maximumAmount: 50000
    })

    this.currencyConfigs.set('VND', {
      code: 'VND',
      symbol: '₫',
      name: '越南盾',
      decimalPlaces: 0,           // 越南盾不使用小數
      stripeMultiplier: 1,        // VND 是零小數貨幣
      thousandSeparator: '.',     // 越南使用點作為千位分隔符
      decimalSeparator: ',',
      symbolPosition: 'after',
      minimumAmount: 10000,
      maximumAmount: 50000000
    })

    // 初始化稅務配置
    this.taxConfigs.set('TW', {
      country: 'TW',
      defaultTaxRate: 0.05,       // 5% 營業稅
      taxName: 'VAT',
      taxIncluded: false,         // 台灣通常標示未稅價格
      taxDisplayName: '營業稅',
      exemptCategories: ['medical', 'education'],
      businessTaxId: '統一編號 (8 位數字)'
    })

    this.taxConfigs.set('MY', {
      country: 'MY',
      defaultTaxRate: 0.0,        // 馬來西亞目前無 GST
      taxName: 'SST',
      taxIncluded: true,          // 通常已含在價格中
      taxDisplayName: '銷售稅',
      exemptCategories: ['basic_food', 'medical'],
      businessTaxId: 'SST 註冊號碼'
    })

    this.taxConfigs.set('VN', {
      country: 'VN',
      defaultTaxRate: 0.1,        // 10% VAT
      taxName: 'VAT',
      taxIncluded: true,          // 越南通常含稅定價
      taxDisplayName: '增值稅',
      exemptCategories: ['export', 'agriculture'],
      businessTaxId: '稅務識別號 (MST)'
    })
  }

  // =============================================
  // 金額計算和轉換
  // =============================================

  /**
   * 計算含稅和未含稅金額明細
   */
  calculateAmountBreakdown(
    amount: number,
    currency: CurrencyCode,
    country: CountryCode,
    isTaxInclusive: boolean = false,
    taxRate?: number
  ): AmountBreakdown {
    const currencyConfig = this.getCurrencyConfig(currency)
    const taxConfig = this.getTaxConfig(country)
    const effectiveTaxRate = taxRate ?? taxConfig.defaultTaxRate

    let subtotal: number
    let taxAmount: number
    let totalAmount: number

    if (isTaxInclusive) {
      // 金額已含稅，需要分離出稅額
      totalAmount = amount
      subtotal = amount / (1 + effectiveTaxRate)
      taxAmount = amount - subtotal
    } else {
      // 金額未含稅，需要加上稅額
      subtotal = amount
      taxAmount = amount * effectiveTaxRate
      totalAmount = amount + taxAmount
    }

    // 根據貨幣精度進行四捨五入
    subtotal = this.roundToDecimalPlaces(subtotal, currencyConfig.decimalPlaces)
    taxAmount = this.roundToDecimalPlaces(taxAmount, currencyConfig.decimalPlaces)
    totalAmount = this.roundToDecimalPlaces(totalAmount, currencyConfig.decimalPlaces)

    return {
      subtotal,
      taxAmount,
      totalAmount,
      currency,
      taxRate: effectiveTaxRate,
      formatted: {
        subtotal: this.formatAmount(subtotal, currency),
        taxAmount: this.formatAmount(taxAmount, currency),
        totalAmount: this.formatAmount(totalAmount, currency)
      }
    }
  }

  /**
   * 轉換金額為 Stripe 格式 (最小貨幣單位)
   */
  convertToStripeAmount(amount: number, currency: CurrencyCode): number {
    const config = this.getCurrencyConfig(currency)
    return Math.round(amount * config.stripeMultiplier)
  }

  /**
   * 從 Stripe 格式轉換為標準金額
   */
  convertFromStripeAmount(stripeAmount: number, currency: CurrencyCode): number {
    const config = this.getCurrencyConfig(currency)
    return stripeAmount / config.stripeMultiplier
  }

  /**
   * 格式化金額為本地化字串
   */
  formatAmount(amount: number, currency: CurrencyCode, options?: {
    showSymbol?: boolean
    showDecimals?: boolean
  }): string {
    const config = this.getCurrencyConfig(currency)
    const showSymbol = options?.showSymbol ?? true
    const showDecimals = options?.showDecimals ?? config.decimalPlaces > 0

    // 四捨五入到指定小數位
    const roundedAmount = this.roundToDecimalPlaces(amount, config.decimalPlaces)

    // 分離整數和小數部分
    const parts = roundedAmount.toString().split('.')
    let integerPart = parts[0]
    const decimalPart = parts[1] || ''

    // 添加千位分隔符
    integerPart = this.addThousandSeparators(integerPart, config.thousandSeparator)

    // 組合數字字串
    let numberStr = integerPart
    if (showDecimals && config.decimalPlaces > 0) {
      const paddedDecimals = decimalPart.padEnd(config.decimalPlaces, '0')
      numberStr += config.decimalSeparator + paddedDecimals
    }

    // 添加貨幣符號
    if (showSymbol) {
      if (config.symbolPosition === 'before') {
        return `${config.symbol} ${numberStr}`
      } else {
        return `${numberStr} ${config.symbol}`
      }
    }

    return numberStr
  }

  // =============================================
  // 匯率管理
  // =============================================

  /**
   * 設置匯率 (通常從外部 API 獲取)
   */
  setExchangeRate(
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
    rate: number,
    source: string = 'manual'
  ): void {
    const key = `${fromCurrency}_${toCurrency}`
    this.exchangeRates.set(key, {
      fromCurrency,
      toCurrency,
      rate,
      timestamp: Date.now(),
      source
    })

    // 同時設置反向匯率
    const reverseKey = `${toCurrency}_${fromCurrency}`
    this.exchangeRates.set(reverseKey, {
      fromCurrency: toCurrency,
      toCurrency: fromCurrency,
      rate: 1 / rate,
      timestamp: Date.now(),
      source
    })
  }

  /**
   * 獲取匯率
   */
  getExchangeRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): number | null {
    if (fromCurrency === toCurrency) return 1

    const key = `${fromCurrency}_${toCurrency}`
    const exchangeRate = this.exchangeRates.get(key)

    if (!exchangeRate) return null

    // 檢查匯率是否過期
    const now = Date.now()
    if (now - exchangeRate.timestamp > this.ratesCacheExpiry) {
      console.warn(`Exchange rate ${key} is stale, consider updating`)
    }

    return exchangeRate.rate
  }

  /**
   * 轉換金額到另一種貨幣
   */
  convertCurrency(
    amount: number,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ): number | null {
    if (fromCurrency === toCurrency) return amount

    const rate = this.getExchangeRate(fromCurrency, toCurrency)
    if (rate === null) return null

    const convertedAmount = amount * rate
    const toCurrencyConfig = this.getCurrencyConfig(toCurrency)
    
    return this.roundToDecimalPlaces(convertedAmount, toCurrencyConfig.decimalPlaces)
  }

  /**
   * 批量更新匯率 (從外部 API)
   */
  async updateExchangeRatesFromAPI(apiUrl?: string): Promise<boolean> {
    try {
      // 這裡應該調用真實的匯率 API
      // 示例使用固定匯率
      const rates = await this.fetchExchangeRates(apiUrl)
      
      for (const rate of rates) {
        this.setExchangeRate(
          rate.fromCurrency,
          rate.toCurrency,
          rate.rate,
          'api'
        )
      }

      console.log('Exchange rates updated successfully')
      return true
    } catch (error) {
      console.error('Failed to update exchange rates:', error)
      return false
    }
  }

  /**
   * 從 API 獲取匯率 (示例實作)
   */
  private async fetchExchangeRates(_apiUrl?: string): Promise<ExchangeRate[]> {
    // 示例：返回固定匯率
    // 實際應該調用真實的匯率 API，如 exchangerate-api.com
    return [
      { fromCurrency: 'TWD', toCurrency: 'MYR', rate: 0.15, timestamp: Date.now(), source: 'api' },
      { fromCurrency: 'TWD', toCurrency: 'VND', rate: 774, timestamp: Date.now(), source: 'api' },
      { fromCurrency: 'MYR', toCurrency: 'VND', rate: 5160, timestamp: Date.now(), source: 'api' }
    ]
  }

  // =============================================
  // 配置管理
  // =============================================

  getCurrencyConfig(currency: CurrencyCode): CurrencyConfig {
    const config = this.currencyConfigs.get(currency)
    if (!config) {
      throw new Error(`Currency configuration not found: ${currency}`)
    }
    return config
  }

  getTaxConfig(country: CountryCode): TaxConfig {
    const config = this.taxConfigs.get(country)
    if (!config) {
      throw new Error(`Tax configuration not found: ${country}`)
    }
    return config
  }

  /**
   * 獲取國家支援的貨幣
   */
  getSupportedCurrency(country: CountryCode): CurrencyCode {
    const currencyMap: Record<CountryCode, CurrencyCode> = {
      TW: 'TWD',
      MY: 'MYR',
      VN: 'VND'
    }
    return currencyMap[country]
  }

  /**
   * 驗證金額是否在允許範圍內
   */
  validateAmount(amount: number, currency: CurrencyCode): {
    valid: boolean
    error?: string
  } {
    const config = this.getCurrencyConfig(currency)

    if (amount < config.minimumAmount) {
      return {
        valid: false,
        error: `Amount too small. Minimum: ${this.formatAmount(config.minimumAmount, currency)}`
      }
    }

    if (amount > config.maximumAmount) {
      return {
        valid: false,
        error: `Amount too large. Maximum: ${this.formatAmount(config.maximumAmount, currency)}`
      }
    }

    return { valid: true }
  }

  // =============================================
  // 工具方法
  // =============================================

  private roundToDecimalPlaces(amount: number, decimalPlaces: number): number {
    const factor = Math.pow(10, decimalPlaces)
    return Math.round(amount * factor) / factor
  }

  private addThousandSeparators(numberStr: string, separator: string): string {
    return numberStr.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
  }

  /**
   * 獲取所有支援的貨幣
   */
  getSupportedCurrencies(): CurrencyCode[] {
    return Array.from(this.currencyConfigs.keys())
  }

  /**
   * 獲取所有支援的國家
   */
  getSupportedCountries(): CountryCode[] {
    return Array.from(this.taxConfigs.keys())
  }

  /**
   * 計算平台手續費
   */
  calculatePlatformFee(
    amount: number,
    currency: CurrencyCode,
    feeRate: number
  ): {
    feeAmount: number
    merchantAmount: number
    formatted: {
      feeAmount: string
      merchantAmount: string
    }
  } {
    const config = this.getCurrencyConfig(currency)
    const feeAmount = this.roundToDecimalPlaces(amount * feeRate, config.decimalPlaces)
    const merchantAmount = this.roundToDecimalPlaces(amount - feeAmount, config.decimalPlaces)

    return {
      feeAmount,
      merchantAmount,
      formatted: {
        feeAmount: this.formatAmount(feeAmount, currency),
        merchantAmount: this.formatAmount(merchantAmount, currency)
      }
    }
  }

  /**
   * 生成金額摘要 (用於顯示)
   */
  generateAmountSummary(
    amount: number,
    currency: CurrencyCode,
    country: CountryCode,
    options?: {
      includeTax?: boolean
      platformFeeRate?: number
      discountAmount?: number
    }
  ): {
    original: AmountBreakdown
    platformFee?: ReturnType<typeof this.calculatePlatformFee>
    discount?: number
    final: AmountBreakdown
  } {
    const includeTax = options?.includeTax ?? true
    const taxConfig = this.getTaxConfig(country)

    // 原始金額計算
    const original = this.calculateAmountBreakdown(
      amount,
      currency,
      country,
      taxConfig.taxIncluded,
      includeTax ? taxConfig.defaultTaxRate : 0
    )

    let finalAmount = original.totalAmount

    // 計算平台手續費
    let platformFee: ReturnType<typeof this.calculatePlatformFee> | undefined
    if (options?.platformFeeRate) {
      platformFee = this.calculatePlatformFee(
        original.totalAmount,
        currency,
        options.platformFeeRate
      )
      finalAmount = platformFee.merchantAmount
    }

    // 應用折扣
    if (options?.discountAmount) {
      finalAmount = Math.max(0, finalAmount - options.discountAmount)
    }

    // 最終金額計算
    const final = finalAmount === original.totalAmount 
      ? original 
      : this.calculateAmountBreakdown(
          finalAmount,
          currency,
          country,
          true, // 最終金額視為含稅
          includeTax ? taxConfig.defaultTaxRate : 0
        )

    return {
      original,
      platformFee,
      discount: options?.discountAmount,
      final
    }
  }
}