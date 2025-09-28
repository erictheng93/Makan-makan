/**
 * Receipt Formatter Factory
 * Creates region-specific receipt formatters
 */

import type {
  CountryCode,
  PrintContent,
  RegionConfig
} from '@makanmakan/shared-types'

export interface IReceiptFormatter {
  formatReceipt(data: any): PrintContent
  validateData(data: any): boolean
  getRequiredFields(): string[]
}

export abstract class BaseReceiptFormatter implements IReceiptFormatter {
  protected region: RegionConfig
  protected countryCode: CountryCode

  constructor(region: RegionConfig, countryCode: CountryCode) {
    this.region = region
    this.countryCode = countryCode
  }

  abstract formatReceipt(data: any): PrintContent
  abstract validateData(data: any): boolean
  abstract getRequiredFields(): string[]

  protected formatCurrency(amount: number): string {
    const { currency } = this.region.numberFormat
    const formattedAmount = amount.toFixed(2)

    if (currency.position === 'before') {
      return currency.space ? `${currency.symbol} ${formattedAmount}` : `${currency.symbol}${formattedAmount}`
    } else {
      return currency.space ? `${formattedAmount} ${currency.symbol}` : `${formattedAmount}${currency.symbol}`
    }
  }

  protected formatDate(date: Date): string {
    return date.toLocaleDateString(this.region.locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  protected formatTime(date: Date): string {
    return date.toLocaleTimeString(this.region.locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }
}

export class TWReceiptFormatter extends BaseReceiptFormatter {
  formatReceipt(data: any): PrintContent {
    return {
      header: {
        restaurantInfo: {
          name: data.restaurant?.name || '餐廳名稱',
          nameLocal: data.restaurant?.nameLocal,
          address: data.restaurant?.address || '餐廳地址',
          phone: data.restaurant?.phone || '電話號碼',
          taxNumber: data.restaurant?.taxNumber // 統一編號
        },
        transactionInfo: {
          orderId: data.order?.id || 'N/A',
          tableNumber: data.order?.tableNumber,
          customerName: data.customer?.name,
          cashier: data.cashier?.name || '收銀員',
          timestamp: new Date(data.order?.createdAt || Date.now()),
          receiptNumber: data.receiptNumber || `TW${Date.now()}`
        }
      },
      items: data.order?.items?.map((item: any) => ({
        name: item.name,
        nameLocal: item.nameLocal,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.quantity * item.price,
        modifiers: item.modifiers || [],
        category: item.category,
        taxRate: 0.05 // Taiwan VAT rate
      })) || [],
      summary: {
        subtotal: data.order?.subtotal || 0,
        tax: [{
          name: '營業稅',
          rate: 0.05,
          amount: (data.order?.subtotal || 0) * 0.05,
          taxableAmount: data.order?.subtotal || 0
        }],
        total: data.order?.total || 0,
        payment: data.payment ? [{
          method: data.payment.method || '現金',
          amount: data.payment.amount || 0,
          details: data.payment.details
        }] : []
      },
      footer: {
        thankYouMessage: '謝謝光臨',
        thankYouMessageLocal: 'Thank you for your visit',
        legalNotice: '本收據為電子發票證明聯',
        contactInfo: {
          supportPhone: data.restaurant?.supportPhone,
          supportEmail: data.restaurant?.supportEmail
        }
      }
    }
  }

  validateData(data: any): boolean {
    const required = this.getRequiredFields()
    return required.every(field => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], data)
      return value !== undefined && value !== null
    })
  }

  getRequiredFields(): string[] {
    return [
      'restaurant.name',
      'restaurant.address',
      'order.id',
      'order.items',
      'order.total',
      'cashier.name'
    ]
  }
}

