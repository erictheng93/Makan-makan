/**
 * Tests for Onboarding Store
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useOnboardingStore } from "@/stores/onboarding";
import { ApiError } from "@/services/api";

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

// Get mocked API
import { onboardingApi } from "@/services/api";
const mockApi = vi.mocked(onboardingApi);

describe("useOnboardingStore", () => {
  let store: ReturnType<typeof useOnboardingStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    window.sessionStorage.clear();
    vi.clearAllMocks();
    store = useOnboardingStore();
  });

  describe("initial state", () => {
    it("should have null initial values", () => {
      expect(store.application).toBeNull();
      expect(store.applicationId).toBeNull();
      expect(store.assignedSubdomain).toBeNull();
      expect(store.cloudflareInfo).toBeNull();
      expect(store.completionResult).toBeNull();
    });

    it("should have false loading states", () => {
      expect(store.isLoading).toBe(false);
      expect(store.isCheckingSubdomain).toBe(false);
      expect(store.isVerifyingCf).toBe(false);
      expect(store.isCompleting).toBe(false);
    });

    it("should have null error state", () => {
      expect(store.apiError).toBeNull();
    });

    it("should have null subdomain status", () => {
      expect(store.subdomainStatus).toBeNull();
      expect(store.subdomainSuggestions).toEqual([]);
    });
  });

  describe("computed properties", () => {
    it("canVerifyCloudflare should be falsy without applicationId", () => {
      expect(store.canVerifyCloudflare).toBeFalsy();
    });

    it("canVerifyCloudflare should be true when application is submitted", () => {
      store.applicationId = "app-123";
      store.application = {
        businessName: "Test",
        contactName: "John",
        contactEmail: "john@test.com",
        contactPhone: "123",
        planId: "standard",
        status: "submitted",
      };
      expect(store.canVerifyCloudflare).toBe(true);
    });

    it("canVerifyCloudflare should be false when status is not submitted", () => {
      store.applicationId = "app-123";
      store.application = {
        businessName: "Test",
        contactName: "John",
        contactEmail: "john@test.com",
        contactPhone: "123",
        planId: "standard",
        status: "pending",
      };
      expect(store.canVerifyCloudflare).toBe(false);
    });

    it("canComplete should be falsy without verified cloudflare", () => {
      expect(store.canComplete).toBeFalsy();
    });

    it("canComplete should be true when cloudflare is verified", () => {
      store.applicationId = "app-123";
      store.cloudflareInfo = {
        accountId: "a".repeat(32),
        apiToken: "b".repeat(40),
        verified: true,
      };
      expect(store.canComplete).toBe(true);
    });

    it("isCompleted should be false initially", () => {
      expect(store.isCompleted).toBe(false);
    });

    it("isCompleted should be true when completionResult exists", () => {
      store.completionResult = {
        tenantId: "tenant-123",
        subdomain: "mysite",
      };
      expect(store.isCompleted).toBe(true);
    });
  });

  describe("checkSubdomain", () => {
    it("should return false for empty subdomain", async () => {
      const result = await store.checkSubdomain("");
      expect(result).toBe(false);
      expect(store.subdomainStatus).toBe("invalid");
    });

    it("should return false for subdomain shorter than 3 chars", async () => {
      const result = await store.checkSubdomain("ab");
      expect(result).toBe(false);
      expect(store.subdomainStatus).toBe("invalid");
    });

    it("should return false for invalid characters", async () => {
      const result = await store.checkSubdomain("my_site!");
      expect(result).toBe(false);
      expect(store.subdomainStatus).toBe("invalid");
    });

    it("should return false for uppercase characters", async () => {
      const result = await store.checkSubdomain("MySite");
      expect(result).toBe(false);
      expect(store.subdomainStatus).toBe("invalid");
    });

    it("should call API and return true for available subdomain", async () => {
      mockApi.checkSubdomain.mockResolvedValueOnce({
        subdomain: "myrestaurant",
        available: true,
        suggestions: [],
      });

      const result = await store.checkSubdomain("myrestaurant");

      expect(result).toBe(true);
      expect(store.subdomainStatus).toBe("available");
      expect(store.isCheckingSubdomain).toBe(false);
      expect(mockApi.checkSubdomain).toHaveBeenCalledWith("myrestaurant");
    });

    it("should return false for taken subdomain with suggestions", async () => {
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

    it("should handle API errors gracefully", async () => {
      mockApi.checkSubdomain.mockRejectedValueOnce(
        new ApiError("Server error", "SERVER_ERROR"),
      );

      const result = await store.checkSubdomain("test-sub");

      expect(result).toBe(false);
      expect(store.subdomainStatus).toBeNull();
      expect(store.apiError).toBe("Server error");
    });

    it("should set isCheckingSubdomain during check", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockApi.checkSubdomain.mockReturnValueOnce(promise as never);

      const checkPromise = store.checkSubdomain("mysite");

      // While checking, flag should be true
      expect(store.isCheckingSubdomain).toBe(true);

      resolvePromise!({ subdomain: "mysite", available: true });
      await checkPromise;

      expect(store.isCheckingSubdomain).toBe(false);
    });
  });

  describe("submitApplication", () => {
    const validData = {
      businessName: "Test Restaurant",
      contactName: "John Doe",
      contactEmail: "john@example.com",
      contactPhone: "02-1234-5678",
      planId: "standard" as const,
      subdomain: "testrestaurant",
    };

    it("should submit application successfully", async () => {
      mockApi.createApplication.mockResolvedValueOnce({
        applicationId: "app-123",
        assignedSubdomain: "testrestaurant",
        status: "submitted",
      });

      const result = await store.submitApplication(validData);

      expect(result).toBe(true);
      expect(store.applicationId).toBe("app-123");
      expect(store.assignedSubdomain).toBe("testrestaurant");
      expect(store.application).not.toBeNull();
      expect(store.application!.status).toBe("submitted");
      expect(store.application!.businessName).toBe("Test Restaurant");
    });

    it("should persist data to session storage on success", async () => {
      mockApi.createApplication.mockResolvedValueOnce({
        applicationId: "app-123",
        assignedSubdomain: "testrestaurant",
        status: "submitted",
      });

      await store.submitApplication(validData);

      const stored = window.sessionStorage.getItem("onboarding_application");
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.applicationId).toBe("app-123");
      expect(parsed.assignedSubdomain).toBe("testrestaurant");
    });

    it("should return false and set error on API error", async () => {
      mockApi.createApplication.mockRejectedValueOnce(
        new ApiError("Email already registered", "DUPLICATE_EMAIL"),
      );

      const result = await store.submitApplication(validData);

      expect(result).toBe(false);
      expect(store.apiError).toBe("Email already registered");
    });

    it("should return false with generic message on unknown error", async () => {
      mockApi.createApplication.mockRejectedValueOnce(
        new Error("Random error"),
      );

      const result = await store.submitApplication(validData);

      expect(result).toBe(false);
      expect(store.apiError).toBe("Failed to submit application");
    });

    it("should set isLoading during submission", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockApi.createApplication.mockReturnValueOnce(promise as never);

      const submitPromise = store.submitApplication(validData);
      expect(store.isLoading).toBe(true);

      resolvePromise!({
        applicationId: "app-123",
        assignedSubdomain: "test",
        status: "submitted",
      });
      await submitPromise;

      expect(store.isLoading).toBe(false);
    });

    it("should reset isLoading on error", async () => {
      mockApi.createApplication.mockRejectedValueOnce(new Error("fail"));

      await store.submitApplication(validData);

      expect(store.isLoading).toBe(false);
    });
  });

  describe("verifyCloudflare", () => {
    beforeEach(() => {
      store.applicationId = "app-123";
      store.application = {
        businessName: "Test",
        contactName: "John",
        contactEmail: "john@test.com",
        contactPhone: "123",
        planId: "standard",
        status: "submitted",
      };
    });

    it("should verify Cloudflare credentials successfully", async () => {
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
      expect(store.cloudflareInfo).not.toBeNull();
      expect(store.cloudflareInfo!.verified).toBe(true);
      expect(store.cloudflareInfo!.accountId).toBe(accountId);
      expect(store.cloudflareInfo!.permissions!.workers).toBe(true);
      expect(store.application!.status).toBe("cf_verified");
    });

    it("should return false without applicationId", async () => {
      store.applicationId = null;

      const result = await store.verifyCloudflare("acc", "tok");

      expect(result).toBe(false);
      expect(store.apiError).toBe("No application ID");
    });

    it("should handle verification failure", async () => {
      mockApi.verifyCloudflare.mockRejectedValueOnce(
        new ApiError("Invalid token", "CF_VERIFICATION_FAILED"),
      );

      const result = await store.verifyCloudflare("acc", "tok");

      expect(result).toBe(false);
      expect(store.apiError).toBe("Invalid token");
    });

    it("should handle non-ApiError failures", async () => {
      mockApi.verifyCloudflare.mockRejectedValueOnce(new Error("Unknown"));

      const result = await store.verifyCloudflare("acc", "tok");

      expect(result).toBe(false);
      expect(store.apiError).toBe("Failed to verify Cloudflare credentials");
    });

    it("should set isVerifyingCf during verification", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockApi.verifyCloudflare.mockReturnValueOnce(promise as never);

      const verifyPromise = store.verifyCloudflare("acc", "tok");
      expect(store.isVerifyingCf).toBe(true);

      resolvePromise!({
        verified: true,
        permissions: {
          workers: true,
          d1: true,
          kv: true,
          r2: true,
          pages: true,
        },
      });
      await verifyPromise;

      expect(store.isVerifyingCf).toBe(false);
    });
  });

  describe("completeApplication", () => {
    beforeEach(() => {
      store.applicationId = "app-123";
      store.application = {
        businessName: "Test",
        contactName: "John",
        contactEmail: "john@test.com",
        contactPhone: "123",
        planId: "standard",
        status: "cf_verified",
      };
    });

    it("should complete application successfully", async () => {
      mockApi.completeApplication.mockResolvedValueOnce({
        tenantId: "tenant-abc",
        subdomain: "testrestaurant",
        status: "completed",
      });

      const result = await store.completeApplication();

      expect(result).toBe(true);
      expect(store.completionResult).not.toBeNull();
      expect(store.completionResult!.tenantId).toBe("tenant-abc");
      expect(store.completionResult!.subdomain).toBe("testrestaurant");
      expect(store.application!.status).toBe("completed");
    });

    it("should return false without applicationId", async () => {
      store.applicationId = null;

      const result = await store.completeApplication();

      expect(result).toBe(false);
      expect(store.apiError).toBe("No application ID");
    });

    it("should handle API error", async () => {
      mockApi.completeApplication.mockRejectedValueOnce(
        new ApiError("Provisioning failed", "PROVISIONING_ERROR"),
      );

      const result = await store.completeApplication();

      expect(result).toBe(false);
      expect(store.apiError).toBe("Provisioning failed");
    });

    it("should set isCompleting during completion", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockApi.completeApplication.mockReturnValueOnce(promise as never);

      const completePromise = store.completeApplication();
      expect(store.isCompleting).toBe(true);

      resolvePromise!({
        tenantId: "t-1",
        subdomain: "test",
        status: "completed",
      });
      await completePromise;

      expect(store.isCompleting).toBe(false);
    });
  });

  describe("setApplication", () => {
    it("should set application data and save to session", () => {
      const data = {
        businessName: "My Restaurant",
        contactName: "Jane",
        contactEmail: "jane@test.com",
        contactPhone: "123",
        planId: "professional" as const,
        status: "pending" as const,
      };

      store.setApplication(data);

      expect(store.application).toEqual(data);
      const stored = window.sessionStorage.getItem("onboarding_application");
      expect(stored).not.toBeNull();
    });
  });

  describe("setCloudflareInfo", () => {
    it("should set cloudflare info without persisting", () => {
      const info = {
        accountId: "a".repeat(32),
        apiToken: "b".repeat(40),
        verified: false,
      };

      store.setCloudflareInfo(info);

      expect(store.cloudflareInfo).toEqual(info);
      // Should NOT be in session storage (sensitive info)
      const stored = window.sessionStorage.getItem("onboarding_application");
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.cloudflareInfo).toBeUndefined();
      }
    });
  });

  describe("session persistence", () => {
    it("should load data from session storage", () => {
      const sessionData = {
        application: {
          businessName: "Saved Restaurant",
          contactName: "John",
          contactEmail: "john@test.com",
          contactPhone: "123",
          planId: "standard",
          status: "submitted",
        },
        applicationId: "saved-app-123",
        assignedSubdomain: "saved-sub",
        completionResult: null,
      };

      window.sessionStorage.setItem(
        "onboarding_application",
        JSON.stringify(sessionData),
      );

      // Create new store instance to trigger loadFromSession
      const newStore = useOnboardingStore();
      newStore.loadFromSession();

      expect(newStore.applicationId).toBe("saved-app-123");
      expect(newStore.assignedSubdomain).toBe("saved-sub");
      expect(newStore.application!.businessName).toBe("Saved Restaurant");
    });

    it("should handle corrupted session data gracefully", () => {
      window.sessionStorage.setItem("onboarding_application", "not-json{{{");

      // Should not throw
      const newStore = useOnboardingStore();
      newStore.loadFromSession();

      // Should remain at default values
      expect(newStore.applicationId).toBeNull();
    });

    it("should handle missing session data", () => {
      const newStore = useOnboardingStore();
      newStore.loadFromSession();

      expect(newStore.applicationId).toBeNull();
      expect(newStore.application).toBeNull();
    });
  });

  describe("reset", () => {
    it("should reset all state to defaults", () => {
      // Set up various state
      store.application = {
        businessName: "Test",
        contactName: "John",
        contactEmail: "john@test.com",
        contactPhone: "123",
        planId: "standard",
        status: "completed",
      };
      store.applicationId = "app-123";
      store.assignedSubdomain = "test-sub";
      store.cloudflareInfo = {
        accountId: "acc",
        apiToken: "tok",
        verified: true,
      };
      store.completionResult = { tenantId: "t-1", subdomain: "test" };
      store.apiError = "Some error";
      store.subdomainStatus = "available";
      store.subdomainSuggestions = ["sug-1"];

      store.reset();

      expect(store.application).toBeNull();
      expect(store.applicationId).toBeNull();
      expect(store.assignedSubdomain).toBeNull();
      expect(store.cloudflareInfo).toBeNull();
      expect(store.completionResult).toBeNull();
      expect(store.apiError).toBeNull();
      expect(store.subdomainStatus).toBeNull();
      expect(store.subdomainSuggestions).toEqual([]);
    });

    it("should clear session storage", () => {
      window.sessionStorage.setItem("onboarding_application", "some-data");

      store.reset();

      expect(
        window.sessionStorage.getItem("onboarding_application"),
      ).toBeNull();
    });
  });

  describe("clearError", () => {
    it("should clear the apiError", () => {
      store.apiError = "An error occurred";

      store.clearError();

      expect(store.apiError).toBeNull();
    });
  });
});
