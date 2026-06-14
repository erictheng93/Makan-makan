import { afterEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import type { D1Database } from "@cloudflare/workers-types";
import { D1DatabaseAdapter } from "../../../../tests/helpers/d1-adapter";
import { PartnershipService } from "./PartnershipService";

function createServiceWithDb<TDb extends object>(db: TDb): PartnershipService {
  const service = new PartnershipService({} as D1Database, {
    JWT_SECRET: "test",
  });
  (service as unknown as { db: TDb }).db = db;
  return service;
}

describe("PartnershipService percentage discounts", () => {
  it("stores percentage plan values in basis points instead of cents", async () => {
    const returning = vi.fn(async () => [{ id: "plan-1" }]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const service = createServiceWithDb({ insert });
    const planData: Parameters<PartnershipService["createPlan"]>[0] = {
      id: "plan-1",
      partnershipId: "partner-1",
      restaurantId: "restaurant-1",
      planName: "Student 12.5",
      planCode: "STUDENT125",
      discountType: "percentage",
      discountValue: 12.5,
      minOrderAmount: 0,
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validTo: new Date("2026-12-31T23:59:59Z"),
      isActive: true,
    };

    await service.createPlan(planData);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        discountPercentageBps: 1250,
        discountValueCents: null,
      }),
    );
  });

  it("preserves direct cents and bps plan values when legacy values are omitted", async () => {
    const returning = vi.fn(async () => [{ id: "plan-1" }]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const service = createServiceWithDb({ insert });
    const planData: Parameters<PartnershipService["createPlan"]>[0] = {
      id: "plan-1",
      partnershipId: "partner-1",
      restaurantId: "restaurant-1",
      planName: "Student 12.5",
      planCode: "STUDENT125",
      discountType: "percentage",
      discountPercentageBps: 1250,
      discountValueCents: null,
      maxDiscountAmountCents: 500,
      minOrderAmountCents: 1000,
      maxOrderAmountCents: 30000,
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validTo: new Date("2026-12-31T23:59:59Z"),
      isActive: true,
    };

    await service.createPlan(planData);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        discountPercentageBps: 1250,
        discountValueCents: null,
        maxDiscountAmountCents: 500,
        minOrderAmountCents: 1000,
        maxOrderAmountCents: 30000,
      }),
    );
  });

  it("treats null legacy minimum order amounts as zero cents", async () => {
    const returning = vi.fn(async () => [{ id: "plan-1" }]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const service = createServiceWithDb({ insert });
    const planData: Parameters<PartnershipService["createPlan"]>[0] = {
      id: "plan-1",
      partnershipId: "partner-1",
      restaurantId: "restaurant-1",
      planName: "Student 12.5",
      planCode: "STUDENT125",
      discountType: "percentage",
      discountPercentageBps: 1250,
      minOrderAmount: null,
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validTo: new Date("2026-12-31T23:59:59Z"),
      isActive: true,
    };

    await service.createPlan(planData);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        minOrderAmountCents: 0,
      }),
    );
  });

  it("calculates percentage plan discounts from basis points first", async () => {
    const plan = {
      id: "plan-1",
      isActive: true,
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validTo: new Date("2026-12-31T23:59:59Z"),
      usageLimitPerDay: null,
      dailyUsageCount: 0,
      usageLimitPerMember: null,
      minOrderAmount: 0,
      minOrderAmountCents: 0,
      maxOrderAmount: null,
      applicableDays: null,
      applicableTimeSlots: null,
      discountType: "percentage",
      discountValue: 0,
      discountPercentageBps: 1250,
      maxDiscountAmount: null,
      maxDiscountAmountCents: null,
      canCombineWithCoupons: true,
      canCombineWithPromotions: false,
    };
    const db = {
      query: {
        partnershipPlans: {
          findFirst: vi.fn(async () => plan),
        },
        verifiedMembers: {
          findFirst: vi.fn(async () => ({
            id: "member-1",
            status: "verified",
          })),
        },
      },
    };
    const service = createServiceWithDb(db);

    const result = await service.validatePlan("plan-1", "member-1", 240);

    expect(result).toMatchObject({
      valid: true,
      discountAmount: 30,
      finalAmount: 210,
    });
  });

  it("validates maximum order amounts from cents first", async () => {
    const plan = {
      id: "plan-1",
      isActive: true,
      validFrom: new Date("2026-01-01T00:00:00Z"),
      validTo: new Date("2026-12-31T23:59:59Z"),
      usageLimitPerDay: null,
      dailyUsageCount: 0,
      usageLimitPerMember: null,
      minOrderAmount: 0,
      minOrderAmountCents: 0,
      maxOrderAmount: 1,
      maxOrderAmountCents: 30000,
      applicableDays: null,
      applicableTimeSlots: null,
      discountType: "percentage",
      discountValue: 0,
      discountPercentageBps: 1250,
      maxDiscountAmount: null,
      maxDiscountAmountCents: null,
      canCombineWithCoupons: true,
      canCombineWithPromotions: false,
    };
    const db = {
      query: {
        partnershipPlans: {
          findFirst: vi.fn(async () => plan),
        },
        verifiedMembers: {
          findFirst: vi.fn(async () => ({
            id: "member-1",
            status: "verified",
          })),
        },
      },
    };
    const service = createServiceWithDb(db);

    const result = await service.validatePlan("plan-1", "member-1", 240);

    expect(result).toMatchObject({
      valid: true,
      discountAmount: 30,
      finalAmount: 210,
    });
  });
});

