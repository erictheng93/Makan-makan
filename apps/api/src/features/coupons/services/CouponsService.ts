/**
 * Coupons Feature Service
 *
 * Business logic for coupon management and operations
 */

import { CouponService as BaseCouponService } from "@makanmasak/database";
import { badRequest } from "../../../shared/utils/api-error";
import {
  fromCents,
  toCents,
  toRequiredCents,
} from "../../../shared/utils/money";
import type {
  CreateCouponData,
  CouponFilters,
  CouponValidationResult,
  PaginatedCouponsResponse,
  CouponStats,
} from "../types";

interface AvailableCoupon {
  id: number;
  discountType: string;
  discountValue: number;
  discountValueCents?: number | null;
  maxDiscountAmount?: number | null;
  maxDiscountAmountCents?: number | null;
  minOrderAmount?: number | null;
  minOrderAmountCents?: number | null;
}

interface CouponUsageByDay {
  date: string;
  usageCount: number;
  totalDiscount: number;
}

interface CouponTopUser {
  userId: number;
  username?: string | null;
  usageCount: number;
  totalDiscount: number;
}

interface CouponUsageTrendPoint {
  period: string;
  totalUsage: number;
  totalSavings: number;
}

export class CouponsService extends BaseCouponService {
  formatCouponMoneyFields<T extends AvailableCoupon>(coupon: T): T {
    const minOrderAmount = amountFromCents(
      coupon.minOrderAmountCents,
      coupon.minOrderAmount,
    );
    const maxDiscountAmount = amountFromCents(
      coupon.maxDiscountAmountCents,
      coupon.maxDiscountAmount,
    );
    const discountValue =
      coupon.discountType === "percentage"
        ? coupon.discountValue
        : (amountFromCents(coupon.discountValueCents, coupon.discountValue) ??
          coupon.discountValue);

    return {
      ...coupon,
      discountValue,
      maxDiscountAmount,
      minOrderAmount,
    } as T;
  }

  /**
   * Enhanced coupon validation with business rules
   */
  async validateCouponWithBusinessRules(
    code: string,
    restaurantId: string,
    orderAmount: number,
    userId?: number,
    menuItems?: Array<{ menuItemId: number; quantity: number }>,
  ): Promise<CouponValidationResult> {
    // Use base validation
    const baseResult = await this.validateCoupon(
      code,
      restaurantId,
      orderAmount,
      userId,
      menuItems,
    );

    if (!baseResult.valid) {
      return baseResult;
    }

    // Additional business rules can be added here
    // For example: customer tier validation, geographic restrictions, etc.

    return baseResult;
  }

  /**
   * Get coupons with enhanced filtering and sorting
   */
  async getCouponsWithEnhancedFilters(
    filters: CouponFilters = {},
    page = 1,
    limit = 20,
    _sortBy = "createdAt",
    _sortOrder: "desc" | "asc" = "desc",
  ): Promise<PaginatedCouponsResponse> {
    const result = await this.getCoupons(filters, page, limit);
    const couponList = result.coupons.map((coupon) =>
      this.formatCouponMoneyFields(coupon as AvailableCoupon),
    );

    // Add pages calculation
    const pages = Math.ceil(result.total / result.limit);

    return {
      coupons: couponList,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages,
    };
  }

  /**
   * Create coupon with duplicate check and validation
   */
  async createCouponWithValidation(data: CreateCouponData): Promise<unknown> {
    // Validate date range
    const validFrom = new Date(data.validFrom);
    const validTo = new Date(data.validTo);

    if (validFrom >= validTo) {
      throw badRequest("有效期結束時間必須晚於開始時間", "INVALID_DATE_RANGE");
    }

    // Validate discount value
    if (data.discountType === "percentage" && data.discountValue > 100) {
      throw badRequest("百分比折扣不能超過 100%", "INVALID_DISCOUNT_VALUE");
    }

    return await this.createCoupon(data);
  }

