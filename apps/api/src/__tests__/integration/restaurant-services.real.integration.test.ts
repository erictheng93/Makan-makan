import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { restaurantServiceItems } from "@makanmakan/database";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

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
});
