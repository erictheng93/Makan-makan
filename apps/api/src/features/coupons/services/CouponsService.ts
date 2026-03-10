/**
 * Coupons Feature Service
 *
 * Business logic for coupon management and operations
 */

import { CouponService as BaseCouponService } from "@makanmakan/database";
import type {
  CreateCouponData,
  CouponFilters,
  CouponValidationResult,
  PaginatedCouponsResponse,
  CouponStats,
} from "../types";

export class CouponsService extends BaseCouponService {
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

    // Add pages calculation
    const pages = Math.ceil(result.total / result.limit);

    return {
      coupons: result.coupons,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages,
    };
  }

  /**
   * Create coupon with duplicate check and validation
   */
  async createCouponWithValidation(data: CreateCouponData): Promise<any> {
    // Validate date range
    const validFrom = new Date(data.validFrom);
    const validTo = new Date(data.validTo);

    if (validFrom >= validTo) {
      throw new Error("有效期結束時間必須晚於開始時間");
    }

    // Validate discount value
    if (data.discountType === "percentage" && data.discountValue > 100) {
      throw new Error("百分比折扣不能超過 100%");
    }

    return await this.createCoupon(data);
  }

  /**
   * Get comprehensive coupon statistics
   */
  async getComprehensiveCouponStats(couponId: number): Promise<
    CouponStats & {
      usageByDay: any[];
      topUsers: any[];
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
    userId: number,
    orderAmount?: number,
  ): Promise<any[]> {
    const availableCoupons = await this.getAvailableCoupons(
      restaurantId,
      userId,
    );

    if (!orderAmount) {
      return availableCoupons;
    }

    // Filter by minimum order amount
    return availableCoupons.filter(
      (coupon) =>
        !coupon.minOrderAmount || orderAmount >= coupon.minOrderAmount,
    );
  }

  /**
   * Calculate potential savings for multiple coupons
   */
  async calculatePotentialSavings(
    coupons: any[],
    orderAmount: number,
  ): Promise<Array<{ couponId: number; saving: number }>> {
    const savings = [];

    for (const coupon of coupons) {
      let saving = 0;

      if (coupon.discountType === "percentage") {
        saving = Math.round(orderAmount * (coupon.discountValue / 100));
        if (coupon.maxDiscountAmount && saving > coupon.maxDiscountAmount) {
          saving = coupon.maxDiscountAmount;
        }
      } else {
        saving = coupon.discountValue;
      }

      saving = Math.min(saving, orderAmount);
      savings.push({ couponId: coupon.id, saving });
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
    usageByPeriod: any[];
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
