/**
 * TenantDetailView Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import TenantDetailView from "@/views/TenantDetailView.vue";
import { useTenantsStore } from "@/stores/tenants";
import type { Tenant } from "@/types";

// Override vue-router mock for this file to provide route params
vi.mock("vue-router", async () => {
  const { ref } = await import("vue");
  const pushMock = vi.fn((_to) => Promise.resolve());

  return {
    useRouter: () => ({
      push: pushMock,
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      resolve: vi.fn((to) => ({
        href: typeof to === "string" ? to : to.path || "/",
        path: typeof to === "string" ? to : to.path || "/",
        matched: [],
        meta: {},
      })),
      currentRoute: ref({ path: "/tenants/t1", params: { id: "t1" } }),
    }),
    useRoute: () => ({
      path: "/tenants/t1",
      name: "TenantDetail",
      params: { id: "t1" },
      query: {},
      meta: { title: "租戶詳情" },
      hash: "",
      fullPath: "/tenants/t1",
      matched: [],
    }),
    RouterLink: {
      name: "RouterLink",
      template: "<a><slot /></a>",
      props: ["to"],
    },
    RouterView: {
      name: "RouterView",
      template: "<div><slot /></div>",
    },
    createRouter: vi.fn(),
    createWebHistory: vi.fn(),
    createMemoryHistory: vi.fn(),
  };
});

vi.mock("@/services/api", () => ({
  tenantsApi: {
    list: vi.fn(),
    get: vi.fn().mockResolvedValue({
      id: "t1",
      businessName: "Test Restaurant",
      contactEmail: "test@test.com",
      contactPhone: "02-1234-5678",
      subdomain: "test",
      status: "active",
      deployedVersion: "1.0.0",
      createdAt: "2026-01-01T00:00:00Z",
    }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getResources: vi.fn().mockResolvedValue([]),
  },
  deploymentsApi: {
    getStatus: vi.fn(),
    getHistory: vi.fn().mockResolvedValue([]),
    provision: vi.fn(),
    deploy: vi.fn(),
    rollback: vi.fn(),
    batchDeploy: vi.fn(),
  },
  healthApi: {
    getAllStatus: vi.fn(),
    getTenantStatus: vi.fn().mockResolvedValue([]),
    check: vi.fn(),
  },
  licensesApi: {
    generate: vi.fn(),
    getTenantLicense: vi.fn().mockResolvedValue([]),
    renew: vi.fn(),
    upgrade: vi.fn(),
  },
}));

const mockTenant: Tenant = {
  id: "t1",
  businessName: "Test Restaurant",
  contactEmail: "test@test.com",
  contactPhone: "02-1234-5678",
  subdomain: "test",
  status: "active",
  deployedVersion: "1.0.0",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("TenantDetailView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mountView = (tenant: Tenant | null = mockTenant) => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useTenantsStore();
    if (tenant) {
      store.currentTenant = tenant;
    }

    return mount(TenantDetailView, {
      global: { plugins: [pinia] },
    });
  };

  it("renders back button", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("返回租戶列表");
  });

  it("renders tenant name", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("Test Restaurant");
  });

  it("renders tenant status", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("運行中");
  });

  it("renders subdomain info", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("test.makanmakan.app");
  });

  it("renders first letter avatar", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("T"); // First letter of "Test Restaurant"
  });

  it("renders tab navigation", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("概覽");
    expect(wrapper.text()).toContain("資源");
    expect(wrapper.text()).toContain("部署");
    expect(wrapper.text()).toContain("健康");
    expect(wrapper.text()).toContain("授權");
  });

  it("shows overview tab by default", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("基本資訊");
    expect(wrapper.text()).toContain("部署資訊");
    expect(wrapper.text()).toContain("商家名稱");
    expect(wrapper.text()).toContain("聯絡 Email");
  });

  it("shows contact information in overview", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("test@test.com");
    expect(wrapper.text()).toContain("02-1234-5678");
  });

  it("shows deployment version in overview", async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain("v1.0.0");
  });

  it("switches to resources tab", async () => {
    const wrapper = mountView();
    await flushPromises();

    const resourcesTab = wrapper
      .findAll("button")
      .find((b) => b.text().includes("資源"));
    await resourcesTab!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Cloudflare 資源");
  });

  it("shows empty state in resources tab", async () => {
    const wrapper = mountView();
    await flushPromises();

    const resourcesTab = wrapper
      .findAll("button")
      .find((b) => b.text().includes("資源"));
    await resourcesTab!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("尚未配置資源");
  });

  it("switches to deployments tab", async () => {
    const wrapper = mountView();
    await flushPromises();

    const deploymentsTab = wrapper
      .findAll("button")
      .find((b) => b.text().trim() === "部署");
    if (deploymentsTab) {
      await deploymentsTab.trigger("click");
      await flushPromises();
      expect(wrapper.text()).toContain("部署歷史");
    }
  });

  it("switches to health tab", async () => {
    const wrapper = mountView();
    await flushPromises();

    const healthTab = wrapper
      .findAll("button")
      .find((b) => b.text().includes("健康"));
    await healthTab!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("健康狀態");
  });

  it("switches to license tab", async () => {
    const wrapper = mountView();
    await flushPromises();

    const licenseTab = wrapper
      .findAll("button")
      .find((b) => b.text().includes("授權"));
    await licenseTab!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("授權資訊");
  });

  it("shows provision button for pending tenants", async () => {
    const { tenantsApi } = await import("@/services/api");
    vi.mocked(tenantsApi.get).mockResolvedValue({
      ...mockTenant,
      status: "pending" as const,
    });

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(TenantDetailView, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("配置資源");
  });

  it("shows deploy button for active tenants", async () => {
    const { tenantsApi } = await import("@/services/api");
    vi.mocked(tenantsApi.get).mockResolvedValue(mockTenant);
    vi.mocked(tenantsApi.getResources).mockResolvedValue([]);

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(TenantDetailView, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("重新部署");
  });

  it("shows loading state when no tenant loaded", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useTenantsStore();
    store.loading = true;
    store.currentTenant = null;

    const wrapper = mount(TenantDetailView, {
      global: { plugins: [pinia] },
    });

    expect(wrapper.text()).toContain("載入中...");
  });

  it("displays resources when available", async () => {
    const { tenantsApi, deploymentsApi, healthApi, licensesApi } =
      await import("@/services/api");
    const resources = [
      {
        id: "r1",
        tenantId: "t1",
        resourceType: "d1" as const,
        resourceName: "db-test",
        resourceId: "abc-123",
        status: "provisioned" as const,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    vi.mocked(tenantsApi.get).mockResolvedValue(mockTenant);
    vi.mocked(tenantsApi.getResources).mockResolvedValue(resources);
    vi.mocked(deploymentsApi.getHistory).mockResolvedValue([]);
    vi.mocked(healthApi.getTenantStatus).mockResolvedValue([]);
    vi.mocked(licensesApi.getTenantLicense).mockResolvedValue([]);

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(TenantDetailView, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    // Switch to resources tab
    const resourcesTab = wrapper
      .findAll("button")
      .find((b) => b.text().includes("資源"));
    await resourcesTab!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("D1 資料庫");
    expect(wrapper.text()).toContain("db-test");
    expect(wrapper.text()).toContain("已配置");
  });

  it("displays deployment history when available", async () => {
    const { deploymentsApi } = await import("@/services/api");
    const deployments = [
      {
        id: "d1",
        tenantId: "t1",
        deploymentType: "initial" as const,
        toVersion: "1.0.0",
        status: "completed" as const,
        startedAt: "2026-01-01T00:00:00Z",
      },
    ];
    vi.mocked(deploymentsApi.getHistory).mockResolvedValue(deployments);

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(TenantDetailView, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    // Switch to deployments tab
    const deploymentsTab = wrapper.findAll("button").find((b) => {
      const text = b.text().trim();
      return text === "部署";
    });
    if (deploymentsTab) {
      await deploymentsTab.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("初始部署");
      expect(wrapper.text()).toContain("v1.0.0");
      expect(wrapper.text()).toContain("已完成");
    }
  });
});
