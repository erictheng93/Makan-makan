/**
 * Tests for Tenant Management Routes
 *
 * Covers: CRUD operations, validation, subdomain checks, CF connection
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../../index";
import {
  createMockEnv,
  createMockD1Statement,
  createTestTenantRow,
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

function jsonBody(data: unknown) {
  return {
    method: "POST" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

describe("Tenant Routes", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    env = createMockEnv();
    authHeader = await createTestAuthHeader(env.JWT_SECRET);
  });

  // ============================================================
  // GET /api/v1/tenants (list)
  // ============================================================
  describe("GET /api/v1/tenants", () => {
    it("should return paginated list of tenants", async () => {
      const tenantRow = createTestTenantRow();
      const db = mockDb();

      // First call: count query, second call: data query
      const countStmt = createMockD1Statement();
      countStmt.first.mockResolvedValue({ count: 1 });

      const dataStmt = createMockD1Statement();
      dataStmt.all.mockResolvedValue({ results: [tenantRow], success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return countStmt;
        return dataStmt;
      });

      const res = await fetchApp("/api/v1/tenants");
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].businessName).toBe("Test Restaurant");
      expect(body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("should respect page and limit query params", async () => {
      const db = mockDb();
      const countStmt = createMockD1Statement();
      countStmt.first.mockResolvedValue({ count: 50 });
      const dataStmt = createMockD1Statement();
      dataStmt.all.mockResolvedValue({ results: [], success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return countStmt;
        return dataStmt;
      });

      const res = await fetchApp("/api/v1/tenants?page=3&limit=10");
      const body: any = await res.json();
      expect(body.pagination.page).toBe(3);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.totalPages).toBe(5);
    });

    it("should cap limit at 100", async () => {
      const db = mockDb();
      const countStmt = createMockD1Statement();
      countStmt.first.mockResolvedValue({ count: 0 });
      const dataStmt = createMockD1Statement();
      dataStmt.all.mockResolvedValue({ results: [], success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return countStmt;
        return dataStmt;
      });

      const res = await fetchApp("/api/v1/tenants?limit=500");
      const body: any = await res.json();
      expect(body.pagination.limit).toBe(100);
    });

    it("should return 500 on database error", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockRejectedValue(new Error("DB error"));
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/tenants");
      expect(res.status).toBe(500);
      const body: any = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("LIST_FAILED");
    });
  });

  // ============================================================
  // GET /api/v1/tenants/:id
  // ============================================================
  describe("GET /api/v1/tenants/:id", () => {
    it("should return tenant by ID", async () => {
      const tenantRow = createTestTenantRow();
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(tenantRow);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/tenants/T-20240101-ABC");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("T-20240101-ABC");
      expect(body.data.businessName).toBe("Test Restaurant");
    });

    it("should return 404 for non-existent tenant", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/tenants/T-NONEXISTENT");
      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("NOT_FOUND");
    });

    it("should return 500 on database error", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockRejectedValue(new Error("DB error"));
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/tenants/T-20240101-ABC");
      expect(res.status).toBe(500);
      const body: any = await res.json();
      expect(body.code).toBe("GET_FAILED");
    });
  });

  // ============================================================
  // POST /api/v1/tenants (create)
  // ============================================================
  describe("POST /api/v1/tenants", () => {
    it("should create a tenant with valid data", async () => {
      const tenantRow = createTestTenantRow({ subdomain: "my-shop" });
      const db = mockDb();

      // subdomain check returns null (available)
      const subdomainStmt = createMockD1Statement();
      subdomainStmt.first.mockResolvedValue(null);

      // insert succeeds
      const insertStmt = createMockD1Statement();
      insertStmt.run.mockResolvedValue({ success: true });

      // getTenantById after insert
      const getStmt = createMockD1Statement();
      getStmt.first.mockResolvedValue(tenantRow);

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return subdomainStmt; // subdomain check
        if (callCount === 2) return insertStmt; // insert
        return getStmt; // get by id
      });

      const res = await fetchApp(
        "/api/v1/tenants",
        jsonBody({
          businessName: "My Shop",
          contactEmail: "owner@myshop.com",
          subdomain: "my-shop",
          licenseTier: "standard",
        }),
      );

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.success).toBe(true);
    });

    it("should auto-generate subdomain when not provided", async () => {
      const db = mockDb();

      // subdomain check returns null (available)
      const subdomainStmt = createMockD1Statement();
      subdomainStmt.first.mockResolvedValue(null);

      const insertStmt = createMockD1Statement();
      insertStmt.run.mockResolvedValue({ success: true });

      const getStmt = createMockD1Statement();
      getStmt.first.mockResolvedValue(
        createTestTenantRow({ business_name: "Café Latte" }),
      );

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return subdomainStmt;
        if (callCount === 2) return insertStmt;
        return getStmt;
      });

      const res = await fetchApp(
        "/api/v1/tenants",
        jsonBody({
          businessName: "Café Latte",
          contactEmail: "cafe@example.com",
          licenseTier: "professional",
        }),
      );

      expect(res.status).toBe(201);
    });

    it("should return 409 when subdomain is taken", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(createTestTenantRow()); // subdomain exists
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp(
        "/api/v1/tenants",
        jsonBody({
          businessName: "My Shop",
          contactEmail: "owner@myshop.com",
          subdomain: "test-restaurant",
          licenseTier: "standard",
        }),
      );

      expect(res.status).toBe(409);
      const body: any = await res.json();
      expect(body.code).toBe("SUBDOMAIN_TAKEN");
    });

    it("should return 400 for invalid email", async () => {
      const res = await fetchApp(
        "/api/v1/tenants",
        jsonBody({
          businessName: "My Shop",
          contactEmail: "not-an-email",
          licenseTier: "standard",
        }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for missing businessName", async () => {
      const res = await fetchApp(
        "/api/v1/tenants",
        jsonBody({
          contactEmail: "valid@email.com",
          licenseTier: "standard",
        }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for invalid licenseTier", async () => {
      const res = await fetchApp(
        "/api/v1/tenants",
        jsonBody({
          businessName: "Shop",
          contactEmail: "valid@email.com",
          licenseTier: "mega-plan",
        }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for subdomain with invalid characters", async () => {
      const res = await fetchApp(
        "/api/v1/tenants",
        jsonBody({
          businessName: "Shop",
          contactEmail: "valid@email.com",
          subdomain: "UPPERCASE_BAD!",
          licenseTier: "standard",
        }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for businessName too short", async () => {
      const res = await fetchApp(
        "/api/v1/tenants",
        jsonBody({
          businessName: "X",
          contactEmail: "valid@email.com",
          licenseTier: "standard",
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // PATCH /api/v1/tenants/:id (update)
  // ============================================================
  describe("PATCH /api/v1/tenants/:id", () => {
    it("should update tenant fields", async () => {
      const db = mockDb();
      const existingTenant = createTestTenantRow();
      const updatedTenant = createTestTenantRow({
        business_name: "Updated Name",
      });

      // First call: getTenantById (existing check)
      // Second call: update
      // Third call: getTenantById (return result)
      const getStmt1 = createMockD1Statement();
      getStmt1.first.mockResolvedValue(existingTenant);

      const updateStmt = createMockD1Statement();
      updateStmt.run.mockResolvedValue({ success: true });

      const getStmt2 = createMockD1Statement();
      getStmt2.first.mockResolvedValue(updatedTenant);

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getStmt1;
        if (callCount === 2) return updateStmt;
        return getStmt2;
      });

      const res = await fetchApp("/api/v1/tenants/T-20240101-ABC", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
    });

    it("should return 404 for non-existent tenant", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/tenants/T-NONEXISTENT", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: "New Name" }),
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("NOT_FOUND");
    });

    it("should return 400 for invalid status value", async () => {
      const res = await fetchApp("/api/v1/tenants/T-20240101-ABC", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid-status" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("VALIDATION_ERROR");
    });
  });

  // ============================================================
  // DELETE /api/v1/tenants/:id (soft delete)
  // ============================================================
  describe("DELETE /api/v1/tenants/:id", () => {
    it("should soft-delete a tenant (set status to terminated)", async () => {
      const db = mockDb();
      const existingTenant = createTestTenantRow();

      const getStmt = createMockD1Statement();
      getStmt.first.mockResolvedValue(existingTenant);

      const updateStmt = createMockD1Statement();
      updateStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getStmt;
        return updateStmt;
      });

      const res = await fetchApp("/api/v1/tenants/T-20240101-ABC", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.deleted).toBe(true);
    });

    it("should return 404 for non-existent tenant", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/tenants/T-NONEXISTENT", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // GET /api/v1/tenants/:id/resources
  // ============================================================
  describe("GET /api/v1/tenants/:id/resources", () => {
    it("should return tenant resources", async () => {
      const db = mockDb();
      const resourceRows = [
        {
          id: "res-1",
          tenant_id: "T-20240101-ABC",
          resource_type: "d1",
          resource_name: "makanmakan-test-db",
          resource_id: "d1-uuid-123",
          status: "ready",
          error_message: null,
          created_at: "2024-01-01T00:00:00.000Z",
          updated_at: "2024-01-01T00:00:00.000Z",
        },
      ];

      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: resourceRows, success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/tenants/T-20240101-ABC/resources");
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].resourceType).toBe("d1");
      expect(body.data[0].status).toBe("ready");
    });

    it("should return empty array when tenant has no resources", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({ results: [], success: true });
      db.prepare.mockReturnValue(stmt);

      const res = await fetchApp("/api/v1/tenants/T-20240101-ABC/resources");
      const body: any = await res.json();
      expect(body.data).toEqual([]);
    });
  });

  // ============================================================
  // POST /api/v1/tenants/:id/connect-cf
  // ============================================================
  describe("POST /api/v1/tenants/:id/connect-cf", () => {
    it("should return 400 when apiToken is missing", async () => {
      const res = await fetchApp(
        "/api/v1/tenants/T-20240101-ABC/connect-cf",
        jsonBody({ accountId: "acc-123" }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("MISSING_PARAMS");
    });

    it("should return 400 when accountId is missing", async () => {
      const res = await fetchApp(
        "/api/v1/tenants/T-20240101-ABC/connect-cf",
        jsonBody({ apiToken: "token-123" }),
      );

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe("MISSING_PARAMS");
    });
  });
});