export class MYReceiptFormatter extends BaseReceiptFormatter {
  formatReceipt(data: any): PrintContent {
    return {
      header: {
        restaurantInfo: {
          name: data.restaurant?.name || 'Restaurant Name',
          address: data.restaurant?.address || 'Restaurant Address',
          phone: data.restaurant?.phone || 'Phone Number',
          licenseNumber: data.restaurant?.licenseNumber // Business license
        },
        transactionInfo: {
          orderId: data.order?.id || 'N/A',
          tableNumber: data.order?.tableNumber,
          customerName: data.customer?.name,
          cashier: data.cashier?.name || 'Cashier',
          timestamp: new Date(data.order?.createdAt || Date.now()),
          receiptNumber: data.receiptNumber || `MY${Date.now()}`
        }
      },
      items: data.order?.items?.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.quantity * item.price,
        modifiers: item.modifiers || [],
        category: item.category,
        taxRate: 0.06 // Malaysia SST rate
      })) || [],
      summary: {
        subtotal: data.order?.subtotal || 0,
        tax: [{
          name: 'SST',
          rate: 0.06,
          amount: (data.order?.subtotal || 0) * 0.06,
          taxableAmount: data.order?.subtotal || 0
        }],
        total: data.order?.total || 0,
        payment: data.payment ? [{
          method: data.payment.method || 'Cash',
          amount: data.payment.amount || 0,
          details: data.payment.details
        }] : []
      },
      footer: {
        thankYouMessage: 'Thank you for your visit',
        thankYouMessageLocal: 'Terima kasih atas lawatan anda',
        legalNotice: 'This is a computer generated receipt',
        contactInfo: {
          supportPhone: data.restaurant?.supportPhone,
          supportEmail: data.restaurant?.supportEmail
        }
      }
    }
  }

  validateData(data: any): boolean {
    const required = this.getRequiredFields()
    return required.every(field => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], data)
      return value !== undefined && value !== null
    })
  }

  getRequiredFields(): string[] {
    return [
      'restaurant.name',
      'restaurant.address',
      'order.id',
      'order.items',
      'order.total',
      'cashier.name'
    ]
  }
}

export class VNReceiptFormatter extends BaseReceiptFormatter {
  formatReceipt(data: any): PrintContent {
    return {
      header: {
        restaurantInfo: {
          name: data.restaurant?.name || 'Tên nhà hàng',
          address: data.restaurant?.address || 'Địa chỉ nhà hàng',
          phone: data.restaurant?.phone || 'Số điện thoại',
          taxNumber: data.restaurant?.taxNumber // Mã số thuế
        },
        transactionInfo: {
          orderId: data.order?.id || 'N/A',
          tableNumber: data.order?.tableNumber,
          customerName: data.customer?.name,
          cashier: data.cashier?.name || 'Thu ngân',
          timestamp: new Date(data.order?.createdAt || Date.now()),
          receiptNumber: data.receiptNumber || `VN${Date.now()}`
        }
      },
      items: data.order?.items?.map((item: any) => ({
        name: item.name,
        nameLocal: item.nameLocal,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.quantity * item.price,
        modifiers: item.modifiers || [],
        category: item.category,
        taxRate: 0.10 // Vietnam VAT rate
      })) || [],
      summary: {
        subtotal: data.order?.subtotal || 0,
        tax: [{
          name: 'VAT',
          rate: 0.10,
          amount: (data.order?.subtotal || 0) * 0.10,
          taxableAmount: data.order?.subtotal || 0
        }],
        total: data.order?.total || 0,
        payment: data.payment ? [{
          method: data.payment.method || 'Tiền mặt',
          amount: data.payment.amount || 0,
          details: data.payment.details
        }] : []
      },
      footer: {
        thankYouMessage: 'Cảm ơn quý khách',
        thankYouMessageLocal: 'Thank you for your visit',
        legalNotice: 'Hóa đơn được in tự động',
        contactInfo: {
          supportPhone: data.restaurant?.supportPhone,
          supportEmail: data.restaurant?.supportEmail
        }
      }
    }
  }

  validateData(data: any): boolean {
    const required = this.getRequiredFields()
    return required.every(field => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], data)
      return value !== undefined && value !== null
    })
  }

  getRequiredFields(): string[] {
    return [
      'restaurant.name',
      'restaurant.address',
      'order.id',
      'order.items',
      'order.total',
      'cashier.name'
    ]
  }
}

export class ReceiptFormatterFactory {
  private static formatters = new Map<CountryCode, new (region: RegionConfig, countryCode: CountryCode) => IReceiptFormatter>()

  static {
    // Register default formatters
    this.registerFormatter('TW', TWReceiptFormatter)
    this.registerFormatter('MY', MYReceiptFormatter)
    this.registerFormatter('VN', VNReceiptFormatter)
  }

  static registerFormatter(countryCode: CountryCode, formatterClass: new (region: RegionConfig, countryCode: CountryCode) => IReceiptFormatter): void {
    this.formatters.set(countryCode, formatterClass)
  }

  static createFormatter(countryCode: CountryCode, region: RegionConfig): IReceiptFormatter {
    const FormatterClass = this.formatters.get(countryCode)

    if (!FormatterClass) {
      throw new Error(`No formatter found for country code: ${countryCode}`)
    }

    return new FormatterClass(region, countryCode)
  }

  static getSupportedCountries(): CountryCode[] {
    return Array.from(this.formatters.keys())
  }

  static hasFormatter(countryCode: CountryCode): boolean {
    return this.formatters.has(countryCode)
  }
}