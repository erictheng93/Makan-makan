/**
 * Tests for ApplyView
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ApplyView from "@/views/ApplyView.vue";
import { useOnboardingStore } from "@/stores/onboarding";

// Mock the API service (store depends on it)
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

describe("ApplyView", () => {
  let store: ReturnType<typeof useOnboardingStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useOnboardingStore();
    vi.clearAllMocks();
  });

  function mountComponent() {
    return mount(ApplyView, {
      global: {
        stubs: {
          RouterLink: {
            name: "RouterLink",
            props: ["to"],
            template: '<a :href="to"><slot /></a>',
          },
          CheckCircleIcon: { template: "<svg data-testid='check-icon' />" },
          XCircleIcon: { template: "<svg data-testid='x-icon' />" },
          ArrowPathIcon: { template: "<svg data-testid='loading-icon' />" },
        },
      },
    });
  }

  describe("rendering", () => {
    it("should render the form title", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("填寫申請資料");
    });

    it("should render progress indicators showing step 1", () => {
      const wrapper = mountComponent();
      // Step 1 should be active (has bg-primary-600 class)
      const steps = wrapper.findAll(".rounded-full");
      expect(steps.length).toBeGreaterThanOrEqual(3);
    });

    it("should render all form fields", () => {
      const wrapper = mountComponent();
      const inputs = wrapper.findAll("input");

      // businessName, contactName, contactEmail, contactPhone, subdomain
      expect(inputs.length).toBe(5);
    });

    it("should render submit and back buttons", () => {
      const wrapper = mountComponent();
      const buttons = wrapper.findAll("button");

      const backBtn = buttons.find((b) => b.text().includes("返回"));
      const submitBtn = buttons.find((b) => b.text().includes("下一步"));

      expect(backBtn).toBeDefined();
      expect(submitBtn).toBeDefined();
    });

    it("should render subdomain suffix text", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain(".makanmasak.app");
    });
  });

  describe("form validation", () => {
    it("should show error when business name is empty", async () => {
      const wrapper = mountComponent();

      // Submit without filling in anything
      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("請輸入餐廳名稱");
    });

    it("should show error when contact name is empty", async () => {
      const wrapper = mountComponent();

      // Fill only business name
      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("My Restaurant");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("請輸入聯絡人姓名");
    });

    it("should show error when email is empty", async () => {
      const wrapper = mountComponent();

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("My Restaurant");
      await inputs[1].setValue("John Doe");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("請輸入 Email");
    });

    it("should show error for invalid email format", async () => {
      const wrapper = mountComponent();

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("My Restaurant");
      await inputs[1].setValue("John Doe");
      await inputs[2].setValue("not-an-email");
      await inputs[3].setValue("02-1234-5678");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("請輸入有效的 Email");
    });

    it("should show error when phone is empty", async () => {
      const wrapper = mountComponent();

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("My Restaurant");
      await inputs[1].setValue("John Doe");
      await inputs[2].setValue("john@example.com");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("請輸入聯絡電話");
    });

    it("should show error for invalid subdomain characters", async () => {
      const wrapper = mountComponent();

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("My Restaurant");
      await inputs[1].setValue("John Doe");
      await inputs[2].setValue("john@example.com");
      await inputs[3].setValue("02-1234-5678");
      await inputs[4].setValue("INVALID!");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("只能包含小寫字母、數字和連字符");
    });

    it("should show error for short subdomain", async () => {
      const wrapper = mountComponent();

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("My Restaurant");
      await inputs[1].setValue("John Doe");
      await inputs[2].setValue("john@example.com");
      await inputs[3].setValue("02-1234-5678");
      await inputs[4].setValue("ab");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("至少需要 3 個字元");
    });

    it("should pass validation with all fields filled correctly", async () => {
      const wrapper = mountComponent();

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("My Restaurant");
      await inputs[1].setValue("John Doe");
      await inputs[2].setValue("john@example.com");
      await inputs[3].setValue("02-1234-5678");

      // Mock the store's submitApplication
      const submitSpy = vi
        .spyOn(store, "submitApplication")
        .mockResolvedValue(true);

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      // Should not show validation errors
      expect(wrapper.text()).not.toContain("請輸入餐廳名稱");
      expect(wrapper.text()).not.toContain("請輸入聯絡人姓名");
      expect(wrapper.text()).not.toContain("請輸入 Email");
      expect(wrapper.text()).not.toContain("請輸入聯絡電話");

      expect(submitSpy).toHaveBeenCalled();
    });
  });

  describe("form submission", () => {
    async function fillValidForm(wrapper: ReturnType<typeof mount>) {
      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("My Restaurant");
      await inputs[1].setValue("John Doe");
      await inputs[2].setValue("john@example.com");
      await inputs[3].setValue("02-1234-5678");
    }

    it("should call store.submitApplication with form data", async () => {
      const wrapper = mountComponent();
      await fillValidForm(wrapper);

      const submitSpy = vi
        .spyOn(store, "submitApplication")
        .mockResolvedValue(true);

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(submitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          businessName: "My Restaurant",
          contactName: "John Doe",
          contactEmail: "john@example.com",
          contactPhone: "02-1234-5678",
          planId: "standard",
        }),
      );
    });

    it("should include subdomain when provided", async () => {
      const wrapper = mountComponent();
      await fillValidForm(wrapper);

      const inputs = wrapper.findAll("input");
      await inputs[4].setValue("myrestaurant");

      const submitSpy = vi
        .spyOn(store, "submitApplication")
        .mockResolvedValue(true);

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(submitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          subdomain: "myrestaurant",
        }),
      );
    });

    it("should disable submit button while loading", async () => {
      const wrapper = mountComponent();
      store.isLoading = true;
      await flushPromises();

      const submitBtn = wrapper.find('button[type="submit"]');
      expect(submitBtn.attributes("disabled")).toBeDefined();
    });

    it("should disable submit button while checking subdomain", async () => {
      const wrapper = mountComponent();
      store.isCheckingSubdomain = true;
      await flushPromises();

      const submitBtn = wrapper.find('button[type="submit"]');
      expect(submitBtn.attributes("disabled")).toBeDefined();
    });

    it("should show loading text during submission", async () => {
      const wrapper = mountComponent();
      store.isLoading = true;
      await flushPromises();

      expect(wrapper.text()).toContain("提交中...");
    });
  });

  describe("subdomain status display", () => {
    it("should show helper text when subdomain is empty", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("留空將自動生成");
    });

    it("should show available status", async () => {
      const wrapper = mountComponent();
      store.subdomainStatus = "available";
      await flushPromises();

      expect(wrapper.text()).toContain("此網址可以使用");
    });

    it("should show taken status", async () => {
      const wrapper = mountComponent();
      store.subdomainStatus = "taken";
      await flushPromises();

      expect(wrapper.text()).toContain("此網址已被使用");
    });

    it("should show invalid status", async () => {
      const wrapper = mountComponent();
      store.subdomainStatus = "invalid";
      await flushPromises();

      expect(wrapper.text()).toContain("只能包含小寫字母、數字和連字符");
    });

    it("should show subdomain suggestions when taken", async () => {
      const wrapper = mountComponent();
      store.subdomainStatus = "taken";
      store.subdomainSuggestions = ["alt-1", "alt-2"];
      await flushPromises();

      expect(wrapper.text()).toContain("建議的替代網址");
      expect(wrapper.text()).toContain("alt-1.makanmasak.app");
      expect(wrapper.text()).toContain("alt-2.makanmasak.app");
    });

    it("should allow clicking suggestions to fill subdomain", async () => {
      const wrapper = mountComponent();
      store.subdomainStatus = "taken";
      store.subdomainSuggestions = ["alt-1"];
      await flushPromises();

      const suggestionBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("alt-1"));
      expect(suggestionBtn).toBeDefined();

      await suggestionBtn!.trigger("click");
      await flushPromises();

      // The subdomain input should now have the suggestion value
      const subdomainInput = wrapper.findAll("input")[4];
      expect((subdomainInput.element as HTMLInputElement).value).toBe("alt-1");
    });
  });

  describe("API error display", () => {
    it("should show API error when present", async () => {
      const wrapper = mountComponent();
      store.apiError = "Something went wrong on the server";
      await flushPromises();

      expect(wrapper.text()).toContain("Something went wrong on the server");
    });

    it("should hide error when apiError is null", () => {
      const wrapper = mountComponent();
      store.apiError = null;

      const errorAlert = wrapper.find(".bg-red-50");
      expect(errorAlert.exists()).toBe(false);
    });
  });
});
