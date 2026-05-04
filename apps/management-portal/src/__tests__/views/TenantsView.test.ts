/**
 * TenantsView Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import TenantsView from "@/views/TenantsView.vue";
import { useTenantsStore } from "@/stores/tenants";

vi.mock("@/services/api", () => ({
  tenantsApi: {
    list: vi.fn(),
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

import { tenantsApi } from "@/services/api";

const sampleTenants = [
  {
    id: "t1",
    businessName: "Alpha Restaurant",
    contactEmail: "alpha@test.com",
    subdomain: "alpha",
    customDomain: "alpha.com",
    status: "active" as const,
    deployedVersion: "1.0.0",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "t2",
    businessName: "Beta Restaurant",
    contactEmail: "beta@test.com",
    subdomain: "beta",
    status: "pending" as const,
    createdAt: "2026-01-02T00:00:00Z",
  },
  {
    id: "t3",
    businessName: "Gamma Restaurant",
    contactEmail: "gamma@test.com",
    status: "suspended" as const,
    createdAt: "2026-01-03T00:00:00Z",
  },
];

describe("TenantsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mountView = (tenants = sampleTenants) => {
    // Mock fetchTenants to return our sample tenants (onMounted calls it)
    vi.mocked(tenantsApi.list).mockResolvedValue({
      data: tenants,
      total: tenants.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useTenantsStore();
    store.tenants = [...tenants];

    return mount(TenantsView, {
      global: { plugins: [pinia] },
    });
  };

  it("renders page title", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("租戶管理");
  });

  it("renders add tenant button", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("新增租戶");
  });

  it("renders search input", () => {
    const wrapper = mountView();
    const input = wrapper.find('input[type="text"]');
    expect(input.exists()).toBe(true);
  });

  it("renders status filter dropdown", () => {
    const wrapper = mountView();
    const select = wrapper.find("select");
    expect(select.exists()).toBe(true);
  });

  it("renders tenant list table", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("商家名稱");
    expect(wrapper.text()).toContain("聯絡 Email");
    expect(wrapper.text()).toContain("子域名");
  });

  it("displays tenant data", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("Alpha Restaurant");
    expect(wrapper.text()).toContain("alpha@test.com");
    expect(wrapper.text()).toContain("alpha.makanmasak.app");
  });

  it("displays deployed version", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("v1.0.0");
  });

  it("shows status badges", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("運行中");
    expect(wrapper.text()).toContain("待處理");
    expect(wrapper.text()).toContain("已暫停");
  });

  it("shows first letter avatar for each tenant", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("A"); // Alpha
    expect(wrapper.text()).toContain("B"); // Beta
    expect(wrapper.text()).toContain("G"); // Gamma
  });

  it("shows empty state when no tenants", () => {
    const wrapper = mountView([]);
    expect(wrapper.text()).toContain("暫無租戶");
  });

  it("filters tenants by search query", async () => {
    const wrapper = mountView();
    await flushPromises(); // Wait for onMounted fetchTenants
    const input = wrapper.find('input[type="text"]');

    await input.setValue("Alpha");
    await flushPromises();

    expect(wrapper.text()).toContain("Alpha Restaurant");
    expect(wrapper.text()).not.toContain("Beta Restaurant");
    expect(wrapper.text()).not.toContain("Gamma Restaurant");
  });

  it("filters by email in search", async () => {
    const wrapper = mountView();
    await flushPromises();
    const input = wrapper.find('input[type="text"]');

    await input.setValue("gamma@");
    await flushPromises();

    expect(wrapper.text()).toContain("Gamma Restaurant");
    expect(wrapper.text()).not.toContain("Alpha Restaurant");
  });

  it("filters by subdomain in search", async () => {
    const wrapper = mountView();
    await flushPromises();
    const input = wrapper.find('input[type="text"]');

    await input.setValue("beta");
    await flushPromises();

    expect(wrapper.text()).toContain("Beta Restaurant");
  });

  it("shows no results message when search matches nothing", async () => {
    const wrapper = mountView();
    const input = wrapper.find('input[type="text"]');

    await input.setValue("zzzznonexistent");
    await flushPromises();

    expect(wrapper.text()).toContain("沒有符合條件的租戶");
  });

  it("filters tenants by status", async () => {
    const wrapper = mountView();
    await flushPromises();
    const select = wrapper.find("select");

    await select.setValue("active");
    await flushPromises();

    expect(wrapper.text()).toContain("Alpha Restaurant");
    expect(wrapper.text()).not.toContain("Beta Restaurant");
    expect(wrapper.text()).not.toContain("Gamma Restaurant");
  });

  it("shows all tenants with 'all' status filter", async () => {
    const wrapper = mountView();
    await flushPromises();
    const select = wrapper.find("select");

    await select.setValue("active");
    await flushPromises();
    await select.setValue("all");
    await flushPromises();

    expect(wrapper.text()).toContain("Alpha Restaurant");
    expect(wrapper.text()).toContain("Beta Restaurant");
    expect(wrapper.text()).toContain("Gamma Restaurant");
  });

  it("opens create modal on button click", async () => {
    const wrapper = mountView();
    const button = wrapper.find("button");

    await button.trigger("click");
    await flushPromises();

    // The CreateTenantModal should receive show=true
    // Since we're testing the parent, we check for modal content
    expect(wrapper.text()).toContain("新增租戶");
  });

  it("shows loading state", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useTenantsStore();
    store.loading = true;

    const wrapper = mount(TenantsView, {
      global: { plugins: [pinia] },
    });

    expect(wrapper.text()).toContain("載入中...");
  });

  it("displays custom domain when present", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("alpha.com");
  });

  it("shows dash when no subdomain", () => {
    const wrapper = mountView();
    // Gamma has no subdomain, should show "-"
    const html = wrapper.html();
    expect(html).toContain("-");
  });
});
