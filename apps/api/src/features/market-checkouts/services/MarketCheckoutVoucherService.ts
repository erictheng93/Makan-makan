/**
 * Market Checkout Voucher (卷) Service — MVP anonymous code redemption.
 *
 * Applies a platform-wide coupon code to a multi-vendor market checkout, splits
 * the discount proportionally across child orders, and records redemption in the
 * existing `coupon_usage` table only on verified payment success.
 *
 * Locked decisions (docs/superpowers/specs/2026-06-03-market-checkout-voucher-redemption.md):
 * - platform-wide coupons only (`coupons.restaurant_id IS NULL`),
 * - anonymous (no `user_coupons`, no owner),
 * - `used_count` increments once per checkout, idempotent on replay.
 */

import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray, sql } from "drizzle-orm";
import { coupons, couponUsage } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import { badRequest, notFound } from "../../../shared/utils/api-error";
import { fromCents, toCents } from "../../../shared/utils/money";

export interface VoucherChildOrder {
  orderId: number;
  amountCents: number;
}

export interface VoucherAllocation {
  orderId: number;
  /** Child order total before the voucher (for the coupon_usage audit row). */
  amountCents: number;
  /** This child's share of the voucher discount. */
  discountCents: number;
}

export interface AppliedVoucher {
  couponId: number;
  code: string;
  name: string;
  /** Total discount, clamped to the subtotal. */
  discountCents: number;
  allocations: VoucherAllocation[];
}

interface NormalizedCoupon {
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountValueCents: number | null;
  maxDiscountAmountCents: number | null;
}

export class MarketCheckoutVoucherService {
  private readonly db: ReturnType<typeof drizzle>;
  private readonly d1: D1Database;

  constructor(env: Env) {
    this.db = drizzle(env.DB);
    this.d1 = env.DB;
  }

  /**
   * Discount in cents for a coupon against a subtotal. Pure — unit tested.
   * Percentage discounts honor `maxDiscountAmountCents`; everything clamps to
   * the subtotal and floors at zero.
   */
  static computeDiscountCents(
    coupon: NormalizedCoupon,
    subtotalCents: number,
  ): number {
    if (subtotalCents <= 0) return 0;

    let discountCents: number;
    if (coupon.discountType === "percentage") {
      discountCents = Math.round(subtotalCents * (coupon.discountValue / 100));
      if (
        coupon.maxDiscountAmountCents != null &&
        discountCents > coupon.maxDiscountAmountCents
      ) {
        discountCents = coupon.maxDiscountAmountCents;
      }
    } else {
      discountCents = coupon.discountValueCents ?? 0;
    }

    return Math.max(0, Math.min(discountCents, subtotalCents));
  }

  /**
   * Split a total discount across child orders proportionally by amount. The
   * largest child absorbs the rounding remainder so allocations always sum to
   * the total discount. Pure — unit tested.
   */
  static splitDiscount(
    discountCents: number,
    childOrders: VoucherChildOrder[],
  ): VoucherAllocation[] {
    const subtotalCents = childOrders.reduce(
      (sum, child) => sum + child.amountCents,
      0,
    );
    const allocations: VoucherAllocation[] = childOrders.map((child) => ({
      orderId: child.orderId,
      amountCents: child.amountCents,
      discountCents:
        subtotalCents <= 0
          ? 0
          : Math.floor((discountCents * child.amountCents) / subtotalCents),
    }));

    const assigned = allocations.reduce(
      (sum, alloc) => sum + alloc.discountCents,
      0,
    );
    const remainder = discountCents - assigned;
    if (remainder > 0 && subtotalCents > 0 && allocations.length > 0) {
      // Give the remainder to the largest child order (deterministic tie-break
      // by orderId so split is stable across retries).
      let target = allocations[0];
      for (const alloc of allocations) {
        if (
          alloc.amountCents > target.amountCents ||
          (alloc.amountCents === target.amountCents &&
            alloc.orderId < target.orderId)
        ) {
          target = alloc;
        }
      }
      target.discountCents += remainder;
    }

    return allocations;
  }

