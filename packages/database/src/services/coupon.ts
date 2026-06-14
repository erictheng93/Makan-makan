import { eq, and, gte, lte, sql, desc, asc, inArray } from "drizzle-orm";
import { BaseService } from "./base";
import { coupons, couponUsage, menuItems as menuItemsTable } from "../schema";
import type {
  DiscountType,
  DistributionType,
  TargetType,
  UsageStatus,
} from "../schema";
import {
  amountFromCents,
  fromCents,
  percentageFromBps,
  toCents,
  toRequiredPercentageBps,
  toRequiredCents,
} from "../utils/money";

// 優惠券驗證結果接口
export interface CouponValidationResult {
  valid: boolean;
  coupon?: any;
  error?: string;
  discountAmount?: number;
  finalAmount?: number;
}

// 優惠券創建資料接口
export interface CreateCouponData {
  restaurantId?: string;
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  applicableMenuItems?: number[];
  applicableCategories?: number[];
  usageLimit?: number;
  usageLimitPerUser?: number;
  validFrom: string;
  validTo: string;
  isActive?: boolean;
  isVisible?: boolean;
  createdBy?: number;
}

// 優惠券使用資料接口
export interface UseCouponData {
  couponId: number;
  orderId: number;
  userId?: number;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
}

// 優惠券查詢過濾器
export interface CouponFilters {
  restaurantId?: string;
  isActive?: boolean;
  isVisible?: boolean;
  discountType?: DiscountType;
  validOnly?: boolean;
  search?: string;
}

export class CouponService extends BaseService {
  private mapCouponMoneyFields<T extends Record<string, any>>(coupon: T): T {
    const hasDiscountValue =
      "discountValue" in coupon || "discountValueCents" in coupon;
    const hasMaxDiscountAmount =
      "maxDiscountAmount" in coupon || "maxDiscountAmountCents" in coupon;
    const hasMinOrderAmount =
      "minOrderAmount" in coupon || "minOrderAmountCents" in coupon;

    const normalized: Record<string, any> = {
      ...coupon,
    };

    if (hasDiscountValue) {
      normalized.discountValue =
        coupon.discountType === "percentage"
          ? (percentageFromBps(
              coupon.discountPercentageBps,
              coupon.discountValue,
            ) ?? coupon.discountValue)
          : (amountFromCents(coupon.discountValueCents, coupon.discountValue) ??
            coupon.discountValue);
    }

    if (hasMaxDiscountAmount) {
      normalized.maxDiscountAmount = amountFromCents(
        coupon.maxDiscountAmountCents,
        coupon.maxDiscountAmount,
      );
    }

    if (hasMinOrderAmount) {
      normalized.minOrderAmount = amountFromCents(
        coupon.minOrderAmountCents,
        coupon.minOrderAmount,
      );
    }

    return normalized as T;
  }

