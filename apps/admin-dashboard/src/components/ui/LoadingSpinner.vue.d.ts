interface Props {
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    color?: "primary" | "secondary" | "white" | "gray" | "success" | "error" | "warning";
    text?: string;
    showText?: boolean;
    center?: boolean;
    overlay?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    size: "xs" | "sm" | "md" | "lg" | "xl";
    text: string;
    color: "primary" | "secondary" | "white" | "gray" | "success" | "error" | "warning";
    overlay: boolean;
    center: boolean;
    showText: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
