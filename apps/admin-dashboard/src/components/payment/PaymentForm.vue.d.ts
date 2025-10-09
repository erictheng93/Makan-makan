import type { CountryCode } from "@makanmakan/shared-types";
interface Props {
    orderId: string;
    restaurantId: number;
    country: CountryCode;
    currency: "TWD" | "MYR" | "VND";
    amount: number;
    autoStart?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    "payment-success": (transactionId: string) => any;
    "payment-error": (error: string) => any;
    "payment-cancel": () => any;
    "step-change": (step: string) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    "onPayment-success"?: ((transactionId: string) => any) | undefined;
    "onPayment-error"?: ((error: string) => any) | undefined;
    "onPayment-cancel"?: (() => any) | undefined;
    "onStep-change"?: ((step: string) => any) | undefined;
}>, {
    autoStart: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
