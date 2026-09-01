import {
  and,
  customers,
  eq,
  restaurantCustomers,
  TenantMemberDirectoryService,
} from "@makanmasak/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

describe("Members API — tenant isolation", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  afterAll(async () => {
    await testApp?.dispose();
  });

  const csrf = "a".repeat(64);
  function get(path: string, token: string) {
    return testApp.app.fetch(
      new Request(`https://test/api/v1${path}`, {
        headers: {
          authorization: `Bearer ${token}`,
          "x-csrf-token": csrf,
          cookie: `__Host-mm_csrf=${csrf}`,
          origin: "http://localhost:3001",
        },
      }),
    );
  }

  async function shop(name: string) {
    const restaurant = await seed.restaurant({ name });
    const owner = await seed.user({
      username: `${name}-owner`,
      role: 1,
      restaurantId: String(restaurant.id),
    });
    return {
      restaurantId: String(restaurant.id),
      token: await testApp.authHelper.ownerToken(owner.id, restaurant.id),
    };
  }

  async function member(restaurantId: string, displayName: string) {
    const [customer] = await testApp.testDb.drizzle
      .insert(customers)
      .values({
        displayName,
        primaryPhone: `+8869${String(Date.now()).slice(-8)}`,
        primaryEmail: `${displayName}@example.com`,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: customers.id });
    const [row] = await testApp.testDb.drizzle
      .insert(restaurantCustomers)
      .values({
        restaurantId,
        customerId: customer!.id,
        orderCount: 2,
        cancelledOrderCount: 1,
        totalSpentCents: 1200,
        firstOrderAt: new Date("2026-08-01T00:00:00Z"),
        lastOrderAt: new Date("2026-08-30T00:00:00Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: restaurantCustomers.id });
    return { memberId: row!.id, customerId: customer!.id };
  }

  it("returns only the caller's projection and never exposes customers.id", async () => {
    const a = await shop("members-a");
    const b = await shop("members-b");
    const mine = await member(a.restaurantId, "Alice");
    await member(b.restaurantId, "Bob");

    const res = await get(`/restaurants/${a.restaurantId}/members`, a.token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<Record<string, unknown>>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      memberId: mine.memberId,
      displayName: "Alice",
      maskedPhone: expect.stringMatching(/^\+886\*{3}\d{3}$/),
      maskedEmail: "A***@example.com",
      orderCount: 2,
      totalSpentCents: 1200,
    });
    expect(Object.keys(body.data[0]).sort()).toEqual([
      "avgOrderValueCents",
      "cancelledOrderCount",
      "displayName",
      "firstOrderAt",
      "isBlocked",
      "lastOrderAt",
      "locale",
      "marketingReachable",
      "maskedEmail",
      "maskedPhone",
      "memberId",
      "orderCount",
      "status",
      "tags",
      "totalSpentCents",
    ]);
    expect(JSON.stringify(body)).not.toContain(mine.customerId);
  });

  it("returns 404 for another restaurant's member and leaves the victim unchanged", async () => {
    const a = await shop("members-attacker");
    const b = await shop("members-victim");
    const victim = await member(b.restaurantId, "Victim");
    const before = await testApp.testDb.drizzle
      .select()
      .from(restaurantCustomers)
      .where(
        and(
          eq(restaurantCustomers.id, victim.memberId),
          eq(restaurantCustomers.restaurantId, b.restaurantId),
        ),
      );

    const res = await get(
      `/restaurants/${a.restaurantId}/members/${victim.memberId}`,
      a.token,
    );
    expect(res.status).toBe(404);
    await expect(
      testApp.testDb.drizzle
        .select()
        .from(restaurantCustomers)
        .where(eq(restaurantCustomers.id, victim.memberId)),
    ).resolves.toEqual(before);
  });

  it("recomputes a tenant projection idempotently from order facts", async () => {
    const shopA = await shop("members-rollup");
    const [customer] = await testApp.testDb.drizzle
      .insert(customers)
      .values({ displayName: "Repeat", status: "active" })
      .returning({ id: customers.id });
    await seed.order(shopA.restaurantId, {
      customerId: customer!.id,
      status: "paid",
      totalAmountCents: 1200,
    });
    await seed.order(shopA.restaurantId, {
      customerId: customer!.id,
      status: "cancelled",
      totalAmountCents: 900,
    });
    const service = new TenantMemberDirectoryService(
      testApp.env.DB,
      testApp.env,
    );

    await service.recomputeForCustomer(
      { restaurantId: shopA.restaurantId },
      customer!.id,
    );
    await service.recomputeForCustomer(
      { restaurantId: shopA.restaurantId },
      customer!.id,
    );

    const [projection] = await testApp.testDb.drizzle
      .select()
      .from(restaurantCustomers)
      .where(eq(restaurantCustomers.customerId, customer!.id));
    expect(projection).toMatchObject({
      restaurantId: shopA.restaurantId,
      orderCount: 1,
      cancelledOrderCount: 1,
      totalSpentCents: 1200,
    });
  });
});
