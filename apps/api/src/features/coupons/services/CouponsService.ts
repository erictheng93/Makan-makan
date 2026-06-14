/**
 * Coupons Feature Service
 *
 * Business logic for coupon management and operations
 */

import { CouponService as BaseCouponService } from "@makanmakan/database";
import { coupons, couponUsage, orders } from "@makanmakan/database";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  badRequest,
  forbidden,
  notFound,
} from "../../../shared/utils/api-error";
import {
  fromCents,
  percentageFromBps,
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
  discountPercentageBps?: number | null;
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
    const minOrderAmount = amountFromCents(coupon.minOrderAmountCents);
    const maxDiscountAmount = amountFromCents(coupon.maxDiscountAmountCents);
    const discountValue =
      coupon.discountType === "percentage"
        ? (percentageFromBps(coupon.discountPercentageBps) ?? 0)
        : (amountFromCents(coupon.discountValueCents) ?? 0);

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
      const minOrderAmount = amountFromCents(coupon.minOrderAmountCents);

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

  async useCouponForOrder(input: {
    couponId: number;
    orderId: number;
    userId?: number;
    allowedRestaurantId?: string;
  }) {
    const [order] = await this.db
      .select({
        id: orders.id,
        restaurantId: orders.restaurantId,
        subtotalCents: orders.subtotalCents,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (!order) {
      throw notFound("Order not found", "ORDER_NOT_FOUND");
    }

    if (
      input.allowedRestaurantId &&
      order.restaurantId !== input.allowedRestaurantId
    ) {
      throw forbidden("Access denied", "FORBIDDEN");
    }

    const [coupon] = await this.db
      .select()
      .from(coupons)
      .where(eq(coupons.id, input.couponId))
      .limit(1);

    if (!coupon || coupon.deletedAt) {
      throw notFound("Coupon not found", "COUPON_NOT_FOUND");
    }

    if (coupon.restaurantId && coupon.restaurantId !== order.restaurantId) {
      throw forbidden("Coupon does not belong to this order", "FORBIDDEN");
    }

    const originalAmountCents = order.subtotalCents ?? 0;
    let discountAmountCents = 0;

    if (coupon.discountType === "percentage") {
      const discountPercentage =
        percentageFromBps(coupon.discountPercentageBps) ?? 0;
      discountAmountCents = Math.round(
        originalAmountCents * (discountPercentage / 100),
      );
      const maxDiscountAmountCents = coupon.maxDiscountAmountCents;
      if (
        maxDiscountAmountCents != null &&
        discountAmountCents > maxDiscountAmountCents
      ) {
        discountAmountCents = maxDiscountAmountCents;
      }
    } else {
      discountAmountCents = coupon.discountValueCents ?? 0;
    }

    discountAmountCents = Math.max(
      0,
      Math.min(discountAmountCents, originalAmountCents),
    );
    const finalAmountCents = originalAmountCents - discountAmountCents;

    return this.useCoupon({
      couponId: input.couponId,
      orderId: input.orderId,
      userId: input.userId,
      discountAmount: fromCents(discountAmountCents),
      originalAmount: fromCents(originalAmountCents),
      finalAmount: fromCents(finalAmountCents),
    });
  }

  /**
   * Get coupon usage trends
   */
  async getCouponUsageTrends(
    restaurantId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    totalCoupons: number;
    activeCoupons: number;
    totalUsage: number;
    totalSavings: number;
    usageByPeriod: CouponUsageTrendPoint[];
  }> {
    const now = new Date().toISOString();
    const couponWhere = restaurantId
      ? sql`(${coupons.restaurantId} = ${restaurantId} OR ${coupons.restaurantId} IS NULL)`
      : undefined;
    const usageWhere = this.buildCouponUsageTrendWhere(
      restaurantId,
      startDate,
      endDate,
    );

    const [couponCounts, usageTotals, usageByPeriod] = await Promise.all([
      this.db
        .select({
          totalCoupons: sql<number>`count(*)`,
          activeCoupons: sql<number>`coalesce(sum(CASE
            WHEN ${coupons.isActive} = 1
              AND ${coupons.isVisible} = 1
              AND ${coupons.validFrom} <= ${now}
              AND ${coupons.validTo} >= ${now}
              AND (${coupons.usageLimit} IS NULL OR coalesce(${coupons.usedCount}, 0) < ${coupons.usageLimit})
            THEN 1 ELSE 0 END), 0)`,
        })
        .from(coupons)
        .where(couponWhere),
      this.db
        .select({
          totalUsage: sql<number>`count(${couponUsage.id})`,
          totalSavings: sql<number>`coalesce(sum(COALESCE(${couponUsage.discountAmountCents}, 0)), 0) / 100.0`,
        })
        .from(couponUsage)
        .innerJoin(coupons, eq(couponUsage.couponId, coupons.id))
        .where(usageWhere),
      this.db
        .select({
          period: sql<string>`date(${couponUsage.usedAt} / 1000, 'unixepoch')`,
          totalUsage: sql<number>`count(${couponUsage.id})`,
          totalSavings: sql<number>`coalesce(sum(COALESCE(${couponUsage.discountAmountCents}, 0)), 0) / 100.0`,
        })
        .from(couponUsage)
        .innerJoin(coupons, eq(couponUsage.couponId, coupons.id))
        .where(usageWhere)
        .groupBy(sql`date(${couponUsage.usedAt} / 1000, 'unixepoch')`)
        .orderBy(sql`date(${couponUsage.usedAt} / 1000, 'unixepoch') ASC`),
    ]);

    return {
      totalCoupons: couponCounts[0]?.totalCoupons ?? 0,
      activeCoupons: couponCounts[0]?.activeCoupons ?? 0,
      totalUsage: usageTotals[0]?.totalUsage ?? 0,
      totalSavings: usageTotals[0]?.totalSavings ?? 0,
      usageByPeriod,
    };
  }

  private buildCouponUsageTrendWhere(
    restaurantId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const conditions = [eq(couponUsage.status, "active")];

    if (restaurantId) {
      conditions.push(
        sql`(${coupons.restaurantId} = ${restaurantId} OR ${coupons.restaurantId} IS NULL)`,
      );
    }

    const start = parseDateFilter(startDate);
    if (start) {
      conditions.push(gte(couponUsage.usedAt, start));
    }

    const end = parseDateFilter(endDate);
    if (end) {
      conditions.push(lte(couponUsage.usedAt, end));
    }

    let where = conditions[0];
    for (const condition of conditions.slice(1)) {
      where = and(where, condition)!;
    }
    return where;
  }
}

function parseDateFilter(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function amountFromCents(
  cents: number | null | undefined,
  fallback?: number | null | undefined,
): number | null {
  return cents == null ? (fallback ?? null) : fromCents(cents);
}
