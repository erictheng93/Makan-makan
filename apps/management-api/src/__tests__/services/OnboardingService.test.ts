import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingService } from "../../services/OnboardingService";
import {
  createMockD1Statement,
  createMockEnv,
  createTestApplicationRow,
  createTestTenantRow,
} from "../setup";
import {
  DEFAULT_BILLING_CYCLE_MS,
  TRIAL_DURATION_MS,
} from "@makanmasak/database";
import type { ManagementEnv } from "../../types";

let env: ManagementEnv;
let service: OnboardingService;

function mockDb() {
  return env.MANAGEMENT_DB as unknown as {
    prepare: ReturnType<typeof vi.fn>;
    batch: ReturnType<typeof vi.fn>;
  };
}

function setupCompleteApplication(planId: string | null) {
  const db = mockDb();
  const application = createTestApplicationRow({
    status: "cf_verified",
    cf_account_id: "a".repeat(32),
    cf_api_token_enc: null,
    plan_id: planId,
  });
  const tenant = createTestTenantRow({
    id: "T-20240101-ABC",
    license_tier:
      planId === "professional" || planId === "enterprise"
        ? planId
        : "standard",
    status: "pending",
  });

  const applicationStmt = createMockD1Statement();
  applicationStmt.first.mockResolvedValue(application);

  const provisioningStatusStmt = createMockD1Statement();
  const tenantInsertStmt = createMockD1Statement();
  const subscriptionInsertStmt = createMockD1Statement();

  const tenantGetStmt = createMockD1Statement();
  tenantGetStmt.first.mockResolvedValue(tenant);

  const tokenStmt = createMockD1Statement();
  tokenStmt.first.mockResolvedValue(null);

  const completeStmt = createMockD1Statement();

  db.prepare.mockImplementation((sql: string) => {
    if (sql.includes("SELECT * FROM onboarding_applications")) {
      return applicationStmt;
    }
    if (sql.includes("UPDATE onboarding_applications SET status")) {
      return provisioningStatusStmt;
    }
    if (sql.includes("INSERT INTO tenants")) {
      return tenantInsertStmt;
    }
    if (sql.includes("INSERT INTO shop_subscriptions")) {
      return subscriptionInsertStmt;
    }
    if (sql.includes("SELECT * FROM tenants WHERE id")) {
      return tenantGetStmt;
    }
    if (sql.includes("SELECT cf_api_token_enc")) {
      return tokenStmt;
    }
    if (sql.includes("SET status = ?, tenant_id = ?")) {
      return completeStmt;
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  db.batch.mockResolvedValue([{ success: true }, { success: true }]);

  return { tenantInsertStmt, subscriptionInsertStmt };
}

describe("OnboardingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    service = new OnboardingService(env);
  });

  describe("completeApplication", () => {
    it.each([
      ["standard", "basic"],
      ["professional", "pro"],
      ["enterprise", "enterprise"],
      [null, "trial"],
    ])(
      "creates tenant and subscription in one batch for planId=%s",
      async (planId, expectedPlanTier) => {
        const before = Date.now();
        const { tenantInsertStmt, subscriptionInsertStmt } =
          setupCompleteApplication(planId);

        const result = await service.completeApplication("APP-20240101-XYZ");

        expect(result.success).toBe(true);
        expect(mockDb().batch).toHaveBeenCalledWith([
          tenantInsertStmt,
          subscriptionInsertStmt,
        ]);

        const tenantArgs = tenantInsertStmt.bind.mock.calls[0];
        const subscriptionArgs = subscriptionInsertStmt.bind.mock.calls[0];

        expect(subscriptionArgs[1]).toBe(tenantArgs[0]);
        expect(subscriptionArgs[2]).toBe(expectedPlanTier);
        expect(subscriptionArgs[3]).toBe("{}");
        expect(subscriptionArgs[4]).toBe("managed");
        expect(subscriptionArgs[5]).toBe(1);

        if (expectedPlanTier === "trial") {
          expect(subscriptionArgs[6]).toBeGreaterThanOrEqual(
            before + TRIAL_DURATION_MS,
          );
          expect(subscriptionArgs[7]).toBeNull();
          expect(subscriptionArgs[8]).toBeNull();
        } else {
          expect(subscriptionArgs[6]).toBeNull();
          expect(subscriptionArgs[7]).toBeGreaterThanOrEqual(before);
          expect(subscriptionArgs[8]).toBe(
            subscriptionArgs[7] + DEFAULT_BILLING_CYCLE_MS,
          );
        }
      },
    );
  });
});
