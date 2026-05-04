/**
 * SubscriptionService Unit Tests
 * 訂閱服務單元測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  envFactory,
  resetAllFactories,
  createMockD1Database,
} from "@makanmasak/testing-utils";
import { SubscriptionService } from "../services/SubscriptionService";
import type { D1Database } from "@makanmasak/database";

// ---------------------------------------------------------------------------
// Shared mock subscription row (mirrors shopSubscriptions schema)
// ---------------------------------------------------------------------------

const mockSubRow = {
  id: "sub-1",
  restaurantId: "rest-1",
  planTier: "pro" as const,
  moduleOverrides: {},
  deploymentMode: "managed" as const,
  isActive: true,
  trialEndsAt: null,
  billingCycleStartAt: null,
  billingCycleEndAt: null,
  notes: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe("SubscriptionService", () => {
  let service: SubscriptionService;
  let mockDB: ReturnType<typeof createMockD1Database>;

  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
    mockDB = createMockD1Database();
    service = new SubscriptionService(mockDB as unknown as D1Database);
  });

  // ── getByRestaurantId ──────────────────────────────────────────────────────

  describe("getByRestaurantId", () => {
    it("returns the subscription when found", async () => {
      vi.spyOn(service["db"], "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockSubRow]),
          }),
        }),
      } as never);

      const result = await service.getByRestaurantId("rest-1");
      expect(result).toEqual(mockSubRow);
    });

    it("returns null when not found", async () => {
      vi.spyOn(service["db"], "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const result = await service.getByRestaurantId("nonexistent");
      expect(result).toBeNull();
    });
  });

  // ── listAll ────────────────────────────────────────────────────────────────

  describe("listAll", () => {
    it("returns all subscriptions ordered by createdAt", async () => {
      const rows = [
        mockSubRow,
        { ...mockSubRow, id: "sub-2", restaurantId: "rest-2" },
      ];

      vi.spyOn(service["db"], "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      } as never);

      const result = await service.listAll();
      expect(result).toHaveLength(2);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates a new subscription and returns it", async () => {
      // getByRestaurantId returns null (no existing record)
      vi.spyOn(service, "getByRestaurantId").mockResolvedValue(null);

      const createdRow = { ...mockSubRow, planTier: "trial" as const };
      vi.spyOn(service["db"], "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdRow]),
        }),
      } as never);

      const result = await service.create({
        restaurantId: "rest-1",
        planTier: "trial",
        trialEndsAt: new Date("2024-12-31"),
      });

      expect(result).toEqual(createdRow);
      expect(service.getByRestaurantId).toHaveBeenCalledWith("rest-1");
    });

    it("throws conflict error when subscription already exists", async () => {
      vi.spyOn(service, "getByRestaurantId").mockResolvedValue(mockSubRow);

      await expect(
        service.create({ restaurantId: "rest-1", planTier: "pro" }),
      ).rejects.toMatchObject({
        status: 409,
        code: "SUBSCRIPTION_EXISTS",
      });
    });
  });

  // ── updateModules ──────────────────────────────────────────────────────────

  describe("updateModules", () => {
    it("merges new overrides into existing ones", async () => {
      const existingRow = {
        ...mockSubRow,
        moduleOverrides: { coupons: false } as never,
      };

      vi.spyOn(service, "getByRestaurantId").mockResolvedValue(existingRow);

      const updatedRow = {
        ...existingRow,
        moduleOverrides: { coupons: false, ai_analytics: true },
      };

      vi.spyOn(service["db"], "update").mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedRow]),
          }),
        }),
      } as never);

      const result = await service.updateModules("rest-1", {
        overrides: { ai_analytics: true },
      });

      expect(result).toEqual(updatedRow);
    });

    it("removes a key set to undefined (reset to plan default)", async () => {
      const existingRow = {
        ...mockSubRow,
        moduleOverrides: { coupons: false, analytics: true } as never,
      };

      vi.spyOn(service, "getByRestaurantId").mockResolvedValue(existingRow);

      let capturedSet: any;
      vi.spyOn(service["db"], "update").mockReturnValue({
        set: vi.fn().mockImplementation((val: any) => {
          capturedSet = val;
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockSubRow]),
            }),
          };
        }),
      } as never);

      await service.updateModules("rest-1", {
        overrides: { coupons: undefined as never },
      });

      // 'coupons' should be absent from the merged overrides (undefined keys are deleted)
      expect(capturedSet.moduleOverrides).not.toHaveProperty("coupons");
      expect(capturedSet.moduleOverrides).toHaveProperty("analytics", true);
    });

    it("throws not-found when subscription does not exist", async () => {
      vi.spyOn(service, "getByRestaurantId").mockResolvedValue(null);

      await expect(
        service.updateModules("nonexistent", { overrides: {} }),
      ).rejects.toMatchObject({
        status: 404,
        code: "SUBSCRIPTION_NOT_FOUND",
      });
    });
  });

  // ── changePlan ─────────────────────────────────────────────────────────────

  describe("changePlan", () => {
    it("changes the plan tier and resets moduleOverrides to {}", async () => {
      vi.spyOn(service, "getByRestaurantId").mockResolvedValue(mockSubRow);

      let capturedSet: any;
      vi.spyOn(service["db"], "update").mockReturnValue({
        set: vi.fn().mockImplementation((val: any) => {
          capturedSet = val;
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  ...mockSubRow,
                  planTier: "enterprise",
                  moduleOverrides: {},
                },
              ]),
            }),
          };
        }),
      } as never);

      const result = await service.changePlan("rest-1", "enterprise");

      expect(capturedSet.planTier).toBe("enterprise");
      expect(capturedSet.moduleOverrides).toEqual({});
      expect(result.planTier).toBe("enterprise");
    });

    it("throws not-found when subscription does not exist", async () => {
      vi.spyOn(service, "getByRestaurantId").mockResolvedValue(null);

      await expect(
        service.changePlan("nonexistent", "basic"),
      ).rejects.toMatchObject({
        status: 404,
        code: "SUBSCRIPTION_NOT_FOUND",
      });
    });
  });

  // ── setActive ──────────────────────────────────────────────────────────────

  describe("setActive", () => {
    it("sets isActive to false (kill switch)", async () => {
      vi.spyOn(service, "getByRestaurantId").mockResolvedValue(mockSubRow);

      let capturedSet: any;
      vi.spyOn(service["db"], "update").mockReturnValue({
        set: vi.fn().mockImplementation((val: any) => {
          capturedSet = val;
          return {
            where: vi.fn().mockReturnValue({
              returning: vi
                .fn()
                .mockResolvedValue([{ ...mockSubRow, isActive: false }]),
            }),
          };
        }),
      } as never);

      const result = await service.setActive("rest-1", false);

      expect(capturedSet.isActive).toBe(false);
      expect(result.isActive).toBe(false);
    });

    it("throws not-found when subscription does not exist", async () => {
      vi.spyOn(service, "getByRestaurantId").mockResolvedValue(null);

      await expect(
        service.setActive("nonexistent", true),
      ).rejects.toMatchObject({
        status: 404,
        code: "SUBSCRIPTION_NOT_FOUND",
      });
    });
  });

  // ── getEffectiveModules ────────────────────────────────────────────────────

  describe("getEffectiveModules", () => {
    it("returns plan defaults when no overrides are set", () => {
      const result = service.getEffectiveModules({
        ...mockSubRow,
        planTier: "basic",
        moduleOverrides: {},
      });

      // Basic plan includes only these three core modules
      expect(result.menu_management).toBe(true);
      expect(result.table_management).toBe(true);
      expect(result.online_ordering).toBe(true);
      // Modules not in plan defaults are absent from the result
      expect(result.kitchen_display).toBeUndefined();
      expect(result.ai_analytics).toBeUndefined();
    });

    it("overrides take priority over plan defaults", () => {
      const result = service.getEffectiveModules({
        ...mockSubRow,
        planTier: "basic",
        moduleOverrides: {
          kitchen_display: true,
          menu_management: false,
        } as never,
      });

      expect(result.kitchen_display).toBe(true); // override grants
      expect(result.menu_management).toBe(false); // override revokes
      expect(result.online_ordering).toBe(true); // plan default
    });

    it("returns all true for enterprise plan with no overrides", () => {
      const result = service.getEffectiveModules({
        ...mockSubRow,
        planTier: "enterprise",
        moduleOverrides: {},
      });

      expect(result.ai_analytics).toBe(true);
      expect(result.platform_integration).toBe(true);
      expect(result.loyalty).toBe(true);
      expect(result.pos).toBe(true);
      expect(result.inventory).toBe(true);
      expect(result.staff_management).toBe(true);
    });

    it("resolves P1-a module defaults by plan tier", () => {
      const basic = service.getEffectiveModules({
        ...mockSubRow,
        planTier: "basic",
        moduleOverrides: {},
      });
      const pro = service.getEffectiveModules({
        ...mockSubRow,
        planTier: "pro",
        moduleOverrides: {},
      });
      const trial = service.getEffectiveModules({
        ...mockSubRow,
        planTier: "trial",
        moduleOverrides: {},
      });

      expect(basic.pos).toBeUndefined();
      expect(basic.inventory).toBeUndefined();
      expect(basic.staff_management).toBeUndefined();

      expect(pro.pos).toBe(true);
      expect(pro.inventory).toBeUndefined();
      expect(pro.staff_management).toBeUndefined();

      expect(trial.pos).toBe(true);
      expect(trial.inventory).toBe(true);
      expect(trial.staff_management).toBe(true);
    });
  });
});
