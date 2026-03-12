/**
 * Tests for VersionSyncService
 *
 * Covers: release listing, batch update plan creation, plan execution,
 *         plan cancellation, tenant version queries
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VersionSyncService } from "../../services/VersionSyncService";
import { createMockEnv, createMockD1Statement } from "../setup";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;
let service: VersionSyncService;

function mockDb() {
  return env.MANAGEMENT_DB as unknown as {
    prepare: ReturnType<typeof vi.fn>;
  };
}

function mockCacheKV() {
  return env.CACHE_KV as unknown as {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };
}

describe("VersionSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    service = new VersionSyncService(env);
  });

  // ============================================================
  // getAvailableReleases
  // ============================================================
  describe("getAvailableReleases", () => {
    it("should return hardcoded releases in descending order", async () => {
      const releases = await service.getAvailableReleases();
      expect(releases).toHaveLength(3);
      expect(releases[0].version).toBe("1.2.0");
      expect(releases[1].version).toBe("1.1.0");
      expect(releases[2].version).toBe("1.0.0");
    });

    it("should include changelog and breaking flag for each release", async () => {
      const releases = await service.getAvailableReleases();
      for (const release of releases) {
        expect(release.changelog).toBeInstanceOf(Array);
        expect(release.changelog.length).toBeGreaterThan(0);
        expect(typeof release.breaking).toBe("boolean");
        expect(release.releaseDate).toBeDefined();
      }
    });
  });

  // ============================================================
  // getTenantsNeedingUpdate
  // ============================================================
  describe("getTenantsNeedingUpdate", () => {
    it("should query tenants with lower version or no version", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          { id: "T-1", businessName: "Rest A", deployedVersion: "1.0.0" },
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const tenants = await service.getTenantsNeedingUpdate("1.2.0");
      expect(tenants).toHaveLength(1);
      expect(stmt.bind).toHaveBeenCalledWith("1.2.0");
    });

    it("should return empty when all tenants are up to date", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const tenants = await service.getTenantsNeedingUpdate("1.0.0");
      expect(tenants).toEqual([]);
    });
  });

  // ============================================================
  // createBatchUpdatePlan
  // ============================================================
  describe("createBatchUpdatePlan", () => {
    it("should create plan and store in KV", async () => {
      const kv = mockCacheKV();

      const plan = await service.createBatchUpdatePlan(
        "1.2.0",
        ["T-1", "T-2"],
        "rolling",
        { batchSize: 3 },
      );

      expect(plan.id).toBeDefined();
      expect(plan.targetVersion).toBe("1.2.0");
      expect(plan.strategy).toBe("rolling");
      expect(plan.tenantIds).toEqual(["T-1", "T-2"]);
      expect(plan.batchSize).toBe(3);
      expect(plan.status).toBe("planned");
      expect(plan.createdAt).toBeDefined();

      // Verify KV storage
      expect(kv.put).toHaveBeenCalledWith(
        `update_plan:${plan.id}`,
        expect.any(String),
        expect.objectContaining({ expirationTtl: 604800 }), // 7 days
      );
    });

    it("should default batchSize to 5", async () => {
      const plan = await service.createBatchUpdatePlan(
        "1.2.0",
        ["T-1"],
        "rolling",
      );
      expect(plan.batchSize).toBe(5);
    });

    it("should default canaryPercentage to 10", async () => {
      const plan = await service.createBatchUpdatePlan(
        "1.2.0",
        ["T-1"],
        "canary",
      );
      expect(plan.canaryPercentage).toBe(10);
    });

    it("should support all_at_once strategy", async () => {
      const plan = await service.createBatchUpdatePlan(
        "1.2.0",
        ["T-1"],
        "all_at_once",
      );
      expect(plan.strategy).toBe("all_at_once");
    });
  });

  // ============================================================
  // executeBatchUpdatePlan
  // ============================================================
  describe("executeBatchUpdatePlan", () => {
    it("should throw when plan not found in KV", async () => {
      const kv = mockCacheKV();
      kv.get.mockResolvedValue(null);

      await expect(
        service.executeBatchUpdatePlan("plan-nonexistent"),
      ).rejects.toThrow("Update plan not found");
    });

    it("should execute plan and return progress", async () => {
      const kv = mockCacheKV();
      const db = mockDb();

      const plan = {
        id: "plan-123",
        targetVersion: "1.2.0",
        strategy: "all_at_once",
        tenantIds: ["T-1"],
        batchSize: 5,
        status: "planned",
        createdAt: new Date().toISOString(),
      };
      kv.get.mockResolvedValue(JSON.stringify(plan));

      // getTenantsByIds + deploy flow
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            id: "T-1",
            businessName: "Rest A",
            cf_account_id: "acc-1",
            cf_api_token_enc: btoa("token"),
            subdomain: "rest-a",
            deployed_version: "1.0.0",
          },
        ],
        success: true,
      });
      stmt.first.mockResolvedValue({
        id: "T-1",
        subdomain: "rest-a",
        deployed_version: "1.0.0",
        cf_account_id: "acc-1",
        cf_api_token_enc: btoa("token"),
      });
      stmt.run.mockResolvedValue({ success: true });
      db.prepare.mockReturnValue(stmt);

      const progress = await service.executeBatchUpdatePlan("plan-123");
      expect(progress.planId).toBe("plan-123");
      expect(progress.totalTenants).toBe(1);

      // Plan should be updated to in_progress in KV
      expect(kv.put).toHaveBeenCalled();
    });
  });

  // ============================================================
  // getUpdatePlanProgress
  // ============================================================
  describe("getUpdatePlanProgress", () => {
    it("should return null when not found", async () => {
      const kv = mockCacheKV();
      kv.get.mockResolvedValue(null);

      const progress = await service.getUpdatePlanProgress("plan-nonexistent");
      expect(progress).toBeNull();
    });

    it("should return parsed progress data", async () => {
      const kv = mockCacheKV();
      const mockProgress = {
        planId: "plan-123",
        totalTenants: 5,
        completedTenants: 3,
        failedTenants: 1,
        inProgressTenants: 0,
        pendingTenants: 1,
        results: [],
      };
      kv.get.mockResolvedValue(JSON.stringify(mockProgress));

      const progress = await service.getUpdatePlanProgress("plan-123");
      expect(progress).toEqual(mockProgress);
    });
  });

  // ============================================================
  // cancelUpdatePlan
  // ============================================================
  describe("cancelUpdatePlan", () => {
    it("should throw when plan not found", async () => {
      const kv = mockCacheKV();
      kv.get.mockResolvedValue(null);

      await expect(
        service.cancelUpdatePlan("plan-nonexistent"),
      ).rejects.toThrow("Update plan not found");
    });

    it("should throw when plan is in_progress", async () => {
      const kv = mockCacheKV();
      kv.get.mockResolvedValue(
        JSON.stringify({
          id: "plan-123",
          status: "in_progress",
        }),
      );

      await expect(service.cancelUpdatePlan("plan-123")).rejects.toThrow(
        "Cannot cancel an in-progress update plan",
      );
    });

    it("should cancel a planned update and update KV", async () => {
      const kv = mockCacheKV();
      kv.get.mockResolvedValue(
        JSON.stringify({
          id: "plan-123",
          status: "planned",
        }),
      );

      await service.cancelUpdatePlan("plan-123");

      expect(kv.put).toHaveBeenCalledWith(
        "update_plan:plan-123",
        expect.stringContaining('"status":"cancelled"'),
      );
    });

    it("should cancel a completed plan", async () => {
      const kv = mockCacheKV();
      kv.get.mockResolvedValue(
        JSON.stringify({
          id: "plan-123",
          status: "completed",
        }),
      );

      // Should not throw for completed status
      await expect(service.cancelUpdatePlan("plan-123")).resolves.not.toThrow();
    });
  });
});
