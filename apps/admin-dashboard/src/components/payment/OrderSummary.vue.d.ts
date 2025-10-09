import type { PaymentMethod, CountryCode, CurrencyCode } from "@makanmakan/shared-types";
interface OrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    customizations?: string[];
    notes?: string;
}
interface Order {
    id: string;
    restaurantId: number;
    restaurantName?: string;
    tableNumber?: string;
    country: CountryCode;
    currency: CurrencyCode;
    items: OrderItem[];
    subtotal: number;
    tax?: number;
    serviceFee?: number;
    deliveryFee?: number;
    discount?: number;
    total: number;
}
interface Props {
    order?: Order | null;
    loading?: boolean;
    showBreakdown?: boolean;
    selectedPaymentMethod?: PaymentMethod;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{}>, {
    loading: boolean;
    showBreakdown: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
