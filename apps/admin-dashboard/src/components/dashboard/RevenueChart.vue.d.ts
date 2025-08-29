interface RevenueDataPoint {
    label: string;
    value: number;
    date: string;
}
interface RevenueChartProps {
    data: RevenueDataPoint[];
    loading?: boolean;
    period: 'daily' | 'weekly' | 'monthly';
}
declare const _default: import("vue").DefineComponent<RevenueChartProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<RevenueChartProps> & Readonly<{}>, {
    loading: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
