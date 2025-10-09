interface PaymentStep {
    key: string;
    label: string;
    description?: string;
    icon?: string;
}
interface Props {
    currentStep: string;
    steps: PaymentStep[];
    showDescriptions?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    showDescriptions: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
