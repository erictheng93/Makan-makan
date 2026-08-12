export type CountryCode = "TW" | "MY" | "VN";
export type CurrencyCode = "TWD" | "MYR" | "VND";

export interface CurrencyFormatConfig {
  symbol: string;
  position: "before" | "after";
  space: boolean;
  decimals: number;
  locale: string;
}

export type PaymentMethod =
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "digital_wallet"
  | "cash"
  // 台灣第三方支付
  | "ecpay"
  | "newebpay"
  | "line_pay"
  | "unipay"
  // 馬來西亞
  | "fpx"
  | "touch_n_go"
  | "touch_n_go_direct"
  | "grab_pay"
  // 越南
  | "momo"
  | "zalo_pay"
  | "viet_qr"
  | "vnpay";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partial_refunded";

export interface PaymentRequest {
  orderId: string;
  restaurantId: string;
  country: CountryCode;
  currency: CurrencyCode;
  amount: number;
  method: PaymentMethod;
  customerInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  metadata?: Record<string, unknown>;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  status: PaymentStatus;
  clientSecret?: string;
  redirectUrl?: string;
  qrCodeData?: string;
  metadata?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface RefundRequest {
  transactionId: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  status: "pending" | "completed" | "failed";
  error?: {
    code: string;
    message: string;
  };
}

export interface WebhookPayload {
  provider: string;
  eventType: string;
  transactionId: string;
  status: PaymentStatus;
  amount?: number;
  currency?: CurrencyCode;
  timestamp: string;
  signature?: string;
  rawData: unknown;
}

export interface WebhookResult {
  processed: boolean;
  transactionId?: string;
  newStatus?: PaymentStatus;
  shouldUpdateOrder?: boolean;
  error?: string;
}

export interface PaymentProviderConfig {
  name: string;
  displayName: string;
  isActive: boolean;
  supportedCountries: CountryCode[];
  supportedMethods: PaymentMethod[];
  testMode: boolean;
  config: Record<string, unknown>;
  webhookEndpoint?: string;
}

export interface CountryPaymentConfig {
  country: CountryCode;
  currency: CurrencyCode;
  supportedMethods: PaymentMethod[];
  primaryProvider: string;
  fallbackProviders: string[];
  minimumAmount: number;
  maximumAmount: number;
  taxRate: number;
  processingFeeRate: number;
}

export abstract class PaymentProvider {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly supportedCountries: CountryCode[];
  abstract readonly supportedMethods: PaymentMethod[];

  constructor(protected config: PaymentProviderConfig) {}

  abstract createPayment(request: PaymentRequest): Promise<PaymentResult>;

  abstract getPaymentStatus(transactionId: string): Promise<PaymentStatus>;

  abstract refundPayment(request: RefundRequest): Promise<RefundResult>;

  abstract handleWebhook(
    payload: unknown,
    signature?: string,
  ): Promise<WebhookResult>;

  abstract validateConfig(): boolean;

  protected convertAmount(
    amount: number,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode,
  ): number {
    // 基礎貨幣轉換邏輯（實際應該使用即時匯率API）
    if (fromCurrency === toCurrency) return amount;

    // 暫時使用固定匯率（實際應該動態取得）
    const rates: Record<CurrencyCode, number> = {
      TWD: 31.0, // 1 USD = 31 TWD
      MYR: 4.7, // 1 USD = 4.7 MYR
      VND: 24000, // 1 USD = 24000 VND
    };

    return Math.round(amount * (rates[toCurrency] / rates[fromCurrency]));
  }

  protected formatAmount(amount: number, currency: CurrencyCode): string {
    const formatters: Record<CurrencyCode, Intl.NumberFormat> = {
      TWD: new Intl.NumberFormat("zh-TW", {
        style: "currency",
        currency: "TWD",
      }),
      MYR: new Intl.NumberFormat("ms-MY", {
        style: "currency",
        currency: "MYR",
      }),
      VND: new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }),
    };

    return formatters[currency].format(amount);
  }
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  providerId: string;
  providerTransactionId: string;
  method: PaymentMethod;
  amount: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  country: CountryCode;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
  error?: string;
}
