/**
 * Tests for Monitoring Routes
 *
 * Covers: overview, health timeline, performance, alerts, versions
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

describe("Monitoring Routes", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    env = createMockEnv();
    authHeader = await createTestAuthHeader(env.JWT_SECRET);
  });

  // ============================================================
  // GET /api/v1/monitoring/overview
  // ============================================================
  describe("GET /api/v1/monitoring/overview", () => {
    it("should return system overview statistics", async () => {
      const db = mockDb();

      // This endpoint calls 4 queries via Promise.all
      const tenantStatsStmt = createMockD1Statement();
      tenantStatsStmt.first.mockResolvedValue({
        total: 10,
        active: 7,
        pending: 2,
        provisioning: 1,
        suspended: 0,
      });

      const healthStatsStmt = createMockD1Statement();
      healthStatsStmt.all.mockResolvedValue({
        results: [
          { status: "healthy", count: 5 },
          { status: "degraded", count: 2 },
        ],
        success: true,
      });

      const deployStatsStmt = createMockD1Statement();
      deployStatsStmt.all.mockResolvedValue({
        results: [
          { status: "completed", count: 3 },
          { status: "failed", count: 1 },
        ],
        success: true,
      });

      const versionStatsStmt = createMockD1Statement();
      versionStatsStmt.all.mockResolvedValue({
        results: [
          { version: "1.2.0", count: 4 },
          { version: "1.1.0", count: 3 },
        ],
        success: true,
      });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        switch (callCount) {
          case 1:
            return tenantStatsStmt;
          case 2:
            return healthStatsStmt;
          case 3:
            return deployStatsStmt;
          case 4:
            return versionStatsStmt;
          default:
            return createMockD1Statement();
        }
      });

      const res = await fetchApp("/api/v1/monitoring/overview");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.tenants).toBeDefined();
      expect(body.data.tenants.total).toBe(10);
      expect(body.data.tenants.active).toBe(7);
      expect(body.data.health).toBeDefined();
      expect(body.data.health.healthy).toBe(5);
      expect(body.data.deployments).toBeDefined();
      expect(body.data.versions).toHaveLength(2);
      expect(body.data.generatedAt).toBeDefined();
    });
  });

  // ============================================================
  // GET /api/v1/monitoring/health/timeline
  // ============================================================
  describe("GET /api/v1/monitoring/health/timeline", () => {
    it("should return health timeline data", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            hour: "2024-01-01 12:00:00",
            status: "healthy",
            count: 5,
            avg_response_time: 120,
          },
          {
            hour: "2024-01-01 13:00:00",
            status: "healthy",
            count: 4,
            avg_response_time: 150,
          },
          {
            hour: "2024-01-01 13:00:00",
            status: "degraded",
            count: 1,
            avg_response_time: 800,
          },
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/monitoring/health/timeline?hours=24");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.timeline).toBeInstanceOf(Array);
      expect(body.data.hours).toBe(24);
    });

    it("should default to 24 hours", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/monitoring/health/timeline");
      const body: any = await res.json();
      expect(body.data.hours).toBe(24);
    });
  });

  // ============================================================
  // GET /api/v1/monitoring/performance
  // ============================================================
  describe("GET /api/v1/monitoring/performance", () => {
    it("should return performance metrics", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            tenant_id: "T-1",
            business_name: "Restaurant A",
            deployed_version: "1.0.0",
            avg_response_time: 120,
            min_response_time: 50,
            max_response_time: 300,
            check_count: 10,
            healthy_count: 9,
          },
          {
            tenant_id: "T-2",
            business_name: "Restaurant B",
            deployed_version: "1.0.0",
            avg_response_time: 250,
            min_response_time: 100,
            max_response_time: 500,
            check_count: 10,
            healthy_count: 7,
          },
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/monitoring/performance");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.overall).toBeDefined();
      expect(body.data.overall.totalTenants).toBe(2);
      expect(body.data.tenants).toHaveLength(2);
      expect(body.data.tenants[0].healthRate).toBe(90); // 9/10 * 100
      expect(body.data.tenants[1].healthRate).toBe(70); // 7/10 * 100
    });

    it("should handle no active tenants", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/monitoring/performance");
      const body: any = await res.json();
      expect(body.data.overall.totalTenants).toBe(0);
      expect(body.data.tenants).toEqual([]);
    });
  });

  // ============================================================
  // GET /api/v1/monitoring/alerts
  // ============================================================
  describe("GET /api/v1/monitoring/alerts", () => {
    it("should return active alerts by default", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            id: "hc-1",
            tenant_id: "T-1",
            business_name: "Restaurant A",
            status: "down",
            severity: "critical",
            response_time_ms: 5000,
            details: null,
            checked_at: new Date().toISOString(),
          },
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/monitoring/alerts");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.alerts).toBeInstanceOf(Array);
      expect(body.data.total).toBeDefined();
    });

    it("should support severity filter", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/monitoring/alerts?severity=critical");
      expect(res.status).toBe(200);
    });

    it("should support status filter", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/monitoring/alerts?status=all");
      expect(res.status).toBe(200);
    });

    it("should parse JSON details when present", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            id: "hc-1",
            tenant_id: "T-1",
            business_name: "Restaurant A",
            status: "degraded",
            severity: "warning",
            response_time_ms: 800,
            details: JSON.stringify({ api: "slow", db: "ok" }),
            checked_at: new Date().toISOString(),
          },
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/monitoring/alerts?status=all");
      const body: any = await res.json();
      expect(body.data.alerts[0].details).toEqual({
        api: "slow",
        db: "ok",
      });
    });
  });

  // ============================================================
  // GET /api/v1/monitoring/versions
  // ============================================================
  describe("GET /api/v1/monitoring/versions", () => {
    it("should return version distribution and updates", async () => {
      const db = mockDb();

      const versionDistStmt = createMockD1Statement();
      versionDistStmt.all.mockResolvedValue({
        results: [
          { version: "1.2.0", count: 3, tenants: "Rest A,Rest B,Rest C" },
          { version: "1.1.0", count: 2, tenants: "Rest D,Rest E" },
        ],
        success: true,
      });

      const recentUpdatesStmt = createMockD1Statement();
      recentUpdatesStmt.all.mockResolvedValue({
        results: [
          {
            tenant_id: "T-1",
            business_name: "Rest A",
            from_version: "1.1.0",
            to_version: "1.2.0",
            status: "completed",
            started_at: "2024-01-15T00:00:00Z",
            completed_at: "2024-01-15T00:01:00Z",
          },
        ],
        success: true,
      });

      const pendingUpdatesStmt = createMockD1Statement();
      pendingUpdatesStmt.all.mockResolvedValue({
        results: [
          { id: "T-3", business_name: "Rest D", deployed_version: "1.1.0" },
        ],
        success: true,
      });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        switch (callCount) {
          case 1:
            return versionDistStmt;
          case 2:
            return recentUpdatesStmt;
          case 3:
            return pendingUpdatesStmt;
          default:
            return createMockD1Statement();
        }
      });

      const res = await fetchApp("/api/v1/monitoring/versions");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.latestVersion).toBe("1.2.0");
      expect(body.data.distribution).toHaveLength(2);
      expect(body.data.distribution[0].tenants).toBeInstanceOf(Array);
      expect(body.data.recentUpdates).toHaveLength(1);
      expect(body.data.pendingUpdates).toHaveLength(1);
    });

    it("should handle no versions deployed", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/monitoring/versions");
      const body: any = await res.json();
      expect(body.data.latestVersion).toBeNull();
    });
  });
});
