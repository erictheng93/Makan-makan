/**
 * API Service Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

// Mock axios before importing api module
vi.mock("axios", () => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return {
    default: {
      create: vi.fn(() => mockInstance),
      ...mockInstance,
    },
    __mockInstance: mockInstance,
  };
});

// We need to get the mock instance that was created
const mockAxiosCreate = vi.mocked(axios.create);

describe("API Service", () => {
  let mockInstance: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module cache to get fresh imports
    vi.resetModules();

    // Re-mock axios for the fresh import
    vi.doMock("axios", () => {
      mockInstance = {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
        defaults: { headers: { common: {} } },
      };
      return {
        default: {
          create: vi.fn(() => mockInstance),
        },
      };
    });
  });

  describe("tenantsApi", () => {
    it("list calls GET /tenants", async () => {
      const { tenantsApi } = await import("@/services/api");
      const mockResponse = {
        data: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      mockInstance.get.mockResolvedValue(mockResponse);

      const result = await tenantsApi.list();

      expect(mockInstance.get).toHaveBeenCalledWith("/tenants", {
        params: undefined,
      });
      expect(result).toEqual(mockResponse.data);
    });

    it("list passes pagination params", async () => {
      const { tenantsApi } = await import("@/services/api");
      const params = { page: 2, limit: 10, search: "test" };
      mockInstance.get.mockResolvedValue({
        data: { data: [], total: 0, page: 2, limit: 10, totalPages: 0 },
      });

      await tenantsApi.list(params);

      expect(mockInstance.get).toHaveBeenCalledWith("/tenants", { params });
    });

    it("get calls GET /tenants/:id", async () => {
      const { tenantsApi } = await import("@/services/api");
      const tenant = { id: "t1", businessName: "Test" };
      mockInstance.get.mockResolvedValue({ data: { data: tenant } });

      const result = await tenantsApi.get("t1");

      expect(mockInstance.get).toHaveBeenCalledWith("/tenants/t1");
      expect(result).toEqual(tenant);
    });

    it("create calls POST /tenants", async () => {
      const { tenantsApi } = await import("@/services/api");
      const request = {
        businessName: "New",
        contactEmail: "a@b.com",
        licenseTier: "standard" as const,
      };
      const created = { id: "t-new", ...request, status: "pending" };
      mockInstance.post.mockResolvedValue({ data: { data: created } });

      const result = await tenantsApi.create(request);

      expect(mockInstance.post).toHaveBeenCalledWith("/tenants", request);
      expect(result).toEqual(created);
    });

    it("update calls PATCH /tenants/:id", async () => {
      const { tenantsApi } = await import("@/services/api");
      const request = { businessName: "Updated" };
      const updated = { id: "t1", businessName: "Updated" };
      mockInstance.patch.mockResolvedValue({ data: { data: updated } });

      const result = await tenantsApi.update("t1", request);

      expect(mockInstance.patch).toHaveBeenCalledWith("/tenants/t1", request);
      expect(result).toEqual(updated);
    });

    it("delete calls DELETE /tenants/:id", async () => {
      const { tenantsApi } = await import("@/services/api");
      mockInstance.delete.mockResolvedValue({});

      await tenantsApi.delete("t1");

      expect(mockInstance.delete).toHaveBeenCalledWith("/tenants/t1");
    });

    it("getResources calls GET /tenants/:id/resources", async () => {
      const { tenantsApi } = await import("@/services/api");
      const resources = [{ id: "r1", resourceType: "d1" }];
      mockInstance.get.mockResolvedValue({ data: { data: resources } });

      const result = await tenantsApi.getResources("t1");

      expect(mockInstance.get).toHaveBeenCalledWith("/tenants/t1/resources");
      expect(result).toEqual(resources);
    });

    it("connectCloudflare calls POST /tenants/:id/connect-cf", async () => {
      const { tenantsApi } = await import("@/services/api");
      const request = { accountId: "acc-1", apiToken: "token" };
      mockInstance.post.mockResolvedValue({});

      await tenantsApi.connectCloudflare("t1", request);

      expect(mockInstance.post).toHaveBeenCalledWith(
        "/tenants/t1/connect-cf",
        request,
      );
    });
  });

  describe("deploymentsApi", () => {
    it("getStatus calls GET /deployments/:tenantId", async () => {
      const { deploymentsApi } = await import("@/services/api");
      mockInstance.get.mockResolvedValue({
        data: { data: { status: "active", currentVersion: "1.0.0" } },
      });

      const result = await deploymentsApi.getStatus("t1");

      expect(mockInstance.get).toHaveBeenCalledWith("/deployments/t1");
      expect(result).toEqual({ status: "active", currentVersion: "1.0.0" });
    });

    it("deploy calls POST /deployments/deploy", async () => {
      const { deploymentsApi } = await import("@/services/api");
      const request = { tenantId: "t1", version: "1.1.0" };
      const deployment = { id: "d1", ...request, status: "in_progress" };
      mockInstance.post.mockResolvedValue({ data: { data: deployment } });

      const result = await deploymentsApi.deploy(request);

      expect(mockInstance.post).toHaveBeenCalledWith(
        "/deployments/deploy",
        request,
      );
      expect(result).toEqual(deployment);
    });

    it("batchDeploy calls POST /deployments/batch", async () => {
      const { deploymentsApi } = await import("@/services/api");
      const request = { tenantIds: ["t1", "t2"], version: "1.1.0" };
      const response = { queued: 2, failed: [] };
      mockInstance.post.mockResolvedValue({ data: { data: response } });

      const result = await deploymentsApi.batchDeploy(request);

      expect(mockInstance.post).toHaveBeenCalledWith(
        "/deployments/batch",
        request,
      );
      expect(result).toEqual(response);
    });

    it("rollback calls POST /deployments/:tenantId/rollback", async () => {
      const { deploymentsApi } = await import("@/services/api");
      const deployment = { id: "d1", status: "completed" };
      mockInstance.post.mockResolvedValue({ data: { data: deployment } });

      const result = await deploymentsApi.rollback("t1", "1.0.0");

      expect(mockInstance.post).toHaveBeenCalledWith(
        "/deployments/t1/rollback",
        { targetVersion: "1.0.0" },
      );
    });
  });

  describe("healthApi", () => {
    it("getAllStatus calls GET /health/tenants", async () => {
      const { healthApi } = await import("@/services/api");
      const checks = [{ id: "h1", status: "healthy" }];
      mockInstance.get.mockResolvedValue({ data: { data: checks } });

      const result = await healthApi.getAllStatus();

      expect(mockInstance.get).toHaveBeenCalledWith("/health/tenants");
      expect(result).toEqual(checks);
    });

    it("check calls POST /health/check/:tenantId", async () => {
      const { healthApi } = await import("@/services/api");
      const check = { id: "h1", tenantId: "t1", status: "healthy" };
      mockInstance.post.mockResolvedValue({ data: { data: check } });

      const result = await healthApi.check("t1");

      expect(mockInstance.post).toHaveBeenCalledWith("/health/check/t1");
      expect(result).toEqual(check);
    });
  });

  describe("licensesApi", () => {
    it("generate calls POST /licenses/generate", async () => {
      const { licensesApi } = await import("@/services/api");
      const request = { tenantId: "t1", tier: "standard" as const };
      const license = { id: "l1", ...request, licenseKey: "KEY-123" };
      mockInstance.post.mockResolvedValue({ data: { data: license } });

      const result = await licensesApi.generate(request);

      expect(mockInstance.post).toHaveBeenCalledWith(
        "/licenses/generate",
        request,
      );
      expect(result).toEqual(license);
    });

    it("renew calls POST /licenses/:tenantId/renew", async () => {
      const { licensesApi } = await import("@/services/api");
      const license = { id: "l1", expiresAt: "2027-01-01" };
      mockInstance.post.mockResolvedValue({ data: { data: license } });

      const result = await licensesApi.renew("t1", "2027-01-01");

      expect(mockInstance.post).toHaveBeenCalledWith("/licenses/t1/renew", {
        expiresAt: "2027-01-01",
      });
    });

    it("upgrade calls POST /licenses/:tenantId/upgrade", async () => {
      const { licensesApi } = await import("@/services/api");
      const license = { id: "l1", tier: "professional" };
      mockInstance.post.mockResolvedValue({ data: { data: license } });

      const result = await licensesApi.upgrade("t1", "professional");

      expect(mockInstance.post).toHaveBeenCalledWith("/licenses/t1/upgrade", {
        tier: "professional",
      });
    });
  });
});
