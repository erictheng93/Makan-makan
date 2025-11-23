interface DataPoint {
    timestamp: number;
    value: number;
    label?: string;
}
interface Props {
    data: DataPoint[];
    label: string;
    color?: string;
    fillColor?: string;
    unit?: string;
    showGrid?: boolean;
    height?: number;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    color: string;
    height: number;
    unit: string;
    showGrid: boolean;
    fillColor: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