  /**
   * Get comprehensive coupon statistics
   */
  async getComprehensiveCouponStats(couponId: number): Promise<
    CouponStats & {
      usageByDay: CouponUsageByDay[];
      topUsers: CouponTopUser[];
      averageOrderValue: number;
    }
  > {
    const baseStats = await this.getCouponStats(couponId);

    // Additional analytics can be added here
    // For now, return base stats with empty additional data
    return {
      ...baseStats,
      usageByDay: [],
      topUsers: [],
      averageOrderValue: 0,
    };
  }

  /**
   * Bulk coupon operations
   */
  async bulkActivateCoupons(
    couponIds: number[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const id of couponIds) {
      try {
        await this.updateCoupon(id, { isActive: true });
        success++;
      } catch (error) {
        failed++;
        console.error(`Failed to activate coupon ${id}:`, error);
      }
    }

    return { success, failed };
  }

  async bulkDeactivateCoupons(
    couponIds: number[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const id of couponIds) {
      try {
        await this.deactivateCoupon(id);
        success++;
      } catch (error) {
        failed++;
        console.error(`Failed to deactivate coupon ${id}:`, error);
      }
    }

    return { success, failed };
  }

  async bulkDeleteCoupons(
    couponIds: number[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const id of couponIds) {
      try {
        await this.deleteCoupon(id);
        success++;
      } catch (error) {
        failed++;
        console.error(`Failed to delete coupon ${id}:`, error);
      }
    }

    return { success, failed };
  }

  /**
   * Get available coupons for a specific user
   */
  async getAvailableCouponsForUser(
    restaurantId: string,
    userId?: number,
    orderAmount?: number,
  ): Promise<AvailableCoupon[]> {
    const availableCoupons = (
      (await this.getAvailableCoupons(
        restaurantId,
        userId,
      )) as AvailableCoupon[]
    ).map((coupon) => this.formatCouponMoneyFields(coupon));

    if (!orderAmount) {
      return availableCoupons;
    }

    // Filter by minimum order amount
    return availableCoupons.filter((coupon) => {
      const minOrderAmount = amountFromCents(
        coupon.minOrderAmountCents,
        coupon.minOrderAmount,
      );

      return !minOrderAmount || orderAmount >= minOrderAmount;
    });
  }

  /**
   * Calculate potential savings for multiple coupons
   */
  async calculatePotentialSavings(
    coupons: AvailableCoupon[],
    orderAmount: number,
  ): Promise<Array<{ couponId: number; saving: number }>> {
    const savings = [];
    const orderAmountCents = toRequiredCents(orderAmount);

    for (const coupon of coupons) {
      const normalizedCoupon = this.formatCouponMoneyFields(coupon);
      let savingCents = 0;

      if (normalizedCoupon.discountType === "percentage") {
        savingCents = Math.round(
          orderAmountCents * (normalizedCoupon.discountValue / 100),
        );
        const maxDiscountAmountCents = toCents(
          normalizedCoupon.maxDiscountAmount,
        );
        if (maxDiscountAmountCents && savingCents > maxDiscountAmountCents) {
          savingCents = maxDiscountAmountCents;
        }
      } else {
        savingCents = toRequiredCents(normalizedCoupon.discountValue);
      }

      savingCents = Math.min(savingCents, orderAmountCents);
      savings.push({ couponId: coupon.id, saving: fromCents(savingCents) });
    }

    return savings;
  }

  /**
   * Get coupon usage trends
   */
  async getCouponUsageTrends(
    _restaurantId?: string,
    _startDate?: string,
    _endDate?: string,
  ): Promise<{
    totalCoupons: number;
    activeCoupons: number;
    totalUsage: number;
    totalSavings: number;
    usageByPeriod: CouponUsageTrendPoint[];
  }> {
    // This would require more complex database queries
    // For now, return mock data structure
    return {
      totalCoupons: 0,
      activeCoupons: 0,
      totalUsage: 0,
      totalSavings: 0,
      usageByPeriod: [],
    };
  }
}

function amountFromCents(
  cents: number | null | undefined,
  fallback: number | null | undefined,
): number | null {
  return cents == null ? (fallback ?? null) : fromCents(cents);
}
