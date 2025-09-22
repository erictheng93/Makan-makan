/**
 * 多國收據格式化引擎
 * 根據國家法規和文化要求格式化收據內容
 */

import type {
  PrintContent,
  PrintRequest,
  CountryCode,
  CurrencyCode,
  RegionConfig,
  ReceiptTemplate,
  RestaurantInfo,
  TransactionInfo,
  ReceiptItem,
  ReceiptSummary,
  ReceiptFooter
} from '@makanmakan/shared-types'

// =============================================
// 地區特定格式化器
// =============================================

export abstract class RegionReceiptFormatter {
  protected region: RegionConfig
  protected template: ReceiptTemplate

  constructor(region: RegionConfig, template: ReceiptTemplate) {
    this.region = region
    this.template = template
  }

  abstract formatReceipt(request: PrintRequest): PrintContent
  abstract formatHeader(restaurant: any, transaction: any): PrintContent['header']
  abstract formatItems(items: any[]): PrintContent['items']
  abstract formatSummary(order: any, payment?: any): PrintContent['summary']
  abstract formatFooter(restaurant: any, order: any): PrintContent['footer']

  // 通用格式化方法
  protected formatCurrency(amount: number): string {
    const formatter = new Intl.NumberFormat(this.region.locale, {
      style: 'currency',
      currency: this.region.currency,
      minimumFractionDigits: this.getCurrencyDecimals()
    })
    return formatter.format(amount)
  }

  protected formatDate(date: Date): string {
    return new Intl.DateTimeFormat(this.region.locale, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: this.region.timezone
    }).format(date)
  }

  protected formatNumber(number: number): string {
    return new Intl.NumberFormat(this.region.locale).format(number)
  }

  private getCurrencyDecimals(): number {
    const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'TWD']
    return noDecimalCurrencies.includes(this.region.currency) ? 0 : 2
  }

  protected truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
  }

  protected calculateTax(subtotal: number, taxRate: number, inclusive: boolean = false): number {
    if (inclusive) {
      // 含稅價格計算稅額
      return subtotal * (taxRate / (1 + taxRate))
    } else {
      // 未稅價格計算稅額
      return subtotal * taxRate
    }
  }
}

// =============================================
// 台灣格式化器
// =============================================

export class TaiwanReceiptFormatter extends RegionReceiptFormatter {
  formatReceipt(request: PrintRequest): PrintContent {
    const { order, customer, payment } = request.data
    const restaurant = this.getRestaurantInfo(request.restaurantId)

    return {
      header: this.formatHeader(restaurant, {
        orderId: order.id,
        tableNumber: order.tableNumber,
        customerName: customer?.name,
        cashier: 'System', // 從請求中獲取
        timestamp: order.createdAt,
        receiptNumber: this.generateReceiptNumber(order.id)
      }),
      items: this.formatItems(order.items),
      summary: this.formatSummary(order, payment),
      footer: this.formatFooter(restaurant, order)
    }
  }

  formatHeader(restaurant: any, transaction: any): PrintContent['header'] {
    return {
      restaurantInfo: {
        name: restaurant.name,
        // nameLocal: restaurant.nameLocal || restaurant.name,
        address: restaurant.address,
        addressLocal: restaurant.addressLocal,
        phone: restaurant.phone,
        taxNumber: restaurant.taxNumber || '12345678', // 統編
        licenseNumber: restaurant.licenseNumber
      },
      transactionInfo: {
        orderId: transaction.orderId,
        tableNumber: transaction.tableNumber,
        customerName: transaction.customerName,
        cashier: transaction.cashier,
        timestamp: transaction.timestamp,
        receiptNumber: transaction.receiptNumber
      },
      logo: restaurant.logo ? {
        type: 'text',
        data: restaurant.logo,
        alignment: 'center'
      } : undefined
    }
  }

  formatItems(items: any[]): PrintContent['items'] {
    return items.map(item => ({
      name: item.name,
      // nameLocal: item.nameLocal,
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
      modifiers: item.modifiers?.map((mod: any) => ({
        name: mod.name,
        // nameLocal: mod.nameLocal,
        price: mod.price
      })),
      category: item.category,
      sku: item.sku,
      taxRate: 0.05 // 台灣營業稅 5%
    }))
  }

