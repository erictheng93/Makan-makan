interface Coupon {
    id: number;
    code: string;
    name: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    maxDiscountAmount?: number;
    usageLimit?: number;
    usedCount: number;
    validFrom: string;
    validTo: string;
    isActive: boolean;
    createdAt: string;
}
interface CouponStats {
    totalUsed: number;
    totalDiscount: number;
    avgDiscount: number;
    lastUsed?: string;
}
interface Props {
    coupon: Coupon;
    stats: CouponStats | null;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    close: () => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onClose?: (() => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
