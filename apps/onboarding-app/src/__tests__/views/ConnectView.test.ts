/**
 * Tests for ConnectView
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ConnectView from "@/views/ConnectView.vue";
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
        path: "/connect",
        name: "Connect",
        params: {},
        query: {},
        meta: {},
      }),
    }),
    useRoute: () => ({
      path: "/connect",
      name: "Connect",
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
const mockToastError = vi.fn();
vi.mock("vue-toastification", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

describe("ConnectView", () => {
  let store: ReturnType<typeof useOnboardingStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useOnboardingStore();
    vi.clearAllMocks();

    // Set applicationId so we don't get redirected
    store.applicationId = "app-123";
    store.assignedSubdomain = "myrestaurant";
    store.application = {
      businessName: "Test Restaurant",
      contactName: "John",
      contactEmail: "john@test.com",
      contactPhone: "123",
      planId: "standard",
      status: "submitted",
    };
  });

  function mountComponent() {
    return mount(ConnectView, {
      global: {
        stubs: {
          InformationCircleIcon: { template: "<svg />" },
          ClipboardDocumentIcon: { template: "<svg />" },
          CheckCircleIcon: { template: "<svg data-testid='check-icon' />" },
          XCircleIcon: { template: "<svg data-testid='x-icon' />" },
          ArrowPathIcon: { template: "<svg />" },
          ExclamationTriangleIcon: { template: "<svg />" },
        },
      },
    });
  }

  describe("rendering", () => {
    it("should render the page title", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("連接 Cloudflare 帳號");
    });

    it("should show the assigned subdomain", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("myrestaurant.makanmakan.app");
    });

    it("should render the info box explaining why Cloudflare is needed", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("為什麼需要 Cloudflare 帳號？");
    });

    it("should render step-by-step instructions", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("操作步驟");
      expect(wrapper.text()).toContain("Cloudflare Dashboard");
      expect(wrapper.text()).toContain("Account ID");
      expect(wrapper.text()).toContain("API Tokens");
    });

    it("should render Account ID and API Token fields", () => {
      const wrapper = mountComponent();
      const inputs = wrapper.findAll("input");

      expect(inputs.length).toBeGreaterThanOrEqual(2);
      expect(wrapper.text()).toContain("Cloudflare Account ID");
      expect(wrapper.text()).toContain("API Token");
    });

    it("should render verify button when not verified", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("驗證連接");
    });

    it("should render back button", () => {
      const wrapper = mountComponent();
      const buttons = wrapper.findAll("button");
      const backBtn = buttons.find((b) => b.text().includes("返回"));
      expect(backBtn).toBeDefined();
    });

    it("should render help contact link", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("需要協助？");
      expect(wrapper.text()).toContain("聯繫我們安排視訊輔導");
    });
  });

  describe("redirect when no application", () => {
    it("should redirect to /apply if no applicationId", async () => {
      store.applicationId = null;

      mountComponent();
      await flushPromises();

      expect(mockRouterPush).toHaveBeenCalledWith("/apply");
    });
  });

  describe("form validation", () => {
    it("should show error when Account ID is empty", async () => {
      const wrapper = mountComponent();

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("請輸入 Account ID");
    });

    it("should show error when Account ID is not 32 characters", async () => {
      const wrapper = mountComponent();
      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("short-id");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("Account ID 應為 32 位字元");
    });

    it("should show error when API Token is empty", async () => {
      const wrapper = mountComponent();
      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("a".repeat(32));

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("請輸入 API Token");
    });

    it("should show error when API Token is too short", async () => {
      const wrapper = mountComponent();
      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("a".repeat(32));
      await inputs[1].setValue("short-token");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("API Token 格式不正確");
    });
  });

  describe("verification flow", () => {
    it("should call store.verifyCloudflare on valid form submission", async () => {
      const wrapper = mountComponent();
      const verifySpy = vi
        .spyOn(store, "verifyCloudflare")
        .mockResolvedValue(true);

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("a".repeat(32));
      await inputs[1].setValue("b".repeat(40));

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(verifySpy).toHaveBeenCalledWith("a".repeat(32), "b".repeat(40));
    });

    it("should show toast on successful verification", async () => {
      const wrapper = mountComponent();
      vi.spyOn(store, "verifyCloudflare").mockResolvedValue(true);

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("a".repeat(32));
      await inputs[1].setValue("b".repeat(40));

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Cloudflare 帳號驗證成功！",
      );
    });

    it("should show error toast on failed verification", async () => {
      const wrapper = mountComponent();
      vi.spyOn(store, "verifyCloudflare").mockResolvedValue(false);
      store.apiError = "Invalid credentials";

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("a".repeat(32));
      await inputs[1].setValue("b".repeat(40));

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(mockToastError).toHaveBeenCalled();
    });

    it("should disable verify button while verifying", async () => {
      const wrapper = mountComponent();
      store.isVerifyingCf = true;
      await flushPromises();

      const submitBtn = wrapper.find('button[type="submit"]');
      expect(submitBtn.attributes("disabled")).toBeDefined();
    });

    it("should show loading text while verifying", async () => {
      const wrapper = mountComponent();
      store.isVerifyingCf = true;
      await flushPromises();

      expect(wrapper.text()).toContain("驗證中...");
    });
  });

  describe("verified state", () => {
    beforeEach(() => {
      store.cloudflareInfo = {
        accountId: "a".repeat(32),
        apiToken: "b".repeat(40),
        verified: true,
        permissions: {
          workers: true,
          d1: true,
          kv: true,
          r2: true,
          pages: true,
        },
      };
    });

    it("should show success message when verified", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.text()).toContain("Cloudflare 帳號已成功連接！");
    });

    it("should show permission status grid", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.text()).toContain("權限檢查通過");
      expect(wrapper.text()).toContain("Workers");
      expect(wrapper.text()).toContain("D1 Database");
      expect(wrapper.text()).toContain("KV Storage");
      expect(wrapper.text()).toContain("R2 Storage");
      expect(wrapper.text()).toContain("Pages");
    });

    it("should show complete button instead of verify button", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.text()).toContain("完成申請");
      expect(wrapper.text()).not.toContain("驗證連接");
    });

    it("should disable inputs when verified", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      const inputs = wrapper.findAll("input");
      inputs.forEach((input) => {
        expect(input.attributes("disabled")).toBeDefined();
      });
    });
  });

  describe("completion flow", () => {
    beforeEach(() => {
      store.cloudflareInfo = {
        accountId: "a".repeat(32),
        apiToken: "b".repeat(40),
        verified: true,
        permissions: {
          workers: true,
          d1: true,
          kv: true,
          r2: true,
          pages: true,
        },
      };
    });

    it("should call store.completeApplication on complete click", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      const completeSpy = vi
        .spyOn(store, "completeApplication")
        .mockResolvedValue(true);

      const completeBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("完成申請"));
      await completeBtn!.trigger("click");
      await flushPromises();

      expect(completeSpy).toHaveBeenCalled();
    });

    it("should redirect to /success on successful completion", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      vi.spyOn(store, "completeApplication").mockResolvedValue(true);

      const completeBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("完成申請"));
      await completeBtn!.trigger("click");
      await flushPromises();

      expect(mockRouterPush).toHaveBeenCalledWith("/success");
    });

    it("should show error toast on failed completion", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      vi.spyOn(store, "completeApplication").mockResolvedValue(false);
      store.apiError = "Provisioning failed";

      const completeBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("完成申請"));
      await completeBtn!.trigger("click");
      await flushPromises();

      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe("API error display", () => {
    it("should display API error alert when present", async () => {
      const wrapper = mountComponent();
      store.apiError = "Server is unavailable";
      await flushPromises();

      expect(wrapper.text()).toContain("Server is unavailable");
    });
  });
});