  formatSummary(order: any, payment?: any): PrintContent['summary'] {
    const subtotal = order.subtotal || order.total / 1.05 // 如果沒有小計，從含稅總額推算
    const taxAmount = this.calculateTax(subtotal, 0.05, false)

    const summary: PrintContent['summary'] = {
      subtotal,
      tax: [{
        name: 'Tax',
        // nameLocal: '營業稅',
        rate: 0.05,
        amount: taxAmount,
        taxableAmount: subtotal
      }],
      total: order.total,
      payment: payment ? [{
        method: this.translatePaymentMethod(payment.method),
        amount: payment.amount,
        details: payment.cardLast4 ? `**** ${payment.cardLast4}` : undefined
      }] : []
    }

    // 服務費 (如果有)
    if (order.serviceCharge) {
      summary.serviceCharge = {
        name: '服務費',
        rate: 0.1, // 10% 服務費
        amount: order.serviceCharge
      }
    }

    // 找零
    if (payment?.change && payment.change > 0) {
      summary.change = payment.change
    }

    return summary
  }

  formatFooter(restaurant: any, order: any): PrintContent['footer'] {
    return {
      thankYouMessage: 'Thank you for your visit!',
      thankYouMessageLocal: '謝謝光臨！',
      promotionalMessage: restaurant.promotionalMessage,
      qrCode: {
        data: `https://makanmakan.com/receipt/${order.id}`,
        size: 'medium',
        label: '數位收據'
      },
      contactInfo: {
        supportPhone: restaurant.supportPhone || '+886-2-1234-5678',
        supportEmail: restaurant.supportEmail || 'support@makanmakan.com',
        website: 'https://makanmakan.com'
      },
      legalNotice: '本收據為電腦統一發票，請妥善保管'
    }
  }

  private generateReceiptNumber(orderId: string): string {
    // 台灣發票號碼格式: 英文字母2碼 + 數字8碼
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const prefix = letters[Math.floor(Math.random() * 26)] + letters[Math.floor(Math.random() * 26)]
    const suffix = orderId.slice(-6).padStart(8, '0')
    return `${prefix}-${suffix}`
  }

  private translatePaymentMethod(method: string): string {
    const translations: { [key: string]: string } = {
      'cash': '現金',
      'credit_card': '信用卡',
      'debit_card': '金融卡',
      'mobile_payment': '行動支付',
      'e_wallet': '電子錢包'
    }
    return translations[method] || method
  }

  private getRestaurantInfo(restaurantId: number): any {
    // 實際實作中會從資料庫獲取
    return {
      name: 'MakanMakan Restaurant',
      // nameLocal: '好呷餐廳',
      address: '台北市信義區信義路五段7號',
      addressLocal: '台北市信義區信義路五段7號',
      phone: '02-8101-8888',
      taxNumber: '12345678',
      licenseNumber: 'A1234567890'
    }
  }
}

// =============================================
// 馬來西亞格式化器
// =============================================

export class MalaysiaReceiptFormatter extends RegionReceiptFormatter {
  formatReceipt(request: PrintRequest): PrintContent {
    const { order, customer, payment } = request.data
    const restaurant = this.getRestaurantInfo(request.restaurantId)

    return {
      header: this.formatHeader(restaurant, {
        orderId: order.id,
        tableNumber: order.tableNumber,
        customerName: customer?.name,
        cashier: 'System',
        timestamp: order.createdAt,
        receiptNumber: this.generateReceiptNumber(order.id)
      }),
      items: this.formatItems(order.items),
      summary: this.formatSummary(order, payment),
      footer: this.formatFooter(restaurant, order)
    }
  }

