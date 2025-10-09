import type { PaymentRequest, PaymentResult, PaymentMethod, PaymentStatus, CountryCode, CurrencyCode } from "@makanmakan/shared-types";
interface PaymentState {
    currentPayment: {
        request: PaymentRequest | null;
        result: PaymentResult | null;
        status: PaymentStatus;
        transactionId: string | null;
        clientSecret: string | null;
        step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
    };
    paymentHistory: PaymentTransaction[];
    availableMethods: Record<CountryCode, PaymentMethod[]>;
    loading: {
        creating: boolean;
        methods: boolean;
        status: boolean;
    };
    errors: {
        payment: string | null;
        validation: Record<string, string>;
    };
    settings: {
        testMode: boolean;
        autoRetry: boolean;
        maxRetries: number;
    };
}
interface PaymentTransaction {
    id: string;
    orderId: string;
    amount: number;
    currency: CurrencyCode;
    method: PaymentMethod;
    status: PaymentStatus;
    createdAt: Date;
    updatedAt: Date;
    error?: string;
}
export declare const usePaymentStore: import("pinia").StoreDefinition<"payment", Pick<{
    state: Readonly<import("vue").Ref<{
        readonly currentPayment: {
            readonly request: {
                readonly orderId: string;
                readonly restaurantId: number;
                readonly country: CountryCode;
                readonly currency: CurrencyCode;
                readonly amount: number;
                readonly method: PaymentMethod;
                readonly customerInfo?: {
                    readonly name?: string | undefined;
                    readonly email?: string | undefined;
                    readonly phone?: string | undefined;
                } | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly returnUrl?: string | undefined;
                readonly cancelUrl?: string | undefined;
            } | null;
            readonly result: {
                readonly success: boolean;
                readonly transactionId: string;
                readonly status: PaymentStatus;
                readonly clientSecret?: string | undefined;
                readonly redirectUrl?: string | undefined;
                readonly qrCodeData?: string | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly error?: {
                    readonly code: string;
                    readonly message: string;
                    readonly details?: any;
                } | undefined;
            } | null;
            readonly status: PaymentStatus;
            readonly transactionId: string | null;
            readonly clientSecret: string | null;
            readonly step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
        };
        readonly paymentHistory: readonly {
            readonly id: string;
            readonly orderId: string;
            readonly amount: number;
            readonly currency: CurrencyCode;
            readonly method: PaymentMethod;
            readonly status: PaymentStatus;
            readonly createdAt: Date;
            readonly updatedAt: Date;
            readonly error?: string | undefined;
        }[];
        readonly availableMethods: {
            readonly TW: readonly PaymentMethod[];
            readonly MY: readonly PaymentMethod[];
            readonly VN: readonly PaymentMethod[];
        };
        readonly loading: {
            readonly creating: boolean;
            readonly methods: boolean;
            readonly status: boolean;
        };
        readonly errors: {
            readonly payment: string | null;
            readonly validation: {
                readonly [x: string]: string;
            };
        };
        readonly settings: {
            readonly testMode: boolean;
            readonly autoRetry: boolean;
            readonly maxRetries: number;
        };
    }, {
        readonly currentPayment: {
            readonly request: {
                readonly orderId: string;
                readonly restaurantId: number;
                readonly country: CountryCode;
                readonly currency: CurrencyCode;
                readonly amount: number;
                readonly method: PaymentMethod;
                readonly customerInfo?: {
                    readonly name?: string | undefined;
                    readonly email?: string | undefined;
                    readonly phone?: string | undefined;
                } | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly returnUrl?: string | undefined;
                readonly cancelUrl?: string | undefined;
            } | null;
            readonly result: {
                readonly success: boolean;
                readonly transactionId: string;
                readonly status: PaymentStatus;
                readonly clientSecret?: string | undefined;
                readonly redirectUrl?: string | undefined;
                readonly qrCodeData?: string | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly error?: {
                    readonly code: string;
                    readonly message: string;
                    readonly details?: any;
                } | undefined;
            } | null;
            readonly status: PaymentStatus;
            readonly transactionId: string | null;
            readonly clientSecret: string | null;
            readonly step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
        };
        readonly paymentHistory: readonly {
            readonly id: string;
            readonly orderId: string;
            readonly amount: number;
            readonly currency: CurrencyCode;
            readonly method: PaymentMethod;
            readonly status: PaymentStatus;
            readonly createdAt: Date;
            readonly updatedAt: Date;
            readonly error?: string | undefined;
        }[];
        readonly availableMethods: {
            readonly TW: readonly PaymentMethod[];
            readonly MY: readonly PaymentMethod[];
            readonly VN: readonly PaymentMethod[];
        };
        readonly loading: {
            readonly creating: boolean;
            readonly methods: boolean;
            readonly status: boolean;
        };
        readonly errors: {
            readonly payment: string | null;
            readonly validation: {
                readonly [x: string]: string;
            };
        };
        readonly settings: {
            readonly testMode: boolean;
            readonly autoRetry: boolean;
            readonly maxRetries: number;
        };
    }>>;
    currentStep: import("vue").ComputedRef<"details" | "completed" | "failed" | "method" | "processing" | "idle">;
    isLoading: import("vue").ComputedRef<boolean>;
    hasError: import("vue").ComputedRef<boolean>;
    canRetry: import("vue").ComputedRef<boolean>;
    getCurrentPayment: import("vue").ComputedRef<{
        request: {
            orderId: string;
            restaurantId: number;
            country: CountryCode;
            currency: CurrencyCode;
            amount: number;
            method: PaymentMethod;
            customerInfo?: {
                name?: string | undefined;
                email?: string | undefined;
                phone?: string | undefined;
            } | undefined;
            metadata?: Record<string, any> | undefined;
            returnUrl?: string | undefined;
            cancelUrl?: string | undefined;
        } | null;
        result: {
            success: boolean;
            transactionId: string;
            status: PaymentStatus;
            clientSecret?: string | undefined;
            redirectUrl?: string | undefined;
            qrCodeData?: string | undefined;
            metadata?: Record<string, any> | undefined;
            error?: {
                code: string;
                message: string;
                details?: any;
            } | undefined;
        } | null;
        status: PaymentStatus;
        transactionId: string | null;
        clientSecret: string | null;
        step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
    }>;
    getPaymentHistory: import("vue").ComputedRef<{
        id: string;
        orderId: string;
        amount: number;
        currency: CurrencyCode;
        method: PaymentMethod;
        status: PaymentStatus;
        createdAt: Date;
        updatedAt: Date;
        error?: string | undefined;
    }[]>;
    getPaymentStats: import("vue").ComputedRef<{
        total: number;
        successful: number;
        failed: number;
        pending: number;
        successRate: number;
    }>;
    getAvailableMethodsForCountry: (country: CountryCode) => PaymentMethod[];
    initializePayment: (request: PaymentRequest) => Promise<void>;
    createPayment: (request: PaymentRequest) => Promise<PaymentResult>;
    checkPaymentStatus: (transactionId: string) => Promise<PaymentStatus>;
    refundPayment: (transactionId: string, amount?: number, reason?: string) => Promise<any>;
    loadPaymentMethods: (country: CountryCode) => Promise<void>;
    retryPayment: () => Promise<PaymentResult | null>;
    cancelPayment: () => void;
    setStep: (step: PaymentState["currentPayment"]["step"]) => void;
    setError: (error: string) => void;
    clearErrors: () => void;
    formatAmount: (amount: number, currency: CurrencyCode) => string;
    reset: () => void;
    updateSettings: (newSettings: Partial<PaymentState["settings"]>) => void;
    pollPaymentStatus: (transactionId: string, interval?: number, maxAttempts?: number) => void;
}, "state">, Pick<{
    state: Readonly<import("vue").Ref<{
        readonly currentPayment: {
            readonly request: {
                readonly orderId: string;
                readonly restaurantId: number;
                readonly country: CountryCode;
                readonly currency: CurrencyCode;
                readonly amount: number;
                readonly method: PaymentMethod;
                readonly customerInfo?: {
                    readonly name?: string | undefined;
                    readonly email?: string | undefined;
                    readonly phone?: string | undefined;
                } | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly returnUrl?: string | undefined;
                readonly cancelUrl?: string | undefined;
            } | null;
            readonly result: {
                readonly success: boolean;
                readonly transactionId: string;
                readonly status: PaymentStatus;
                readonly clientSecret?: string | undefined;
                readonly redirectUrl?: string | undefined;
                readonly qrCodeData?: string | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly error?: {
                    readonly code: string;
                    readonly message: string;
                    readonly details?: any;
                } | undefined;
            } | null;
            readonly status: PaymentStatus;
            readonly transactionId: string | null;
            readonly clientSecret: string | null;
            readonly step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
        };
        readonly paymentHistory: readonly {
            readonly id: string;
            readonly orderId: string;
            readonly amount: number;
            readonly currency: CurrencyCode;
            readonly method: PaymentMethod;
            readonly status: PaymentStatus;
            readonly createdAt: Date;
            readonly updatedAt: Date;
            readonly error?: string | undefined;
        }[];
        readonly availableMethods: {
            readonly TW: readonly PaymentMethod[];
            readonly MY: readonly PaymentMethod[];
            readonly VN: readonly PaymentMethod[];
        };
        readonly loading: {
            readonly creating: boolean;
            readonly methods: boolean;
            readonly status: boolean;
        };
        readonly errors: {
            readonly payment: string | null;
            readonly validation: {
                readonly [x: string]: string;
            };
        };
        readonly settings: {
            readonly testMode: boolean;
            readonly autoRetry: boolean;
            readonly maxRetries: number;
        };
    }, {
        readonly currentPayment: {
            readonly request: {
                readonly orderId: string;
                readonly restaurantId: number;
                readonly country: CountryCode;
                readonly currency: CurrencyCode;
                readonly amount: number;
                readonly method: PaymentMethod;
                readonly customerInfo?: {
                    readonly name?: string | undefined;
                    readonly email?: string | undefined;
                    readonly phone?: string | undefined;
                } | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly returnUrl?: string | undefined;
                readonly cancelUrl?: string | undefined;
            } | null;
            readonly result: {
                readonly success: boolean;
                readonly transactionId: string;
                readonly status: PaymentStatus;
                readonly clientSecret?: string | undefined;
                readonly redirectUrl?: string | undefined;
                readonly qrCodeData?: string | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly error?: {
                    readonly code: string;
                    readonly message: string;
                    readonly details?: any;
                } | undefined;
            } | null;
            readonly status: PaymentStatus;
            readonly transactionId: string | null;
            readonly clientSecret: string | null;
            readonly step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
        };
        readonly paymentHistory: readonly {
            readonly id: string;
            readonly orderId: string;
            readonly amount: number;
            readonly currency: CurrencyCode;
            readonly method: PaymentMethod;
            readonly status: PaymentStatus;
            readonly createdAt: Date;
            readonly updatedAt: Date;
            readonly error?: string | undefined;
        }[];
        readonly availableMethods: {
            readonly TW: readonly PaymentMethod[];
            readonly MY: readonly PaymentMethod[];
            readonly VN: readonly PaymentMethod[];
        };
        readonly loading: {
            readonly creating: boolean;
            readonly methods: boolean;
            readonly status: boolean;
        };
        readonly errors: {
            readonly payment: string | null;
            readonly validation: {
                readonly [x: string]: string;
            };
        };
        readonly settings: {
            readonly testMode: boolean;
            readonly autoRetry: boolean;
            readonly maxRetries: number;
        };
    }>>;
    currentStep: import("vue").ComputedRef<"details" | "completed" | "failed" | "method" | "processing" | "idle">;
    isLoading: import("vue").ComputedRef<boolean>;
    hasError: import("vue").ComputedRef<boolean>;
    canRetry: import("vue").ComputedRef<boolean>;
    getCurrentPayment: import("vue").ComputedRef<{
        request: {
            orderId: string;
            restaurantId: number;
            country: CountryCode;
            currency: CurrencyCode;
            amount: number;
            method: PaymentMethod;
            customerInfo?: {
                name?: string | undefined;
                email?: string | undefined;
                phone?: string | undefined;
            } | undefined;
            metadata?: Record<string, any> | undefined;
            returnUrl?: string | undefined;
            cancelUrl?: string | undefined;
        } | null;
        result: {
            success: boolean;
            transactionId: string;
            status: PaymentStatus;
            clientSecret?: string | undefined;
            redirectUrl?: string | undefined;
            qrCodeData?: string | undefined;
            metadata?: Record<string, any> | undefined;
            error?: {
                code: string;
                message: string;
                details?: any;
            } | undefined;
        } | null;
        status: PaymentStatus;
        transactionId: string | null;
        clientSecret: string | null;
        step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
    }>;
    getPaymentHistory: import("vue").ComputedRef<{
        id: string;
        orderId: string;
        amount: number;
        currency: CurrencyCode;
        method: PaymentMethod;
        status: PaymentStatus;
        createdAt: Date;
        updatedAt: Date;
        error?: string | undefined;
    }[]>;
    getPaymentStats: import("vue").ComputedRef<{
        total: number;
        successful: number;
        failed: number;
        pending: number;
        successRate: number;
    }>;
    getAvailableMethodsForCountry: (country: CountryCode) => PaymentMethod[];
    initializePayment: (request: PaymentRequest) => Promise<void>;
    createPayment: (request: PaymentRequest) => Promise<PaymentResult>;
    checkPaymentStatus: (transactionId: string) => Promise<PaymentStatus>;
    refundPayment: (transactionId: string, amount?: number, reason?: string) => Promise<any>;
    loadPaymentMethods: (country: CountryCode) => Promise<void>;
    retryPayment: () => Promise<PaymentResult | null>;
    cancelPayment: () => void;
    setStep: (step: PaymentState["currentPayment"]["step"]) => void;
    setError: (error: string) => void;
    clearErrors: () => void;
    formatAmount: (amount: number, currency: CurrencyCode) => string;
    reset: () => void;
    updateSettings: (newSettings: Partial<PaymentState["settings"]>) => void;
    pollPaymentStatus: (transactionId: string, interval?: number, maxAttempts?: number) => void;
}, "isLoading" | "currentStep" | "hasError" | "canRetry" | "getCurrentPayment" | "getPaymentHistory" | "getPaymentStats">, Pick<{
    state: Readonly<import("vue").Ref<{
        readonly currentPayment: {
            readonly request: {
                readonly orderId: string;
                readonly restaurantId: number;
                readonly country: CountryCode;
                readonly currency: CurrencyCode;
                readonly amount: number;
                readonly method: PaymentMethod;
                readonly customerInfo?: {
                    readonly name?: string | undefined;
                    readonly email?: string | undefined;
                    readonly phone?: string | undefined;
                } | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly returnUrl?: string | undefined;
                readonly cancelUrl?: string | undefined;
            } | null;
            readonly result: {
                readonly success: boolean;
                readonly transactionId: string;
                readonly status: PaymentStatus;
                readonly clientSecret?: string | undefined;
                readonly redirectUrl?: string | undefined;
                readonly qrCodeData?: string | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly error?: {
                    readonly code: string;
                    readonly message: string;
                    readonly details?: any;
                } | undefined;
            } | null;
            readonly status: PaymentStatus;
            readonly transactionId: string | null;
            readonly clientSecret: string | null;
            readonly step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
        };
        readonly paymentHistory: readonly {
            readonly id: string;
            readonly orderId: string;
            readonly amount: number;
            readonly currency: CurrencyCode;
            readonly method: PaymentMethod;
            readonly status: PaymentStatus;
            readonly createdAt: Date;
            readonly updatedAt: Date;
            readonly error?: string | undefined;
        }[];
        readonly availableMethods: {
            readonly TW: readonly PaymentMethod[];
            readonly MY: readonly PaymentMethod[];
            readonly VN: readonly PaymentMethod[];
        };
        readonly loading: {
            readonly creating: boolean;
            readonly methods: boolean;
            readonly status: boolean;
        };
        readonly errors: {
            readonly payment: string | null;
            readonly validation: {
                readonly [x: string]: string;
            };
        };
        readonly settings: {
            readonly testMode: boolean;
            readonly autoRetry: boolean;
            readonly maxRetries: number;
        };
    }, {
        readonly currentPayment: {
            readonly request: {
                readonly orderId: string;
                readonly restaurantId: number;
                readonly country: CountryCode;
                readonly currency: CurrencyCode;
                readonly amount: number;
                readonly method: PaymentMethod;
                readonly customerInfo?: {
                    readonly name?: string | undefined;
                    readonly email?: string | undefined;
                    readonly phone?: string | undefined;
                } | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly returnUrl?: string | undefined;
                readonly cancelUrl?: string | undefined;
            } | null;
            readonly result: {
                readonly success: boolean;
                readonly transactionId: string;
                readonly status: PaymentStatus;
                readonly clientSecret?: string | undefined;
                readonly redirectUrl?: string | undefined;
                readonly qrCodeData?: string | undefined;
                readonly metadata?: {
                    readonly [x: string]: any;
                } | undefined;
                readonly error?: {
                    readonly code: string;
                    readonly message: string;
                    readonly details?: any;
                } | undefined;
            } | null;
            readonly status: PaymentStatus;
            readonly transactionId: string | null;
            readonly clientSecret: string | null;
            readonly step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
        };
        readonly paymentHistory: readonly {
            readonly id: string;
            readonly orderId: string;
            readonly amount: number;
            readonly currency: CurrencyCode;
            readonly method: PaymentMethod;
            readonly status: PaymentStatus;
            readonly createdAt: Date;
            readonly updatedAt: Date;
            readonly error?: string | undefined;
        }[];
        readonly availableMethods: {
            readonly TW: readonly PaymentMethod[];
            readonly MY: readonly PaymentMethod[];
            readonly VN: readonly PaymentMethod[];
        };
        readonly loading: {
            readonly creating: boolean;
            readonly methods: boolean;
            readonly status: boolean;
        };
        readonly errors: {
            readonly payment: string | null;
            readonly validation: {
                readonly [x: string]: string;
            };
        };
        readonly settings: {
            readonly testMode: boolean;
            readonly autoRetry: boolean;
            readonly maxRetries: number;
        };
    }>>;
    currentStep: import("vue").ComputedRef<"details" | "completed" | "failed" | "method" | "processing" | "idle">;
    isLoading: import("vue").ComputedRef<boolean>;
    hasError: import("vue").ComputedRef<boolean>;
    canRetry: import("vue").ComputedRef<boolean>;
    getCurrentPayment: import("vue").ComputedRef<{
        request: {
            orderId: string;
            restaurantId: number;
            country: CountryCode;
            currency: CurrencyCode;
            amount: number;
            method: PaymentMethod;
            customerInfo?: {
                name?: string | undefined;
                email?: string | undefined;
                phone?: string | undefined;
            } | undefined;
            metadata?: Record<string, any> | undefined;
            returnUrl?: string | undefined;
            cancelUrl?: string | undefined;
        } | null;
        result: {
            success: boolean;
            transactionId: string;
            status: PaymentStatus;
            clientSecret?: string | undefined;
            redirectUrl?: string | undefined;
            qrCodeData?: string | undefined;
            metadata?: Record<string, any> | undefined;
            error?: {
                code: string;
                message: string;
                details?: any;
            } | undefined;
        } | null;
        status: PaymentStatus;
        transactionId: string | null;
        clientSecret: string | null;
        step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
    }>;
    getPaymentHistory: import("vue").ComputedRef<{
        id: string;
        orderId: string;
        amount: number;
        currency: CurrencyCode;
        method: PaymentMethod;
        status: PaymentStatus;
        createdAt: Date;
        updatedAt: Date;
        error?: string | undefined;
    }[]>;
    getPaymentStats: import("vue").ComputedRef<{
        total: number;
        successful: number;
        failed: number;
        pending: number;
        successRate: number;
    }>;
    getAvailableMethodsForCountry: (country: CountryCode) => PaymentMethod[];
    initializePayment: (request: PaymentRequest) => Promise<void>;
    createPayment: (request: PaymentRequest) => Promise<PaymentResult>;
    checkPaymentStatus: (transactionId: string) => Promise<PaymentStatus>;
    refundPayment: (transactionId: string, amount?: number, reason?: string) => Promise<any>;
    loadPaymentMethods: (country: CountryCode) => Promise<void>;
    retryPayment: () => Promise<PaymentResult | null>;
    cancelPayment: () => void;
    setStep: (step: PaymentState["currentPayment"]["step"]) => void;
    setError: (error: string) => void;
    clearErrors: () => void;
    formatAmount: (amount: number, currency: CurrencyCode) => string;
    reset: () => void;
    updateSettings: (newSettings: Partial<PaymentState["settings"]>) => void;
    pollPaymentStatus: (transactionId: string, interval?: number, maxAttempts?: number) => void;
}, "reset" | "setError" | "getAvailableMethodsForCountry" | "initializePayment" | "createPayment" | "checkPaymentStatus" | "refundPayment" | "loadPaymentMethods" | "retryPayment" | "cancelPayment" | "setStep" | "clearErrors" | "formatAmount" | "updateSettings" | "pollPaymentStatus">>;
export type PaymentStore = ReturnType<typeof usePaymentStore>;
export {};
