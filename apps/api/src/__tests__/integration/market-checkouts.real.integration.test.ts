import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  marketCheckoutChildOrders,
  marketCheckoutSessions,
  markets,
  orders,
  restaurantMarketMemberships,
} from "@makanmakan/database";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers, type SeedHelpers } from "./helpers/seed-helper";

const CSRF_HEADERS = {
  host: "test",
  origin: "https://test",
  cookie: `csrf_token=${"a".repeat(64)}`,
  "x-csrf-token": "a".repeat(64),
};

async function seedMarket(testApp: RealIntegrationTestApp) {
  const now = new Date();
  const [market] = await testApp.testDb.drizzle
    .insert(markets)
    .values({
      id: `market-${crypto.randomUUID()}`,
      slug: `checkout-market-${crypto.randomUUID()}`,
      name: "持久化測試夜市",
      type: "night_market",
      description: "Market checkout persistence fixture",
      city: "台中市",
      district: "西屯區",
      address: "台中市西屯區文華路",
      latitude: 24.1764,
      longitude: 120.6466,
      openingHours: {
        friday: { open: "17:00", close: "23:30" },
      },
      platformFeeRateBps: 350,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return market;
}

describe("Market checkouts API - real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: SeedHelpers;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  }, 300000);

  afterAll(async () => {
    if (testApp) await testApp.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("persists checkout sessions, survives KV expiry, and updates payment status", async () => {
    const market = await seedMarket(testApp);
    expect(market.platformFeeRateBps).toBe(350);
    const vendorA = await seed.restaurant({ name: "雞排攤" });
    const vendorB = await seed.restaurant({ name: "甜點攤" });
    const [itemA, itemB] = await Promise.all([
      seed.menuItem(vendorA.id, {
        name: "雞排",
        price: 120,
        priceCents: 12000,
      }),
      seed.menuItem(vendorB.id, {
        name: "地瓜球",
        price: 80,
        priceCents: 8000,
      }),
    ]);

    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      {
        restaurantId: String(vendorA.id),
        marketId: market.id,
        stallNumber: "A01",
        joinedAt: new Date(),
      },
      {
        restaurantId: String(vendorB.id),
        marketId: market.id,
        stallNumber: "B02",
        joinedAt: new Date(),
      },
    ]);

    const createRes = await testApp.app.fetch(
      new Request("https://test/api/v1/market-checkouts", {
        method: "POST",
        headers: { ...CSRF_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({
          marketSlug: market.slug,
          guestName: "Market Guest",
          phoneLastDigits: "789",
          vendors: [
            {
              restaurantId: String(vendorA.id),
              items: [{ menuItemId: itemA.id, quantity: 1 }],
            },
            {
              restaurantId: String(vendorB.id),
              items: [{ menuItemId: itemB.id, quantity: 1 }],
            },
          ],
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const createJson: any = await createRes.json();
    const checkoutId = createJson.data.checkout.id as string;
    expect(createJson.data.checkout.childOrders).toHaveLength(2);
    expect(createJson.data.checkout.market.platformFeeRateBps).toBe(350);

    const persistedSession = await testApp.testDb.drizzle
      .select()
      .from(marketCheckoutSessions)
      .where(eq(marketCheckoutSessions.id, checkoutId))
      .get();
    expect(persistedSession).toMatchObject({
      id: checkoutId,
      marketId: market.id,
      marketSlug: market.slug,
      marketName: "持久化測試夜市",
      platformFeeRateBps: 350,
      paymentStatus: "pending",
      subtotalCents: 20000,
      childOrderCount: 2,
    });

    const persistedChildren = await testApp.testDb.drizzle
      .select()
      .from(marketCheckoutChildOrders)
      .where(eq(marketCheckoutChildOrders.checkoutId, checkoutId))
      .all();
    expect(persistedChildren).toHaveLength(2);
    expect(
      persistedChildren
        .map((child) => child.totalAmountCents)
        .sort((a, b) => a - b),
    ).toEqual([8000, 12000]);

    const childOrderIds = persistedChildren.map((child) => child.orderId);
    const [childOrder] = await testApp.testDb.drizzle
      .select()
      .from(orders)
      .where(eq(orders.id, childOrderIds[0]))
      .all();
    expect(childOrder?.orderSource).toBe("market_checkout");

    await testApp.env.CACHE_KV.delete(`market_checkout:${checkoutId}`);
    await testApp.env.CACHE_KV.delete("market_checkout:index");

    const publicRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/market-checkouts/${checkoutId}`),
    );
    expect(publicRes.status).toBe(200);
    const publicJson: any = await publicRes.json();
    expect(publicJson.data.checkout).toMatchObject({
      id: checkoutId,
      market: { slug: market.slug, platformFeeRateBps: 350 },
      subtotal: 20000,
    });
    expect(publicJson.data.checkout.childOrders).toHaveLength(2);

    const payRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/market-checkouts/${checkoutId}/pay`, {
        method: "POST",
        headers: {
          ...CSRF_HEADERS,
          "content-type": "application/json",
          "idempotency-key": `market-pay-${checkoutId}`,
        },
        body: JSON.stringify({ method: "line_pay" }),
      }),
    );
    expect(payRes.status).toBe(200);

    const paidSession = await testApp.testDb.drizzle
      .select()
      .from(marketCheckoutSessions)
      .where(eq(marketCheckoutSessions.id, checkoutId))
      .get();
    expect(paidSession?.paymentStatus).toBe("paid");
    expect(paidSession?.paymentSummary).toMatchObject({
      status: "paid",
      totalAmount: 200,
      paidAmount: 200,
      settlement: {
        platformFeeRateBps: 350,
        platformFeeCents: 700,
        vendorNetAmountCents: 19300,
      },
    });

    const admin = await seed.user({ role: 0 });
    const adminToken = await testApp.authHelper.adminToken(
      String(vendorA.id),
      admin.id,
    );
    const adminRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/market-checkouts/admin?paymentStatus=paid`,
        {
          headers: { authorization: `Bearer ${adminToken}` },
        },
      ),
    );
    expect(adminRes.status).toBe(200);
    const adminJson: any = await adminRes.json();
    expect(adminJson.data.checkouts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: checkoutId,
          paymentStatus: "paid",
          childOrderCount: 2,
        }),
      ]),
    );
  });
});
