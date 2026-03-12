export interface StripeConfig {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
    accountId?: string;
    applicationFee?: number;
    testMode: boolean;
    apiVersion: string;
    country: "TW" | "MY" | "VN";
    currency: "TWD" | "MYR" | "VND";
    paymentMethodTypes: string[];
    automaticTax: boolean;
    requireAuthentication: "automatic" | "always" | "never";
    captureMethod: "automatic" | "manual";
    confirmationMethod: "automatic" | "manual";
    locale?: string;
    minimumAmount: number;
    maximumAmount: number;
    paymentTimeout: number;
    webhookTimeout: number;
    maxRetries: number;
    retryBackoffMs: number;
    radarRules?: string[];
    blockSuspiciousPayments: boolean;
    invoiceSettings?: {
        businessNumber: string;
        enableInvoiceGeneration: boolean;
        defaultInvoiceFormat: string;
    };
}
export interface StripePaymentIntentOptions {
    amount: number;
    currency: string;
    paymentMethodTypes?: string[];
    captureMethod?: "automatic" | "manual";
    confirmationMethod?: "automatic" | "manual";
    description?: string;
    metadata?: Record<string, string>;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    receiptEmail?: string;
    statementDescriptor?: string;
    applicationFeeAmount?: number;
    transferGroup?: string;
    onBehalfOf?: string;
    setupFutureUsage?: "on_session" | "off_session";
    returnUrl?: string;
    automaticTax?: {
        enabled: boolean;
    };
}
export interface StripeWebhookEvent {
    id: string;
    object: "event";
    type: string;
    created: number;
    data: {
        object: any;
        previous_attributes?: any;
    };
    livemode: boolean;
    pending_webhooks: number;
    request?: {
        id: string;
        idempotency_key: string;
    };
}
export interface StripeErrorDetails {
    type: "card_error" | "invalid_request_error" | "api_error" | "authentication_error" | "rate_limit_error";
    code?: string;
    decline_code?: string;
    param?: string;
    message: string;
    doc_url?: string;
    charge?: string;
    payment_intent?: {
        id: string;
        status: string;
    };
    payment_method?: {
        id: string;
        type: string;
    };
}
export declare const STRIPE_PAYMENT_METHOD_MAP: {
    readonly credit_card: "card";
    readonly debit_card: "card";
    readonly alipay: "alipay";
    readonly wechat_pay: "wechat_pay";
    readonly grabpay: "grabpay";
    readonly sepa_debit: "sepa_debit";
    readonly ideal: "ideal";
    readonly sofort: "sofort";
    readonly bancontact: "bancontact";
    readonly p24: "p24";
    readonly eps: "eps";
    readonly giropay: "giropay";
    readonly oxxo: "oxxo";
};
export declare const STRIPE_COUNTRY_METHODS: {
    readonly TW: readonly ["card", "alipay"];
    readonly MY: readonly ["card", "grabpay", "alipay"];
    readonly VN: readonly ["card", "alipay"];
};
export declare const STRIPE_CURRENCY_UNITS: {
    readonly TWD: 1;
    readonly MYR: 100;
    readonly VND: 1;
};
export interface StripeCountryConfig {
    country: "TW" | "MY" | "VN";
    currency: "TWD" | "MYR" | "VND";
    supportedMethods: string[];
    minimumAmount: number;
    maximumAmount: number;
    feeStructure: {
        percentage: number;
        fixedAmount: number;
    };
    taxRate: number;
    requiresBusiness: boolean;
    invoiceRequired: boolean;
    localRegulations: string[];
}
