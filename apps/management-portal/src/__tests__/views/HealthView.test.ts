/**
 * HealthView Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import HealthView from "@/views/HealthView.vue";
import { useHealthStore } from "@/stores/health";
import { useTenantsStore } from "@/stores/tenants";

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

import { healthApi } from "@/services/api";

describe("HealthView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mountView = (healthChecks: any[] = [], tenants: any[] = []) => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const hStore = useHealthStore();
    hStore.healthChecks = healthChecks;
    const tStore = useTenantsStore();
    tStore.tenants = tenants;

    return mount(HealthView, { global: { plugins: [pinia] } });
  };

  it("renders page title", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("健康監控");
  });

  it("renders subtitle", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("監控所有租戶的運行狀態");
  });

  it("renders refresh button", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("刷新");
  });

  it("renders stat cards", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("總體狀態");
    expect(wrapper.text()).toContain("正常");
    expect(wrapper.text()).toContain("降級");
    expect(wrapper.text()).toContain("離線");
  });

  it("shows average response time", () => {
    const wrapper = mountView([
      {
        id: "h1",
        tenantId: "t1",
        status: "healthy",
        responseTimeMs: 100,
        checkedAt: "2026-01-01",
      },
    ]);
    expect(wrapper.text()).toContain("平均回應時間");
    expect(wrapper.text()).toContain("100");
    expect(wrapper.text()).toContain("ms");
  });

  it("shows empty state when no health checks", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("暫無健康檢查資料");
  });

  it("renders health check table with data", () => {
    const checks = [
      {
        id: "h1",
        tenantId: "t1",
        status: "healthy" as const,
        responseTimeMs: 45,
        checkedAt: "2026-03-01T00:00:00Z",
        details: {
          api: "healthy",
          database: "healthy",
          cache: "healthy",
          storage: "healthy",
        },
      },
    ];
    const tenants = [
      {
        id: "t1",
        businessName: "Test Restaurant",
        contactEmail: "t@t.com",
        status: "active",
        createdAt: "",
      },
    ];

    const wrapper = mountView(checks, tenants);

    expect(wrapper.text()).toContain("Test Restaurant");
    expect(wrapper.text()).toContain("45ms");
  });

  it("shows issue section when there are down tenants", () => {
    const checks = [
      {
        id: "h1",
        tenantId: "t1",
        status: "down" as const,
        checkedAt: "2026-01-01",
      },
    ];
    const tenants = [
      {
        id: "t1",
        businessName: "Down Restaurant",
        contactEmail: "d@d.com",
        status: "active",
        createdAt: "",
      },
    ];

    const wrapper = mountView(checks, tenants);

    expect(wrapper.text()).toContain("需要注意");
    expect(wrapper.text()).toContain("服務離線");
    expect(wrapper.text()).toContain("Down Restaurant");
  });

  it("shows degraded tenants in issue section", () => {
    const checks = [
      {
        id: "h1",
        tenantId: "t1",
        status: "degraded" as const,
        responseTimeMs: 300,
        checkedAt: "2026-01-01",
      },
    ];
    const tenants = [
      {
        id: "t1",
        businessName: "Slow Restaurant",
        contactEmail: "s@s.com",
        status: "active",
        createdAt: "",
      },
    ];

    const wrapper = mountView(checks, tenants);

    expect(wrapper.text()).toContain("需要注意");
    expect(wrapper.text()).toContain("服務降級");
    expect(wrapper.text()).toContain("300ms");
  });

  it("refresh button calls fetchAllHealthChecks", async () => {
    vi.mocked(healthApi.getAllStatus).mockResolvedValue([]);
    const wrapper = mountView();

    const refreshBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("刷新"));
    expect(refreshBtn).toBeDefined();

    await refreshBtn!.trigger("click");
    await flushPromises();

    expect(healthApi.getAllStatus).toHaveBeenCalled();
  });

  it("displays correct healthy count", () => {
    const checks = [
      { id: "h1", tenantId: "t1", status: "healthy" as const, checkedAt: "" },
      { id: "h2", tenantId: "t2", status: "healthy" as const, checkedAt: "" },
      { id: "h3", tenantId: "t3", status: "degraded" as const, checkedAt: "" },
    ];

    const wrapper = mountView(checks);

    // Should show 2 for healthy count in the stat card
    expect(wrapper.text()).toContain("2");
  });

  it("displays health check details columns when data exists", () => {
    const checks = [
      {
        id: "h1",
        tenantId: "t1",
        status: "healthy" as const,
        responseTimeMs: 45,
        checkedAt: "2026-03-01T00:00:00Z",
        details: {
          api: "healthy",
          database: "healthy",
          cache: "healthy",
          storage: "healthy",
        },
      },
    ];
    const tenants = [
      {
        id: "t1",
        businessName: "Test",
        contactEmail: "t@t.com",
        status: "active",
        createdAt: "",
      },
    ];
    const wrapper = mountView(checks, tenants);
    expect(wrapper.text()).toContain("API");
    expect(wrapper.text()).toContain("資料庫");
    expect(wrapper.text()).toContain("快取");
    expect(wrapper.text()).toContain("儲存");
  });
});
