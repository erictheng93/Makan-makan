import type { PaymentMethod, CountryCode } from "@makanmakan/shared-types";
interface Props {
    availableMethods: PaymentMethod[];
    selectedMethod?: PaymentMethod;
    country: CountryCode;
    loading?: boolean;
    showRegionalHint?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    retry: () => any;
    "update:selectedMethod": (method: PaymentMethod) => any;
    "method-selected": (method: PaymentMethod) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onRetry?: (() => any) | undefined;
    "onUpdate:selectedMethod"?: ((method: PaymentMethod) => any) | undefined;
    "onMethod-selected"?: ((method: PaymentMethod) => any) | undefined;
}>, {
    loading: boolean;
    showRegionalHint: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