  formatHeader(restaurant: any, transaction: any): PrintContent['header'] {
    return {
      restaurantInfo: {
        name: restaurant.name,
        // nameLocal: restaurant.nameLocal, // 馬來文名稱
        address: restaurant.address,
        addressLocal: restaurant.addressLocal,
        phone: restaurant.phone,
        licenseNumber: restaurant.licenseNumber // 公司註冊號碼
      },
      transactionInfo: {
        orderId: transaction.orderId,
        tableNumber: transaction.tableNumber,
        customerName: transaction.customerName,
        cashier: transaction.cashier,
        timestamp: transaction.timestamp,
        receiptNumber: transaction.receiptNumber
      }
    }
  }

  formatItems(items: any[]): PrintContent['items'] {
    return items.map(item => ({
      name: item.name,
      // nameLocal: item.nameLocal, // 馬來文名稱
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
      modifiers: item.modifiers?.map((mod: any) => ({
        name: mod.name,
        // nameLocal: mod.nameLocal,
        price: mod.price
      }))
    }))
  }

  formatSummary(order: any, payment?: any): PrintContent['summary'] {
    const subtotal = order.subtotal || order.total / 1.06 // 假設含 6% SST
    const sstAmount = this.calculateTax(subtotal, 0.06, false)

    const summary: PrintContent['summary'] = {
      subtotal,
      tax: [{
        name: 'SST',
        // nameLocal: 'SST',
        rate: 0.06,
        amount: sstAmount,
        taxableAmount: subtotal
      }],
      total: order.total,
      payment: payment ? [{
        method: this.translatePaymentMethod(payment.method),
        amount: payment.amount,
        details: payment.cardLast4 ? `**** ${payment.cardLast4}` : undefined
      }] : []
    }

    if (payment?.change && payment.change > 0) {
      summary.change = payment.change
    }

    return summary
  }

  formatFooter(restaurant: any, order: any): PrintContent['footer'] {
    return {
      thankYouMessage: 'Thank you for dining with us!',
      thankYouMessageLocal: 'Terima kasih kerana makan bersama kami!',
      qrCode: {
        data: `https://makanmakan.com/receipt/${order.id}`,
        size: 'medium',
        label: 'Digital Receipt / Resit Digital'
      },
      contactInfo: {
        supportPhone: restaurant.supportPhone || '+60-3-1234-5678',
        website: 'https://makanmakan.my'
      },
      legalNotice: 'GST/SST No: 000123456789 | Company No: 123456-A'
    }
  }

  private generateReceiptNumber(orderId: string): string {
    return `MY${Date.now().toString().slice(-8)}`
  }

  private translatePaymentMethod(method: string): string {
    const translations: { [key: string]: string } = {
      'cash': 'Tunai / Cash',
      'credit_card': 'Kad Kredit / Credit Card',
      'debit_card': 'Kad Debit / Debit Card',
      'grabpay': 'GrabPay',
      'tng': 'Touch \'n Go eWallet'
    }
    return translations[method] || method
  }

  private getRestaurantInfo(restaurantId: number): any {
    return {
      name: 'MakanMakan Restaurant',
      // nameLocal: 'Restoran MakanMakan',
      address: 'Lot 1-01, Jalan Bukit Bintang, 55100 Kuala Lumpur',
      addressLocal: 'Lot 1-01, Jalan Bukit Bintang, 55100 Kuala Lumpur',
      phone: '+60-3-2141-8888',
      licenseNumber: '123456-A'
    }
  }
}

// =============================================
// 越南格式化器
// =============================================

export class VietnamReceiptFormatter extends RegionReceiptFormatter {
  formatReceipt(request: PrintRequest): PrintContent {
    const { order, customer, payment } = request.data
    const restaurant = this.getRestaurantInfo(request.restaurantId)

    return {
      header: this.formatHeader(restaurant, {
        orderId: order.id,
        tableNumber: order.tableNumber,
        customerName: customer?.name,
        cashier: 'System',
        timestamp: order.createdAt,
        receiptNumber: this.generateReceiptNumber(order.id)
      }),
      items: this.formatItems(order.items),
      summary: this.formatSummary(order, payment),
      footer: this.formatFooter(restaurant, order)
    }
  }

