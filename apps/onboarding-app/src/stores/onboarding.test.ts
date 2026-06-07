import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useOnboardingStore, type ApplicationData } from "./onboarding";
import { onboardingApi, ApiError } from "@/services/api";

vi.mock("@/services/api", () => {
  class MockApiError extends Error {
    code: string;

    constructor(message: string, code: string) {
      super(message);
      this.name = "ApiError";
      this.code = code;
    }
  }

  return {
    ApiError: MockApiError,
    onboardingApi: {
      checkSubdomain: vi.fn(),
      createApplication: vi.fn(),
      verifyCloudflare: vi.fn(),
      completeApplication: vi.fn(),
    },
  };
});

const applicationData = (): ApplicationData => ({
  businessName: "Demo Noodles",
  contactName: "Lin Mei",
  contactEmail: "mei@example.com",
  contactPhone: "0912345678",
  latitude: 24.147736,
  longitude: 120.673648,
  planId: "professional",
  subdomain: "demo-noodles",
  status: "pending",
});

beforeEach(() => {
  setActivePinia(createPinia());
  sessionStorage.clear();
});

describe("useOnboardingStore", () => {
  it("rejects invalid subdomains locally without calling the API", async () => {
    const store = useOnboardingStore();

    await expect(store.checkSubdomain("ab")).resolves.toBe(false);
    expect(store.subdomainStatus).toBe("invalid");

    await expect(store.checkSubdomain("bad_domain")).resolves.toBe(false);
    expect(store.subdomainStatus).toBe("invalid");
    expect(onboardingApi.checkSubdomain).not.toHaveBeenCalled();
  });

  it("stores subdomain availability and suggestions from the API", async () => {
    vi.mocked(onboardingApi.checkSubdomain).mockResolvedValue({
      subdomain: "demo-noodles",
      available: false,
      suggestions: ["demo-noodles-1", "demo-noodles-tw"],
    });
    const store = useOnboardingStore();

    await expect(store.checkSubdomain("demo-noodles")).resolves.toBe(false);

    expect(store.subdomainStatus).toBe("taken");
    expect(store.subdomainSuggestions).toEqual([
      "demo-noodles-1",
      "demo-noodles-tw",
    ]);
    expect(store.isCheckingSubdomain).toBe(false);
  });

  it("submits applications, updates state, and persists non-sensitive data", async () => {
    vi.mocked(onboardingApi.createApplication).mockResolvedValue({
      applicationId: "app-123",
      assignedSubdomain: "demo-noodles",
      status: "submitted",
    });
    const store = useOnboardingStore();
    const data = applicationData();

    await expect(store.submitApplication(data)).resolves.toBe(true);

    expect(store.applicationId).toBe("app-123");
    expect(store.assignedSubdomain).toBe("demo-noodles");
    expect(store.application).toEqual({ ...data, status: "submitted" });
    expect(store.canVerifyCloudflare).toBe(true);
    expect(
      JSON.parse(sessionStorage.getItem("onboarding_application")!),
    ).toMatchObject({
      applicationId: "app-123",
      assignedSubdomain: "demo-noodles",
      application: { businessName: "Demo Noodles", status: "submitted" },
    });
  });

  it("captures API errors from failed application submission", async () => {
    vi.mocked(onboardingApi.createApplication).mockRejectedValue(
      new ApiError("Subdomain already exists", "SUBDOMAIN_TAKEN"),
    );
    const store = useOnboardingStore();

    await expect(store.submitApplication(applicationData())).resolves.toBe(
      false,
    );

    expect(store.apiError).toBe("Subdomain already exists");
    expect(store.isLoading).toBe(false);
  });

  it("requires an application before Cloudflare verification", async () => {
    const store = useOnboardingStore();

    await expect(
      store.verifyCloudflare("account-123", "token-123"),
    ).resolves.toBe(false);

    expect(store.apiError).toBe("No application ID");
    expect(onboardingApi.verifyCloudflare).not.toHaveBeenCalled();
  });

  it("verifies Cloudflare credentials and never persists the API token", async () => {
    vi.mocked(onboardingApi.createApplication).mockResolvedValue({
      applicationId: "app-123",
      assignedSubdomain: "demo-noodles",
      status: "submitted",
    });
    vi.mocked(onboardingApi.verifyCloudflare).mockResolvedValue({
      verified: true,
      permissions: {
        workers: true,
        d1: true,
        kv: true,
        r2: true,
        pages: false,
      },
    });
    const store = useOnboardingStore();
    await store.submitApplication(applicationData());

    await expect(
      store.verifyCloudflare("account-123", "token-123"),
    ).resolves.toBe(true);

    expect(store.application?.status).toBe("cf_verified");
    expect(store.cloudflareInfo).toEqual({
      accountId: "account-123",
      apiToken: "token-123",
      verified: true,
      permissions: {
        workers: true,
        d1: true,
        kv: true,
        r2: true,
        pages: false,
      },
    });
    expect(sessionStorage.getItem("onboarding_application")).not.toContain(
      "token-123",
    );
  });

  it("completes applications and resets persisted state", async () => {
    vi.mocked(onboardingApi.createApplication).mockResolvedValue({
      applicationId: "app-123",
      assignedSubdomain: "demo-noodles",
      status: "submitted",
    });
    vi.mocked(onboardingApi.completeApplication).mockResolvedValue({
      tenantId: "tenant-123",
      subdomain: "demo-noodles",
      status: "active",
    });
    const store = useOnboardingStore();
    await store.submitApplication(applicationData());

    await expect(store.completeApplication()).resolves.toBe(true);

    expect(store.completionResult).toEqual({
      tenantId: "tenant-123",
      subdomain: "demo-noodles",
    });
    expect(store.application?.status).toBe("completed");
    expect(store.isCompleted).toBe(true);

    store.reset();
    expect(store.application).toBeNull();
    expect(store.completionResult).toBeNull();
    expect(sessionStorage.getItem("onboarding_application")).toBeNull();
  });

  it("loads non-sensitive session state when the store initializes", () => {
    sessionStorage.setItem(
      "onboarding_application",
      JSON.stringify({
        application: { ...applicationData(), status: "submitted" },
        applicationId: "app-123",
        assignedSubdomain: "demo-noodles",
        completionResult: null,
      }),
    );

    const store = useOnboardingStore();

    expect(store.applicationId).toBe("app-123");
    expect(store.application?.businessName).toBe("Demo Noodles");
    expect(store.assignedSubdomain).toBe("demo-noodles");
  });
});