  /**
   * 驗證優惠券代碼
   * @param code 優惠券代碼
   * @param restaurantId 餐廳ID
   * @param orderAmount 訂單金額
   * @param userId 用戶ID (可選)
   * @param menuItems 訂單商品 (用於檢查適用商品)
   */
  async validateCoupon(
    code: string,
    restaurantId: string,
    orderAmount: number,
    userId?: number,
    menuItems?: Array<{ menuItemId: number; quantity: number }>,
  ): Promise<CouponValidationResult> {
    try {
      // 查找優惠券
      const coupon = await this.db.query.coupons.findFirst({
        where: and(
          eq(coupons.code, code.toUpperCase()),
          eq(coupons.isActive, true),
          eq(coupons.isVisible, true),
          // 優惠券適用於指定餐廳或全平台
          sql`(${coupons.restaurantId} = ${restaurantId} OR ${coupons.restaurantId} IS NULL)`,
        ),
      });

      if (!coupon) {
        return { valid: false, error: "優惠券代碼不存在或已失效" };
      }

      // 檢查有效期
      const now = new Date();
      const validFrom = new Date(coupon.validFrom);
      const validTo = new Date(coupon.validTo);

      if (now < validFrom || now > validTo) {
        return { valid: false, error: "優惠券已過期或尚未生效" };
      }

      // 檢查使用次數限制
      if (coupon.usageLimit && (coupon.usedCount || 0) >= coupon.usageLimit) {
        return { valid: false, error: "優惠券使用次數已達上限" };
      }

      const orderAmountCents = toRequiredCents(orderAmount);
      const minOrderAmount = amountFromCents(
        coupon.minOrderAmountCents,
        coupon.minOrderAmount,
      );

      // 檢查最低訂單金額
      if (minOrderAmount && orderAmount < minOrderAmount) {
        return {
          valid: false,
          error: `訂單金額需滿 $${minOrderAmount} 才可使用此優惠券`,
        };
      }

      // 檢查用戶使用次數限制
      if (coupon.usageLimitPerUser && userId) {
        const userUsageCount = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(couponUsage)
          .where(
            and(
              eq(couponUsage.couponId, coupon.id),
              eq(couponUsage.userId, userId),
              eq(couponUsage.status, "active"),
            ),
          );

        if (userUsageCount[0]?.count >= coupon.usageLimitPerUser) {
          return { valid: false, error: "您已達到此優惠券的使用次數上限" };
        }
      }

      // 檢查適用商品限制
      if (coupon.applicableMenuItems && menuItems) {
        const applicableItems = coupon.applicableMenuItems as number[];
        const hasApplicableItem = menuItems.some((item) =>
          applicableItems.includes(item.menuItemId),
        );

        if (!hasApplicableItem) {
          return { valid: false, error: "此優惠券不適用於購物車中的商品" };
        }
      }

      // 檢查適用分類限制
      if (coupon.applicableCategories && menuItems) {
        const applicableCategories = coupon.applicableCategories as number[];

        // 查詢商品的分類資訊
        const menuItemIds = menuItems.map((item) => item.menuItemId);
        const itemCategories = await this.db.query.menuItems.findMany({
          where: inArray(menuItemsTable.id, menuItemIds),
          with: {
            category: true,
          },
        });

        const hasApplicableCategory = itemCategories.some(
          (item) =>
            item.category && applicableCategories.includes(item.category.id),
        );

        if (!hasApplicableCategory) {
          return { valid: false, error: "此優惠券不適用於購物車中商品的分類" };
        }
      }

      // 計算折扣金額
      let discountAmountCents = 0;
      if (coupon.discountType === "percentage") {
        const discountPercentage =
          percentageFromBps(
            coupon.discountPercentageBps,
            coupon.discountValue,
          ) ?? coupon.discountValue;
        discountAmountCents = Math.round(
          orderAmountCents * (discountPercentage / 100),
        );

        // 應用最大折扣金額限制
        const maxDiscountAmountCents = toCents(
          amountFromCents(
            coupon.maxDiscountAmountCents,
            coupon.maxDiscountAmount,
          ),
        );
        if (
          maxDiscountAmountCents &&
          discountAmountCents > maxDiscountAmountCents
        ) {
          discountAmountCents = maxDiscountAmountCents;
        }
      } else {
        discountAmountCents =
          coupon.discountValueCents ?? toRequiredCents(coupon.discountValue);
      }

      // 確保折扣金額不超過訂單金額
      discountAmountCents = Math.min(discountAmountCents, orderAmountCents);
      const finalAmountCents = Math.max(
        0,
        orderAmountCents - discountAmountCents,
      );
      const discountAmount = fromCents(discountAmountCents);
      const finalAmount = fromCents(finalAmountCents);

      return {
        valid: true,
        coupon: this.mapCouponMoneyFields(coupon),
        discountAmount,
        finalAmount,
      };
    } catch (error) {
      console.error("Coupon validation error:", error);
      return { valid: false, error: "優惠券驗證失敗，請稍後再試" };
    }
  }