  formatHeader(restaurant: any, transaction: any): PrintContent['header'] {
    return {
      restaurantInfo: {
        name: restaurant.name,
        // nameLocal: restaurant.nameLocal, // 越南文名稱
        address: restaurant.address,
        addressLocal: restaurant.addressLocal,
        phone: restaurant.phone,
        taxNumber: restaurant.taxNumber // 稅務登記號碼
      },
      transactionInfo: {
        orderId: transaction.orderId,
        tableNumber: transaction.tableNumber,
        customerName: transaction.customerName,
        cashier: transaction.cashier,
        timestamp: transaction.timestamp,
        receiptNumber: transaction.receiptNumber
      }
    }
  }

  formatItems(items: any[]): PrintContent['items'] {
    return items.map(item => ({
      name: item.name,
      // nameLocal: item.nameLocal, // 越南文名稱
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
      modifiers: item.modifiers?.map((mod: any) => ({
        name: mod.name,
        // nameLocal: mod.nameLocal,
        price: mod.price
      }))
    }))
  }

  formatSummary(order: any, payment?: any): PrintContent['summary'] {
    // 越南 VAT 通常是含稅價格
    const totalWithoutVAT = order.total / 1.10
    const vatAmount = order.total - totalWithoutVAT

    const summary: PrintContent['summary'] = {
      subtotal: totalWithoutVAT,
      tax: [{
        name: 'VAT',
        // nameLocal: 'VAT',
        rate: 0.10,
        amount: vatAmount,
        taxableAmount: totalWithoutVAT
      }],
      total: order.total,
      payment: payment ? [{
        method: this.translatePaymentMethod(payment.method),
        amount: payment.amount,
        details: payment.cardLast4 ? `**** ${payment.cardLast4}` : undefined
      }] : []
    }

    if (payment?.change && payment.change > 0) {
      summary.change = payment.change
    }

    return summary
  }

  formatFooter(restaurant: any, order: any): PrintContent['footer'] {
    return {
      thankYouMessage: 'Thank you for your visit!',
      thankYouMessageLocal: 'Cảm ơn bạn đã ghé thăm!',
      qrCode: {
        data: `https://makanmakan.com/receipt/${order.id}`,
        size: 'medium',
        label: 'Hóa đơn điện tử / Digital Receipt'
      },
      contactInfo: {
        supportPhone: restaurant.supportPhone || '+84-28-1234-5678',
        website: 'https://makanmakan.vn'
      },
      legalNotice: 'Mã số thuế: 0123456789'
    }
  }

  private generateReceiptNumber(orderId: string): string {
    return `VN${Date.now().toString().slice(-8)}`
  }

  private translatePaymentMethod(method: string): string {
    const translations: { [key: string]: string } = {
      'cash': 'Tiền mặt / Cash',
      'credit_card': 'Thẻ tín dụng / Credit Card',
      'debit_card': 'Thẻ ghi nợ / Debit Card',
      'momo': 'Ví MoMo',
      'zalopay': 'ZaloPay',
      'vnpay': 'VNPay'
    }
    return translations[method] || method
  }

  private getRestaurantInfo(restaurantId: number): any {
    return {
      name: 'MakanMakan Restaurant',
      // nameLocal: 'Nhà Hàng MakanMakan',
      address: '123 Nguyen Hue Street, District 1, Ho Chi Minh City',
      addressLocal: '123 Đường Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
      phone: '+84-28-3823-4567',
      taxNumber: '0123456789'
    }
  }
}

// =============================================
// 格式化工廠
// =============================================

export class ReceiptFormatterFactory {
  private static formatters: Map<CountryCode, typeof RegionReceiptFormatter> = new Map([
    ['TW', TaiwanReceiptFormatter],
    ['MY', MalaysiaReceiptFormatter],
    ['VN', VietnamReceiptFormatter]
  ])

  static createFormatter(
    country: CountryCode, 
    region: RegionConfig, 
    template: ReceiptTemplate
  ): RegionReceiptFormatter {
    const FormatterClass = this.formatters.get(country)
    
    if (!FormatterClass) {
      // 使用台灣格式化器作為預設
      return new TaiwanReceiptFormatter(region, template)
    }
    
    return new FormatterClass(region, template)
  }