describe("PartnershipService percentage discounts with real D1", () => {
  let db: D1DatabaseAdapter | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("persists percentage plans as bps and zero min-order cents", async () => {
    db = createPartnershipServiceTestDb();
    const now = new Date();
    const validFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const validTo = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const service = new PartnershipService(db as unknown as D1Database, {
      JWT_SECRET: "test",
      NODE_ENV: "test",
    });
    const plan = await service.createPlan({
      id: "plan-real",
      partnershipId: "partnership-real",
      restaurantId: "restaurant-partnership-real",
      planName: "Student 12.5",
      planCode: "STUDENT125",
      discountType: "percentage",
      discountValue: 12.5,
      minOrderAmount: null,
      validFrom,
      validTo,
      isActive: true,
      canCombineWithCoupons: true,
      canCombineWithPromotions: false,
    });

    const persisted = await db
      .prepare(
        `
          SELECT
            discount_percentage_bps AS discountPercentageBps,
            discount_value_cents AS discountValueCents,
            min_order_amount_cents AS minOrderAmountCents
          FROM partnership_plans
          WHERE id = ?
        `,
      )
      .bind(plan.id)
      .first();

    expect(persisted).toEqual({
      discountPercentageBps: 1250,
      discountValueCents: null,
      minOrderAmountCents: 0,
    });
  });
});

function createPartnershipServiceTestDb(): D1DatabaseAdapter {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE partnership_plans (
      id TEXT PRIMARY KEY NOT NULL,
      partnership_id TEXT NOT NULL,
      restaurant_id TEXT NOT NULL,
      plan_code TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      plan_name_en TEXT,
      description TEXT,
      discount_type TEXT NOT NULL,
      discount_percentage_bps INTEGER,
      discount_value_cents INTEGER,
      max_discount_amount_cents INTEGER,
      min_order_amount_cents INTEGER,
      max_order_amount_cents INTEGER,
      applicable_menu_items TEXT DEFAULT '[]',
      applicable_categories TEXT DEFAULT '[]',
      excluded_menu_items TEXT DEFAULT '[]',
      excluded_categories TEXT DEFAULT '[]',
      applicable_days TEXT DEFAULT '[]',
      applicable_time_slots TEXT DEFAULT '[]',
      usage_limit_per_member INTEGER,
      usage_limit_per_day INTEGER,
      daily_usage_count INTEGER DEFAULT 0,
      total_usage_count INTEGER DEFAULT 0,
      valid_from_ms INTEGER NOT NULL,
      valid_to_ms INTEGER NOT NULL,
      priority INTEGER DEFAULT 0,
      can_combine_with_coupons INTEGER DEFAULT 0,
      can_combine_with_promotions INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      badge_text TEXT,
      badge_color TEXT,
      show_on_menu INTEGER DEFAULT 1,
      total_discount_given_cents INTEGER,
      total_revenue_cents INTEGER,
      terms_and_conditions TEXT,
      notes TEXT,
      metadata TEXT DEFAULT '{}',
      created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      deleted_at_ms INTEGER,
      created_by INTEGER
    );
  `);
  return new D1DatabaseAdapter(sqlite);
}
