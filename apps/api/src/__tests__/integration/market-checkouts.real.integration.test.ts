import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  cashMovements,
  cashShifts,
  coupons,
  couponUsage,
  marketCheckoutChildOrders,
  marketCheckoutPayments,
  marketCheckoutSessions,
  markets,
  orders,
  paymentTransactions,
  restaurantMarketMemberships,
} from "@makanmakan/database";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers, type SeedHelpers } from "./helpers/seed-helper";
import { CreditService } from "../../features/credits/services/CreditService";

const CSRF_HEADERS = {
  host: "test",
  origin: "https://test",
  cookie: `csrf_token=${"a".repeat(64)}`,
  "x-csrf-token": "a".repeat(64),
};
const POS_BASE = "https://test/api/v1/pos";

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

async function seedPlatformVoucher(
  testApp: RealIntegrationTestApp,
  code: string,
) {
  const [coupon] = await testApp.testDb.drizzle
    .insert(coupons)
    .values({
      code,
      name: code,
      restaurantId: null,
      discountType: "percentage",
      discountValue: 10,
      minOrderAmount: 0,
      validFrom: "2020-01-01",
      validTo: "2099-12-31",
      isActive: true,
      isVisible: true,
      usedCount: 0,
    })
    .returning({ id: coupons.id });
  return coupon.id;
}

