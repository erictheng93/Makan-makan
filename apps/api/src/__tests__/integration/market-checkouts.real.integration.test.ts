import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  marketCheckoutChildOrders,
  marketCheckoutPayments,
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
    const pushDeliveries: Array<{ endpoint: string; payload: any }> = [];
    testApp.env.WEB_PUSH_DELIVERER = async (delivery) => {
      pushDeliveries.push({
        endpoint: delivery.subscription.endpoint,
        payload: delivery.payload,
      });
      return { ok: true, status: 201 };
    };

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
    await Promise.all([
      putRestaurantPushSubscription(String(vendorA.id), "vendor-a"),
      putRestaurantPushSubscription(String(vendorB.id), "vendor-b"),
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
    expect(pushDeliveries).toHaveLength(2);
    expect(pushDeliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpoint: "https://push.example.test/vendor-a",
          payload: expect.objectContaining({
            type: "new_order",
            orderSource: "market_checkout",
            title: "市場結帳新訂單",
            priority: "high",
            requireInteraction: true,
          }),
        }),
        expect.objectContaining({
          endpoint: "https://push.example.test/vendor-b",
          payload: expect.objectContaining({
            type: "new_order",
            orderSource: "market_checkout",
            title: "市場結帳新訂單",
            priority: "high",
            requireInteraction: true,
          }),
        }),
      ]),
    );

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
      parentPayment: {
        status: "paid",
        provider: "line_pay",
        splitMode: "child_transactions",
        amountCents: 20000,
        paidAmountCents: 20000,
        refundedAmountCents: 0,
      },
      settlement: {
        platformFeeRateBps: 350,
        platformFeeCents: 700,
        vendorNetAmountCents: 19300,
      },
    });

    const [parentPayment] = await testApp.testDb.drizzle
      .select()
      .from(marketCheckoutPayments)
      .where(eq(marketCheckoutPayments.checkoutId, checkoutId))
      .all();
    expect(parentPayment).toMatchObject({
      paymentId: `market_pay_${checkoutId}`,
      checkoutId,
      marketId: market.id,
      provider: "line_pay",
      splitMode: "child_transactions",
      idempotencyKey: `market-pay-${checkoutId}`,
      status: "paid",
      amountCents: 20000,
      paidAmountCents: 20000,
      refundedAmountCents: 0,
      currency: "TWD",
      countryCode: "TW",
    });
    expect(parentPayment?.childPaymentIds).toHaveLength(2);
    expect(parentPayment?.providerPayload).toMatchObject({
      source: "market-checkouts",
      splitMode: "child_transactions",
      settlement: {
        platformFeeRateBps: 350,
        platformFeeCents: 700,
        vendorNetAmountCents: 19300,
      },
    });
    expect(parentPayment?.completedAt).toBeInstanceOf(Date);

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

    const refundRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/market-checkouts/${checkoutId}/refund`, {
        method: "POST",
        headers: {
          ...CSRF_HEADERS,
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "integration_refund" }),
      }),
    );
    expect(refundRes.status).toBe(200);

    const refundedParentPayment = await testApp.testDb.drizzle
      .select()
      .from(marketCheckoutPayments)
      .where(eq(marketCheckoutPayments.checkoutId, checkoutId))
      .get();
    expect(refundedParentPayment).toMatchObject({
      paymentId: `market_pay_${checkoutId}`,
      status: "refunded",
      amountCents: 20000,
      paidAmountCents: 20000,
      refundedAmountCents: 20000,
      currency: "TWD",
      countryCode: "TW",
    });
    expect(refundedParentPayment?.refundedAt).toBeInstanceOf(Date);

    const adminDetailRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/market-checkouts/admin/${checkoutId}`, {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    );
    expect(adminDetailRes.status).toBe(200);
    const adminDetailJson: any = await adminDetailRes.json();
    expect(adminDetailJson.data.checkout.payment).toMatchObject({
      status: "refunded",
      refundedAmountCents: 20000,
      parentPayment: {
        status: "refunded",
        refundedAmountCents: 20000,
      },
    });
  });

  async function putRestaurantPushSubscription(
    restaurantId: string,
    suffix: string,
  ) {
    await testApp.env.CACHE_KV.put(
      `push:subscription:${encodeURIComponent(restaurantId)}:user-1:${suffix}`,
      JSON.stringify({
        id: suffix,
        userId: 1,
        username: "kitchen",
        userRole: 2,
        userType: "kitchen",
        restaurantId,
        subscription: {
          endpoint: `https://push.example.test/${suffix}`,
          keys: {
            p256dh: `${suffix}-p256dh`,
            auth: `${suffix}-auth`,
          },
        },
        deviceInfo: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
  }
});
