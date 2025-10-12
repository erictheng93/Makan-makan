interface SeatConfig {
    count: number;
    numberingStyle: 'numeric' | 'alphabetic' | 'custom';
}
interface Props {
    modelValue: 'table' | 'seat';
    seatConfig: SeatConfig;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    "update:modelValue": (value: "table" | "seat") => any;
    "update:seatConfig": (value: SeatConfig) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    "onUpdate:modelValue"?: ((value: "table" | "seat") => any) | undefined;
    "onUpdate:seatConfig"?: ((value: SeatConfig) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
