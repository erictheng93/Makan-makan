/**
 * Tests for Deployment Management Routes
 *
 * Covers: deployment status, history, provisioning, deploy, rollback, batch
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../index";
import {
  createMockEnv,
  createMockD1Statement,
  createTestTenantRow,
  createTestDeploymentLogRow,
} from "../setup";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;

function mockDb() {
  return env.MANAGEMENT_DB as unknown as {
    prepare: ReturnType<typeof vi.fn>;
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

describe("Deployment Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
  });

  // ============================================================
  // GET /api/v1/deployments/:tenantId
  // ============================================================
  describe("GET /api/v1/deployments/:tenantId", () => {
    it("should return deployment status", async () => {
      const db = mockDb();

      // tenant version
      const versionStmt = createMockD1Statement();
      versionStmt.first.mockResolvedValue({ deployed_version: "1.1.0" });

      // last deployment
      const deployStmt = createMockD1Statement();
      deployStmt.first.mockResolvedValue(createTestDeploymentLogRow());

      // resources
      const resourcesStmt = createMockD1Statement();
      resourcesStmt.all.mockResolvedValue({ results: [], success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return versionStmt;
        if (callCount === 2) return deployStmt;
        return resourcesStmt;
      });

      const res = await fetchApp("/api/v1/deployments/T-20240101-ABC");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.currentVersion).toBe("1.1.0");
      expect(body.data.lastDeployment).toBeDefined();
      expect(body.data.lastDeployment.status).toBe("completed");
    });

    it("should handle tenant with no deployments", async () => {
      const db = mockDb();
      const versionStmt = createMockD1Statement();
      versionStmt.first.mockResolvedValue(null);
      const deployStmt = createMockD1Statement();
      deployStmt.first.mockResolvedValue(null);
      const resourcesStmt = createMockD1Statement();
      resourcesStmt.all.mockResolvedValue({ results: [], success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return versionStmt;
        if (callCount === 2) return deployStmt;
        return resourcesStmt;
      });

      const res = await fetchApp("/api/v1/deployments/T-NEW");
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.currentVersion).toBeUndefined();
      expect(body.data.lastDeployment).toBeUndefined();
    });

    it("should return 500 on error", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockRejectedValue(new Error("DB error"));
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/deployments/T-20240101-ABC");
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.code).toBe("GET_STATUS_FAILED");
    });
  });

  // ============================================================
  // GET /api/v1/deployments/:tenantId/history
  // ============================================================
  describe("GET /api/v1/deployments/:tenantId/history", () => {
    it("should return deployment history", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          createTestDeploymentLogRow(),
          createTestDeploymentLogRow({
            id: "deploy-456",
            from_version: "0.9.0",
            to_version: "1.0.0",
          }),
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/deployments/T-20240101-ABC/history");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it("should cap limit at 100", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      await fetchApp("/api/v1/deployments/T-20240101-ABC/history?limit=500");

      // Verify the bind was called with capped limit
      expect(stmt.bind).toHaveBeenCalledWith("T-20240101-ABC", 100);
    });
  });

  // ============================================================
  // POST /api/v1/deployments/provision
  // ============================================================
  describe("POST /api/v1/deployments/provision", () => {
    it("should return 400 for invalid input", async () => {
      const res = await fetchApp(
        "/api/v1/deployments/provision",
        jsonBody({ tenantId: "" }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid resource types", async () => {
      const res = await fetchApp(
        "/api/v1/deployments/provision",
        jsonBody({
          tenantId: "T-123",
          resourceTypes: ["invalid-type"],
        }),
      );

      expect(res.status).toBe(400);
    });

    it("should return error when tenant not found", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null); // no tenant
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/deployments/provision",
        jsonBody({ tenantId: "T-NONEXISTENT" }),
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.code).toBe("PROVISION_FAILED");
    });
  });

  // ============================================================
  // POST /api/v1/deployments/deploy
  // ============================================================
  describe("POST /api/v1/deployments/deploy", () => {
    it("should validate version format", async () => {
      const res = await fetchApp(
        "/api/v1/deployments/deploy",
        jsonBody({
          tenantId: "T-123",
          targetVersion: "not-semver",
        }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should accept valid semver and deploy", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();

      // createDeploymentLog -> get tenant -> updateDeploymentLogFromVersion -> updateVersion -> updateDeploymentLog
      const tenantRow = createTestTenantRow({
        cf_account_id: "acc-123",
        cf_api_token_enc: btoa("test-token"),
      });

      stmt.first.mockResolvedValue(tenantRow);
      stmt.run.mockResolvedValue({ success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/deployments/deploy",
        jsonBody({
          tenantId: "T-20240101-ABC",
          targetVersion: "1.2.0",
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.version).toBe("1.2.0");
      expect(body.data.deploymentId).toBeDefined();
    });

    it("should return 400 for missing tenantId", async () => {
      const res = await fetchApp(
        "/api/v1/deployments/deploy",
        jsonBody({ targetVersion: "1.0.0" }),
      );

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // POST /api/v1/deployments/:tenantId/rollback
  // ============================================================
  describe("POST /api/v1/deployments/:tenantId/rollback", () => {
    it("should rollback to previous version", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();

      // rollbackDeployment -> getLastDeployment -> deployToTenant flow
      stmt.first.mockResolvedValueOnce({ from_version: "1.0.0" }); // last deployment
      stmt.run.mockResolvedValue({ success: true });

      // deployToTenant flow: createLog, getTenant, updateVersion, updateLog
      const tenantRow = createTestTenantRow({
        cf_account_id: "acc-123",
        cf_api_token_enc: btoa("test-token"),
      });
      stmt.first.mockResolvedValueOnce(tenantRow);

      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/deployments/T-20240101-ABC/rollback",
        jsonBody({}),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("rolled_back");
    });

    it("should return 500 when no previous version exists", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null); // no previous deployment
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/deployments/T-20240101-ABC/rollback",
        jsonBody({}),
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.code).toBe("ROLLBACK_FAILED");
    });
  });

  // ============================================================
  // POST /api/v1/deployments/batch
  // ============================================================
  describe("POST /api/v1/deployments/batch", () => {
    it("should return 400 for empty tenantIds array", async () => {
      const res = await fetchApp(
        "/api/v1/deployments/batch",
        jsonBody({ tenantIds: [], targetVersion: "1.0.0" }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("non-empty array");
    });

    it("should return 400 for invalid version format", async () => {
      const res = await fetchApp(
        "/api/v1/deployments/batch",
        jsonBody({ tenantIds: ["T-1"], targetVersion: "bad" }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("semver");
    });

    it("should return 400 when tenantIds is not an array", async () => {
      const res = await fetchApp(
        "/api/v1/deployments/batch",
        jsonBody({ tenantIds: "not-array", targetVersion: "1.0.0" }),
      );

      expect(res.status).toBe(400);
    });

    it("should deploy to multiple tenants and return summary", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();

      const tenantRow = createTestTenantRow({
        cf_account_id: "acc-123",
        cf_api_token_enc: btoa("test-token"),
      });
      stmt.first.mockResolvedValue(tenantRow);
      stmt.run.mockResolvedValue({ success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/deployments/batch",
        jsonBody({
          tenantIds: ["T-1", "T-2"],
          targetVersion: "1.2.0",
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.summary.total).toBe(2);
      expect(body.data.results).toHaveLength(2);
    });
  });
});
