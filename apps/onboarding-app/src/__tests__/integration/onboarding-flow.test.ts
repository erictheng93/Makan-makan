/**
 * Integration Tests for Onboarding Flow
 *
 * Tests the full onboarding journey: Home -> Apply -> Connect -> Success
 * Uses the real Pinia store with mocked API layer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { useOnboardingStore } from "@/stores/onboarding";
import { ApiError } from "@/services/api";
import ApplyView from "@/views/ApplyView.vue";
import ConnectView from "@/views/ConnectView.vue";
import SuccessView from "@/views/SuccessView.vue";
import HomeView from "@/views/HomeView.vue";

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
    details?: Array<{ path: string[]; message: string }>;
    constructor(
      message: string,
      code: string,
      details?: Array<{ path: string[]; message: string }>,
    ) {
      super(message);
      this.name = "ApiError";
      this.code = code;
      this.details = details;
    }
  },
}));

import { onboardingApi } from "@/services/api";
const mockApi = vi.mocked(onboardingApi);

// Icon stubs to avoid import issues
const iconStubs = {
  CheckCircleIcon: { template: "<svg />" },
  XCircleIcon: { template: "<svg />" },
  ArrowPathIcon: { template: "<svg />" },
  InformationCircleIcon: { template: "<svg />" },
  ClipboardDocumentIcon: { template: "<svg />" },
  ExclamationTriangleIcon: { template: "<svg />" },
  CloudIcon: { template: "<svg />" },
  ShieldCheckIcon: { template: "<svg />" },
  CubeIcon: { template: "<svg />" },
  RocketLaunchIcon: { template: "<svg />" },
  EnvelopeIcon: { template: "<svg />" },
  ClockIcon: { template: "<svg />" },
  DocumentDuplicateIcon: { template: "<svg />" },
};

function mountView(component: any) {
  return mount(component, {
    global: {
      stubs: {
        ...iconStubs,
        RouterLink: {
          name: "RouterLink",
          props: ["to"],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  });
}

describe("Onboarding Flow Integration", () => {
  let store: ReturnType<typeof useOnboardingStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    window.sessionStorage.clear();
    vi.clearAllMocks();
    store = useOnboardingStore();
  });

  describe("Home -> Apply Navigation", () => {
    it("should render Home with apply links that point to /apply", () => {
      const wrapper = mountView(HomeView);

      const applyLinks = wrapper
        .findAll("a")
        .filter((a) => a.attributes("href") === "/apply");
      expect(applyLinks.length).toBeGreaterThanOrEqual(1);
    });

    it("should display feature cards on Home view", () => {
      const wrapper = mountView(HomeView);

      expect(wrapper.text()).toContain("獨立環境");
      expect(wrapper.text()).toContain("安全可靠");
      expect(wrapper.text()).toContain("完整功能");
      expect(wrapper.text()).toContain("快速部署");
    });
  });

  describe("Apply Step - Form Submission", () => {
    it("should show validation errors for empty required fields", async () => {
      const wrapper = mountView(ApplyView);

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("請輸入餐廳名稱");
      expect(wrapper.text()).toContain("請輸入聯絡人姓名");
      expect(wrapper.text()).toContain("請輸入 Email");
      expect(wrapper.text()).toContain("請輸入聯絡電話");
    });

    it("should validate email format", async () => {
      const wrapper = mountView(ApplyView);

      await wrapper.find('input[type="email"]').setValue("invalid-email");
      await wrapper.find('input[type="text"]').setValue("Test Restaurant");
      // Fill other required fields
      const inputs = wrapper.findAll('input[type="text"]');
      if (inputs.length > 1) await inputs[1].setValue("John Doe");
      await wrapper.find('input[type="tel"]').setValue("02-1234-5678");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("請輸入有效的 Email");
    });

    it("should submit form and update store on success", async () => {
      mockApi.createApplication.mockResolvedValueOnce({
        applicationId: "app-integration-123",
        assignedSubdomain: "testrestaurant",
        status: "submitted",
      });

      const wrapper = mountView(ApplyView);

      // Fill in all required fields
      const textInputs = wrapper.findAll('input[type="text"]');
      await textInputs[0].setValue("Integration Restaurant");
      await textInputs[1].setValue("Jane Doe");
      await wrapper.find('input[type="email"]').setValue("jane@example.com");
      await wrapper.find('input[type="tel"]').setValue("02-9876-5432");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(store.applicationId).toBe("app-integration-123");
      expect(store.assignedSubdomain).toBe("testrestaurant");
      expect(store.application?.status).toBe("submitted");
    });

    it("should show API error on submission failure", async () => {
      mockApi.createApplication.mockRejectedValueOnce(
        new ApiError("Email already registered", "DUPLICATE_EMAIL"),
      );

      const wrapper = mountView(ApplyView);

      // Fill in all required fields
      const textInputs = wrapper.findAll('input[type="text"]');
      await textInputs[0].setValue("Test Restaurant");
      await textInputs[1].setValue("John Doe");
      await wrapper.find('input[type="email"]').setValue("taken@example.com");
      await wrapper.find('input[type="tel"]').setValue("02-1234-5678");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(store.apiError).toBe("Email already registered");
    });
  });

  describe("Apply Step - Subdomain Check", () => {
    it("should check subdomain availability and update store", async () => {
      mockApi.checkSubdomain.mockResolvedValueOnce({
        subdomain: "myplace",
        available: true,
        suggestions: [],
      });

      const result = await store.checkSubdomain("myplace");

      expect(result).toBe(true);
      expect(store.subdomainStatus).toBe("available");
    });

    it("should show suggestions for taken subdomain", async () => {
      mockApi.checkSubdomain.mockResolvedValueOnce({
        subdomain: "popular",
        available: false,
        suggestions: ["popular-1", "popular-2"],
      });

      const result = await store.checkSubdomain("popular");

      expect(result).toBe(false);
      expect(store.subdomainStatus).toBe("taken");
      expect(store.subdomainSuggestions).toEqual(["popular-1", "popular-2"]);
    });

    it("should reject invalid subdomain format without API call", async () => {
      const result = await store.checkSubdomain("BAD_NAME!");

      expect(result).toBe(false);
      expect(store.subdomainStatus).toBe("invalid");
      expect(mockApi.checkSubdomain).not.toHaveBeenCalled();
    });

    it("should reject subdomain shorter than 3 characters", async () => {
      const result = await store.checkSubdomain("ab");

      expect(result).toBe(false);
      expect(store.subdomainStatus).toBe("invalid");
      expect(mockApi.checkSubdomain).not.toHaveBeenCalled();
    });
  });

  describe("Connect Step - Cloudflare Verification", () => {
    beforeEach(() => {
      // Simulate having completed the Apply step
      store.applicationId = "app-flow-123";
      store.assignedSubdomain = "testrestaurant";
      store.application = {
        businessName: "Integration Restaurant",
        contactName: "Jane Doe",
        contactEmail: "jane@example.com",
        contactPhone: "02-9876-5432",
        planId: "standard",
        status: "submitted",
      };
    });

    it("should verify Cloudflare credentials and update store", async () => {
      mockApi.verifyCloudflare.mockResolvedValueOnce({
        verified: true,
        permissions: {
          workers: true,
          d1: true,
          kv: true,
          r2: true,
          pages: true,
        },
      });

      const accountId = "a".repeat(32);
      const apiToken = "b".repeat(40);
      const result = await store.verifyCloudflare(accountId, apiToken);

      expect(result).toBe(true);
      expect(store.cloudflareInfo?.verified).toBe(true);
      expect(store.application?.status).toBe("cf_verified");
    });

    it("should handle verification failure with partial permissions", async () => {
      mockApi.verifyCloudflare.mockResolvedValueOnce({
        verified: false,
        permissions: {
          workers: true,
          d1: false,
          kv: true,
          r2: false,
          pages: false,
        },
      });

      const result = await store.verifyCloudflare(
        "a".repeat(32),
        "b".repeat(40),
      );

      expect(result).toBe(false);
      expect(store.cloudflareInfo?.verified).toBe(false);
      expect(store.cloudflareInfo?.permissions?.d1).toBe(false);
    });

    it("should return false without applicationId", async () => {
      store.applicationId = null;

      const result = await store.verifyCloudflare("acc", "tok");

      expect(result).toBe(false);
      expect(store.apiError).toBe("No application ID");
    });

    it("should render ConnectView with application subdomain", () => {
      const wrapper = mountView(ConnectView);

      expect(wrapper.text()).toContain("testrestaurant.makanmakan.app");
    });

    it("should show validation error for short Account ID in ConnectView", async () => {
      const wrapper = mountView(ConnectView);

      const inputs = wrapper.findAll("input");
      // Account ID input
      await inputs[0].setValue("short");
      // API Token input
      await inputs[1].setValue("b".repeat(40));

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("Account ID 應為 32 位字元");
    });

    it("should show validation error for short API Token in ConnectView", async () => {
      const wrapper = mountView(ConnectView);

      const inputs = wrapper.findAll("input");
      await inputs[0].setValue("a".repeat(32));
      await inputs[1].setValue("short");

      await wrapper.find("form").trigger("submit.prevent");
      await flushPromises();

      expect(wrapper.text()).toContain("API Token 格式不正確");
    });
  });

  describe("Connect Step - Complete Application", () => {
    beforeEach(() => {
      store.applicationId = "app-complete-123";
      store.assignedSubdomain = "myrestaurant";
      store.application = {
        businessName: "My Restaurant",
        contactName: "Owner",
        contactEmail: "owner@example.com",
        contactPhone: "02-1111-2222",
        planId: "professional",
        status: "cf_verified",
      };
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

    it("should complete application and update store", async () => {
      mockApi.completeApplication.mockResolvedValueOnce({
        tenantId: "tenant-xyz",
        subdomain: "myrestaurant",
        status: "completed",
      });

      const result = await store.completeApplication();

      expect(result).toBe(true);
      expect(store.completionResult?.tenantId).toBe("tenant-xyz");
      expect(store.completionResult?.subdomain).toBe("myrestaurant");
      expect(store.application?.status).toBe("completed");
      expect(store.isCompleted).toBe(true);
    });

    it("should handle completion failure", async () => {
      mockApi.completeApplication.mockRejectedValueOnce(
        new ApiError("Provisioning failed", "PROVISIONING_ERROR"),
      );

      const result = await store.completeApplication();

      expect(result).toBe(false);
      expect(store.apiError).toBe("Provisioning failed");
      expect(store.isCompleted).toBe(false);
    });
  });

  describe("Success Step - Display", () => {
    beforeEach(() => {
      store.applicationId = "app-success-123";
      store.assignedSubdomain = "myrestaurant";
      store.application = {
        businessName: "Success Restaurant",
        contactName: "Happy Owner",
        contactEmail: "happy@example.com",
        contactPhone: "02-3333-4444",
        planId: "standard",
        status: "completed",
      };
      store.completionResult = {
        tenantId: "tenant-success",
        subdomain: "myrestaurant",
      };
    });

    it("should render success page with application summary", () => {
      const wrapper = mountView(SuccessView);

      expect(wrapper.text()).toContain("申請已完成");
      expect(wrapper.text()).toContain("Success Restaurant");
      expect(wrapper.text()).toContain("happy@example.com");
      expect(wrapper.text()).toContain("tenant-success");
      expect(wrapper.text()).toContain("myrestaurant.makanmakan.app");
    });

    it("should display the plan label correctly", () => {
      const wrapper = mountView(SuccessView);

      expect(wrapper.text()).toContain("標準版");
    });

    it("should display professional plan label", () => {
      store.application!.planId = "professional";
      const wrapper = mountView(SuccessView);

      expect(wrapper.text()).toContain("專業版");
    });

    it("should show link to admin panel", () => {
      const wrapper = mountView(SuccessView);

      const adminLink = wrapper.find(
        'a[href="https://myrestaurant.makanmakan.app/admin"]',
      );
      expect(adminLink.exists()).toBe(true);
    });
  });

  describe("Form State Persistence", () => {
    it("should persist application data to sessionStorage after submission", async () => {
      mockApi.createApplication.mockResolvedValueOnce({
        applicationId: "app-persist-123",
        assignedSubdomain: "persisted",
        status: "submitted",
      });

      await store.submitApplication({
        businessName: "Persisted Restaurant",
        contactName: "Persist Man",
        contactEmail: "persist@example.com",
        contactPhone: "02-5555-6666",
        planId: "standard",
        subdomain: "persisted",
      });

      const stored = window.sessionStorage.getItem("onboarding_application");
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.applicationId).toBe("app-persist-123");
      expect(parsed.application.businessName).toBe("Persisted Restaurant");
    });

    it("should restore state from sessionStorage in new store instance", async () => {
      // Set up session data as if Apply step was completed
      const sessionData = {
        application: {
          businessName: "Resumed Restaurant",
          contactName: "Resume Owner",
          contactEmail: "resume@example.com",
          contactPhone: "02-7777-8888",
          planId: "standard",
          status: "submitted",
        },
        applicationId: "app-resume-123",
        assignedSubdomain: "resumed",
        completionResult: null,
      };
      window.sessionStorage.setItem(
        "onboarding_application",
        JSON.stringify(sessionData),
      );

      // Create a fresh store that loads from session
      const resumedStore = useOnboardingStore();
      resumedStore.loadFromSession();

      expect(resumedStore.applicationId).toBe("app-resume-123");
      expect(resumedStore.assignedSubdomain).toBe("resumed");
      expect(resumedStore.application?.businessName).toBe("Resumed Restaurant");
      expect(resumedStore.application?.status).toBe("submitted");
    });

    it("should not persist cloudflare info to sessionStorage", () => {
      store.setCloudflareInfo({
        accountId: "secret-acc",
        apiToken: "secret-tok",
        verified: false,
      });

      const stored = window.sessionStorage.getItem("onboarding_application");
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.cloudflareInfo).toBeUndefined();
      }
    });
  });

  describe("Error Recovery", () => {
    it("should clear error and allow retry after API failure", async () => {
      // First attempt fails
      mockApi.createApplication.mockRejectedValueOnce(
        new ApiError("Server busy", "SERVER_ERROR"),
      );

      const firstResult = await store.submitApplication({
        businessName: "Retry Restaurant",
        contactName: "Retry Person",
        contactEmail: "retry@example.com",
        contactPhone: "02-1111-1111",
        planId: "standard",
      });

      expect(firstResult).toBe(false);
      expect(store.apiError).toBe("Server busy");

      // Clear error
      store.clearError();
      expect(store.apiError).toBeNull();

      // Second attempt succeeds
      mockApi.createApplication.mockResolvedValueOnce({
        applicationId: "app-retry-123",
        assignedSubdomain: "retried",
        status: "submitted",
      });

      const secondResult = await store.submitApplication({
        businessName: "Retry Restaurant",
        contactName: "Retry Person",
        contactEmail: "retry@example.com",
        contactPhone: "02-1111-1111",
        planId: "standard",
      });

      expect(secondResult).toBe(true);
      expect(store.applicationId).toBe("app-retry-123");
    });

    it("should allow retrying Cloudflare verification after failure", async () => {
      store.applicationId = "app-cf-retry";
      store.application = {
        businessName: "CF Retry",
        contactName: "Test",
        contactEmail: "test@test.com",
        contactPhone: "123",
        planId: "standard",
        status: "submitted",
      };

      // First attempt fails
      mockApi.verifyCloudflare.mockRejectedValueOnce(
        new ApiError("Invalid token", "CF_VERIFICATION_FAILED"),
      );
      await store.verifyCloudflare(
        "a".repeat(32),
        "bad-token-" + "x".repeat(30),
      );
      expect(store.apiError).toBe("Invalid token");

      // Second attempt succeeds
      mockApi.verifyCloudflare.mockResolvedValueOnce({
        verified: true,
        permissions: {
          workers: true,
          d1: true,
          kv: true,
          r2: true,
          pages: true,
        },
      });

      store.clearError();
      const result = await store.verifyCloudflare(
        "a".repeat(32),
        "b".repeat(40),
      );

      expect(result).toBe(true);
      expect(store.cloudflareInfo?.verified).toBe(true);
    });
  });

  describe("Full End-to-End Flow", () => {
    it("should complete entire onboarding: apply -> verify -> complete", async () => {
      // Step 1: Submit application
      mockApi.createApplication.mockResolvedValueOnce({
        applicationId: "app-e2e-123",
        assignedSubdomain: "e2e-restaurant",
        status: "submitted",
      });

      const submitResult = await store.submitApplication({
        businessName: "E2E Restaurant",
        contactName: "E2E Owner",
        contactEmail: "e2e@example.com",
        contactPhone: "02-1234-5678",
        planId: "professional",
        subdomain: "e2e-restaurant",
      });

      expect(submitResult).toBe(true);
      expect(store.applicationId).toBe("app-e2e-123");
      expect(store.canVerifyCloudflare).toBe(true);

      // Step 2: Verify Cloudflare
      mockApi.verifyCloudflare.mockResolvedValueOnce({
        verified: true,
        permissions: {
          workers: true,
          d1: true,
          kv: true,
          r2: true,
          pages: true,
        },
      });

      const verifyResult = await store.verifyCloudflare(
        "a".repeat(32),
        "b".repeat(40),
      );

      expect(verifyResult).toBe(true);
      expect(store.application?.status).toBe("cf_verified");
      expect(store.canComplete).toBe(true);

      // Step 3: Complete application
      mockApi.completeApplication.mockResolvedValueOnce({
        tenantId: "tenant-e2e",
        subdomain: "e2e-restaurant",
        status: "completed",
      });

      const completeResult = await store.completeApplication();

      expect(completeResult).toBe(true);
      expect(store.isCompleted).toBe(true);
      expect(store.completionResult?.tenantId).toBe("tenant-e2e");
      expect(store.application?.status).toBe("completed");
    });
  });

  describe("Reset and Start New", () => {
    it("should reset all state and clear session after completion", async () => {
      // Set up completed state
      store.applicationId = "app-reset-123";
      store.assignedSubdomain = "reset-sub";
      store.application = {
        businessName: "Reset Test",
        contactName: "Test",
        contactEmail: "test@test.com",
        contactPhone: "123",
        planId: "standard",
        status: "completed",
      };
      store.completionResult = {
        tenantId: "tenant-reset",
        subdomain: "reset-sub",
      };
      store.cloudflareInfo = {
        accountId: "acc",
        apiToken: "tok",
        verified: true,
      };

      // Save to session first
      window.sessionStorage.setItem("onboarding_application", "some-data");

      // Reset
      store.reset();

      expect(store.application).toBeNull();
      expect(store.applicationId).toBeNull();
      expect(store.assignedSubdomain).toBeNull();
      expect(store.cloudflareInfo).toBeNull();
      expect(store.completionResult).toBeNull();
      expect(store.isCompleted).toBe(false);
      expect(
        window.sessionStorage.getItem("onboarding_application"),
      ).toBeNull();
    });
  });

  describe("Computed Guards", () => {
    it("canVerifyCloudflare should be false before application submission", () => {
      expect(store.canVerifyCloudflare).toBeFalsy();
    });

    it("canVerifyCloudflare should be true only when status is submitted", () => {
      store.applicationId = "app-guard";
      store.application = {
        businessName: "Guard",
        contactName: "G",
        contactEmail: "g@g.com",
        contactPhone: "1",
        planId: "standard",
        status: "submitted",
      };
      expect(store.canVerifyCloudflare).toBe(true);

      store.application.status = "pending";
      expect(store.canVerifyCloudflare).toBe(false);

      store.application.status = "cf_verified";
      expect(store.canVerifyCloudflare).toBe(false);
    });

    it("canComplete should be false without verified cloudflare", () => {
      store.applicationId = "app-guard-2";
      store.cloudflareInfo = null;
      expect(store.canComplete).toBeFalsy();

      store.cloudflareInfo = {
        accountId: "acc",
        apiToken: "tok",
        verified: false,
      };
      expect(store.canComplete).toBeFalsy();

      store.cloudflareInfo.verified = true;
      expect(store.canComplete).toBe(true);
    });
  });

  describe("Loading State Transitions", () => {
    it("isLoading should be true during submitApplication", async () => {
      let resolveApi: (value: any) => void;
      mockApi.createApplication.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveApi = resolve;
        }),
      );

      const promise = store.submitApplication({
        businessName: "Loading Test",
        contactName: "Test",
        contactEmail: "test@test.com",
        contactPhone: "123",
        planId: "standard",
      });

      expect(store.isLoading).toBe(true);

      resolveApi!({
        applicationId: "app-load",
        assignedSubdomain: "load",
        status: "submitted",
      });
      await promise;

      expect(store.isLoading).toBe(false);
    });

    it("isVerifyingCf should be true during verifyCloudflare", async () => {
      store.applicationId = "app-vf";
      store.application = {
        businessName: "VF",
        contactName: "V",
        contactEmail: "v@v.com",
        contactPhone: "1",
        planId: "standard",
        status: "submitted",
      };

      let resolveApi: (value: any) => void;
      mockApi.verifyCloudflare.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveApi = resolve;
        }),
      );

      const promise = store.verifyCloudflare("a".repeat(32), "b".repeat(40));

      expect(store.isVerifyingCf).toBe(true);

      resolveApi!({
        verified: true,
        permissions: {
          workers: true,
          d1: true,
          kv: true,
          r2: true,
          pages: true,
        },
      });
      await promise;

      expect(store.isVerifyingCf).toBe(false);
    });

    it("isCompleting should be true during completeApplication", async () => {
      store.applicationId = "app-comp";

      let resolveApi: (value: any) => void;
      mockApi.completeApplication.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveApi = resolve;
        }),
      );

      const promise = store.completeApplication();

      expect(store.isCompleting).toBe(true);

      resolveApi!({
        tenantId: "t-1",
        subdomain: "comp",
        status: "completed",
      });
      await promise;

      expect(store.isCompleting).toBe(false);
    });
  });
});
