import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../packages/database/src/testing/create-test-database";
import {
  restaurants,
  shopSubscriptions,
  usageEvents,
} from "@makanmakan/database";
import type { Env } from "../types/env";
import { enforceQuota } from "./quotaGate";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 120000);

afterAll(async () => {
  await testDb?.dispose();
});

beforeEach(async () => {
  await testDb.truncateAll();
});

describe("enforceQuota", () => {
  it("throws a 429 quota error when staging-style enforcement is enabled and trial usage exceeds the hard limit", async () => {
    const restaurantId = "quota-restaurant";
    await testDb.drizzle.insert(restaurants).values({
      id: restaurantId,
      name: "Quota Test Restaurant",
      type: "street_food",
      category: "snack",
      address: "1 Test Rd",
      district: "West",
      phone: "0900000000",
    });
    await testDb.drizzle.insert(shopSubscriptions).values({
      restaurantId,
      planTier: "trial",
      isActive: true,
      createdAt: new Date("2026-06-01T00:00:00Z"),
      trialEndsAt: new Date("2026-06-15T00:00:00Z"),
    });
    await testDb.drizzle.insert(usageEvents).values({
      restaurantId,
      meterKey: "orders.created",
      quantity: 100,
    });

    const headers = new Headers();
    const waitUntilPromises: Array<Promise<unknown>> = [];
    const context = {
      env: {
        DB: testDb.bindings.DB,
        CACHE_KV: testDb.bindings.CACHE_KV,
        QUOTA_ENFORCEMENT_MODE: "enforce",
      } as Env,
      get: (key: string) =>
        key === "user" ? { role: 1, restaurantId } : undefined,
      header: (key: string, value: string) => headers.set(key, value),
      executionCtx: {
        waitUntil: (promise: Promise<unknown>) => {
          waitUntilPromises.push(promise);
        },
      },
    };

    await expect(
      enforceQuota(context as never, "orders.created"),
    ).rejects.toMatchObject({
      code: "QUOTA_EXCEEDED",
      status: 429,
    });
    await Promise.all(waitUntilPromises);
    expect(headers.get("X-Quota-Warning")).toBe("orders.created 100%");
  });
});
