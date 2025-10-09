export type CountryCode = 'TW' | 'MY' | 'VN';
export type CurrencyCode = 'TWD' | 'MYR' | 'VND';
export type PaymentMethod = 'credit_card' | 'debit_card' | 'bank_transfer' | 'digital_wallet' | 'cash' | 'ecpay' | 'newebpay' | 'line_pay' | 'unipay' | 'fpx' | 'touch_n_go' | 'touch_n_go_direct' | 'grab_pay' | 'momo' | 'zalo_pay' | 'viet_qr' | 'vnpay';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'partial_refunded';
export interface PaymentRequest {
    orderId: string;
    restaurantId: number;
    country: CountryCode;
    currency: CurrencyCode;
    amount: number;
    method: PaymentMethod;
    customerInfo?: {
        name?: string;
        email?: string;
        phone?: string;
    };
    metadata?: Record<string, any>;
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
    metadata?: Record<string, any>;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}
export interface RefundRequest {
    transactionId: string;
    amount?: number;
    reason?: string;
    metadata?: Record<string, any>;
}
export interface RefundResult {
    success: boolean;
    refundId: string;
    amount: number;
    status: 'pending' | 'completed' | 'failed';
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
    rawData: any;
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
    config: Record<string, any>;
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
export declare abstract class PaymentProvider {
    protected config: PaymentProviderConfig;
    abstract readonly name: string;
    abstract readonly displayName: string;
    abstract readonly supportedCountries: CountryCode[];
    abstract readonly supportedMethods: PaymentMethod[];
    constructor(config: PaymentProviderConfig);
    abstract createPayment(request: PaymentRequest): Promise<PaymentResult>;
    abstract getPaymentStatus(transactionId: string): Promise<PaymentStatus>;
    abstract refundPayment(request: RefundRequest): Promise<RefundResult>;
    abstract handleWebhook(payload: any, signature?: string): Promise<WebhookResult>;
    abstract validateConfig(): boolean;
    protected convertAmount(amount: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode): number;
    protected formatAmount(amount: number, currency: CurrencyCode): string;
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
    metadata?: Record<string, any>;
    error?: string;
}
