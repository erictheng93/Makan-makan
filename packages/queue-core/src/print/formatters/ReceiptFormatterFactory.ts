/**
 * Receipt Formatter Factory
 * Creates region-specific receipt formatters
 */

import type {
  CountryCode,
  PrintContent,
  PrintRequest,
  RegionConfig,
} from "@makanmasak/shared-types";

export interface IReceiptFormatter {
  formatReceipt(data: any): PrintContent;
  validateData(data: any): boolean;
  getRequiredFields(): string[];
}

export abstract class BaseReceiptFormatter implements IReceiptFormatter {
  protected region: RegionConfig;
  protected countryCode: CountryCode;

  constructor(region: RegionConfig, countryCode: CountryCode) {
    this.region = region;
    this.countryCode = countryCode;
  }

  abstract formatReceipt(data: any): PrintContent;
  abstract validateData(data: any): boolean;
  abstract getRequiredFields(): string[];

  protected getReceiptData(input: any): any {
    if (input?.data?.order) {
      return {
        ...input.data,
        restaurant: input.data.restaurant ?? input.restaurant,
        cashier: input.data.cashier ?? input.cashier,
        receiptNumber: input.data.receiptNumber ?? input.receiptNumber,
        restaurantId: input.restaurantId,
      };
    }

    return input ?? {};
  }

  protected generateBusinessNumber(prefix: string, now = Date.now()): string {
    const suffix = globalThis.crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase();

    return `${prefix}${now}-${suffix}`;
  }

  protected getCashierName(data: any, fallback: string): string {
    if (typeof data.cashier === "string") {
      return data.cashier;
    }

    return data.cashier?.name || fallback;
  }

  protected getPaymentDetails(payment: any): string | undefined {
    if (payment?.cardLast4) {
      return `**** ${payment.cardLast4}`;
    }

    return payment?.details;
  }

  protected formatCurrency(amount: number): string {
    const { currency } = this.region.numberFormat;
    const formattedAmount = amount.toFixed(2);

    if (currency.position === "before") {
      return currency.space
        ? `${currency.symbol} ${formattedAmount}`
        : `${currency.symbol}${formattedAmount}`;
    } else {
      return currency.space
        ? `${formattedAmount} ${currency.symbol}`
        : `${formattedAmount}${currency.symbol}`;
    }
  }

