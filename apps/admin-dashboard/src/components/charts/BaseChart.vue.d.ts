interface ChartDataset {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
}
interface ChartData {
    labels: string[];
    datasets: ChartDataset[];
}
interface Props {
    type: 'bar' | 'line' | 'pie' | 'doughnut';
    data: ChartData;
    options?: Record<string, any>;
    height?: number;
    isLoading?: boolean;
    error?: string;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    isLoading: boolean;
    error: string;
    height: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