async function issueCreditCard(
  testApp: RealIntegrationTestApp,
  balanceCents: number,
) {
  const card = await new CreditService(testApp.env as never).issueCard({
    currency: "TWD",
    initialBalanceCents: balanceCents,
  });
  return card.publicId;
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

    const adminToken = await testApp.authHelper.adminToken(String(vendorA.id));
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

  it("marks redeemed voucher usage refunded when a paid market checkout is refunded", async () => {
    const market = await seedMarket(testApp);
    const couponId = await seedPlatformVoucher(testApp, "REFUND10");
    const creditCardPublicId = await issueCreditCard(testApp, 50000);
    const vendorA = await seed.restaurant({ name: "退款雞排攤" });
    const vendorB = await seed.restaurant({ name: "退款甜點攤" });
    const [itemA, itemB] = await Promise.all([
      seed.menuItem(vendorA.id, {
        name: "退款雞排",
        price: 120,
        priceCents: 12000,
      }),
      seed.menuItem(vendorB.id, {
        name: "退款地瓜球",
        price: 80,
        priceCents: 8000,
      }),
    ]);

    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      {
        restaurantId: String(vendorA.id),
        marketId: market.id,
        stallNumber: "R01",
        joinedAt: new Date(),
      },
      {
        restaurantId: String(vendorB.id),
        marketId: market.id,
        stallNumber: "R02",
        joinedAt: new Date(),
      },
    ]);

    const createRes = await testApp.app.fetch(
      new Request("https://test/api/v1/market-checkouts", {
        method: "POST",
        headers: { ...CSRF_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({
          marketSlug: market.slug,
          guestName: "Voucher Refund Guest",
          phoneLastDigits: "456",
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

    const applyVoucherRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/market-checkouts/${checkoutId}/voucher`,
        {
          method: "POST",
          headers: { ...CSRF_HEADERS, "content-type": "application/json" },
          body: JSON.stringify({ code: "REFUND10" }),
        },
      ),
    );
    expect(applyVoucherRes.status).toBe(200);

    const payRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/market-checkouts/${checkoutId}/pay`, {
        method: "POST",
        headers: {
          ...CSRF_HEADERS,
          "content-type": "application/json",
          "idempotency-key": `market-voucher-pay-${checkoutId}`,
        },
        body: JSON.stringify({
          method: "credits",
          providerInput: { creditCardPublicId },
        }),
      }),
    );
    expect(payRes.status).toBe(200);

    const activeUsage = await testApp.testDb.drizzle
      .select()
      .from(couponUsage)
      .where(eq(couponUsage.couponId, couponId))
      .all();
    expect(activeUsage).toHaveLength(2);
    expect(activeUsage.every((usage) => usage.status === "active")).toBe(true);

    const adminToken = await testApp.authHelper.adminToken(String(vendorA.id));
    const refundRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/market-checkouts/${checkoutId}/refund`, {
        method: "POST",
        headers: {
          ...CSRF_HEADERS,
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "voucher_refund" }),
      }),
    );
    expect(refundRes.status).toBe(200);

    const refundedUsage = await testApp.testDb.drizzle
      .select()
      .from(couponUsage)
      .where(eq(couponUsage.couponId, couponId))
      .all();
    expect(refundedUsage).toHaveLength(2);
    expect(refundedUsage.every((usage) => usage.status === "refunded")).toBe(
      true,
    );
  });

  it("records market checkout onsite payment through an active POS shift", async () => {
    const market = await seedMarket(testApp);
    const vendorA = await seed.restaurant({ name: "現場收款攤" });
    const vendorB = await seed.restaurant({ name: "配合攤" });
    const [itemA, itemB] = await Promise.all([
      seed.menuItem(vendorA.id, {
        name: "現場雞排",
        price: 120,
        priceCents: 12000,
      }),
      seed.menuItem(vendorB.id, {
        name: "現場甜點",
        price: 80,
        priceCents: 8000,
      }),
    ]);

    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values([
      {
        restaurantId: String(vendorA.id),
        marketId: market.id,
        stallNumber: "P01",
        joinedAt: new Date(),
      },
      {
        restaurantId: String(vendorB.id),
        marketId: market.id,
        stallNumber: "P02",
        joinedAt: new Date(),
      },
    ]);
    await insertSubscription(String(vendorA.id));

    const owner = await seed.user({
      role: 1,
      restaurantId: String(vendorA.id),
    });
    const cashier = await seed.user({
      role: 4,
      restaurantId: String(vendorA.id),
    });
    const ownerToken = await testApp.authHelper.ownerToken(
      owner.id,
      String(vendorA.id),
    );
    const cashierToken = await testApp.authHelper.staffToken(
      cashier.id,
      4,
      String(vendorA.id),
    );
    const registerRes = await testApp.app.fetch(
      new Request(`${POS_BASE}/registers`, {
        method: "POST",
        headers: {
          ...CSRF_HEADERS,
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Market POS Register",
          restaurantId: String(vendorA.id),
        }),
      }),
    );
    expect(registerRes.status).toBe(200);
    const registerJson: any = await registerRes.json();
    const registerId = registerJson.data.id as string;

    const shiftRes = await testApp.app.fetch(
      new Request(`${POS_BASE}/shifts/start`, {
        method: "POST",
        headers: {
          ...CSRF_HEADERS,
          authorization: `Bearer ${cashierToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          registerId,
          operatorId: cashier.id,
          startAmount: 500,
        }),
      }),
    );
    expect(shiftRes.status).toBe(200);
    const shiftJson: any = await shiftRes.json();
    const shiftId = shiftJson.data.id as string;

    const createRes = await testApp.app.fetch(
      new Request("https://test/api/v1/market-checkouts", {
        method: "POST",
        headers: { ...CSRF_HEADERS, "content-type": "application/json" },
        body: JSON.stringify({
          marketSlug: market.slug,
          guestName: "Onsite Guest",
          phoneLastDigits: "456",
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

    const posPayRes = await testApp.app.fetch(
      new Request(`${POS_BASE}/market-checkouts/${checkoutId}/pay`, {
        method: "POST",
        headers: {
          ...CSRF_HEADERS,
          authorization: `Bearer ${cashierToken}`,
          "content-type": "application/json",
          "idempotency-key": `pos-${checkoutId}`,
        },
        body: JSON.stringify({
          registerId,
          shiftId,
          paymentMethod: "cash",
        }),
      }),
    );

    expect(posPayRes.status).toBe(200);
    const posPayJson: any = await posPayRes.json();
    expect(posPayJson.data.payment).toMatchObject({
      status: "paid",
      method: "pos_cash",
      totalAmountCents: 20000,
      paidAmountCents: 20000,
      parentPayment: {
        paymentId: `market_pay_${checkoutId}`,
        provider: "pos_cash",
        idempotencyKey: `pos-${checkoutId}`,
      },
    });

    const paidSession = await testApp.testDb.drizzle
      .select()
      .from(marketCheckoutSessions)
      .where(eq(marketCheckoutSessions.id, checkoutId))
      .get();
    expect(paidSession?.paymentStatus).toBe("paid");
    expect(paidSession?.paymentSummary).toMatchObject({
      status: "paid",
      method: "pos_cash",
      parentPayment: {
        provider: "pos_cash",
      },
    });

    const parentPayment = await testApp.testDb.drizzle
      .select()
      .from(marketCheckoutPayments)
      .where(eq(marketCheckoutPayments.checkoutId, checkoutId))
      .get();
    expect(parentPayment).toMatchObject({
      paymentId: `market_pay_${checkoutId}`,
      provider: "pos_cash",
      status: "paid",
      amountCents: 20000,
      paidAmountCents: 20000,
    });
    expect(parentPayment?.providerPayload).toMatchObject({
      source: "pos_market_checkout",
      registerId,
      shiftId,
      paymentMethod: "cash",
    });

    const childRows = await testApp.testDb.drizzle
      .select()
      .from(marketCheckoutChildOrders)
      .where(eq(marketCheckoutChildOrders.checkoutId, checkoutId))
      .all();
    const childPaymentTransactions = await Promise.all(
      childRows.map((child) =>
        testApp.testDb.drizzle
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.orderId, child.orderId))
          .get(),
      ),
    );
    expect(childPaymentTransactions).toHaveLength(2);
    expect(childPaymentTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paymentMethod: "cash",
          gateway: "pos",
          status: "paid",
        }),
      ]),
    );

    const paidChildOrder = await testApp.testDb.drizzle
      .select()
      .from(orders)
      .where(eq(orders.id, childRows[0].orderId))
      .get();
    expect(paidChildOrder?.paymentStatus).toBe("paid");
    expect(paidChildOrder?.paymentMethod).toBe("cash");

    const updatedShift = await testApp.testDb.drizzle
      .select()
      .from(cashShifts)
      .where(eq(cashShifts.id, shiftId))
      .get();
    expect(updatedShift).toMatchObject({
      totalSalesCents: 20000,
      cashSalesCents: 20000,
      totalTransactions: 1,
    });

    const saleMovement = await testApp.testDb.drizzle
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.shiftId, shiftId))
      .all();
    expect(saleMovement).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "sale",
          amountCents: 20000,
          referenceType: "market_checkout",
          paymentMethod: "cash",
        }),
      ]),
    );
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

  function insertSubscription(restaurantId: string) {
    return testApp.env.DB.prepare(
      `INSERT INTO shop_subscriptions
        (id, restaurant_id, plan_tier, module_overrides, deployment_mode,
         is_active, trial_ends_at_ms, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'trial', ?, 'managed', 1, ?, ?, ?)`,
    )
      .bind(
        `sub-${restaurantId}`,
        restaurantId,
        JSON.stringify({ pos: true }),
        Date.now() + 24 * 60 * 60 * 1000,
        Date.now(),
        Date.now(),
      )
      .run();
  }
});