  static registerFormatter(country: CountryCode, formatter: typeof RegionReceiptFormatter): void {
    this.formatters.set(country, formatter)
  }

  static getSupportedCountries(): CountryCode[] {
    return Array.from(this.formatters.keys())
  }
}

// =============================================
// 主要格式化服務
// =============================================

export class ReceiptFormattingService {
  private regions: Map<CountryCode, RegionConfig>
  private templates: Map<string, ReceiptTemplate>

  constructor() {
    this.regions = new Map()
    this.templates = new Map()
    this.initializeDefaultConfigs()
  }

  formatReceipt(request: PrintRequest): PrintContent {
    const region = this.regions.get(request.country)
    if (!region) {
      throw new Error(`Region configuration not found for country: ${request.country}`)
    }

    const template = this.templates.get(`${request.country}_${request.type}`) || 
                    this.templates.get(`default_${request.type}`) ||
                    this.templates.get('default_receipt')

    if (!template) {
      throw new Error(`Template not found for country: ${request.country}, type: ${request.type}`)
    }

    const formatter = ReceiptFormatterFactory.createFormatter(request.country, region, template)
    return formatter.formatReceipt(request)
  }

  addRegion(country: CountryCode, config: RegionConfig): void {
    this.regions.set(country, config)
  }

  addTemplate(id: string, template: ReceiptTemplate): void {
    this.templates.set(id, template)
  }

  private initializeDefaultConfigs(): void {
    // 初始化預設地區配置 (簡化版)
    this.regions.set('TW', {
      country: 'TW',
      currency: 'TWD',
      locale: 'zh-TW',
      timezone: 'Asia/Taipei',
      dateFormat: 'YYYY/MM/DD',
      timeFormat: 'HH:mm:ss',
      numberFormat: {
        decimal: '.',
        thousand: ',',
        currency: { symbol: 'NT$', position: 'before', space: false }
      },
      tax: {
        name: 'Tax',
        // nameLocal: '營業稅',
        rate: 0.05,
        inclusive: false,
        displayFormat: '營業稅 (5%)'
      },
      legal: {
        requiresTaxNumber: true,
        requiresLicense: true,
        invoiceFormat: 'government',
        retentionPeriod: 1825,
        electronicInvoice: true
      },
      receipt: {
        width: 32,
        headerLines: 8,
        footerLines: 6,
        itemNameMaxLength: 20,
        showItemCodes: false,
        showTaxBreakdown: true,
        defaultFont: 'normal',
        paperSize: '80mm'
      }
    })

    // 預設收據模板
    this.templates.set('default_receipt', {
      id: 'default_receipt',
      name: 'Default Receipt',
      description: 'Standard receipt template',
      country: 'TW',
      type: 'receipt',
      layout: {
        header: { show: true, order: 1, spacing: 2, alignment: 'center', fields: ['logo', 'restaurant', 'transaction'] },
        items: { show: true, order: 2, spacing: 1, alignment: 'left', fields: ['items', 'modifiers'] },
        summary: { show: true, order: 3, spacing: 2, alignment: 'right', fields: ['subtotal', 'tax', 'total'] },
        footer: { show: true, order: 4, spacing: 2, alignment: 'center', fields: ['thanks', 'qr', 'contact'] }
      },
      styles: {
        fonts: {
          normal: { size: 'normal', bold: false, underline: false, doubleHeight: false, doubleWidth: false },
          bold: { size: 'normal', bold: true, underline: false, doubleHeight: false, doubleWidth: false },
          large: { size: 'large', bold: false, underline: false, doubleHeight: false, doubleWidth: false },
          title: { size: 'large', bold: true, underline: false, doubleHeight: true, doubleWidth: true }
        },
        spacing: { line: 1, section: 2, item: 1 },
        borders: { style: 'dashed', sections: ['header', 'summary'] }
      }
    })
  }
}