  protected formatDate(date: Date): string {
    return date.toLocaleDateString(this.region.locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  protected formatTime(date: Date): string {
    return date.toLocaleTimeString(this.region.locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
}

export class TWReceiptFormatter extends BaseReceiptFormatter {
  formatReceipt(input: PrintRequest | any): PrintContent {
    const data = this.getReceiptData(input);
    const order = data.order;
    const restaurant = data.restaurant;
    const payment = data.payment;
    const subtotal = order?.subtotal ?? 0;
    const taxAmount = order?.tax ?? subtotal * 0.05;

    return {
      header: {
        restaurantInfo: {
          name: restaurant?.name || "餐廳名稱",
          nameLocal: restaurant?.nameLocal,
          address: restaurant?.address || "餐廳地址",
          addressLocal: restaurant?.addressLocal,
          phone: restaurant?.phone || "電話號碼",
          taxNumber: restaurant?.taxNumber, // 統一編號
          licenseNumber: restaurant?.licenseNumber,
        },
        transactionInfo: {
          orderId: order?.id || "N/A",
          tableNumber: order?.tableNumber,
          customerName: data.customer?.name,
          cashier: this.getCashierName(data, "System"),
          timestamp: new Date(order?.createdAt || Date.now()),
          receiptNumber:
            data.receiptNumber || this.generateBusinessNumber("TW"),
        },
        logo: restaurant?.logo
          ? {
              type: "text",
              data: restaurant.logo,
              alignment: "center",
            }
          : undefined,
      },
      items:
        order?.items?.map((item: any) => ({
          name: item.name,
          nameLocal: item.nameLocal,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.quantity * item.price,
          modifiers: item.modifiers || [],
          category: item.category,
          taxRate: 0.05, // Taiwan VAT rate
        })) || [],
      summary: {
        subtotal,
        tax: [
          {
            name: "營業稅",
            rate: 0.05,
            amount: taxAmount,
            taxableAmount: subtotal,
          },
        ],
        total: order?.total || 0,
        payment: payment
          ? [
              {
                method: this.translatePaymentMethod(payment.method || "cash"),
                amount: payment.amount || 0,
                details: this.getPaymentDetails(payment),
              },
            ]
          : [],
        change:
          payment?.change && payment.change > 0 ? payment.change : undefined,
      },
      footer: {
        thankYouMessage: "Thank you for your visit!",
        thankYouMessageLocal: "謝謝光臨！",
        promotionalMessage: restaurant?.promotionalMessage,
        qrCode: {
          data: `https://makanmasak.com/receipt/${order?.id || "unknown"}`,
          size: "medium",
          label: "數位收據",
        },
        legalNotice: "本收據為電子發票證明聯",
        contactInfo: {
          supportPhone: restaurant?.supportPhone,
          supportEmail: restaurant?.supportEmail,
          website: restaurant?.website || "https://makanmasak.com",
        },
      },
    };
  }

  validateData(data: any): boolean {
    const required = this.getRequiredFields();
    return required.every((field) => {
      const value = field.split(".").reduce((obj, key) => obj?.[key], data);
      return value !== undefined && value !== null;
    });
  }

  getRequiredFields(): string[] {
    return [
      "restaurant.name",
      "restaurant.address",
      "order.id",
      "order.items",
      "order.total",
      "cashier.name",
    ];
  }

  private translatePaymentMethod(method: string): string {
    const translations: Record<string, string> = {
      cash: "現金",
      credit_card: "信用卡",
      debit_card: "金融卡",
      mobile_payment: "行動支付",
      e_wallet: "電子錢包",
    };

    return translations[method] || method;
  }
}

export class MYReceiptFormatter extends BaseReceiptFormatter {
  formatReceipt(input: PrintRequest | any): PrintContent {
    const data = this.getReceiptData(input);
    const order = data.order;
    const restaurant = data.restaurant;
    const payment = data.payment;
    const subtotal = order?.subtotal ?? 0;
    const taxAmount = order?.tax ?? subtotal * 0.06;

    return {
      header: {
        restaurantInfo: {
          name: restaurant?.name || "Restaurant Name",
          nameLocal: restaurant?.nameLocal,
          address: restaurant?.address || "Restaurant Address",
          addressLocal: restaurant?.addressLocal,
          phone: restaurant?.phone || "Phone Number",
          licenseNumber: restaurant?.licenseNumber, // Business license
        },
        transactionInfo: {
          orderId: order?.id || "N/A",
          tableNumber: order?.tableNumber,
          customerName: data.customer?.name,
          cashier: this.getCashierName(data, "Cashier"),
          timestamp: new Date(order?.createdAt || Date.now()),
          receiptNumber: data.receiptNumber || `MY${Date.now()}`,
        },
      },
      items:
        order?.items?.map((item: any) => ({
          name: item.name,
          nameLocal: item.nameLocal,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.quantity * item.price,
          modifiers: item.modifiers || [],
          category: item.category,
          taxRate: 0.06, // Malaysia SST rate
        })) || [],
      summary: {
        subtotal,
        tax: [
          {
            name: "SST",
            rate: 0.06,
            amount: taxAmount,
            taxableAmount: subtotal,
          },
        ],
        total: order?.total || 0,
        payment: payment
          ? [
              {
                method: this.translatePaymentMethod(payment.method || "cash"),
                amount: payment.amount || 0,
                details: this.getPaymentDetails(payment),
              },
            ]
          : [],
        change:
          payment?.change && payment.change > 0 ? payment.change : undefined,
      },
      footer: {
        thankYouMessage: "Thank you for dining with us!",
        thankYouMessageLocal: "Terima kasih kerana makan bersama kami!",
        qrCode: {
          data: `https://makanmasak.com/receipt/${order?.id || "unknown"}`,
          size: "medium",
          label: "Digital Receipt / Resit Digital",
        },
        legalNotice: "GST/SST No: 000123456789 | Company No: 123456-A",
        contactInfo: {
          supportPhone: restaurant?.supportPhone,
          supportEmail: restaurant?.supportEmail,
          website: restaurant?.website || "https://makanmasak.com",
        },
      },
    };
  }

  validateData(data: any): boolean {
    const required = this.getRequiredFields();
    return required.every((field) => {
      const value = field.split(".").reduce((obj, key) => obj?.[key], data);
      return value !== undefined && value !== null;
    });
  }

  getRequiredFields(): string[] {
    return [
      "restaurant.name",
      "restaurant.address",
      "order.id",
      "order.items",
      "order.total",
      "cashier.name",
    ];
  }

  private translatePaymentMethod(method: string): string {
    const translations: Record<string, string> = {
      cash: "Tunai / Cash",
      credit_card: "Kad Kredit / Credit Card",
      debit_card: "Kad Debit / Debit Card",
      grabpay: "GrabPay",
      tng: "Touch 'n Go eWallet",
    };

    return translations[method] || method;
  }
}

export class VNReceiptFormatter extends BaseReceiptFormatter {
  formatReceipt(input: PrintRequest | any): PrintContent {
    const data = this.getReceiptData(input);
    const order = data.order;
    const restaurant = data.restaurant;
    const payment = data.payment;
    const total = order?.total ?? 0;
    const subtotal = order?.subtotal ?? total / 1.1;
    const taxAmount = order?.tax ?? total - subtotal;

    return {
      header: {
        restaurantInfo: {
          name: restaurant?.name || "Tên nhà hàng",
          nameLocal: restaurant?.nameLocal,
          address: restaurant?.address || "Địa chỉ nhà hàng",
          addressLocal: restaurant?.addressLocal,
          phone: restaurant?.phone || "Số điện thoại",
          taxNumber: restaurant?.taxNumber, // Mã số thuế
        },
        transactionInfo: {
          orderId: order?.id || "N/A",
          tableNumber: order?.tableNumber,
          customerName: data.customer?.name,
          cashier: this.getCashierName(data, "Thu ngân"),
          timestamp: new Date(order?.createdAt || Date.now()),
          receiptNumber: data.receiptNumber || `VN${Date.now()}`,
        },
      },
      items:
        order?.items?.map((item: any) => ({
          name: item.name,
          nameLocal: item.nameLocal,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.quantity * item.price,
          modifiers: item.modifiers || [],
          category: item.category,
          taxRate: 0.1, // Vietnam VAT rate
        })) || [],
      summary: {
        subtotal,
        tax: [
          {
            name: "VAT",
            rate: 0.1,
            amount: taxAmount,
            taxableAmount: subtotal,
          },
        ],
        total,
        payment: payment
          ? [
              {
                method: this.translatePaymentMethod(payment.method || "cash"),
                amount: payment.amount || 0,
                details: this.getPaymentDetails(payment),
              },
            ]
          : [],
        change:
          payment?.change && payment.change > 0 ? payment.change : undefined,
      },
      footer: {
        thankYouMessage: "Thank you for your visit!",
        thankYouMessageLocal: "Cảm ơn bạn đã ghé thăm!",
        qrCode: {
          data: `https://makanmasak.com/receipt/${order?.id || "unknown"}`,
          size: "medium",
          label: "Hóa đơn điện tử / Digital Receipt",
        },
        legalNotice: "Mã số thuế: 0123456789",
        contactInfo: {
          supportPhone: restaurant?.supportPhone,
          supportEmail: restaurant?.supportEmail,
          website: restaurant?.website || "https://makanmasak.com",
        },
      },
    };
  }

  validateData(data: any): boolean {
    const required = this.getRequiredFields();
    return required.every((field) => {
      const value = field.split(".").reduce((obj, key) => obj?.[key], data);
      return value !== undefined && value !== null;
    });
  }

  getRequiredFields(): string[] {
    return [
      "restaurant.name",
      "restaurant.address",
      "order.id",
      "order.items",
      "order.total",
      "cashier.name",
    ];
  }

  private translatePaymentMethod(method: string): string {
    const translations: Record<string, string> = {
      cash: "Tiền mặt / Cash",
      credit_card: "Thẻ tín dụng / Credit Card",
      debit_card: "Thẻ ghi nợ / Debit Card",
      momo: "Ví MoMo",
      zalopay: "ZaloPay",
      vnpay: "VNPay",
    };

    return translations[method] || method;
  }
}

export class ReceiptFormatterFactory {
  private static formatters = new Map<
    CountryCode,
    new (region: RegionConfig, countryCode: CountryCode) => IReceiptFormatter
  >();

  static {
    // Register default formatters
    this.registerFormatter("TW", TWReceiptFormatter);
    this.registerFormatter("MY", MYReceiptFormatter);
    this.registerFormatter("VN", VNReceiptFormatter);
  }

  static registerFormatter(
    countryCode: CountryCode,
    formatterClass: new (
      region: RegionConfig,
      countryCode: CountryCode,
    ) => IReceiptFormatter,
  ): void {
    this.formatters.set(countryCode, formatterClass);
  }

  static createFormatter(
    countryCode: CountryCode,
    region: RegionConfig,
  ): IReceiptFormatter {
    // Validate countryCode against registered formatters (allowlist)
    if (!this.formatters.has(countryCode)) {
      throw new Error(
        `No formatter found for country code: ${String(countryCode)
          .replace(/[\r\n\t]/g, " ")
          .slice(0, 10)}`,
      );
    }

    const FormatterClass = this.formatters.get(countryCode)!;
    return new FormatterClass(region, countryCode);
  }

  static getSupportedCountries(): CountryCode[] {
    return Array.from(this.formatters.keys());
  }

  static hasFormatter(countryCode: CountryCode): boolean {
    return this.formatters.has(countryCode);
  }
}
