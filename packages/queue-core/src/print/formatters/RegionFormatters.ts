/**
 * Region-Specific Formatters
 * Utility classes for formatting data according to regional standards
 */

import type { CountryCode, RegionConfig } from '@makanmakan/shared-types'

export interface IRegionFormatter {
  formatCurrency(amount: number): string
  formatDate(date: Date): string
  formatTime(date: Date): string
  formatPhone(phone: string): string
  formatTaxNumber(taxNumber: string): string
  formatAddress(address: string): string
  getReceiptTitle(): string
  getTaxLabel(): string
  getCurrencySymbol(): string
}

export abstract class BaseRegionFormatter implements IRegionFormatter {
  protected region: RegionConfig
  protected countryCode: CountryCode

  constructor(region: RegionConfig, countryCode: CountryCode) {
    this.region = region
    this.countryCode = countryCode
  }

  formatCurrency(amount: number): string {
    const { currency } = this.region.numberFormat
    const formattedAmount = amount.toLocaleString(this.region.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

    if (currency.position === 'before') {
      return currency.space ? `${currency.symbol} ${formattedAmount}` : `${currency.symbol}${formattedAmount}`
    } else {
      return currency.space ? `${formattedAmount} ${currency.symbol}` : `${formattedAmount}${currency.symbol}`
    }
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString(this.region.locale)
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString(this.region.locale)
  }

  abstract formatPhone(phone: string): string
  abstract formatTaxNumber(taxNumber: string): string
  abstract formatAddress(address: string): string
  abstract getReceiptTitle(): string
  abstract getTaxLabel(): string
  abstract getCurrencySymbol(): string
}

export class TWRegionFormatter extends BaseRegionFormatter {
  formatPhone(phone: string): string {
    // Taiwan phone format: +886-x-xxxx-xxxx or 0x-xxxx-xxxx
    const cleaned = phone.replace(/\D/g, '')

    if (cleaned.startsWith('886')) {
      // International format
      const local = cleaned.substring(3)
      if (local.length === 9) {
        return `+886-${local.substring(0, 1)}-${local.substring(1, 5)}-${local.substring(5)}`
      }
    } else if (cleaned.startsWith('0')) {
      // Domestic format
      if (cleaned.length === 10) {
        return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 6)}-${cleaned.substring(6)}`
      }
    }

    return phone // Return original if can't format
  }

  formatTaxNumber(taxNumber: string): string {
    // Taiwan unified business number: 8 digits
    const cleaned = taxNumber.replace(/\D/g, '')
    if (cleaned.length === 8) {
      return `統編: ${cleaned}`
    }
    return `統編: ${taxNumber}`
  }

  formatAddress(address: string): string {
    // Taiwan addresses are typically structured as:
    // City + District + Road + Number
    return address
  }

  getReceiptTitle(): string {
    return '收據'
  }

  getTaxLabel(): string {
    return '營業稅'
  }

  getCurrencySymbol(): string {
    return 'NT$'
  }
}

export class MYRegionFormatter extends BaseRegionFormatter {
  formatPhone(phone: string): string {
    // Malaysia phone format: +60x-xxx-xxxx or 01x-xxx-xxxx
    const cleaned = phone.replace(/\D/g, '')

    if (cleaned.startsWith('60')) {
      // International format
      const local = cleaned.substring(2)
      if (local.length === 9 || local.length === 10) {
        return `+60${local.substring(0, 1)}-${local.substring(1, 4)}-${local.substring(4)}`
      }
    } else if (cleaned.startsWith('0')) {
      // Domestic format
      if (cleaned.length === 10 || cleaned.length === 11) {
        return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)}-${cleaned.substring(6)}`
      }
    }

    return phone
  }

  formatTaxNumber(taxNumber: string): string {
    // Malaysia company registration number
    const cleaned = taxNumber.replace(/\D/g, '')
    if (cleaned.length >= 6) {
      return `Co. Reg: ${taxNumber}`
    }
    return `Tax ID: ${taxNumber}`
  }

  formatAddress(address: string): string {
    // Malaysia addresses typically include postal code
    return address
  }

  getReceiptTitle(): string {
    return 'Receipt'
  }

  getTaxLabel(): string {
    return 'SST'
  }

  getCurrencySymbol(): string {
    return 'RM'
  }
}

export class VNRegionFormatter extends BaseRegionFormatter {
  formatPhone(phone: string): string {
    // Vietnam phone format: +84xx-xxx-xxxx or 0xx-xxx-xxxx
    const cleaned = phone.replace(/\D/g, '')

    if (cleaned.startsWith('84')) {
      // International format
      const local = cleaned.substring(2)
      if (local.length === 9) {
        return `+84${local.substring(0, 2)}-${local.substring(2, 5)}-${local.substring(5)}`
      }
    } else if (cleaned.startsWith('0')) {
      // Domestic format
      if (cleaned.length === 10) {
        return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)}-${cleaned.substring(6)}`
      }
    }

    return phone
  }

  formatTaxNumber(taxNumber: string): string {
    // Vietnam tax identification number
    const cleaned = taxNumber.replace(/\D/g, '')
    if (cleaned.length >= 10) {
      return `MST: ${cleaned}`
    }
    return `Mã số thuế: ${taxNumber}`
  }

  formatAddress(address: string): string {
    // Vietnam addresses include Ward/District/City structure
    return address
  }

  getReceiptTitle(): string {
    return 'Hóa đơn'
  }

  getTaxLabel(): string {
    return 'VAT'
  }

  getCurrencySymbol(): string {
    return '₫'
  }
}

export class RegionFormatterFactory {
  private static formatters = new Map<CountryCode, new (region: RegionConfig, countryCode: CountryCode) => IRegionFormatter>()

  static {
    // Register default formatters
    this.registerFormatter('TW', TWRegionFormatter)
    this.registerFormatter('MY', MYRegionFormatter)
    this.registerFormatter('VN', VNRegionFormatter)
  }

  static registerFormatter(countryCode: CountryCode, formatterClass: new (region: RegionConfig, countryCode: CountryCode) => IRegionFormatter): void {
    this.formatters.set(countryCode, formatterClass)
  }

  static createFormatter(countryCode: CountryCode, region: RegionConfig): IRegionFormatter {
    const FormatterClass = this.formatters.get(countryCode)

    if (!FormatterClass) {
      throw new Error(`No region formatter found for country code: ${countryCode}`)
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

// Utility functions for quick formatting
export const formatCurrencyByCountry = (amount: number, countryCode: CountryCode, region: RegionConfig): string => {
  const formatter = RegionFormatterFactory.createFormatter(countryCode, region)
  return formatter.formatCurrency(amount)
}

export const formatPhoneByCountry = (phone: string, countryCode: CountryCode, region: RegionConfig): string => {
  const formatter = RegionFormatterFactory.createFormatter(countryCode, region)
  return formatter.formatPhone(phone)
}

export const formatTaxNumberByCountry = (taxNumber: string, countryCode: CountryCode, region: RegionConfig): string => {
  const formatter = RegionFormatterFactory.createFormatter(countryCode, region)
  return formatter.formatTaxNumber(taxNumber)
}