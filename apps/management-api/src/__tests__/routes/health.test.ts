/**
 * Tests for Health Monitoring Routes
 *
 * Covers: tenant health listing, individual health, health report, health check trigger
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../index";
import {
  createMockEnv,
  createMockD1Statement,
  createTestTenantRow,
  createTestHealthCheckRow,
} from "../setup";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;

function mockDb() {
  return env.MANAGEMENT_DB as unknown as {
    prepare: ReturnType<typeof vi.fn>;
  };
}

function mockDeploymentKV() {
  return env.DEPLOYMENT_STATUS_KV as unknown as {
    put: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
}

async function fetchApp(path: string, options?: RequestInit) {
  const request = new Request(`http://localhost${path}`, options);
  return app.fetch(request, env);
}

function jsonBody(data: unknown) {
  return {
    method: "POST" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

describe("Health Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
  });

  // ============================================================
  // GET /api/v1/health/tenants
  // ============================================================
  describe("GET /api/v1/health/tenants", () => {
    it("should return all tenants health status with summary", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            id: "T-1",
            business_name: "Restaurant A",
            subdomain: "rest-a",
            status: "active",
            deployed_version: "1.0.0",
            health_status: "healthy",
            response_time_ms: 120,
            checked_at: new Date().toISOString(),
          },
          {
            id: "T-2",
            business_name: "Restaurant B",
            subdomain: "rest-b",
            status: "active",
            deployed_version: "1.0.0",
            health_status: "degraded",
            response_time_ms: 800,
            checked_at: new Date().toISOString(),
          },
          {
            id: "T-3",
            business_name: "Restaurant C",
            subdomain: "rest-c",
            status: "active",
            deployed_version: "0.9.0",
            health_status: null,
            response_time_ms: null,
            checked_at: null,
          },
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/health/tenants");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.tenants).toHaveLength(3);
      expect(body.data.summary.total).toBe(3);
      expect(body.data.summary.healthy).toBe(1);
      expect(body.data.summary.degraded).toBe(1);
      expect(body.data.summary.unknown).toBe(1);
    });

    it("should handle empty tenant list", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/health/tenants");
      const body = await res.json();
      expect(body.data.tenants).toEqual([]);
      expect(body.data.summary.total).toBe(0);
    });

    it("should return 500 on database error", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockRejectedValue(new Error("DB error"));
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/health/tenants");
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.code).toBe("GET_HEALTH_FAILED");
    });
  });

  // ============================================================
  // GET /api/v1/health/tenants/:tenantId
  // ============================================================
  describe("GET /api/v1/health/tenants/:tenantId", () => {
    it("should return detailed health for a tenant", async () => {
      const db = mockDb();
      const tenantStmt = createMockD1Statement();
      tenantStmt.first.mockResolvedValue({
        id: "T-1",
        business_name: "Restaurant A",
        subdomain: "rest-a",
        custom_domain: null,
        deployed_version: "1.0.0",
        status: "active",
      });

      const checksStmt = createMockD1Statement();
      checksStmt.all.mockResolvedValue({
        results: [
          createTestHealthCheckRow({
            status: "healthy",
            response_time_ms: 100,
          }),
          createTestHealthCheckRow({
            status: "healthy",
            response_time_ms: 150,
          }),
          createTestHealthCheckRow({
            status: "degraded",
            response_time_ms: 600,
          }),
        ],
        success: true,
      });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return tenantStmt;
        return checksStmt;
      });

      const res = await fetchApp("/api/v1/health/tenants/T-1");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.tenant.name).toBe("Restaurant A");
      expect(body.data.health.uptimePercentage).toBeCloseTo(66.67, 1);
      expect(body.data.health.avgResponseTime).toBeDefined();
      expect(body.data.recentChecks).toBeInstanceOf(Array);
    });

    it("should identify issues for degraded tenant", async () => {
      const db = mockDb();
      const tenantStmt = createMockD1Statement();
      tenantStmt.first.mockResolvedValue({
        id: "T-1",
        business_name: "Restaurant A",
        subdomain: "rest-a",
        custom_domain: null,
        deployed_version: "1.0.0",
        status: "active",
      });

      const checksStmt = createMockD1Statement();
      checksStmt.all.mockResolvedValue({
        results: [
          createTestHealthCheckRow({
            status: "down",
            response_time_ms: 5000,
          }),
        ],
        success: true,
      });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return tenantStmt;
        return checksStmt;
      });

      const res = await fetchApp("/api/v1/health/tenants/T-1");
      const body = await res.json();
      expect(body.data.health.issues).toBeDefined();
      expect(body.data.health.issues).toContain("Service is currently down");
      expect(body.data.health.issues).toContain("High response time detected");
    });

    it("should return 404 for non-existent tenant", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/health/tenants/T-NONEXISTENT");
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // POST /api/v1/health/report
  // ============================================================
  describe("POST /api/v1/health/report", () => {
    it("should record a health check report", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.run.mockResolvedValue({ success: true });
      db.prepare.mockReturnValue(stmt);

      const kv = mockDeploymentKV();

      const res = await fetchApp(
        "/api/v1/health/report",
        jsonBody({
          tenantId: "T-1",
          status: "healthy",
          responseTimeMs: 120,
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.tenantId).toBe("T-1");
      expect(body.data.status).toBe("healthy");
      expect(body.data.checkId).toBeDefined();

      // Should update KV cache
      expect(kv.put).toHaveBeenCalledWith(
        "health:T-1",
        expect.any(String),
        expect.objectContaining({ expirationTtl: 3600 }),
      );
    });

    it("should record report with details", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.run.mockResolvedValue({ success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/health/report",
        jsonBody({
          tenantId: "T-1",
          status: "degraded",
          responseTimeMs: 800,
          details: { api: "healthy", db: "slow" },
        }),
      );

      expect(res.status).toBe(200);
    });

    it("should return 400 when tenantId is missing", async () => {
      const res = await fetchApp(
        "/api/v1/health/report",
        jsonBody({ status: "healthy" }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 when status is missing", async () => {
      const res = await fetchApp(
        "/api/v1/health/report",
        jsonBody({ tenantId: "T-1" }),
      );

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid status value", async () => {
      const res = await fetchApp(
        "/api/v1/health/report",
        jsonBody({ tenantId: "T-1", status: "unknown" }),
      );

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // POST /api/v1/health/check/:tenantId
  // ============================================================
  describe("POST /api/v1/health/check/:tenantId", () => {
    it("should return 404 when tenant not found or inactive", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/health/check/T-NONEXISTENT",
        jsonBody({}),
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe("NOT_FOUND");
    });

    it("should perform health check and record result", async () => {
      const db = mockDb();
      const tenantStmt = createMockD1Statement();
      tenantStmt.first.mockResolvedValue({
        id: "T-1",
        subdomain: "test-shop",
        custom_domain: null,
      });

      const insertStmt = createMockD1Statement();
      insertStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return tenantStmt;
        return insertStmt;
      });

      // Mock fetch for health check (the external call)
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("api.test-shop.makanmakan.app")) {
          return Promise.resolve(
            new Response(JSON.stringify({ status: "ok" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return originalFetch(url);
      }) as typeof fetch;

      try {
        const res = await fetchApp("/api/v1/health/check/T-1", jsonBody({}));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.tenantId).toBe("T-1");
        expect(["healthy", "degraded"]).toContain(body.data.status);
        expect(body.data.responseTimeMs).toBeGreaterThanOrEqual(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should report down when health check fetch fails", async () => {
      const db = mockDb();
      const tenantStmt = createMockD1Statement();
      tenantStmt.first.mockResolvedValue({
        id: "T-1",
        subdomain: "test-shop",
        custom_domain: null,
      });

      const insertStmt = createMockD1Statement();
      insertStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return tenantStmt;
        return insertStmt;
      });

      // Mock fetch to fail
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("makanmakan.app")) {
          return Promise.reject(new Error("Connection refused"));
        }
        return originalFetch(url);
      }) as typeof fetch;

      try {
        const res = await fetchApp("/api/v1/health/check/T-1", jsonBody({}));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.status).toBe("down");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should use custom domain when available", async () => {
      const db = mockDb();
      const tenantStmt = createMockD1Statement();
      tenantStmt.first.mockResolvedValue({
        id: "T-1",
        subdomain: "test-shop",
        custom_domain: "myrestaurant.com",
      });

      const insertStmt = createMockD1Statement();
      insertStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return tenantStmt;
        return insertStmt;
      });

      let calledUrl = "";
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        calledUrl = url;
        return Promise.resolve(
          new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
        );
      }) as typeof fetch;

      try {
        await fetchApp("/api/v1/health/check/T-1", jsonBody({}));
        expect(calledUrl).toContain("myrestaurant.com");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
