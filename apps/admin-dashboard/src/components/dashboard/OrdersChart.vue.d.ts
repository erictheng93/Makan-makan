interface OrderDataPoint {
    label: string;
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
    date: string;
}
interface OrdersChartProps {
    data: OrderDataPoint[];
    loading?: boolean;
    period: 'daily' | 'weekly' | 'monthly';
}
declare const _default: import("vue").DefineComponent<OrdersChartProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<OrdersChartProps> & Readonly<{}>, {
    loading: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
