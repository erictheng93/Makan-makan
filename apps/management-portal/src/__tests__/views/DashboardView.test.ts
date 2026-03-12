/**
 * DashboardView Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import DashboardView from "@/views/DashboardView.vue";
import { useTenantsStore } from "@/stores/tenants";
import { useHealthStore } from "@/stores/health";

vi.mock("@/services/api", () => ({
  tenantsApi: {
    list: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    }),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getResources: vi.fn(),
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
    getAllStatus: vi.fn().mockResolvedValue([]),
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

describe("DashboardView", () => {
  let tenantsStore: ReturnType<typeof useTenantsStore>;
  let healthStore: ReturnType<typeof useHealthStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    tenantsStore = useTenantsStore();
    healthStore = useHealthStore();
  });

  const mountView = () => {
    return mount(DashboardView, {
      global: {
        plugins: [createPinia()],
      },
    });
  };

  it("renders page title", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("總覽");
  });

  it("renders subtitle", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("管理平台運行狀態概覽");
  });

  it("renders stat cards", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("總租戶數");
    expect(wrapper.text()).toContain("運行中");
    expect(wrapper.text()).toContain("待處理");
    expect(wrapper.text()).toContain("健康異常");
  });

  it("renders health status section", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("健康狀態");
  });

  it("renders pending section", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("待處理事項");
  });

  it("shows no pending items message when empty", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("沒有待處理的事項");
  });

  it("renders recent tenants section", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("最近租戶");
  });

  it("shows empty state when no tenants", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("暫無租戶");
  });

  it("renders tenant table when tenants exist", async () => {
    const { tenantsApi } = await import("@/services/api");
    const tenants = [
      {
        id: "t1",
        businessName: "Test Restaurant",
        contactEmail: "test@test.com",
        status: "active" as const,
        deployedVersion: "1.0.0",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    vi.mocked(tenantsApi.list).mockResolvedValue({
      data: tenants,
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(DashboardView, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Test Restaurant");
    expect(wrapper.text()).toContain("運行中");
    expect(wrapper.text()).toContain("商家名稱");
    expect(wrapper.text()).toContain("狀態");
  });

  it("shows loading state", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useTenantsStore();
    store.loading = true;

    const wrapper = mount(DashboardView, {
      global: { plugins: [pinia] },
    });

    expect(wrapper.text()).toContain("載入中...");
  });

  it("displays health issue items for degraded/down tenants", async () => {
    const { healthApi, tenantsApi } = await import("@/services/api");
    vi.mocked(tenantsApi.list).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
    vi.mocked(healthApi.getAllStatus).mockResolvedValue([
      {
        id: "h1",
        tenantId: "t1",
        status: "down" as const,
        checkedAt: "2026-03-01T00:00:00Z",
      },
    ]);

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(DashboardView, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("服務離線");
  });

  it("shows pending tenants in action items", async () => {
    const { tenantsApi, healthApi } = await import("@/services/api");
    const tenants = [
      {
        id: "t2",
        businessName: "Pending Restaurant",
        contactEmail: "p@test.com",
        status: "pending" as const,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    vi.mocked(tenantsApi.list).mockResolvedValue({
      data: tenants,
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    vi.mocked(healthApi.getAllStatus).mockResolvedValue([]);

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(DashboardView, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Pending Restaurant");
    expect(wrapper.text()).toContain("等待配置資源");
  });

  it("displays correct stat values", async () => {
    const { tenantsApi, healthApi } = await import("@/services/api");
    const tenants = [
      {
        id: "t1",
        businessName: "A",
        contactEmail: "a@a.com",
        status: "active" as const,
        createdAt: "",
      },
      {
        id: "t2",
        businessName: "B",
        contactEmail: "b@b.com",
        status: "active" as const,
        createdAt: "",
      },
      {
        id: "t3",
        businessName: "C",
        contactEmail: "c@c.com",
        status: "pending" as const,
        createdAt: "",
      },
    ];
    vi.mocked(tenantsApi.list).mockResolvedValue({
      data: tenants,
      total: 3,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    vi.mocked(healthApi.getAllStatus).mockResolvedValue([]);

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(DashboardView, {
      global: { plugins: [pinia] },
    });
    await flushPromises();

    // Total: 3, Active: 2, Pending: 1
    const text = wrapper.text();
    expect(text).toContain("3"); // total
    expect(text).toContain("2"); // active
    expect(text).toContain("1"); // pending
  });
});
