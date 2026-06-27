import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

const ORDERS_ENDPOINT = "https://test/api/v1/orders";
const CUSTOMER_ORDERS_ENDPOINT = "https://test/api/v1/customers/me/orders";
const CUSTOMER_AUTH_BASE = "https://test/api/v1/customer/auth";

function csrfHeaders(token: string) {
  return {
    host: "test",
    origin: "https://test",
    "x-csrf-token": token,
    cookie: `csrf_token=${token}`,
  };
}

describe("Role gap coverage: customer order flow with CSRF and idempotency", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    if (testApp) {
      await testApp.dispose();
    }
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  async function insertActiveSubscription(restaurantId: string) {
    await testApp.env.DB.prepare(
      `INSERT INTO shop_subscriptions
        (id, restaurant_id, plan_tier, module_overrides, deployment_mode,
         is_active, trial_ends_at_ms, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'trial', '{}', 'managed', 1, ?, ?, ?)`,
    )
      .bind(
        `sub-${restaurantId}`,
        restaurantId,
        Date.now() + 24 * 60 * 60 * 1000,
        Date.now(),
        Date.now(),
      )
      .run();
  }

  function buildOrderPayload(restaurantId: string, menuItemId: number) {
    return {
      restaurantId,
      customerPhone: "0912345678",
      items: [{ menuItemId, quantity: 1 }],
    };
  }

  async function loginCustomerSession(phone: string): Promise<{
    accessToken: string;
    customer: { id: string };
  }> {
    const requestOtpRes = await testApp.app.fetch(
      new Request(`${CUSTOMER_AUTH_BASE}/request-otp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ phone }),
      }),
    );
    const requestOtpJson: any = await requestOtpRes.json();

    const verifyRes = await testApp.app.fetch(
      new Request(`${CUSTOMER_AUTH_BASE}/verify-otp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          phone,
          otp: requestOtpJson.data.devOtp,
        }),
      }),
    );
    const verifyJson: any = await verifyRes.json();

    return {
      accessToken: verifyJson.data.accessToken,
      customer: { id: verifyJson.data.customer.id },
    };
  }

  it("returns 403 for POST /api/v1/orders when CSRF header is missing", async () => {
    const restaurant = await seed.restaurant();
    await insertActiveSubscription(String(restaurant.id));

    const customer = await seed.user({
      username: "customer-04-no-csrf",
      role: 5,
      restaurantId: String(restaurant.id),
    });
    const customerToken = await testApp.authHelper.staffToken(
      customer.id,
      5,
      String(restaurant.id),
    );

    const menuItem = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      price: 100,
    });

    const payload = buildOrderPayload(String(restaurant.id), menuItem.id);

    const res = await testApp.app.fetch(
      new Request(ORDERS_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${customerToken}`,
          "content-type": "application/json",
          host: "test",
          origin: "https://test",
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(res.status).toBe(403);
    const json: any = await res.json();
    expect(json.success).toBe(false);
  });

  it("allows role 5 legacy user token to create an order with valid CSRF token", async () => {
    const restaurant = await seed.restaurant();
    await insertActiveSubscription(String(restaurant.id));

    const customer = await seed.user({
      username: "customer-04-order",
      role: 5,
      restaurantId: String(restaurant.id),
    });
    const customerToken = await testApp.authHelper.staffToken(
      customer.id,
      5,
      String(restaurant.id),
    );

    const menuItem = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      price: 120,
    });
    const payload = buildOrderPayload(String(restaurant.id), menuItem.id);

    const csrfToken = "a".repeat(64);
    const createRes = await testApp.app.fetch(
      new Request(ORDERS_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${customerToken}`,
          "content-type": "application/json",
          ...csrfHeaders(csrfToken),
        },
        body: JSON.stringify(payload),
      }),
    );

    expect(createRes.status).toBe(201);
    const createJson: any = await createRes.json();
    expect(createJson.success).toBe(true);
    expect(String(createJson.data.id)).toBeTruthy();
  });

  it("does not dedupe repeated POST for identical payload + token when no idempotency key binding exists", async () => {
    const restaurant = await seed.restaurant();
    await insertActiveSubscription(String(restaurant.id));

    const customer = await seed.user({
      username: "customer-04-replay",
      role: 5,
      restaurantId: String(restaurant.id),
    });
    const customerToken = await testApp.authHelper.staffToken(
      customer.id,
      5,
      String(restaurant.id),
    );

    const menuItem = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      price: 120,
    });
    const payload = buildOrderPayload(String(restaurant.id), menuItem.id);
    const headers = {
      authorization: `Bearer ${customerToken}`,
      "content-type": "application/json",
      ...csrfHeaders("b".repeat(64)),
      "x-idempotency-key": "idem-key-fixed-2026",
    };

    const firstRes = await testApp.app.fetch(
      new Request(ORDERS_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
    );
    expect(firstRes.status).toBe(201);
    const firstJson: any = await firstRes.json();

    const secondRes = await testApp.app.fetch(
      new Request(ORDERS_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
    );
    expect(secondRes.status).toBe(201);
    const secondJson: any = await secondRes.json();

    expect(secondJson.success).toBe(true);
    expect(secondJson.data.id).not.toBe(firstJson.data.id);
    expect(secondJson.data.orderNumber).not.toBe(firstJson.data.orderNumber);
  });

  it("returns 401 for /customers/me/orders with non-canonical staff role token", async () => {
    const restaurant = await seed.restaurant();
    await insertActiveSubscription(String(restaurant.id));
    const staffCustomer = await seed.user({
      username: "customer-04-role5",
      role: 5,
      restaurantId: String(restaurant.id),
    });
    const staffToken = await testApp.authHelper.staffToken(
      staffCustomer.id,
      5,
      String(restaurant.id),
    );

    const listRes = await testApp.app.fetch(
      new Request(CUSTOMER_ORDERS_ENDPOINT, {
        headers: { authorization: `Bearer ${staffToken}` },
      }),
    );

    expect(listRes.status).toBe(401);
    const listJson: any = await listRes.json();
    expect(listJson.success).toBe(false);
  });

  it("binds /customers/me/orders to canonical customer token and scopes by customer id", async () => {
    const restaurant = await seed.restaurant();
    const { accessToken: tokenA, customer: customerA } =
      await loginCustomerSession("+886911000001");
    const { accessToken: tokenB, customer: customerB } =
      await loginCustomerSession("+886922000002");

    await seed.order(restaurant.id, { customerId: customerA.id });
    await seed.order(restaurant.id, { customerId: customerB.id });

    const listARes = await testApp.app.fetch(
      new Request(CUSTOMER_ORDERS_ENDPOINT, {
        headers: { authorization: `Bearer ${tokenA}` },
      }),
    );
    expect(listARes.status).toBe(200);
    const listAJson: any = await listARes.json();
    expect(listAJson.success).toBe(true);
    expect(Array.isArray(listAJson.data)).toBe(true);
    expect(listAJson.data).toHaveLength(1);
    expect(listAJson.data[0].customerId).toBe(customerA.id);
    expect(listAJson.data[0].customerId).not.toBe(customerB.id);
  });
});
