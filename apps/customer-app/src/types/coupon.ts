export interface CustomerCoupon {
  id: string | number;
  code: string;
  name: string;
  description?: string;
  discountType: "percentage" | "fixed" | string;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  expiresAt?: string | number | Date;
  validTo?: string | number | Date;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: CustomerCoupon;
  discountAmount?: number;
  error?: string;
}