  /**
   * 記錄優惠券使用
   */
  async useCoupon(data: UseCouponData) {
    const [existingUsage] = await this.db
      .select({ id: couponUsage.id })
      .from(couponUsage)
      .where(
        and(
          eq(couponUsage.couponId, data.couponId),
          eq(couponUsage.orderId, data.orderId),
          sql`(${couponUsage.status} IS NULL OR ${couponUsage.status} != 'cancelled')`,
        ),
      )
      .limit(1);

    if (existingUsage) {
      throw new Error("Coupon already used for this order");
    }

    await this.claimUsageSlot(data.couponId);

    try {
      const usageRecord = await this.db
        .insert(couponUsage)
        .values({
          couponId: data.couponId,
          orderId: data.orderId,
          userId: data.userId,
          discountAmount: data.discountAmount,
          originalAmount: data.originalAmount,
          finalAmount: data.finalAmount,
          discountAmountCents: toRequiredCents(data.discountAmount),
          originalAmountCents: toRequiredCents(data.originalAmount),
          finalAmountCents: toRequiredCents(data.finalAmount),
          status: "active",
        })
        .returning();

      return usageRecord[0];
    } catch (error) {
      try {
        await this.releaseUsageSlot(data.couponId);
      } catch (rollbackError) {
        console.error("Coupon usage count rollback failed:", rollbackError);
      }

      throw error;
    }
  }

  /**
   * 原子地佔用一個使用名額（條件式 UPDATE，內含上限檢查）。
   * 名額已滿時擲出錯誤。後續消費名額的寫入若失敗，
   * 呼叫端必須以 releaseUsageSlot() 歸還。
   */
  async claimUsageSlot(couponId: number): Promise<void> {
    const claim = await this.d1
      .prepare(
        `UPDATE coupons
            SET used_count = coalesce(used_count, 0) + 1,
                updated_at_ms = unixepoch('now') * 1000
          WHERE id = ?
            AND (usage_limit IS NULL OR coalesce(used_count, 0) < usage_limit)`,
      )
      .bind(couponId)
      .run();

    if ((claim.meta?.changes ?? 0) === 0) {
      throw new Error("Coupon usage limit reached");
    }
  }

  /**
   * 歸還一個先前佔用的使用名額（claimUsageSlot 的補償操作）。
   */
  async releaseUsageSlot(couponId: number): Promise<void> {
    await this.d1
      .prepare(
        `UPDATE coupons
            SET used_count = CASE
                  WHEN coalesce(used_count, 0) > 0
                  THEN coalesce(used_count, 0) - 1
                  ELSE 0
                END,
                updated_at_ms = unixepoch('now') * 1000
          WHERE id = ?`,
      )
      .bind(couponId)
      .run();
  }

  /**
   * 創建優惠券
   */
  async createCoupon(data: CreateCouponData): Promise<any> {
    // 檢查代碼是否已存在
    const existingCoupon = await this.db.query.coupons.findFirst({
      where: eq(coupons.code, data.code.toUpperCase()),
    });

    if (existingCoupon) {
      throw new Error("優惠券代碼已存在");
    }

    const coupon = await this.db
      .insert(coupons)
      .values({
        restaurantId: data.restaurantId,
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscountAmount: data.maxDiscountAmount,
        minOrderAmount: data.minOrderAmount || 0,
        discountPercentageBps:
          data.discountType === "percentage"
            ? toRequiredPercentageBps(data.discountValue)
            : null,
        discountValueCents:
          data.discountType === "percentage"
            ? null
            : toRequiredCents(data.discountValue),
        maxDiscountAmountCents: toCents(data.maxDiscountAmount),
        minOrderAmountCents: toRequiredCents(data.minOrderAmount || 0),
        applicableMenuItems: data.applicableMenuItems,
        applicableCategories: data.applicableCategories,
        usageLimit: data.usageLimit,
        usageLimitPerUser: data.usageLimitPerUser,
        validFrom: data.validFrom,
        validTo: data.validTo,
        isActive: data.isActive !== false,
        isVisible: data.isVisible !== false,
        createdBy: data.createdBy,
      })
      .returning();

    return coupon[0] ? this.mapCouponMoneyFields(coupon[0]) : coupon[0];
  }

