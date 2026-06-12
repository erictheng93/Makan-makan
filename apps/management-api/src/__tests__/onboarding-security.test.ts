import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../index";
import type { ManagementEnv } from "../types";

const onboardingMocks = vi.hoisted(() => ({
  checkSubdomainAvailability: vi.fn(),
  createApplication: vi.fn(),
  getApplication: vi.fn(),
  verifyApplicationSecret: vi.fn(),
  verifyCloudflareCredentials: vi.fn(),
  completeApplication: vi.fn(),
}));

vi.mock("../services/OnboardingService", () => ({
  OnboardingService: vi.fn(function OnboardingService() {
    return onboardingMocks;
  }),
}));

function createEnv(): ManagementEnv {
  return {
    NODE_ENV: "test",
    API_VERSION: "v1",
    API_BASE_URL: "http://localhost",
    CORS_ORIGIN: "http://localhost:5173",
    LOG_LEVEL: "error",
    JWT_SECRET: "test-secret",
    ENCRYPTION_KEY: "a".repeat(32),
    CF_API_TOKEN: "test-token",
    CF_ACCOUNT_ID: "test-account",
    MANAGEMENT_DB: {} as D1Database,
    CACHE_KV: {} as KVNamespace,
    DEPLOYMENT_STATUS_KV: {} as KVNamespace,
    BUNDLE_STORAGE: {} as R2Bucket,
  };
}

const application = {
  id: "app-123",
  businessName: "Demo Noodles",
  contactName: "Lin Mei",
  contactEmail: "mei@example.test",
  contactPhone: "0912345678",
  latitude: 24.147736,
  longitude: 120.673648,
  planId: "trial",
  assignedSubdomain: "demo-noodles",
  status: "submitted",
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
};

const createApplicationBody = {
  businessName: "Demo Noodles",
  contactName: "Lin Mei",
  contactEmail: "mei@example.test",
  contactPhone: "0912345678",
  latitude: 24.147736,
  longitude: 120.673648,
  planId: "trial",
  subdomain: "demo-noodles",
};

beforeEach(() => {
  vi.clearAllMocks();
  onboardingMocks.checkSubdomainAvailability.mockResolvedValue({
    available: true,
  });
  onboardingMocks.createApplication.mockResolvedValue({
    ...application,
    applicationSecret: "onb_secret_123",
  });
  onboardingMocks.getApplication.mockResolvedValue(application);
  onboardingMocks.verifyApplicationSecret.mockResolvedValue(true);
  onboardingMocks.verifyCloudflareCredentials.mockResolvedValue({
    valid: true,
    permissions: {
      workers: true,
      d1: true,
      kv: true,
      r2: true,
      pages: false,
    },
  });
  onboardingMocks.completeApplication.mockResolvedValue({
    success: true,
    tenantId: "tenant-123",
    subdomain: "demo-noodles",
  });
});

function jsonRequest(path: string, body: unknown, headers = {}) {
  return new Request(`https://management.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("onboarding route authorization", () => {
  it("returns a one-time application secret when creating an application", async () => {
    const response = await app.fetch(
      jsonRequest("/api/v1/onboarding/applications", createApplicationBody),
      createEnv(),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        applicationId: "app-123",
        applicationSecret: "onb_secret_123",
      },
    });
  });

  it("requires the application secret before reading or mutating applications", async () => {
    const readResponse = await app.fetch(
      new Request(
        "https://management.test/api/v1/onboarding/applications/app-123",
      ),
      createEnv(),
    );
    expect(readResponse.status).toBe(401);

    const verifyResponse = await app.fetch(
      jsonRequest("/api/v1/onboarding/applications/app-123/verify-cloudflare", {
        accountId: "a".repeat(32),
        apiToken: "t".repeat(40),
      }),
      createEnv(),
    );
    expect(verifyResponse.status).toBe(401);

    const completeResponse = await app.fetch(
      jsonRequest("/api/v1/onboarding/applications/app-123/complete", {}),
      createEnv(),
    );
    expect(completeResponse.status).toBe(401);
    expect(onboardingMocks.verifyCloudflareCredentials).not.toHaveBeenCalled();
    expect(onboardingMocks.completeApplication).not.toHaveBeenCalled();
  });

  it("accepts the application secret for legitimate onboarding mutations", async () => {
    const response = await app.fetch(
      jsonRequest(
        "/api/v1/onboarding/applications/app-123/verify-cloudflare",
        {
          accountId: "a".repeat(32),
          apiToken: "t".repeat(40),
        },
        { "X-Onboarding-Secret": "onb_secret_123" },
      ),
      createEnv(),
    );

    expect(response.status).toBe(200);
    expect(onboardingMocks.verifyApplicationSecret).toHaveBeenCalledWith(
      "app-123",
      "onb_secret_123",
    );
    expect(onboardingMocks.verifyCloudflareCredentials).toHaveBeenCalled();
  });
});
