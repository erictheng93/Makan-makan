import { describe, expect, it } from "vitest";
import {
  createPartnershipSchema,
  createPlanSchema,
  memberFiltersSchema,
  memberVerificationSchema,
  partnershipFiltersSchema,
  usageLogFiltersSchema,
} from "./validation";

const id = "018ffb9a-7b8a-7c3d-9f23-123456789abc";

describe("partnership validation schemas", () => {
  it("validates partnership creation defaults", () => {
    expect(
      createPartnershipSchema.parse({
        partnerCode: "UNI",
        partnerName: "University Partner",
        partnerType: "university",
        contactPerson: "Ada Wong",
        contactPhone: "+886912345678",
        contactEmail: "ada@example.test",
        contractStartDate: 1780790400000,
        contractEndDate: 1812326400000,
      }),
    ).toMatchObject({
      partnerCode: "UNI",
      verificationMethod: "manual",
    });
  });

  it("applies plan defaults and validates time slots", () => {
    expect(
      createPlanSchema.parse({
        partnershipId: id,
        restaurantId: "restaurant-1",
        planCode: "STUDENT",
        planName: "Student discount",
        discountType: "percentage",
        discountValue: 10,
        validFrom: 1780790400000,
        validTo: 1812326400000,
      }),
    ).toMatchObject({
      minOrderAmount: 0,
      priority: 0,
      canCombineWithCoupons: false,
      canCombineWithPromotions: false,
      showOnMenu: true,
    });

    expect(() =>
      createPlanSchema.parse({
        partnershipId: id,
        restaurantId: "restaurant-1",
        planCode: "STUDENT",
        planName: "Student discount",
        discountType: "percentage",
        discountValue: 10,
        validFrom: 1780790400000,
        validTo: 1812326400000,
        applicableTimeSlots: [{ start: "9:00", end: "18:00" }],
      }),
    ).toThrow();
  });

  it("transforms filters and usage dates", () => {
    expect(partnershipFiltersSchema.parse({ isActive: "true" })).toEqual({
      isActive: true,
      page: 1,
      limit: 20,
    });
    expect(memberFiltersSchema.parse({ verifiedOnly: "false" })).toEqual({
      verifiedOnly: false,
      page: 1,
      limit: 20,
    });
    expect(
      usageLogFiltersSchema.parse({
        startDate: "2026-06-07T00:00:00.000Z",
        endDate: "2026-06-08T00:00:00.000Z",
      }),
    ).toMatchObject({
      startDate: Date.parse("2026-06-07T00:00:00.000Z"),
      endDate: Date.parse("2026-06-08T00:00:00.000Z"),
      page: 1,
      limit: 20,
    });
  });

  it("validates member verification identity fields", () => {
    expect(
      memberVerificationSchema.parse({
        partnershipId: id,
        memberId: "S12345",
        memberType: "student",
        fullName: "Ada Wong",
        email: "ada@example.test",
        verificationMethod: "email_domain",
      }),
    ).toMatchObject({
      memberType: "student",
      verificationMethod: "email_domain",
    });

    expect(() =>
      memberVerificationSchema.parse({
        partnershipId: id,
        memberId: "S12345",
        memberType: "student",
        fullName: "Ada Wong",
        email: "not-email",
        verificationMethod: "email_domain",
      }),
    ).toThrow();
  });
});
