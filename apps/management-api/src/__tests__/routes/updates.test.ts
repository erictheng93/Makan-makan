/**
 * Tests for Updates Routes
 *
 * Covers: releases listing, pending updates, batch update plans, execution, cancellation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../index";
import {
  createMockEnv,
  createMockD1Statement,
  createTestAuthHeader,
} from "../setup";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;
let authHeader: string;

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

async function fetchApp(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", authHeader);
  }
  const request = new Request(`http://localhost${path}`, {
    ...options,
    headers,
  });
  return app.fetch(request, env);
}

function jsonBody(data: unknown) {
  return {
    method: "POST" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

describe("Updates Routes", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    env = createMockEnv();
    authHeader = await createTestAuthHeader(env.JWT_SECRET);
  });

  // ============================================================
  // GET /api/v1/updates/releases
  // ============================================================
  describe("GET /api/v1/updates/releases", () => {
    it("should return available releases", async () => {
      const res = await fetchApp("/api/v1/updates/releases");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.releases).toBeInstanceOf(Array);
      expect(body.data.releases.length).toBeGreaterThan(0);
      expect(body.data.latest).toBe("1.2.0");
    });

    it("should return releases in descending order", async () => {
      const res = await fetchApp("/api/v1/updates/releases");
      const body = await res.json();
      const versions = body.data.releases.map(
        (r: { version: string }) => r.version,
      );
      expect(versions[0]).toBe("1.2.0");
      expect(versions[versions.length - 1]).toBe("1.0.0");
    });

    it("should include changelog in each release", async () => {
      const res = await fetchApp("/api/v1/updates/releases");
      const body = await res.json();
      for (const release of body.data.releases) {
        expect(release.changelog).toBeInstanceOf(Array);
        expect(release.changelog.length).toBeGreaterThan(0);
        expect(release.releaseDate).toBeDefined();
        expect(typeof release.breaking).toBe("boolean");
      }
    });
  });

  // ============================================================
  // GET /api/v1/updates/pending
  // ============================================================
  describe("GET /api/v1/updates/pending", () => {
    it("should return tenants needing update", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            id: "T-1",
            businessName: "Restaurant A",
            deployedVersion: "1.0.0",
          },
          {
            id: "T-2",
            businessName: "Restaurant B",
            deployedVersion: "1.1.0",
          },
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/updates/pending?targetVersion=1.2.0");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.targetVersion).toBe("1.2.0");
      expect(body.data.tenants).toBeInstanceOf(Array);
      expect(body.data.count).toBeDefined();
    });

    it("should use latest version when targetVersion not specified", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/updates/pending");
      const body = await res.json();
      // Should use latest release version (1.2.0 from hardcoded releases)
      expect(body.data.targetVersion).toBe("1.2.0");
    });
  });

  // ============================================================
  // POST /api/v1/updates/plans
  // ============================================================
  describe("POST /api/v1/updates/plans", () => {
    it("should create a batch update plan", async () => {
      const kv = mockCacheKV();

      const res = await fetchApp(
        "/api/v1/updates/plans",
        jsonBody({
          targetVersion: "1.2.0",
          tenantIds: ["T-1", "T-2"],
          strategy: "rolling",
          batchSize: 5,
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.targetVersion).toBe("1.2.0");
      expect(body.data.strategy).toBe("rolling");
      expect(body.data.status).toBe("planned");

      // Should store plan in KV
      expect(kv.put).toHaveBeenCalled();
    });

    it("should default strategy to rolling", async () => {
      const res = await fetchApp(
        "/api/v1/updates/plans",
        jsonBody({
          targetVersion: "1.2.0",
          tenantIds: ["T-1"],
        }),
      );

      const body = await res.json();
      expect(body.data.strategy).toBe("rolling");
    });

    it("should return 422 for empty tenantIds", async () => {
      const res = await fetchApp(
        "/api/v1/updates/plans",
        jsonBody({
          targetVersion: "1.2.0",
          tenantIds: [],
        }),
      );

      // zValidator returns 400 for validation errors
      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid strategy", async () => {
      const res = await fetchApp(
        "/api/v1/updates/plans",
        jsonBody({
          targetVersion: "1.2.0",
          tenantIds: ["T-1"],
          strategy: "invalid",
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // POST /api/v1/updates/plans/:planId/execute
  // ============================================================
  describe("POST /api/v1/updates/plans/:planId/execute", () => {
    it("should return 400 when plan not found", async () => {
      const kv = mockCacheKV();
      kv.get.mockResolvedValue(null);

      const res = await fetchApp(
        "/api/v1/updates/plans/plan-nonexistent/execute",
        jsonBody({}),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("not found");
    });

    it("should execute plan when found", async () => {
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

      // getTenantsByIds
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            id: "T-1",
            businessName: "Restaurant A",
            cf_account_id: "acc-1",
            cf_api_token_enc: btoa("token"),
            subdomain: "rest-a",
            deployed_version: "1.1.0",
          },
        ],
        success: true,
      });
      stmt.first.mockResolvedValue({
        id: "T-1",
        subdomain: "rest-a",
        deployed_version: "1.1.0",
        cf_account_id: "acc-1",
        cf_api_token_enc: btoa("token"),
      });
      stmt.run.mockResolvedValue({ success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/updates/plans/plan-123/execute",
        jsonBody({}),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.planId).toBe("plan-123");
      expect(body.data.totalTenants).toBe(1);
    });
  });

  // ============================================================
  // GET /api/v1/updates/plans/:planId/progress
  // ============================================================
  describe("GET /api/v1/updates/plans/:planId/progress", () => {
    it("should return 404 when plan not found", async () => {
      const kv = mockCacheKV();
      kv.get.mockResolvedValue(null);

      const res = await fetchApp(
        "/api/v1/updates/plans/plan-nonexistent/progress",
      );

      expect(res.status).toBe(404);
    });

    it("should return progress when plan exists", async () => {
      const kv = mockCacheKV();
      const progress = {
        planId: "plan-123",
        totalTenants: 5,
        completedTenants: 3,
        failedTenants: 0,
        inProgressTenants: 1,
        pendingTenants: 1,
        results: [],
      };
      kv.get.mockResolvedValue(JSON.stringify(progress));

      const res = await fetchApp("/api/v1/updates/plans/plan-123/progress");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalTenants).toBe(5);
      expect(body.data.completedTenants).toBe(3);
    });
  });

  // ============================================================
  // POST /api/v1/updates/plans/:planId/cancel
  // ============================================================
  describe("POST /api/v1/updates/plans/:planId/cancel", () => {
    it("should return 400 when plan not found", async () => {
      const kv = mockCacheKV();
      kv.get.mockResolvedValue(null);

      const res = await fetchApp(
        "/api/v1/updates/plans/plan-nonexistent/cancel",
        jsonBody({}),
      );

      expect(res.status).toBe(400);
    });

    it("should cancel a planned update", async () => {
      const kv = mockCacheKV();
      const plan = {
        id: "plan-123",
        targetVersion: "1.2.0",
        strategy: "rolling",
        tenantIds: ["T-1"],
        status: "planned",
        createdAt: new Date().toISOString(),
      };
      kv.get.mockResolvedValue(JSON.stringify(plan));

      const res = await fetchApp(
        "/api/v1/updates/plans/plan-123/cancel",
        jsonBody({}),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Should update KV with cancelled status
      expect(kv.put).toHaveBeenCalled();
    });

    it("should return 400 when trying to cancel in-progress plan", async () => {
      const kv = mockCacheKV();
      const plan = {
        id: "plan-123",
        targetVersion: "1.2.0",
        strategy: "rolling",
        tenantIds: ["T-1"],
        status: "in_progress",
        createdAt: new Date().toISOString(),
      };
      kv.get.mockResolvedValue(JSON.stringify(plan));

      const res = await fetchApp(
        "/api/v1/updates/plans/plan-123/cancel",
        jsonBody({}),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("in-progress");
    });
  });

  // ============================================================
  // POST /api/v1/updates/update-all
  // ============================================================
  describe("POST /api/v1/updates/update-all", () => {
    it("should return message when all tenants are up to date", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/updates/update-all",
        jsonBody({ targetVersion: "1.2.0" }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.count).toBe(0);
    });

    it("should create and execute plan for outdated tenants", async () => {
      const db = mockDb();
      const kv = mockCacheKV();

      const tenantsStmt = createMockD1Statement();
      tenantsStmt.all.mockResolvedValue({
        results: [
          {
            id: "T-1",
            businessName: "Restaurant A",
            deployedVersion: "1.0.0",
            cf_account_id: "acc-1",
            cf_api_token_enc: btoa("token"),
          },
        ],
        success: true,
      });

      // For the plan execution: getTenantsByIds, then deploy flow
      const deployStmt = createMockD1Statement();
      deployStmt.first.mockResolvedValue({
        id: "T-1",
        subdomain: "rest-a",
        deployed_version: "1.0.0",
        cf_account_id: "acc-1",
        cf_api_token_enc: btoa("token"),
      });
      deployStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return tenantsStmt;
        return deployStmt;
      });

      // Mock KV for plan storage and retrieval
      kv.get.mockImplementation(async (key: string) => {
        if (key.startsWith("update_plan:")) {
          return JSON.stringify({
            id: "plan-auto",
            targetVersion: "1.2.0",
            strategy: "rolling",
            tenantIds: ["T-1"],
            batchSize: 5,
            status: "planned",
            createdAt: new Date().toISOString(),
          });
        }
        return null;
      });

      const res = await fetchApp(
        "/api/v1/updates/update-all",
        jsonBody({
          targetVersion: "1.2.0",
          strategy: "rolling",
          batchSize: 5,
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.planId).toBeDefined();
    });
  });
});
