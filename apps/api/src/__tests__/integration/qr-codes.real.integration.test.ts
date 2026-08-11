import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { markets } from "@makanmasak/database";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";

async function seedMarket(
  testApp: RealIntegrationTestApp,
  overrides: Partial<typeof markets.$inferInsert> = {},
) {
  const now = new Date();
  const [market] = await testApp.testDb.drizzle
    .insert(markets)
    .values({
      id: `market-${crypto.randomUUID()}`,
      slug: `qr-market-${crypto.randomUUID()}`,
      name: "QR 測試夜市",
      type: "night_market",
      description: "Market QR integration fixture",
      city: "台中市",
      district: "西屯區",
      address: "台中市西屯區文華路",
      latitude: 24.1764,
      longitude: 120.6466,
      openingHours: {
        friday: { open: "17:00", close: "23:30" },
      },
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  return market;
}

describe("QR codes API — real integration", () => {
  let testApp: RealIntegrationTestApp;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
  }, 300000);

  afterAll(async () => {
    if (testApp) await testApp.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("verifies public market QR slugs without authentication", async () => {
    const market = await seedMarket(testApp, {
      slug: "fengjia-night-market",
      name: "逢甲夜市",
    });

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/qr/verify/market/fengjia-night-market"),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({
      valid: true,
      marketId: market.id,
      marketSlug: "fengjia-night-market",
      marketName: "逢甲夜市",
      marketUrl: "/markets/fengjia-night-market",
    });
  });

  it("rejects inactive market QR slugs", async () => {
    await seedMarket(testApp, {
      slug: "inactive-market",
      isActive: false,
    });

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/qr/verify/market/inactive-market"),
    );

    expect(res.status).toBe(404);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("MARKET_QR_INVALID");
  });
});
