interface ErrorDetails {
    code: string;
    message: string;
}
interface Props {
    status: "processing" | "success" | "error" | "cancelled";
    transactionId?: string;
    errorMessage?: string;
    errorDetails?: ErrorDetails;
    retryDisabled?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    close: () => any;
    retry: () => any;
    "continue-shopping": () => any;
    "view-order": () => any;
    "contact-support": () => any;
    "cancel-order": () => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onClose?: (() => any) | undefined;
    onRetry?: (() => any) | undefined;
    "onContinue-shopping"?: (() => any) | undefined;
    "onView-order"?: (() => any) | undefined;
    "onContact-support"?: (() => any) | undefined;
    "onCancel-order"?: (() => any) | undefined;
}>, {
    retryDisabled: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
