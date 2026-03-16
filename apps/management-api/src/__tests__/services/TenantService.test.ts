/**
 * Tests for TenantService
 *
 * Covers: CRUD operations, subdomain lookup, CF connection,
 *         license key generation, tenant ID generation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TenantService } from "../../services/TenantService";
import {
  createMockEnv,
  createMockD1Statement,
  createTestTenantRow,
} from "../setup";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;
let service: TenantService;

function mockDb() {
  return env.MANAGEMENT_DB as unknown as {
    prepare: ReturnType<typeof vi.fn>;
  };
}

describe("TenantService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    service = new TenantService(env);
  });

  // ============================================================
  // listTenants
  // ============================================================
  describe("listTenants", () => {
    it("should return paginated results", async () => {
      const db = mockDb();
      const countStmt = createMockD1Statement();
      countStmt.first.mockResolvedValue({ count: 25 });

      const dataStmt = createMockD1Statement();
      dataStmt.all.mockResolvedValue({
        results: [createTestTenantRow()],
        success: true,
      });

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return countStmt;
        return dataStmt;
      });

      const result = await service.listTenants({ page: 1, limit: 10 });
      expect(result.total).toBe(25);
      expect(result.tenants).toHaveLength(1);
      expect(result.tenants[0].businessName).toBe("Test Restaurant");
    });

    it("should filter by status", async () => {
      const db = mockDb();
      const countStmt = createMockD1Statement();
      countStmt.first.mockResolvedValue({ count: 5 });
      const dataStmt = createMockD1Statement();
      dataStmt.all.mockResolvedValue({ results: [], success: true });

      let callCount = 0;
      db.prepare.mockImplementation((sql: string) => {
        callCount++;
        // Both queries should contain status filter
        expect(sql).toContain("AND status = ?");
        if (callCount === 1) return countStmt;
        return dataStmt;
      });

      await service.listTenants({ page: 1, limit: 10, status: "active" });
      expect(countStmt.bind).toHaveBeenCalledWith("active");
    });

    it("should filter by search term across multiple fields", async () => {
      const db = mockDb();
      const countStmt = createMockD1Statement();
      countStmt.first.mockResolvedValue({ count: 0 });
      const dataStmt = createMockD1Statement();
      dataStmt.all.mockResolvedValue({ results: [], success: true });

      let callCount = 0;
      db.prepare.mockImplementation((sql: string) => {
        callCount++;
        expect(sql).toContain("business_name LIKE ?");
        expect(sql).toContain("contact_email LIKE ?");
        expect(sql).toContain("subdomain LIKE ?");
        if (callCount === 1) return countStmt;
        return dataStmt;
      });

      await service.listTenants({
        page: 1,
        limit: 10,
        search: "restaurant",
      });
    });

    it("should calculate correct offset for pagination", async () => {
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

      await service.listTenants({ page: 3, limit: 10 });
      // Offset should be (3-1)*10 = 20
      expect(dataStmt.bind).toHaveBeenCalledWith(10, 20);
    });
  });

  // ============================================================
  // getTenantById
  // ============================================================
  describe("getTenantById", () => {
    it("should return tenant when found", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(createTestTenantRow());
      db.prepare.mockReturnValue(stmt);

      const tenant = await service.getTenantById("T-20240101-ABC");
      expect(tenant).not.toBeNull();
      expect(tenant!.id).toBe("T-20240101-ABC");
      expect(tenant!.businessName).toBe("Test Restaurant");
      expect(tenant!.licenseTier).toBe("standard");
    });

    it("should return null when not found", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const tenant = await service.getTenantById("T-NONEXISTENT");
      expect(tenant).toBeNull();
    });
  });

  // ============================================================
  // getTenantBySubdomain
  // ============================================================
  describe("getTenantBySubdomain", () => {
    it("should find tenant by subdomain", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(createTestTenantRow());
      db.prepare.mockReturnValue(stmt);

      const tenant = await service.getTenantBySubdomain("test-restaurant");
      expect(tenant).not.toBeNull();
      expect(tenant!.subdomain).toBe("test-restaurant");
    });

    it("should return null for unknown subdomain", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const tenant = await service.getTenantBySubdomain("unknown");
      expect(tenant).toBeNull();
    });
  });

  // ============================================================
  // createTenant
  // ============================================================
  describe("createTenant", () => {
    it("should create tenant and return the created record", async () => {
      const db = mockDb();
      const insertStmt = createMockD1Statement();
      insertStmt.run.mockResolvedValue({ success: true });

      const getStmt = createMockD1Statement();
      getStmt.first.mockResolvedValue(
        createTestTenantRow({ status: "pending" }),
      );

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return insertStmt;
        return getStmt;
      });

      const tenant = await service.createTenant({
        businessName: "Test Restaurant",
        contactEmail: "test@example.com",
        subdomain: "test-restaurant",
        licenseTier: "standard",
      });

      expect(tenant).toBeDefined();
      expect(insertStmt.bind).toHaveBeenCalled();
      // Verify the insert includes all expected fields
      const bindArgs = insertStmt.bind.mock.calls[0];
      expect(bindArgs[0]).toMatch(/^T-\d{8}-[A-Z0-9]{3}$/); // tenant ID format
      expect(bindArgs[1]).toBe("Test Restaurant");
      expect(bindArgs[2]).toBe("test@example.com");
      expect(bindArgs[4]).toBe("test-restaurant");
      expect(bindArgs[6]).toBe("standard");
      expect(bindArgs[7]).toMatch(/^MKM-STD-/); // license key format
      expect(bindArgs[8]).toBe("pending");
    });

    it("should handle optional fields (contactPhone, customDomain)", async () => {
      const db = mockDb();
      const insertStmt = createMockD1Statement();
      insertStmt.run.mockResolvedValue({ success: true });
      const getStmt = createMockD1Statement();
      getStmt.first.mockResolvedValue(createTestTenantRow());

      let callCount = 0;
      db.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return insertStmt;
        return getStmt;
      });

      await service.createTenant({
        businessName: "Shop",
        contactEmail: "shop@example.com",
        contactPhone: "+60123",
        subdomain: "my-shop",
        customDomain: "shop.com",
        licenseTier: "professional",
      });

      const bindArgs = insertStmt.bind.mock.calls[0];
      expect(bindArgs[3]).toBe("+60123"); // contactPhone
      expect(bindArgs[5]).toBe("shop.com"); // customDomain
    });
  });

  // ============================================================
  // updateTenant
  // ============================================================
  describe("updateTenant", () => {
    it("should update specified fields only", async () => {
      const db = mockDb();
      const existingTenant = createTestTenantRow();
      const getStmt1 = createMockD1Statement();
      getStmt1.first.mockResolvedValue(existingTenant);

      const updateStmt = createMockD1Statement();
      updateStmt.run.mockResolvedValue({ success: true });

      const getStmt2 = createMockD1Statement();
      getStmt2.first.mockResolvedValue(
        createTestTenantRow({ business_name: "New Name" }),
      );

      let callCount = 0;
      db.prepare.mockImplementation((sql: string) => {
        callCount++;
        if (callCount === 1) return getStmt1;
        if (callCount === 2) {
          expect(sql).toContain("business_name = ?");
          return updateStmt;
        }
        return getStmt2;
      });

      const result = await service.updateTenant("T-20240101-ABC", {
        businessName: "New Name",
      });

      expect(result).not.toBeNull();
    });

    it("should return existing tenant when no updates provided", async () => {
      const db = mockDb();
      const existingTenant = createTestTenantRow();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(existingTenant);
      db.prepare.mockReturnValue(stmt);

      const result = await service.updateTenant("T-20240101-ABC", {});
      expect(result).not.toBeNull();
      expect(result!.businessName).toBe("Test Restaurant");
    });

    it("should return null when tenant not found", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const result = await service.updateTenant("T-NONEXISTENT", {
        businessName: "New Name",
      });
      expect(result).toBeNull();
    });

    it("should set activated_at when status changes to active", async () => {
      const db = mockDb();
      const existingTenant = createTestTenantRow({
        status: "pending",
        activated_at: null,
      });
      const getStmt = createMockD1Statement();
      getStmt.first.mockResolvedValue(existingTenant);

      const updateStmt = createMockD1Statement();
      updateStmt.run.mockResolvedValue({ success: true });

      const getStmt2 = createMockD1Statement();
      getStmt2.first.mockResolvedValue(
        createTestTenantRow({ status: "active" }),
      );

      let callCount = 0;
      db.prepare.mockImplementation((sql: string) => {
        callCount++;
        if (callCount === 1) return getStmt;
        if (callCount === 2) {
          // Should include activated_at in the update
          expect(sql).toContain("activated_at = ?");
          return updateStmt;
        }
        return getStmt2;
      });

      await service.updateTenant("T-20240101-ABC", { status: "active" });
    });
  });

  // ============================================================
  // deleteTenant
  // ============================================================
  describe("deleteTenant", () => {
    it("should soft-delete tenant", async () => {
      const db = mockDb();
      const existingTenant = createTestTenantRow();
      const getStmt = createMockD1Statement();
      getStmt.first.mockResolvedValue(existingTenant);

      const updateStmt = createMockD1Statement();
      updateStmt.run.mockResolvedValue({ success: true });

      let callCount = 0;
      db.prepare.mockImplementation((sql: string) => {
        callCount++;
        if (callCount === 1) return getStmt;
        expect(sql).toContain("status = 'terminated'");
        return updateStmt;
      });

      const result = await service.deleteTenant("T-20240101-ABC");
      expect(result).toBe(true);
    });

    it("should return false when tenant not found", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.first.mockResolvedValue(null);
      db.prepare.mockReturnValue(stmt);

      const result = await service.deleteTenant("T-NONEXISTENT");
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // getTenantResources
  // ============================================================
  describe("getTenantResources", () => {
    it("should return mapped resource objects", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.all.mockResolvedValue({
        results: [
          {
            id: "r1",
            tenant_id: "T-1",
            resource_type: "d1",
            resource_name: "test-db",
            resource_id: "d1-uuid",
            status: "ready",
            error_message: null,
            created_at: "2024-01-01",
            updated_at: "2024-01-01",
          },
        ],
        success: true,
      });
      db.prepare.mockReturnValue(stmt);

      const resources = await service.getTenantResources("T-1");
      expect(resources).toHaveLength(1);
      expect(resources[0].resourceType).toBe("d1");
      expect(resources[0].tenantId).toBe("T-1");
    });
  });

  // ============================================================
  // connectCloudflareAccount
  // ============================================================
  describe("connectCloudflareAccount", () => {
    it("should return error when token verification fails", async () => {
      // Mock global fetch for CF API call
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ success: false, errors: [], messages: [] }),
            { status: 403 },
          ),
        ) as typeof fetch;

      try {
        const result = await service.connectCloudflareAccount(
          "T-1",
          "bad-token",
          "bad-account",
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should store encrypted token on success", async () => {
      const db = mockDb();
      const stmt = createMockD1Statement();
      stmt.run.mockResolvedValue({ success: true });
      db.prepare.mockReturnValue(stmt);

      // Mock CF API to return success
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            errors: [],
            messages: [],
            result: {},
          }),
          { status: 200 },
        ),
      ) as typeof fetch;

      try {
        const result = await service.connectCloudflareAccount(
          "T-1",
          "valid-token",
          "valid-account",
        );
        expect(result.success).toBe(true);

        // Verify the token was stored (base64 encoded)
        const bindArgs = stmt.bind.mock.calls[0];
        expect(bindArgs[0]).toBe("valid-account"); // accountId
        expect(bindArgs[1]).toContain(":"); // AES-256-GCM format: base64(iv):base64(encrypted)
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
