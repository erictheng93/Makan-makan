/**
 * Real integration smoke - Customer Orders API
 * GET /api/v1/customers/me/orders
 *
 * This suite verifies that:
 * - a customer token (role=5) can reach the endpoint
 * - results are scoped to the current customer
 * - non-customer roles are rejected by requireRole([5])
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

// Undo the global vi.mock("drizzle-orm/d1") so this test uses the real drizzle.
vi.unmock("drizzle-orm/d1");

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

  it("returns 200 for a customer token (role=5) and scopes orders to that customer", async () => {
    const restaurant = await seed.restaurant();

    const customer100 = await seed.user({
      id: 100,
      role: 5,
      username: "customer-100",
    });
    const customer200 = await seed.user({
      id: 200,
      role: 5,
      username: "customer-200",
    });

    await seed.order(restaurant.id, { customerId: customer100.id });
    await seed.order(restaurant.id, { customerId: customer200.id });

    const customerToken = await testApp.authHelper.customerToken(
      customer100.id,
    );

    const res = await testApp.app.fetch(
      new Request(ENDPOINT, {
        headers: { authorization: `Bearer ${customerToken}` },
      }),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(
      json.data.every((order: any) => order.customerId === customer100.id),
    ).toBe(true);
  });

  it("returns 403 for a staff/owner token (role=1) because requireRole([5]) rejects non-customers", async () => {
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

    expect(res.status).toBe(403);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error?.code).toBeDefined();
  });
});
