/**
 * Contract Tests for Coupons API
 *
 * Validates that response shapes match declared Zod schemas.
 * Any schema drift (field added, removed, or renamed) causes a test failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  ListCouponsResponse,
  GetCouponResponse,
  CreateCouponResponse,
  ValidateCouponResponse,
  DeactivateCouponResponse,
  DeleteCouponResponse,
  BulkCouponResponse,
} from "../../../contracts/schemas/coupons";

// ---------------------------------------------------------------------------
// Fixture — a realistic coupon object reused across tests
// ---------------------------------------------------------------------------

function buildMockCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    restaurantId: "rest-001",
    code: "WELCOME20",
    description: "20% off your first order",
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 1000,
    maxDiscount: 500,
    usageLimit: 100,
    usedCount: 12,
    isActive: true,
    validFrom: "2026-01-01T00:00:00Z",
    validUntil: "2026-12-31T23:59:59Z",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Coupons API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =========================================================================
  // List Coupons
  // =========================================================================
  describe("List Coupons Response Contract", () => {
    it("should match ListCouponsResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [buildMockCoupon(), buildMockCoupon({ id: 2, code: "SUMMER50" })],
        pagination: { total: 2, page: 1, limit: 20, pages: 1 },
      };

      assertMatchesSchema(ListCouponsResponse, mockResponse, "GET /coupons");
    });

    it("should accept response without pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [buildMockCoupon()],
      };

      assertMatchesSchema(
        ListCouponsResponse,
        mockResponse,
        "GET /coupons (no pagination)",
      );
    });

    it("should accept empty data array", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListCouponsResponse,
        mockResponse,
        "GET /coupons (empty)",
      );
    });
  });

  // =========================================================================
  // Get Single Coupon
  // =========================================================================
  describe("Get Coupon Response Contract", () => {
    it("should match GetCouponResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockCoupon(),
      };

      assertMatchesSchema(GetCouponResponse, mockResponse, "GET /coupons/:id");
    });

    it("should accept coupon with null optional fields", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockCoupon({
          description: null,
          minOrderAmount: null,
          maxDiscount: null,
          usageLimit: null,
          validFrom: null,
          validUntil: null,
        }),
      };

      assertMatchesSchema(
        GetCouponResponse,
        mockResponse,
        "GET /coupons/:id (nullable fields)",
      );
    });
  });

  // =========================================================================
  // Create Coupon
  // =========================================================================
  describe("Create Coupon Response Contract", () => {
    it("should match CreateCouponResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockCoupon({ id: 99, code: "NEWCOUPON" }),
      };

      assertMatchesSchema(CreateCouponResponse, mockResponse, "POST /coupons");
    });
  });

  // =========================================================================
  // Validate Coupon
  // =========================================================================
  describe("Validate Coupon Response Contract", () => {
    it("should match ValidateCouponResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          valid: true,
          coupon: buildMockCoupon(),
          discountAmount: 200,
        },
      };

      assertMatchesSchema(
        ValidateCouponResponse,
        mockResponse,
        "POST /coupons/validate",
      );
    });

    it("should accept invalid coupon validation result", () => {
      const mockResponse = {
        success: true as const,
        data: {
          valid: false,
          reason: "Coupon expired",
        },
      };

      assertMatchesSchema(
        ValidateCouponResponse,
        mockResponse,
        "POST /coupons/validate (invalid)",
      );
    });
  });

  // =========================================================================
  // Deactivate Coupon
  // =========================================================================
  describe("Deactivate Coupon Response Contract", () => {
    it("should match DeactivateCouponResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockCoupon({ isActive: false }),
        message: "Coupon deactivated",
      };

      assertMatchesSchema(
        DeactivateCouponResponse,
        mockResponse,
        "POST /coupons/:id/deactivate",
      );
    });
  });

  // =========================================================================
  // Delete Coupon
  // =========================================================================
  describe("Delete Coupon Response Contract", () => {
    it("should match DeleteCouponResponse schema", () => {
      const mockResponse = {
        success: true as const,
        message: "Coupon deleted",
      };

      assertMatchesSchema(
        DeleteCouponResponse,
        mockResponse,
        "DELETE /coupons/:id",
      );
    });
  });

  // =========================================================================
  // Bulk Coupon Operations
  // =========================================================================
  describe("Bulk Coupon Response Contract", () => {
    it("should match BulkCouponResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          success: [
            { id: 1, code: "BULK1" },
            { id: 2, code: "BULK2" },
          ],
          failed: [{ code: "DUPLICATE", error: "Code already exists" }],
        },
        message: "2 created, 1 failed",
      };

      assertMatchesSchema(
        BulkCouponResponse,
        mockResponse,
        "POST /coupons/bulk",
      );
    });

    it("should accept bulk response with all successes", () => {
      const mockResponse = {
        success: true as const,
        data: {
          success: [{ id: 1, code: "BULK1" }],
          failed: [],
        },
      };

      assertMatchesSchema(
        BulkCouponResponse,
        mockResponse,
        "POST /coupons/bulk (all success)",
      );
    });

    it("should accept bulk response without message", () => {
      const mockResponse = {
        success: true as const,
        data: {
          success: [],
          failed: [],
        },
      };

      assertMatchesSchema(
        BulkCouponResponse,
        mockResponse,
        "POST /coupons/bulk (empty)",
      );
    });
  });
});
