/**
 * Tenants Store Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTenantsStore } from "@/stores/tenants";
import type { Tenant, CreateTenantRequest } from "@/types";

// Mock the API service
vi.mock("@/services/api", () => ({
  tenantsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getResources: vi.fn(),
    connectCloudflare: vi.fn(),
  },
  deploymentsApi: {
    getStatus: vi.fn(),
    getHistory: vi.fn(),
    provision: vi.fn(),
    deploy: vi.fn(),
    rollback: vi.fn(),
    batchDeploy: vi.fn(),
  },
  healthApi: {
    getAllStatus: vi.fn(),
    getTenantStatus: vi.fn(),
    check: vi.fn(),
  },
  licensesApi: {
    generate: vi.fn(),
    getTenantLicense: vi.fn(),
    renew: vi.fn(),
    upgrade: vi.fn(),
  },
}));

import {
  tenantsApi,
  deploymentsApi,
  healthApi,
  licensesApi,
} from "@/services/api";

const mockTenants: Tenant[] = [
  {
    id: "t1",
    businessName: "Restaurant A",
    contactEmail: "a@test.com",
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    deployedVersion: "1.0.0",
  },
  {
    id: "t2",
    businessName: "Restaurant B",
    contactEmail: "b@test.com",
    status: "pending",
    createdAt: "2026-01-02T00:00:00Z",
  },
  {
    id: "t3",
    businessName: "Restaurant C",
    contactEmail: "c@test.com",
    status: "provisioning",
    createdAt: "2026-01-03T00:00:00Z",
  },
  {
    id: "t4",
    businessName: "Restaurant D",
    contactEmail: "d@test.com",
    status: "suspended",
    createdAt: "2026-01-04T00:00:00Z",
  },
];

describe("Tenants Store", () => {
  let store: ReturnType<typeof useTenantsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useTenantsStore();
  });

  describe("initial state", () => {
    it("has empty tenants array", () => {
      expect(store.tenants).toEqual([]);
    });

    it("has null currentTenant", () => {
      expect(store.currentTenant).toBeNull();
    });

    it("has loading false", () => {
      expect(store.loading).toBe(false);
    });

    it("has null error", () => {
      expect(store.error).toBeNull();
    });
  });

  describe("computed properties", () => {
    beforeEach(() => {
      store.tenants = [...mockTenants];
    });

    it("activeTenants filters correctly", () => {
      expect(store.activeTenants).toHaveLength(1);
      expect(store.activeTenants[0].id).toBe("t1");
    });

    it("pendingTenants includes pending and provisioning", () => {
      expect(store.pendingTenants).toHaveLength(2);
      const ids = store.pendingTenants.map((t) => t.id);
      expect(ids).toContain("t2");
      expect(ids).toContain("t3");
    });

    it("totalTenants returns correct count", () => {
      expect(store.totalTenants).toBe(4);
    });

    it("statusCounts returns correct breakdown", () => {
      expect(store.statusCounts).toEqual({
        pending: 1,
        provisioning: 1,
        active: 1,
        suspended: 1,
        terminated: 0,
      });
    });
  });

  describe("fetchTenants", () => {
    it("fetches and stores tenants", async () => {
      vi.mocked(tenantsApi.list).mockResolvedValue({
        data: mockTenants,
        total: mockTenants.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      await store.fetchTenants();

      expect(tenantsApi.list).toHaveBeenCalled();
      expect(store.tenants).toEqual(mockTenants);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it("sets loading during fetch", async () => {
      let resolvePromise: any;
      vi.mocked(tenantsApi.list).mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const fetchPromise = store.fetchTenants();
      expect(store.loading).toBe(true);

      resolvePromise({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      await fetchPromise;
      expect(store.loading).toBe(false);
    });

    it("handles error", async () => {
      vi.mocked(tenantsApi.list).mockRejectedValue(new Error("Network error"));

      await expect(store.fetchTenants()).rejects.toThrow("Network error");
      expect(store.error).toBe("Network error");
      expect(store.loading).toBe(false);
    });
  });

  describe("fetchTenant", () => {
    it("fetches and sets currentTenant", async () => {
      vi.mocked(tenantsApi.get).mockResolvedValue(mockTenants[0]);

      await store.fetchTenant("t1");

      expect(tenantsApi.get).toHaveBeenCalledWith("t1");
      expect(store.currentTenant).toEqual(mockTenants[0]);
    });

    it("handles error", async () => {
      vi.mocked(tenantsApi.get).mockRejectedValue(new Error("Not found"));

      await expect(store.fetchTenant("bad-id")).rejects.toThrow("Not found");
      expect(store.error).toBe("Not found");
    });
  });

  describe("createTenant", () => {
    it("creates tenant and adds to list", async () => {
      const newTenant: Tenant = {
        id: "t5",
        businessName: "New Restaurant",
        contactEmail: "new@test.com",
        status: "pending",
        createdAt: "2026-03-01T00:00:00Z",
      };
      vi.mocked(tenantsApi.create).mockResolvedValue(newTenant);

      const request: CreateTenantRequest = {
        businessName: "New Restaurant",
        contactEmail: "new@test.com",
        licenseTier: "standard",
      };
      const result = await store.createTenant(request);

      expect(tenantsApi.create).toHaveBeenCalledWith(request);
      expect(result).toEqual(newTenant);
      expect(store.tenants).toContainEqual(newTenant);
    });
  });

  describe("updateTenant", () => {
    it("updates tenant in list and currentTenant", async () => {
      store.tenants = [...mockTenants];
      store.currentTenant = mockTenants[0];

      const updated = { ...mockTenants[0], businessName: "Updated Name" };
      vi.mocked(tenantsApi.update).mockResolvedValue(updated);

      const result = await store.updateTenant("t1", {
        businessName: "Updated Name",
      });

      expect(result.businessName).toBe("Updated Name");
      expect(store.tenants[0].businessName).toBe("Updated Name");
      expect(store.currentTenant!.businessName).toBe("Updated Name");
    });

    it("does not update currentTenant if different id", async () => {
      store.tenants = [...mockTenants];
      store.currentTenant = mockTenants[0];

      const updated = { ...mockTenants[1], businessName: "Updated B" };
      vi.mocked(tenantsApi.update).mockResolvedValue(updated);

      await store.updateTenant("t2", { businessName: "Updated B" });

      expect(store.currentTenant!.id).toBe("t1");
      expect(store.currentTenant!.businessName).toBe("Restaurant A");
    });
  });

  describe("deleteTenant", () => {
    it("removes tenant from list", async () => {
      store.tenants = [...mockTenants];
      vi.mocked(tenantsApi.delete).mockResolvedValue(undefined);

      await store.deleteTenant("t2");

      expect(store.tenants).toHaveLength(3);
      expect(store.tenants.find((t) => t.id === "t2")).toBeUndefined();
    });
  });

  describe("fetchTenantResources", () => {
    it("fetches resources for a tenant", async () => {
      const resources = [
        {
          id: "r1",
          tenantId: "t1",
          resourceType: "d1" as const,
          resourceName: "db-t1",
          status: "provisioned" as const,
          createdAt: "2026-01-01",
        },
      ];
      vi.mocked(tenantsApi.getResources).mockResolvedValue(resources);

      await store.fetchTenantResources("t1");

      expect(store.currentResources).toEqual(resources);
    });
  });

  describe("fetchTenantDeployments", () => {
    it("fetches deployment history", async () => {
      const deployments = [
        {
          id: "d1",
          tenantId: "t1",
          deploymentType: "initial" as const,
          toVersion: "1.0.0",
          status: "completed" as const,
          startedAt: "2026-01-01",
        },
      ];
      vi.mocked(deploymentsApi.getHistory).mockResolvedValue(deployments);

      await store.fetchTenantDeployments("t1");

      expect(store.currentDeployments).toEqual(deployments);
    });
  });

  describe("fetchTenantHealthChecks", () => {
    it("fetches health checks", async () => {
      const checks = [
        {
          id: "h1",
          tenantId: "t1",
          status: "healthy" as const,
          responseTimeMs: 50,
          checkedAt: "2026-01-01",
        },
      ];
      vi.mocked(healthApi.getTenantStatus).mockResolvedValue(checks);

      await store.fetchTenantHealthChecks("t1");

      expect(store.currentHealthChecks).toEqual(checks);
    });
  });

  describe("fetchTenantLicenses", () => {
    it("fetches licenses", async () => {
      const licenses = [
        {
          id: "l1",
          tenantId: "t1",
          licenseKey: "KEY-123",
          tier: "standard" as const,
          createdAt: "2026-01-01",
        },
      ];
      vi.mocked(licensesApi.getTenantLicense).mockResolvedValue(licenses);

      await store.fetchTenantLicenses("t1");

      expect(store.currentLicenses).toEqual(licenses);
    });
  });

  describe("provisionTenant", () => {
    it("provisions and stores resources", async () => {
      const resources = [
        {
          id: "r1",
          tenantId: "t1",
          resourceType: "d1" as const,
          resourceName: "db-t1",
          status: "provisioned" as const,
          createdAt: "2026-01-01",
        },
      ];
      vi.mocked(deploymentsApi.provision).mockResolvedValue(resources);

      const result = await store.provisionTenant("t1");

      expect(deploymentsApi.provision).toHaveBeenCalledWith("t1");
      expect(result).toEqual(resources);
      expect(store.currentResources).toEqual(resources);
    });
  });

  describe("deployTenant", () => {
    it("deploys and prepends to deployment list", async () => {
      store.currentDeployments = [];
      const deployment = {
        id: "d1",
        tenantId: "t1",
        deploymentType: "update" as const,
        toVersion: "1.1.0",
        status: "in_progress" as const,
        startedAt: "2026-03-01",
      };
      vi.mocked(deploymentsApi.deploy).mockResolvedValue(deployment);

      const result = await store.deployTenant("t1", "1.1.0");

      expect(deploymentsApi.deploy).toHaveBeenCalledWith({
        tenantId: "t1",
        version: "1.1.0",
      });
      expect(result).toEqual(deployment);
      expect(store.currentDeployments[0]).toEqual(deployment);
    });
  });

  describe("clearCurrentTenant", () => {
    it("clears all current tenant data", () => {
      store.currentTenant = mockTenants[0];
      store.currentResources = [
        {
          id: "r1",
          tenantId: "t1",
          resourceType: "d1",
          resourceName: "db",
          status: "provisioned",
          createdAt: "",
        },
      ];
      store.currentDeployments = [];
      store.currentHealthChecks = [];
      store.currentLicenses = [];

      store.clearCurrentTenant();

      expect(store.currentTenant).toBeNull();
      expect(store.currentResources).toEqual([]);
      expect(store.currentDeployments).toEqual([]);
      expect(store.currentHealthChecks).toEqual([]);
      expect(store.currentLicenses).toEqual([]);
    });
  });
});
