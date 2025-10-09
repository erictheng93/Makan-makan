interface Props {
    clientSecret?: string;
    publishableKey: string;
    amount: number;
    currency: string;
    country: "TW" | "MY" | "VN";
    customerEmail?: string;
    appearance?: "default" | "minimal" | "accordion";
    loading?: boolean;
    showPayButton?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    "payment-success": (data: {
        transactionId: string;
        paymentMethod: any;
    }) => any;
    "payment-error": (error: string) => any;
    "payment-processing": (isProcessing: boolean) => any;
    "card-change": (data: {
        complete: boolean;
        error?: string;
    }) => any;
    "element-ready": () => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    "onPayment-success"?: ((data: {
        transactionId: string;
        paymentMethod: any;
    }) => any) | undefined;
    "onPayment-error"?: ((error: string) => any) | undefined;
    "onPayment-processing"?: ((isProcessing: boolean) => any) | undefined;
    "onCard-change"?: ((data: {
        complete: boolean;
        error?: string;
    }) => any) | undefined;
    "onElement-ready"?: (() => any) | undefined;
}>, {
    loading: boolean;
    appearance: "default" | "minimal" | "accordion";
    showPayButton: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
