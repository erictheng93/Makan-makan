interface MetricDataPoint {
    timestamp: number;
    value: number;
}
interface MetricSeries {
    label: string;
    data: MetricDataPoint[];
    color: string;
    fillColor?: string;
}
interface Props {
    series: MetricSeries[];
    unit?: string;
    showGrid?: boolean;
    height?: number;
    yAxisLabel?: string;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    height: number;
    unit: string;
    showGrid: boolean;
    yAxisLabel: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
