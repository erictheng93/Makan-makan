/**
 * CreateTenantModal Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import CreateTenantModal from "@/components/tenants/CreateTenantModal.vue";

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

describe("CreateTenantModal", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mountModal = (show = true) => {
    return mount(CreateTenantModal, {
      props: { show },
      global: {
        plugins: [createPinia()],
      },
    });
  };

  it("does not render when show is false", () => {
    const wrapper = mountModal(false);
    expect(wrapper.text()).toBe("");
  });

  it("renders when show is true", () => {
    const wrapper = mountModal(true);
    expect(wrapper.text()).toContain("新增租戶");
  });

  it("renders form fields", () => {
    const wrapper = mountModal();
    expect(wrapper.text()).toContain("商家名稱");
    expect(wrapper.text()).toContain("聯絡 Email");
    expect(wrapper.text()).toContain("聯絡電話");
    expect(wrapper.text()).toContain("子域名");
    expect(wrapper.text()).toContain("選擇方案");
  });

  it("renders plan options", () => {
    const wrapper = mountModal();
    expect(wrapper.text()).toContain("標準版 - $149/月");
    expect(wrapper.text()).toContain("專業版 - $299/月");
    expect(wrapper.text()).toContain("企業版 - 議價");
  });

  it("renders plan descriptions", () => {
    const wrapper = mountModal();
    expect(wrapper.text()).toContain("1 間餐廳，基本功能");
    expect(wrapper.text()).toContain("3 間餐廳，完整功能");
    expect(wrapper.text()).toContain("無限餐廳，客製化服務");
  });

  it("renders action buttons", () => {
    const wrapper = mountModal();
    expect(wrapper.text()).toContain("取消");
    expect(wrapper.text()).toContain("創建租戶");
  });

  it("shows subdomain suffix", () => {
    const wrapper = mountModal();
    expect(wrapper.text()).toContain(".makanmasak.app");
  });

  it("emits close when cancel is clicked", async () => {
    const wrapper = mountModal();
    const cancelBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "取消");

    await cancelBtn!.trigger("click");

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close when backdrop is clicked", async () => {
    const wrapper = mountModal();
    // The backdrop is the first div with bg-gray-500
    const backdrop = wrapper.find(".bg-gray-500");
    if (backdrop.exists()) {
      await backdrop.trigger("click");
      expect(wrapper.emitted("close")).toBeTruthy();
    }
  });

  it("validates required business name", async () => {
    const wrapper = mountModal();
    // Click submit without filling form
    const submitBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "創建租戶");

    await submitBtn!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("請輸入商家名稱");
  });

  it("validates required email", async () => {
    const wrapper = mountModal();
    // Fill business name only
    const inputs = wrapper.findAll("input");
    const nameInput = inputs[0]; // businessName
    await nameInput.setValue("Test Business");

    const submitBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "創建租戶");
    await submitBtn!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("請輸入聯絡 Email");
  });

  it("validates email format", async () => {
    const wrapper = mountModal();
    const inputs = wrapper.findAll('input[type="text"], input[type="email"]');
    // Find the text input (businessName) and email input
    await inputs[0].setValue("Test Business");

    const emailInput = wrapper.find('input[type="email"]');
    await emailInput.setValue("invalid-email");

    const submitBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "創建租戶");
    await submitBtn!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("請輸入有效的 Email");
  });

  it("validates subdomain format", async () => {
    const wrapper = mountModal();
    const inputs = wrapper.findAll("input");
    // businessName
    await inputs[0].setValue("Test Business");
    // email
    const emailInput = wrapper.find('input[type="email"]');
    await emailInput.setValue("test@test.com");
    // Find subdomain input (text input that's not the first one)
    const textInputs = wrapper.findAll('input[type="text"]');
    // subdomain should be the last text input (after businessName)
    const subdomainInput = textInputs[textInputs.length - 1];
    await subdomainInput.setValue("INVALID SUBDOMAIN!");

    const submitBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "創建租戶");
    await submitBtn!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("子域名只能包含小寫字母、數字和連字符");
  });

  it("submits form with valid data", async () => {
    const newTenant = {
      id: "t-new",
      businessName: "New Restaurant",
      contactEmail: "new@test.com",
      status: "pending",
      createdAt: "2026-03-01",
    };
    vi.mocked(tenantsApi.create).mockResolvedValue(newTenant as never);

    const wrapper = mountModal();

    // Fill form
    const inputs = wrapper.findAll('input[type="text"]');
    await inputs[0].setValue("New Restaurant"); // businessName

    const emailInput = wrapper.find('input[type="email"]');
    await emailInput.setValue("new@test.com");

    // Submit
    const submitBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "創建租戶");
    await submitBtn!.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("success")).toBeTruthy();
  });

  it("shows error message on submit failure", async () => {
    vi.mocked(tenantsApi.create).mockRejectedValue(new Error("Server error"));

    const wrapper = mountModal();

    const inputs = wrapper.findAll('input[type="text"]');
    await inputs[0].setValue("Test Business");

    const emailInput = wrapper.find('input[type="email"]');
    await emailInput.setValue("test@test.com");

    const submitBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "創建租戶");
    await submitBtn!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Server error");
  });

  it("shows loading state during submission", async () => {
    let resolvePromise: any;
    vi.mocked(tenantsApi.create).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const wrapper = mountModal();

    const inputs = wrapper.findAll('input[type="text"]');
    await inputs[0].setValue("Test Business");

    const emailInput = wrapper.find('input[type="email"]');
    await emailInput.setValue("test@test.com");

    const submitBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "創建租戶");
    await submitBtn!.trigger("click");

    // Check loading state
    await flushPromises();
    expect(wrapper.text()).toContain("創建中...");

    resolvePromise({
      id: "t1",
      businessName: "Test",
      contactEmail: "t@t.com",
      status: "pending",
      createdAt: "",
    });
    await flushPromises();
  });

  it("resets form when modal opens", async () => {
    const wrapper = mountModal(false);

    // Set show to true
    await wrapper.setProps({ show: true });
    await flushPromises();

    // All inputs should be empty
    const textInputs = wrapper.findAll('input[type="text"]');
    for (const input of textInputs) {
      expect((input.element as HTMLInputElement).value).toBe("");
    }
  });

  it("has standard plan selected by default", () => {
    const wrapper = mountModal();
    const radioInputs = wrapper.findAll('input[type="radio"]');
    const standardRadio = radioInputs.find(
      (r) => (r.element as HTMLInputElement).value === "standard",
    );
    expect(standardRadio).toBeDefined();
    expect((standardRadio!.element as HTMLInputElement).checked).toBe(true);
  });
});
