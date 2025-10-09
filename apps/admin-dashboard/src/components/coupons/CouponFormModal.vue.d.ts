interface Props {
    coupon?: {
        id: number;
        code: string;
        name: string;
        description?: string;
        discountType: "percentage" | "fixed";
        discountValue: number;
        maxDiscountAmount?: number;
        minOrderAmount: number;
        usageLimit?: number;
        usageLimitPerUser?: number;
        validFrom: string;
        validTo: string;
        isActive: boolean;
        isVisible: boolean;
    };
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    close: () => any;
    save: (couponData: any) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onClose?: (() => any) | undefined;
    onSave?: ((couponData: any) => any) | undefined;
}>, {
    coupon: {
        id: number;
        code: string;
        name: string;
        description?: string;
        discountType: "percentage" | "fixed";
        discountValue: number;
        maxDiscountAmount?: number;
        minOrderAmount: number;
        usageLimit?: number;
        usageLimitPerUser?: number;
        validFrom: string;
        validTo: string;
        isActive: boolean;
        isVisible: boolean;
    };
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
