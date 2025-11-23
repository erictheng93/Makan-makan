interface DataPoint {
    label: string;
    value: number;
    color?: string;
}
interface Props {
    data: DataPoint[];
    title?: string;
    unit?: string;
    showGrid?: boolean;
    height?: number;
    horizontal?: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    title: string;
    height: number;
    unit: string;
    showGrid: boolean;
    horizontal: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