  /**
   * Validate a platform-wide coupon code against a market checkout and price the
   * discount. Throws `ApiError` with a voucher-specific code on any failure.
   */
  async validateAndPrice(input: {
    code: string;
    subtotalCents: number;
    childOrders: VoucherChildOrder[];
  }): Promise<AppliedVoucher> {
    const code = input.code.trim().toUpperCase();
    if (!code) {
      throw badRequest("Voucher code is required", "VOUCHER_CODE_REQUIRED");
    }

    const coupon = await this.db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code))
      .get();

    if (!coupon || coupon.deletedAt) {
      throw notFound("Voucher not found", "VOUCHER_NOT_FOUND");
    }

    // MVP: market checkout accepts platform-wide vouchers only. A vendor-scoped
    // coupon belongs to that shop's own order flow, not the multi-vendor basket.
    if (coupon.restaurantId != null) {
      throw badRequest(
        "This voucher can only be used at its own shop, not the market checkout",
        "VOUCHER_NOT_APPLICABLE",
      );
    }

    if (!coupon.isActive || !coupon.isVisible) {
      throw badRequest(
        "This voucher is not available",
        "VOUCHER_NOT_APPLICABLE",
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    if (coupon.validFrom > today || coupon.validTo < today) {
      throw badRequest("This voucher has expired", "VOUCHER_EXPIRED");
    }

    if (
      coupon.usageLimit != null &&
      (coupon.usedCount ?? 0) >= coupon.usageLimit
    ) {
      throw badRequest(
        "This voucher has been fully redeemed",
        "VOUCHER_EXHAUSTED",
      );
    }

    const minOrderCents =
      coupon.minOrderAmountCents ?? toCents(coupon.minOrderAmount) ?? 0;
    if (input.subtotalCents < minOrderCents) {
      throw badRequest(
        `This voucher requires a minimum order of ${fromCents(minOrderCents)}`,
        "VOUCHER_MIN_ORDER_NOT_MET",
      );
    }

    const discountCents = MarketCheckoutVoucherService.computeDiscountCents(
      {
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountValueCents:
          coupon.discountValueCents ?? toCents(coupon.discountValue),
        maxDiscountAmountCents:
          coupon.maxDiscountAmountCents ?? toCents(coupon.maxDiscountAmount),
      },
      input.subtotalCents,
    );

    if (discountCents <= 0) {
      throw badRequest(
        "This voucher does not apply to your order",
        "VOUCHER_NOT_APPLICABLE",
      );
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discountCents,
      allocations: MarketCheckoutVoucherService.splitDiscount(
        discountCents,
        input.childOrders,
      ),
    };
  }

  /**
   * Record redemption after verified payment success. Writes one
   * `coupon_usage` row per child order and increments `coupons.used_count`
   * exactly once per checkout. Idempotent: a replay (success path + webhook)
   * does not double-count, guarded by the `(coupon_id, order_id)` unique index.
   */
  async redeem(applied: AppliedVoucher): Promise<void> {
    const orderIds = applied.allocations.map((alloc) => alloc.orderId);
    if (orderIds.length === 0) return;

    const existing = await this.db
      .select({ orderId: couponUsage.orderId })
      .from(couponUsage)
      .where(
        and(
          eq(couponUsage.couponId, applied.couponId),
          inArray(couponUsage.orderId, orderIds),
          sql`(${couponUsage.status} IS NULL OR ${couponUsage.status} != 'cancelled')`,
        ),
      )
      .all();
    const existingOrderIds = new Set(existing.map((row) => row.orderId));

    if (existingOrderIds.size === orderIds.length) {
      // Already fully recorded — idempotent no-op.
      return;
    }

    if (existingOrderIds.size === 0) {
      // First redemption of this checkout: claim one use. Best-effort guard —
      // the payment already succeeded, so we honor the discount even if the
      // limit was hit between apply and pay.
      await this.d1
        .prepare(
          `UPDATE coupons
              SET used_count = coalesce(used_count, 0) + 1,
                  updated_at_ms = unixepoch('now') * 1000
            WHERE id = ?
              AND (usage_limit IS NULL OR coalesce(used_count, 0) < usage_limit)`,
        )
        .bind(applied.couponId)
        .run();
    }

    for (const alloc of applied.allocations) {
      if (existingOrderIds.has(alloc.orderId)) continue;
      const finalCents = Math.max(0, alloc.amountCents - alloc.discountCents);
      try {
        await this.db
          .insert(couponUsage)
          .values({
            couponId: applied.couponId,
            orderId: alloc.orderId,
            discountAmount: fromCents(alloc.discountCents),
            originalAmount: fromCents(alloc.amountCents),
            finalAmount: fromCents(finalCents),
            discountAmountCents: alloc.discountCents,
            originalAmountCents: alloc.amountCents,
            finalAmountCents: finalCents,
            status: "active",
          })
          .run();
      } catch (error) {
        // Unique-index race (concurrent webhook + success path) — the row is
        // already there, so the redemption stays idempotent.
        console.warn(
          `coupon_usage insert skipped for order ${alloc.orderId}:`,
          error,
        );
      }
    }
  }

  /**
   * Mark a checkout's voucher redemption refunded (mirrors credit refund). Used
   * when a paid market checkout is refunded.
   */
  async markRefunded(input: {
    couponId: number;
    orderIds: number[];
  }): Promise<void> {
    if (input.orderIds.length === 0) return;
    await this.db
      .update(couponUsage)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(
        and(
          eq(couponUsage.couponId, input.couponId),
          inArray(couponUsage.orderId, input.orderIds),
          sql`(${couponUsage.status} IS NULL OR ${couponUsage.status} = 'active')`,
        ),
      )
      .run();
  }
}

