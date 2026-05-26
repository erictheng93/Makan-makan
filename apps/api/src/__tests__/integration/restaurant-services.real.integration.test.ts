import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  markets,
  restaurantMarketMemberships,
  restaurantServiceItems,
} from "@makanmakan/database";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

function withCsrf(
  headers: Record<string, string> = {},
): Record<string, string> {
  const csrfToken = "b".repeat(64);
  return {
    host: "test",
    origin: "https://test",
    "x-csrf-token": csrfToken,
    cookie: `csrf_token=${csrfToken}`,
    ...headers,
  };
}

function openAllWeek() {
  const day = { open: "00:00", close: "23:59" };
  return {
    monday: day,
    tuesday: day,
    wednesday: day,
    thursday: day,
    friday: day,
    saturday: day,
    sunday: day,
  };
}

async function seedMarket(
  testApp: RealIntegrationTestApp,
  overrides: Partial<typeof markets.$inferInsert> = {},
) {
  const now = new Date();
  const [market] = await testApp.testDb.drizzle
    .insert(markets)
    .values({
      id: `market-${crypto.randomUUID()}`,
      slug: `service-market-${crypto.randomUUID()}`,
      name: "Service Search Market",
      type: "night_market",
      description: "Service search integration market",
      city: "台中市",
      district: "西屯區",
      address: "台中市西屯區文華路",
      latitude: 24.1764,
      longitude: 120.6466,
      openingHours: openAllWeek(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  return market;
}

describe("Restaurant service items API — real integration", () => {
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

  it("lists public active service items for a restaurant", async () => {
    const restaurant = await seed.restaurant({
      name: "Service Directory Vendor",
    });
    const now = new Date();
    await testApp.testDb.drizzle.insert(restaurantServiceItems).values([
      {
        restaurantId: String(restaurant.id),
        name: "代客切水果",
        description: "現場代切並分裝",
        serviceType: "general",
        priceCents: 3000,
        tags: ["水果", "分裝"],
        keywords: "水果 分裝 切水果",
        sortOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: String(restaurant.id),
        name: "預約外送",
        serviceType: "delivery",
        priceLabel: "依距離報價",
        requiresBooking: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: String(restaurant.id),
        name: "內部測試服務",
        serviceType: "general",
        isPublic: false,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        restaurantId: String(restaurant.id),
        name: "停用服務",
        serviceType: "general",
        isActive: false,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const res = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/service-items`,
      ),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.map((item: any) => item.name)).toEqual([
      "預約外送",
      "代客切水果",
    ]);
    expect(json.data[0]).toMatchObject({
      restaurantId: restaurant.id,
      serviceType: "delivery",
      priceLabel: "依距離報價",
      requiresBooking: true,
      isPublic: true,
      isActive: true,
    });
    expect(json.data[1]).toMatchObject({
      priceCents: 3000,
      tags: ["水果", "分裝"],
    });
  });

  it("returns 404 for service items of an unknown restaurant", async () => {
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/restaurants/missing/service-items"),
    );

    expect(res.status).toBe(404);
  });

  it("lets an owner manage service items for their restaurant", async () => {
    const restaurant = await seed.restaurant({
      name: "Owner Managed Services",
    });
    const owner = await seed.user({
      role: 1,
      restaurantId: String(restaurant.id),
    });
    const token = await testApp.authHelper.ownerToken(
      owner.id,
      String(restaurant.id),
    );

    const createRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/service-items`,
        {
          method: "POST",
          headers: withCsrf({
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          }),
          body: JSON.stringify({
            name: "代客切水果",
            description: "現場代切並分裝",
            serviceType: "general",
            priceCents: 3000,
            tags: ["水果", "分裝"],
            keywords: "水果 分裝 切水果",
            sortOrder: 1,
            isPublic: true,
          }),
        },
      ),
    );

    expect(createRes.status).toBe(201);
    const createdJson: any = await createRes.json();
    expect(createdJson.data).toMatchObject({
      restaurantId: restaurant.id,
      name: "代客切水果",
      serviceType: "general",
      priceCents: 3000,
      tags: ["水果", "分裝"],
      isActive: true,
      isPublic: true,
    });
    await expect(
      testApp.testDb.bindings.CACHE_KV.get("markets:version"),
    ).resolves.toBe("1");

    const updateRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/service-items/${createdJson.data.id}`,
        {
          method: "PUT",
          headers: withCsrf({
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          }),
          body: JSON.stringify({
            name: "預約切水果",
            priceLabel: "依份量報價",
            requiresBooking: true,
            isPublic: false,
          }),
        },
      ),
    );

    expect(updateRes.status).toBe(200);
    const updatedJson: any = await updateRes.json();
    expect(updatedJson.data).toMatchObject({
      id: createdJson.data.id,
      name: "預約切水果",
      priceLabel: "依份量報價",
      requiresBooking: true,
      isPublic: false,
    });
    await expect(
      testApp.testDb.bindings.CACHE_KV.get("markets:version"),
    ).resolves.toBe("2");

    const publicRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/service-items`,
      ),
    );
    const publicJson: any = await publicRes.json();
    expect(publicJson.data).toEqual([]);

    const deleteRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/service-items/${createdJson.data.id}`,
        {
          method: "DELETE",
          headers: withCsrf({
            authorization: `Bearer ${token}`,
          }),
        },
      ),
    );

    expect(deleteRes.status).toBe(200);
    const deletedRows = await testApp.testDb.drizzle
      .select()
      .from(restaurantServiceItems);
    expect(deletedRows[0].deletedAt).toBeInstanceOf(Date);
    expect(deletedRows[0].isActive).toBe(false);
    await expect(
      testApp.testDb.bindings.CACHE_KV.get("markets:version"),
    ).resolves.toBe("3");
  });

  it("makes owner-created public services searchable within their market", async () => {
    const market = await seedMarket(testApp, {
      slug: "owner-service-search-market",
    });
    const restaurant = await seed.restaurant({
      name: "Owner Service Search Vendor",
      city: "台中市",
      district: "西屯區",
    });
    await testApp.testDb.drizzle.insert(restaurantMarketMemberships).values({
      restaurantId: String(restaurant.id),
      marketId: market.id,
      isPrimary: true,
      joinedAt: new Date(),
    });
    const owner = await seed.user({
      role: 1,
      restaurantId: String(restaurant.id),
    });
    const token = await testApp.authHelper.ownerToken(
      owner.id,
      String(restaurant.id),
    );

    const createRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/service-items`,
        {
          method: "POST",
          headers: withCsrf({
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          }),
          body: JSON.stringify({
            name: "市場 API 代客切水果",
            description: "夜市現場切水果並分裝",
            serviceType: "general",
            tags: ["水果", "分裝"],
            keywords: "切水果 夜市 分裝",
            isPublic: true,
          }),
        },
      ),
    );

    expect(createRes.status).toBe(201);
    const createJson: any = await createRes.json();

    const searchRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/discovery/services?q=${encodeURIComponent(
          "切水果",
        )}&marketId=${market.id}`,
      ),
    );

    expect(searchRes.status).toBe(200);
    const searchJson: any = await searchRes.json();
    expect(searchJson.data.total).toBe(1);
    expect(searchJson.data.results).toHaveLength(1);
    expect(searchJson.data.results[0]).toMatchObject({
      serviceItemId: createJson.data.id,
      restaurantId: restaurant.id,
      restaurantName: "Owner Service Search Vendor",
      name: "市場 API 代客切水果",
    });
  });

  it("prevents an owner from managing service items for another restaurant", async () => {
    const ownRestaurant = await seed.restaurant({ name: "Owned Vendor" });
    const otherRestaurant = await seed.restaurant({ name: "Other Vendor" });
    const owner = await seed.user({
      role: 1,
      restaurantId: String(ownRestaurant.id),
    });
    const token = await testApp.authHelper.ownerToken(
      owner.id,
      String(ownRestaurant.id),
    );

    const res = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${otherRestaurant.id}/service-items`,
        {
          method: "POST",
          headers: withCsrf({
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          }),
          body: JSON.stringify({
            name: "越權服務",
            serviceType: "general",
          }),
        },
      ),
    );

    expect(res.status).toBe(403);
  });
});
