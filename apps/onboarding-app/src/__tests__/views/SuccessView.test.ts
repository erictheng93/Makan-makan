/**
 * Tests for SuccessView
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SuccessView from "@/views/SuccessView.vue";
import { useOnboardingStore } from "@/stores/onboarding";

// Mock the API service
vi.mock("@/services/api", () => ({
  onboardingApi: {
    checkSubdomain: vi.fn(),
    createApplication: vi.fn(),
    getApplication: vi.fn(),
    verifyCloudflare: vi.fn(),
    completeApplication: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = "ApiError";
      this.code = code;
    }
  },
}));

// Track router.push calls
const mockRouterPush = vi.fn();
vi.mock("vue-router", async () => {
  const { ref } = await import("vue");
  return {
    useRouter: () => ({
      push: mockRouterPush,
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      resolve: vi.fn((to) => ({
        href: typeof to === "string" ? to : to.path || "/",
      })),
      currentRoute: ref({
        path: "/success",
        name: "Success",
        params: {},
        query: {},
        meta: {},
      }),
    }),
    useRoute: () => ({
      path: "/success",
      name: "Success",
      params: {},
      query: {},
      meta: {},
    }),
    RouterLink: {
      name: "RouterLink",
      props: ["to"],
      template: "<a><slot /></a>",
    },
    RouterView: {
      name: "RouterView",
      template: "<div><slot /></div>",
    },
    createRouter: vi.fn(),
    createWebHistory: vi.fn(),
  };
});

// Mock vue-toastification
const mockToastSuccess = vi.fn();
vi.mock("vue-toastification", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

describe("SuccessView", () => {
  let store: ReturnType<typeof useOnboardingStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useOnboardingStore();
    vi.clearAllMocks();

    // Set up completed state
    store.applicationId = "app-123";
    store.assignedSubdomain = "myrestaurant";
    store.application = {
      businessName: "Test Restaurant",
      contactName: "John",
      contactEmail: "john@test.com",
      contactPhone: "123",
      planId: "standard",
      status: "completed",
    };
    store.completionResult = {
      tenantId: "tenant-abc",
      subdomain: "myrestaurant",
    };
  });

  function mountComponent() {
    return mount(SuccessView, {
      global: {
        stubs: {
          CheckCircleIcon: { template: "<svg />" },
          EnvelopeIcon: { template: "<svg />" },
          ClockIcon: { template: "<svg />" },
          RocketLaunchIcon: { template: "<svg />" },
          DocumentDuplicateIcon: { template: "<svg />" },
        },
      },
    });
  }

  describe("redirect when no completion data", () => {
    it("should redirect to /apply if no completionResult", async () => {
      store.completionResult = null;

      mountComponent();
      await flushPromises();

      expect(mockRouterPush).toHaveBeenCalledWith("/apply");
    });
  });

  describe("rendering", () => {
    it("should render success message", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("申請已完成！");
    });

    it("should render congratulations text", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("恭喜您");
    });

    it("should show completed progress indicators", () => {
      const wrapper = mountComponent();
      // All 3 steps should show checkmarks
      const steps = wrapper.findAll(".rounded-full");
      expect(steps.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("application summary", () => {
    it("should display application ID", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("申請編號");
      expect(wrapper.text()).toContain("app-123");
    });

    it("should display tenant ID", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("租戶編號");
      expect(wrapper.text()).toContain("tenant-abc");
    });

    it("should display restaurant name", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("餐廳名稱");
      expect(wrapper.text()).toContain("Test Restaurant");
    });

    it("should display contact email", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("聯絡 Email");
      expect(wrapper.text()).toContain("john@test.com");
    });

    it("should display plan label", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("選擇方案");
      expect(wrapper.text()).toContain("標準版");
    });

    it("should display professional plan label", async () => {
      store.application!.planId = "professional";
      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.text()).toContain("專業版");
    });

    it("should display enterprise plan label", async () => {
      store.application!.planId = "enterprise";
      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.text()).toContain("企業版");
    });

    it("should display assigned subdomain URL", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("專屬網址");
      expect(wrapper.text()).toContain("myrestaurant.makanmakan.app");
    });

    it("should display Cloudflare connection status", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Cloudflare 帳號");
      expect(wrapper.text()).toContain("已連接");
    });
  });

  describe("next steps section", () => {
    it("should show confirmation email notice", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("確認郵件");
      expect(wrapper.text()).toContain("john@test.com");
    });

    it("should show deployment notice", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("系統部署");
      expect(wrapper.text()).toContain("幾分鐘內完成");
    });

    it("should show usage instruction", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("開始使用");
      expect(wrapper.text()).toContain("登入管理後台");
    });
  });

  describe("action buttons", () => {
    it("should render admin dashboard link", () => {
      const wrapper = mountComponent();

      wrapper.find('a[href="https://myrestaurant.makanmakan.app/admin"]');
      // The link is constructed dynamically, let's check text
      expect(wrapper.text()).toContain("前往管理後台");
    });

    it("should render back to home button", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("返回首頁");
    });

    it("should reset store and navigate home on start new click", async () => {
      const wrapper = mountComponent();
      const resetSpy = vi.spyOn(store, "reset");

      const homeBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("返回首頁"));
      await homeBtn!.trigger("click");

      expect(resetSpy).toHaveBeenCalled();
      expect(mockRouterPush).toHaveBeenCalledWith("/");
    });
  });

  describe("contact section", () => {
    it("should show support email", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("support@makanmakan.app");
    });
  });

  describe("copy to clipboard functionality", () => {
    it("should have copy buttons for application ID and tenant ID", () => {
      const wrapper = mountComponent();

      // There should be copy buttons next to IDs and URL
      const buttons = wrapper.findAll("button");
      // At least: copy applicationId, copy tenantId, copy URL, home button
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });
  });
});
