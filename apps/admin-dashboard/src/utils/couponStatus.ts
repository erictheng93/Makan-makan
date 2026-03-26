export type CouponStatus =
  | "inactive"
  | "expired"
  | "exhausted"
  | "scheduled"
  | "active";

export const getCouponStatus = (coupon: {
  isActive: boolean;
  validFrom: string;
  validTo: string;
  usageLimit?: number;
  usedCount: number;
}): CouponStatus => {
  if (!coupon.isActive) return "inactive";
  if (new Date() > new Date(coupon.validTo)) return "expired";
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    return "exhausted";
  if (new Date() < new Date(coupon.validFrom)) return "scheduled";
  return "active";
};
