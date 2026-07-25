import { describe, expect, it, vi, beforeEach } from "vitest";
import { OnboardingService } from "../services/OnboardingService";
import type { ManagementEnv, OnboardingApplication } from "../types";

// Mirrors apps/image-processor/src/middleware/auth.ts UUID_V7_PATTERN. Any
// platform user id that fails this regex gets a 401 from image-processor, so a
// v4 owner id silently breaks menu image upload for the whole tenant.
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const insertedRows: Array<{ table: string; values: Record<string, unknown> }> =
  [];

vi.mock("drizzle-orm/d1", () => ({
  drizzle: () => ({
    insert: (table: { _: { name?: string } } & Record<string, unknown>) => ({
      values: (values: Record<string, unknown>) => {
        insertedRows.push({ table: tableNameOf(table), values });
        return { __statement: true };
      },
    }),
    batch: async () => [],
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [], get: async () => undefined }),
      }),
    }),
  }),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: async () => "hashed" },
}));

function tableNameOf(table: unknown): string {
  const symbols = Object.getOwnPropertySymbols(table as object);
  for (const symbol of symbols) {
    const value = (table as Record<symbol, unknown>)[symbol];
    if (typeof value === "string") return value;
  }
  return "unknown";
}

function buildApplication(
  overrides: Partial<OnboardingApplication> = {},
): OnboardingApplication {
  return {
    id: "APP-20260725-TEST0001",
    businessName: "Demo Noodles",
    contactName: "Lin Mei",
    contactEmail: "mei@example.test",
    contactPhone: "0912345678",
    latitude: 24.147736,
    longitude: 120.673648,
    planId: "trial",
    assignedSubdomain: "demo-noodles",
    status: "submitted",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    ...overrides,
  } as OnboardingApplication;
}

function buildEnv(): ManagementEnv {
  const noRowStatement = {
    bind: () => noRowStatement,
    first: async () => null,
    run: async () => ({ success: true }),
    all: async () => ({ results: [] }),
  };

  return {
    NODE_ENV: "test",
    API_VERSION: "v1",
    API_BASE_URL: "http://localhost",
    ADMIN_APP_URL: "http://localhost:3001",
    CORS_ORIGIN: "http://localhost:5173",
    LOG_LEVEL: "error",
    JWT_SECRET: "test-secret",
    ENCRYPTION_KEY: "a".repeat(32),
    CF_API_TOKEN: "test-token",
    CF_ACCOUNT_ID: "test-account",
    MANAGEMENT_DB: { prepare: () => noRowStatement } as unknown as D1Database,
    PLATFORM_DB: { prepare: () => noRowStatement } as unknown as D1Database,
    CACHE_KV: {} as KVNamespace,
    DEPLOYMENT_STATUS_KV: {} as KVNamespace,
    BUNDLE_STORAGE: {} as R2Bucket,
  } as unknown as ManagementEnv;
}

type OwnerAccountFactory = (
  application: OnboardingApplication,
  tenantId: string,
) => Promise<{
  restaurantId: string;
  userId: string;
  setupPasswordToken: string;
}>;

function createPlatformOwnerAccount(env: ManagementEnv): OwnerAccountFactory {
  const service = new OnboardingService(env) as unknown as {
    createPlatformOwnerAccount: OwnerAccountFactory;
  };

  return service.createPlatformOwnerAccount.bind(service);
}

beforeEach(() => {
  insertedRows.length = 0;
});

describe("onboarding platform owner provisioning", () => {
  it("issues UUID v7 ids that image-processor will accept", async () => {
    const account = await createPlatformOwnerAccount(buildEnv())(
      buildApplication(),
      "tenant-1",
    );

    expect(account.restaurantId).toMatch(UUID_V7_PATTERN);
    expect(account.userId).toMatch(UUID_V7_PATTERN);
  });

  it("persists the same v7 ids onto the platform restaurant and user rows", async () => {
    const account = await createPlatformOwnerAccount(buildEnv())(
      buildApplication(),
      "tenant-1",
    );

    const restaurantRow = insertedRows.find(
      (row) => row.values.id === account.restaurantId,
    );
    const userRow = insertedRows.find(
      (row) => row.values.username !== undefined,
    );

    expect(restaurantRow).toBeDefined();
    expect(userRow).toMatchObject({
      values: expect.objectContaining({
        id: account.userId,
        restaurantId: account.restaurantId,
        role: 1,
      }),
    });
    expect(String(userRow?.values.id)).toMatch(UUID_V7_PATTERN);
  });

  it("keeps the setup-password token on v4 so it stays high-entropy", async () => {
    const account = await createPlatformOwnerAccount(buildEnv())(
      buildApplication(),
      "tenant-1",
    );

    // v7 leaks its creation time and carries 74 random bits vs v4's 122, so a
    // one-time credential link must not be downgraded to v7 alongside the ids.
    expect(account.setupPasswordToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
