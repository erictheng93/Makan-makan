import { describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { PartnershipService } from "./PartnershipService";
import type { NewPartnershipPlan } from "../schema";

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
    const planData: NewPartnershipPlan = {
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
});
