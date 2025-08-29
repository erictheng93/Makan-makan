type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
interface RecentOrder {
    id: string;
    orderNumber: string;
    tableNumber: string;
    status: OrderStatus;
    total: number;
    itemCount?: number;
    createdAt: string;
    updatedAt: string;
}
interface RecentOrdersProps {
    orders?: RecentOrder[];
    loading?: boolean;
    maxOrders?: number;
}
declare const _default: import("vue").DefineComponent<RecentOrdersProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    orderClick: (order: RecentOrder) => any;
    showMore: () => any;
}, string, import("vue").PublicProps, Readonly<RecentOrdersProps> & Readonly<{
    onOrderClick?: ((order: RecentOrder) => any) | undefined;
    onShowMore?: (() => any) | undefined;
}>, {
    loading: boolean;
    maxOrders: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