export async function redeemCachedMarketCheckoutVoucher(
  env: Env,
  checkoutId: string,
): Promise<void> {
  const stored = await env.CACHE_KV.get(`market_checkout:${checkoutId}`);
  if (!stored) return;

  let session: unknown;
  try {
    session = JSON.parse(stored) as unknown;
  } catch {
    return;
  }

  const appliedVoucher = readAppliedVoucher(session);
  if (!appliedVoucher) return;

  try {
    await new MarketCheckoutVoucherService(env).redeem(appliedVoucher);
  } catch (error) {
    console.error(
      `Voucher redemption failed for async market checkout ${checkoutId}:`,
      error,
    );
  }
}

function readAppliedVoucher(value: unknown): AppliedVoucher | null {
  if (!value || typeof value !== "object") return null;
  const appliedVoucher = (value as { appliedVoucher?: unknown }).appliedVoucher;
  if (!appliedVoucher || typeof appliedVoucher !== "object") return null;

  const candidate = appliedVoucher as Partial<AppliedVoucher>;
  if (
    typeof candidate.couponId !== "number" ||
    typeof candidate.code !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.discountCents !== "number" ||
    !Array.isArray(candidate.allocations)
  ) {
    return null;
  }

  const allocations = candidate.allocations.filter(
    (alloc): alloc is VoucherAllocation =>
      alloc != null &&
      typeof alloc === "object" &&
      typeof (alloc as VoucherAllocation).orderId === "number" &&
      typeof (alloc as VoucherAllocation).amountCents === "number" &&
      typeof (alloc as VoucherAllocation).discountCents === "number",
  );
  if (allocations.length !== candidate.allocations.length) return null;

  return {
    couponId: candidate.couponId,
    code: candidate.code,
    name: candidate.name,
    discountCents: candidate.discountCents,
    allocations,
  };
}
