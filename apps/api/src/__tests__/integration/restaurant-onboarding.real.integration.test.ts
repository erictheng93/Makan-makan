import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  marketJoinRequests,
  markets,
  PLAN_QUOTAS,
  restaurantMarketMemberships,
  shopSubscriptions,
} from "@makanmakan/database";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";

const CSRF_TOKEN = "c".repeat(64);
const CSRF_HEADERS = {
  host: "test",
  origin: "https://test",
  "x-csrf-token": CSRF_TOKEN,
  cookie: `csrf_token=${CSRF_TOKEN}`,
};

async function seedMarket(
  testApp: RealIntegrationTestApp,
  overrides: Partial<typeof markets.$inferInsert>,
) {
  const now = new Date();
  const [market] = await testApp.testDb.drizzle
    .insert(markets)
    .values({
      id: `market-${crypto.randomUUID()}`,
      slug: `onboarding-market-${crypto.randomUUID()}`,
      name: "Onboarding Market",
      type: "night_market",
      description: "Restaurant onboarding market fixture",
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

describe("Restaurant onboarding — real integration", () => {
  let testApp: RealIntegrationTestApp;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
  });

  afterAll(async () => {
    await testApp.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("auto-attaches a new coordinate-bearing restaurant to the nearest active market", async () => {
    const nearest = await seedMarket(testApp, {
      name: "Nearest Active Market",
      latitude: 24.1764,
      longitude: 120.6466,
      isActive: true,
    });
    await seedMarket(testApp, {
      name: "Inactive Nearby Market",
      latitude: 24.1765,
      longitude: 120.6467,
      isActive: false,
    });
    await seedMarket(testApp, {
      name: "Far Active Market",
      latitude: 25.033,
      longitude: 121.5654,
      isActive: true,
    });

    const adminToken = await testApp.authHelper.adminToken();
    const createRes = await testApp.app.fetch(
      new Request("https://test/api/v1/restaurants", {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
          ...CSRF_HEADERS,
        },
        body: JSON.stringify({
          name: "Geo Onboarding Vendor",
          type: "street_food",
          category: "snack",
          address: "台中市西屯區文華路100號",
          district: "西屯區",
          city: "台中市",
          phone: "0911222333",
          latitude: 24.17645,
          longitude: 120.64665,
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const createJson: any = await createRes.json();
    const restaurantId = String(createJson.data.id);
    const memberships = await testApp.testDb.drizzle
      .select()
      .from(restaurantMarketMemberships)
      .where(eq(restaurantMarketMemberships.restaurantId, restaurantId))
      .all();

    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      restaurantId,
      marketId: nearest.id,
      isPrimary: true,
    });

    const subscription = await testApp.testDb.drizzle
      .select()
      .from(shopSubscriptions)
      .where(eq(shopSubscriptions.restaurantId, restaurantId))
      .get();
    expect(subscription).toMatchObject({
      restaurantId,
      planTier: "trial",
      isActive: true,
    });
    expect(subscription?.trialEndsAt).toBeInstanceOf(Date);
    expect(PLAN_QUOTAS.trial["orders.created"]?.hard).toBeGreaterThan(0);
    expect(PLAN_QUOTAS.trial["api.requests"]?.hard).toBeGreaterThan(0);
  });

  it("does not attach a coordinate-bearing restaurant to a distant active market", async () => {
    await seedMarket(testApp, {
      name: "Distant Taipei Market",
      latitude: 25.033,
      longitude: 121.5654,
      isActive: true,
    });

    const adminToken = await testApp.authHelper.adminToken();
    const createRes = await testApp.app.fetch(
      new Request("https://test/api/v1/restaurants", {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
          ...CSRF_HEADERS,
        },
        body: JSON.stringify({
          name: "Far Geo Onboarding Vendor",
          type: "street_food",
          category: "snack",
          address: "台中市西屯區文華路200號",
          district: "西屯區",
          city: "台中市",
          phone: "0911222444",
          latitude: 24.17645,
          longitude: 120.64665,
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const createJson: any = await createRes.json();
    const restaurantId = String(createJson.data.id);

    const memberships = await testApp.testDb.drizzle
      .select()
      .from(restaurantMarketMemberships)
      .where(eq(restaurantMarketMemberships.restaurantId, restaurantId))
      .all();
    const joinRequests = await testApp.testDb.drizzle
      .select()
      .from(marketJoinRequests)
      .where(eq(marketJoinRequests.restaurantId, restaurantId))
      .all();

    expect(memberships).toHaveLength(0);
    expect(joinRequests).toHaveLength(0);
  });

  it("does not abort restaurant creation when automatic market membership insert fails", async () => {
    const nearest = await seedMarket(testApp, {
      name: "Nearest Active Market",
      latitude: 24.1764,
      longitude: 120.6466,
      isActive: true,
    });

    await testApp.env.DB.prepare(
      `CREATE TRIGGER fail_auto_membership_insert
       BEFORE INSERT ON restaurant_market_memberships
       BEGIN
         SELECT RAISE(ABORT, 'test membership insert failure');
       END`,
    ).run();

    try {
      const adminToken = await testApp.authHelper.adminToken();
      const createRes = await testApp.app.fetch(
        new Request("https://test/api/v1/restaurants", {
          method: "POST",
          headers: {
            authorization: `Bearer ${adminToken}`,
            "content-type": "application/json",
            ...CSRF_HEADERS,
          },
          body: JSON.stringify({
            name: "Resilient Geo Onboarding Vendor",
            type: "street_food",
            category: "snack",
            address: "台中市西屯區文華路300號",
            district: "西屯區",
            city: "台中市",
            phone: "0911222555",
            latitude: 24.17645,
            longitude: 120.64665,
          }),
        }),
      );

      expect(createRes.status).toBe(201);
      const createJson: any = await createRes.json();
      expect(String(createJson.data.id)).toBeTruthy();

      const memberships = await testApp.testDb.drizzle
        .select()
        .from(restaurantMarketMemberships)
        .where(eq(restaurantMarketMemberships.marketId, nearest.id))
        .all();
      expect(memberships).toHaveLength(0);
    } finally {
      await testApp.env.DB.prepare(
        "DROP TRIGGER IF EXISTS fail_auto_membership_insert",
      ).run();
    }
  });
});
