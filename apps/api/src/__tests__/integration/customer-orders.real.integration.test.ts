/**
 * Real integration smoke - Customer Orders API
 * GET /api/v1/customers/me/orders
 *
 * This suite verifies the customer-facing orders path now works end-to-end.
 *
 * The endpoint `GET /api/v1/customers/me/orders` must accept canonical
 * customer tokens and scope results to the authenticated customer.
 *
 * The tests below assert the identity-cleanup behavior: customers should
 * receive 200 and only see their own orders by `customers.id`, while
 * staff/owners are not accepted as customers.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
const ENDPOINT = "https://test/api/v1/customers/me/orders";

describe("Customer Orders API - real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    await testApp.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("returns 401 when no Authorization header is present", async () => {
    const res = await testApp.app.fetch(new Request(ENDPOINT));

    expect(res.status).toBe(401);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBeDefined();
  });

  it("returns 200 for a canonical customer token and scopes orders to that customer", async () => {
    const restaurant = await seed.restaurant();
    const customer100 = await loginCustomerSession("+886911111100");
    const customer200 = await loginCustomerSession("+886922222200");

    await seed.order(restaurant.id, { customerId: customer100.customer.id });
    await seed.order(restaurant.id, { customerId: customer200.customer.id });

    const res = await testApp.app.fetch(
      new Request(ENDPOINT, {
        headers: { authorization: `Bearer ${customer100.accessToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].customerId).toBe(customer100.customer.id);
  });

  it("returns 401 for a staff/owner token because customers routes require canonical customer auth", async () => {
    const restaurant = await seed.restaurant();

    const owner = await seed.user({
      id: 10,
      role: 1,
      username: "owner-user",
    });

    const ownerToken = await testApp.authHelper.ownerToken(
      owner.id,
      String(restaurant.id),
    );

    const res = await testApp.app.fetch(
      new Request(ENDPOINT, {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
    );

    expect(res.status).toBe(401);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBeDefined();
  });

  async function loginCustomerSession(phone: string): Promise<{
    accessToken: string;
    customer: { id: string };
  }> {
    const otpRes = await testApp.app.fetch(
      new Request("https://test/api/v1/customer/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      }),
    );
    const otpJson: any = await otpRes.json();

    const verifyRes = await testApp.app.fetch(
      new Request("https://test/api/v1/customer/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, otp: otpJson.data.devOtp }),
      }),
    );
    const verifyJson: any = await verifyRes.json();

    return {
      accessToken: verifyJson.data.accessToken,
      customer: { id: verifyJson.data.customer.id },
    };
  }
});
