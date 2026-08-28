/**
 * User Coupons Schema (卷的持有實例)
 *
 * 現有 coupons / coupon_usage / coupon_distributions 已成熟，但缺「有歸屬的持有實例」
 * （coupon_distributions 只有彙總統計）。此表補上 per-customer 的可持有、可鎖定、可過期實例。
 *
 * 與代幣（credits）刻意分離：卷是「付款前的定價層折抵」，不是 payment provider。
 * 結帳流程：build session 時將選用券 reserved → 產生 coupon_usage（沿用既有 partial-unique
 * 防同單重複折抵）→ 付款成功 redeemed / 失敗或退款 release。
 *
 * PK：TEXT UUID v7（與 customers / markets 一致）。注意 couponId 為 integer（coupons 是
 * legacy integer PK），此處為跨型別 reference（非 join key），無 int/text FK 不匹配問題。
 */

import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { coupons, couponUsage } from "./coupons";
import { customers } from "./customers";

// ================================================
// ENUMS
// ================================================

export const USER_COUPON_STATE = [
  "issued", // 已發放、可用
  "reserved", // 結帳鎖定中
  "redeemed", // 已核銷
  "expired", // 已過期
] as const;
export type UserCouponState = (typeof USER_COUPON_STATE)[number];

// ================================================
// TABLE: user_coupons (持有實例)
// ================================================

export const userCoupons = sqliteTable(
  "user_coupons",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    couponId: integer("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),

    ownerCustomerId: text("owner_customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    state: text("state").$type<UserCouponState>().notNull().default("issued"),

    // 結帳鎖定：reserved 時記住是哪張 market checkout（text id），釋放時清空
    reservedForCheckoutId: text("reserved_for_checkout_id"),

    // 核銷後回連既有 coupon_usage（integer PK）
    redeemedUsageId: integer("redeemed_usage_id").references(
      () => couponUsage.id,
      { onDelete: "set null" },
    ),

    expiresAtMs: integer("expires_at_ms", { mode: "timestamp_ms" }),

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    ownerStateIdx: index("idx_user_coupons_owner_state").on(
      table.ownerCustomerId,
      table.state,
    ),
    couponIdx: index("idx_user_coupons_coupon").on(table.couponId),
    reservedCheckoutIdx: index("idx_user_coupons_reserved_checkout").on(
      table.reservedForCheckoutId,
    ),
    expiryScanIdx: index("idx_user_coupons_expiry_scan").on(
      table.state,
      table.expiresAtMs,
    ),

    // Distribution is a retryable write: re-running a batch, or two admins
    // pressing distribute at once, must not leave one customer holding the
    // same coupon twice. Only live instances are constrained -- a redeemed or
    // expired one has been consumed, so the customer may legitimately be
    // issued the coupon again by a later campaign.
    holderLiveUniqueIdx: uniqueIndex("user_coupons_holder_live_unique")
      .on(table.couponId, table.ownerCustomerId)
      .where(sql`${table.state} IN ('issued', 'reserved')`),
  }),
);

// ================================================
// RELATIONS
// ================================================

export const userCouponsRelations = relations(userCoupons, ({ one }) => ({
  coupon: one(coupons, {
    fields: [userCoupons.couponId],
    references: [coupons.id],
  }),
  owner: one(customers, {
    fields: [userCoupons.ownerCustomerId],
    references: [customers.id],
  }),
  redeemedUsage: one(couponUsage, {
    fields: [userCoupons.redeemedUsageId],
    references: [couponUsage.id],
  }),
}));