  /**
   * 獲取優惠券列表
   */
  async getCoupons(
    filters: CouponFilters = {},
    page = 1,
    limit = 20,
  ): Promise<{ coupons: any[]; total: number; page: number; limit: number }> {
    const whereConditions = [];

    if (filters.restaurantId) {
      whereConditions.push(
        sql`(${coupons.restaurantId} = ${filters.restaurantId} OR ${coupons.restaurantId} IS NULL)`,
      );
    }

    if (filters.isActive !== undefined) {
      whereConditions.push(eq(coupons.isActive, filters.isActive));
    }

    if (filters.isVisible !== undefined) {
      whereConditions.push(eq(coupons.isVisible, filters.isVisible));
    }

    if (filters.discountType) {
      whereConditions.push(eq(coupons.discountType, filters.discountType));
    }

    if (filters.validOnly) {
      const now = new Date().toISOString();
      whereConditions.push(
        and(lte(coupons.validFrom, now), gte(coupons.validTo, now)),
      );
    }

    if (filters.search) {
      whereConditions.push(
        sql`(${coupons.name} LIKE ${"%" + filters.search + "%"} OR ${coupons.code} LIKE ${"%" + filters.search.toUpperCase() + "%"})`,
      );
    }

    const whereClause =
      whereConditions.length > 0
        ? whereConditions.reduce((acc, condition) => and(acc, condition))
        : undefined;

    // 查詢總數
    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(coupons)
      .where(whereClause);

    const total = totalResult[0]?.count || 0;

    // 查詢資料
    const couponList = await this.db.query.coupons.findMany({
      where: whereClause,
      orderBy: [desc(coupons.createdAt)],
      limit,
      offset: (page - 1) * limit,
      with: {
        restaurant: {
          columns: {
            id: true,
            name: true,
          },
        },
        creator: {
          columns: {
            id: true,
            username: true,
          },
        },
      },
    });

    return {
      coupons: couponList.map((coupon) => this.mapCouponMoneyFields(coupon)),
      total,
      page,
      limit,
    };
  }

  /**
   * 獲取單個優惠券詳情
   */
  async getCoupon(id: number): Promise<any | null> {
    const coupon = await this.db.query.coupons.findFirst({
      where: eq(coupons.id, id),
      with: {
        restaurant: {
          columns: {
            id: true,
            name: true,
          },
        },
        creator: {
          columns: {
            id: true,
            username: true,
          },
        },
        usages: {
          orderBy: [desc(couponUsage.usedAt)],
          limit: 10,
          with: {
            order: {
              columns: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                totalAmountCents: true,
              },
            },
            user: {
              columns: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!coupon) {
      return null;
    }

    return this.mapCouponMoneyFields({
      ...coupon,
      usages: coupon.usages?.map((usage: any) => ({
        ...usage,
        order: usage.order
          ? {
              ...usage.order,
              totalAmount: amountFromCents(
                usage.order.totalAmountCents,
                usage.order.totalAmount,
              ),
            }
          : usage.order,
      })),
    });
  }

  /**
   * 更新優惠券
   */
  async updateCoupon(
    id: number,
    updates: Partial<CreateCouponData>,
  ): Promise<any> {
    const centsUpdates: Record<string, number | null | undefined> = {};
    if (
      updates.discountValue !== undefined ||
      updates.discountType !== undefined
    ) {
      const current =
        updates.discountType === undefined ||
        updates.discountValue === undefined
          ? await this.db.query.coupons.findFirst({
              where: eq(coupons.id, id),
            })
          : undefined;
      const discountType = updates.discountType ?? current?.discountType;
      const discountValue = updates.discountValue ?? current?.discountValue;
      centsUpdates.discountValueCents =
        discountType === "percentage"
          ? null
          : discountValue === undefined
            ? undefined
            : toRequiredCents(discountValue);
      centsUpdates.discountPercentageBps =
        discountType === "percentage" && discountValue !== undefined
          ? toRequiredPercentageBps(discountValue)
          : discountType === undefined
            ? undefined
            : null;
    }
    if (updates.maxDiscountAmount !== undefined) {
      centsUpdates.maxDiscountAmountCents = toCents(updates.maxDiscountAmount);
    }
    if (updates.minOrderAmount !== undefined) {
      centsUpdates.minOrderAmountCents = toRequiredCents(
        updates.minOrderAmount,
      );
    }

    const coupon = await this.db
      .update(coupons)
      .set({
        ...updates,
        ...centsUpdates,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, id))
      .returning();

    return coupon[0] ? this.mapCouponMoneyFields(coupon[0]) : coupon[0];
  }

  /**
   * 停用優惠券
   */
  async deactivateCoupon(id: number): Promise<any> {
    return await this.updateCoupon(id, { isActive: false });
  }

  /**
   * 刪除優惠券
   */
  async deleteCoupon(id: number): Promise<void> {
    await this.db.delete(coupons).where(eq(coupons.id, id));
  }

  /**
   * 獲取優惠券使用統計
   */
  async getCouponStats(couponId: number): Promise<any> {
    const stats = await this.db
      .select({
        totalUsed: sql<number>`count(*)`,
        totalDiscount: sql<number>`sum(COALESCE(${couponUsage.discountAmountCents}, CAST(round(${couponUsage.discountAmount} * 100) AS integer))) / 100.0`,
        avgDiscount: sql<number>`avg(COALESCE(${couponUsage.discountAmountCents}, CAST(round(${couponUsage.discountAmount} * 100) AS integer))) / 100.0`,
        lastUsed: sql<string>`max(${couponUsage.usedAt})`,
      })
      .from(couponUsage)
      .where(
        and(
          eq(couponUsage.couponId, couponId),
          eq(couponUsage.status, "active"),
        ),
      );

    return stats[0];
  }

  /**
   * 獲取優惠券彙總統計（跨所有優惠券）
   */
  async getCouponSummaryStats(restaurantId?: string): Promise<{
    total: number;
    active: number;
    totalUsed: number;
    totalSavings: number;
  }> {
    const restaurantFilter = restaurantId
      ? sql`(${coupons.restaurantId} = ${restaurantId} OR ${coupons.restaurantId} IS NULL)`
      : undefined;

    const now = new Date().toISOString();

    // Total and active counts from coupons table
    const couponCounts = await this.db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`sum(CASE
          WHEN ${coupons.isActive} = 1
            AND ${coupons.validFrom} <= ${now}
            AND ${coupons.validTo} >= ${now}
            AND (${coupons.usageLimit} IS NULL OR ${coupons.usedCount} < ${coupons.usageLimit})
          THEN 1 ELSE 0 END)`,
        totalUsed: sql<number>`coalesce(sum(${coupons.usedCount}), 0)`,
      })
      .from(coupons)
      .where(restaurantFilter);

    // Total savings from coupon_usage table
    const savingsResult = restaurantId
      ? await this.db
          .select({
            totalSavings: sql<number>`coalesce(sum(COALESCE(${couponUsage.discountAmountCents}, CAST(round(${couponUsage.discountAmount} * 100) AS integer))), 0) / 100.0`,
          })
          .from(couponUsage)
          .innerJoin(coupons, eq(couponUsage.couponId, coupons.id))
          .where(
            and(
              eq(couponUsage.status, "active"),
              sql`(${coupons.restaurantId} = ${restaurantId} OR ${coupons.restaurantId} IS NULL)`,
            ),
          )
      : await this.db
          .select({
            totalSavings: sql<number>`coalesce(sum(COALESCE(${couponUsage.discountAmountCents}, CAST(round(${couponUsage.discountAmount} * 100) AS integer))), 0) / 100.0`,
          })
          .from(couponUsage)
          .where(eq(couponUsage.status, "active"));

    return {
      total: couponCounts[0]?.total || 0,
      active: couponCounts[0]?.active || 0,
      totalUsed: couponCounts[0]?.totalUsed || 0,
      totalSavings: savingsResult[0]?.totalSavings || 0,
    };
  }

  /**
   * 獲取可用的優惠券 (供前端顯示)
   */
  async getAvailableCoupons(
    restaurantId: string,
    userId?: number,
  ): Promise<any[]> {
    const now = new Date().toISOString();

    const couponList = await this.db.query.coupons.findMany({
      where: and(
        eq(coupons.isActive, true),
        eq(coupons.isVisible, true),
        sql`(${coupons.restaurantId} = ${restaurantId} OR ${coupons.restaurantId} IS NULL)`,
        lte(coupons.validFrom, now),
        gte(coupons.validTo, now),
        sql`(${coupons.usageLimit} IS NULL OR ${coupons.usedCount} < ${coupons.usageLimit})`,
      ),
      orderBy: [asc(coupons.minOrderAmount), desc(coupons.discountValue)],
    });

    return couponList.map((coupon) => this.mapCouponMoneyFields(coupon));
  }
}
