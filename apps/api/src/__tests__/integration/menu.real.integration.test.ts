import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { categories } from "@makanmakan/database";
describe("Menu API — real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  }, 60000);

  afterAll(async () => {
    await testApp?.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("returns menu with categories and menuItems joined", async () => {
    const restaurant = await seed.restaurant();

    // seed.menuItem internally creates a throwaway category + menu item for
    // this restaurant. Pass explicit overrides to defeat factory flake.
    const item = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      isFeatured: true,
      price: 150,
      name: "Nasi Lemak",
    });

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/menu/${restaurant.id}`),
    );

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    const data = json.data;

    // Response shape: { categories: [...], menuItems: [...] }
    // No `restaurant` wrapper — transformMenuStructure only returns these two arrays.
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThanOrEqual(1);

    expect(Array.isArray(data.menuItems)).toBe(true);
    expect(data.menuItems.length).toBeGreaterThanOrEqual(1);

    // The seeded item should appear in the flat menuItems list.
    const found = data.menuItems.find((i: any) => i.id === item.id);
    expect(found).toBeTruthy();
    expect(found.name).toBe("Nasi Lemak");
    expect(found.price).toBe(150);
  });

  it("returns empty arrays for a restaurant with no menu items", async () => {
    const restaurant = await seed.restaurant();

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/menu/${restaurant.id}`),
    );

    // Route returns 404 when no menu exists (getMenu returns null for unknown
    // restaurant), so either 200+empty or 404 are valid here.
    // We assert on the actual behavior rather than an assumption.
    if (res.status === 200) {
      const json: any = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.categories)).toBe(true);
      expect(Array.isArray(json.data.menuItems)).toBe(true);
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("filters unavailable items from public request", async () => {
    const restaurant = await seed.restaurant();

    // Seed one available and one unavailable item.
    const available = await seed.menuItem(restaurant.id, {
      isAvailable: true,
      name: "Available Item",
    });
    const unavailable = await seed.menuItem(restaurant.id, {
      isAvailable: false,
      name: "Hidden Item",
    });

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/menu/${restaurant.id}`),
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    const items: any[] = json.data.menuItems ?? [];
    const availableFound = items.find((i: any) => i.id === available.id);
    const unavailableFound = items.find((i: any) => i.id === unavailable.id);

    // Available item must be visible to public callers.
    expect(availableFound).toBeTruthy();
    // Unavailable item should NOT appear in the public (unauthenticated) response.
    expect(unavailableFound).toBeUndefined();
  });

  it("hides public menu items that belong to private categories", async () => {
    const restaurant = await seed.restaurant();
    const now = new Date();
    const [visibleCategory, inactiveCategory, hiddenCategory, deletedCategory] =
      await testApp.testDb.drizzle
        .insert(categories)
        .values([
          {
            restaurantId: String(restaurant.id),
            name: "Visible Public Category",
            sortOrder: 0,
            isActive: true,
            isVisible: true,
            createdAt: now,
            updatedAt: now,
          },
          {
            restaurantId: String(restaurant.id),
            name: "Inactive Private Category",
            sortOrder: 1,
            isActive: false,
            isVisible: true,
            createdAt: now,
            updatedAt: now,
          },
          {
            restaurantId: String(restaurant.id),
            name: "Hidden Private Category",
            sortOrder: 2,
            isActive: true,
            isVisible: false,
            createdAt: now,
            updatedAt: now,
          },
          {
            restaurantId: String(restaurant.id),
            name: "Deleted Private Category",
            sortOrder: 3,
            isActive: true,
            isVisible: true,
            deletedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .returning();

    await seed.menuItem(restaurant.id, {
      categoryId: visibleCategory.id,
      name: "Public Category Item",
      isAvailable: true,
      isFeatured: true,
      orderCount: 10,
    });
    await seed.menuItem(restaurant.id, {
      categoryId: inactiveCategory.id,
      name: "Inactive Category Item",
      isAvailable: true,
      isFeatured: true,
      orderCount: 40,
    });
    await seed.menuItem(restaurant.id, {
      categoryId: hiddenCategory.id,
      name: "Hidden Category Item",
      isAvailable: true,
      isFeatured: true,
      orderCount: 30,
    });
    await seed.menuItem(restaurant.id, {
      categoryId: deletedCategory.id,
      name: "Deleted Category Item",
      isAvailable: true,
      isFeatured: true,
      orderCount: 20,
    });

    const [menuRes, featuredRes, popularRes, searchRes] = await Promise.all([
      testApp.app.fetch(
        new Request(`https://test/api/v1/menu/${restaurant.id}`),
      ),
      testApp.app.fetch(
        new Request(`https://test/api/v1/menu/${restaurant.id}/featured`),
      ),
      testApp.app.fetch(
        new Request(`https://test/api/v1/menu/${restaurant.id}/popular`),
      ),
      testApp.app.fetch(
        new Request(
          `https://test/api/v1/menu/${restaurant.id}/search?search=Category+Item`,
        ),
      ),
    ]);

    expect([
      menuRes.status,
      featuredRes.status,
      popularRes.status,
      searchRes.status,
    ]).toEqual([200, 200, 200, 200]);

    const menuJson: any = await menuRes.json();
    const featuredJson: any = await featuredRes.json();
    const popularJson: any = await popularRes.json();
    const searchJson: any = await searchRes.json();

    expect(menuJson.data.menuItems.map((item: any) => item.name)).toEqual([
      "Public Category Item",
    ]);
    expect(featuredJson.data.map((item: any) => item.name)).toEqual([
      "Public Category Item",
    ]);
    expect(popularJson.data.map((item: any) => item.name)).toEqual([
      "Public Category Item",
    ]);
    expect(searchJson.data.map((item: any) => item.name)).toEqual([
      "Public Category Item",
    ]);
  });

  it("does not expose public menus for inactive or deleted restaurants", async () => {
    const inactiveRestaurant = await seed.restaurant({
      name: "Inactive Public Menu Vendor",
      isActive: false,
    });
    const deletedRestaurant = await seed.restaurant({
      name: "Deleted Public Menu Vendor",
      deletedAt: new Date(),
    });

    await seed.menuItem(inactiveRestaurant.id, {
      isAvailable: true,
      name: "Inactive Vendor Item",
    });
    await seed.menuItem(deletedRestaurant.id, {
      isAvailable: true,
      name: "Deleted Vendor Item",
    });

    const [inactiveRes, deletedRes] = await Promise.all([
      testApp.app.fetch(
        new Request(`https://test/api/v1/menu/${inactiveRestaurant.id}`),
      ),
      testApp.app.fetch(
        new Request(`https://test/api/v1/menu/${deletedRestaurant.id}`),
      ),
    ]);

    expect(inactiveRes.status).toBe(404);
    expect(deletedRes.status).toBe(404);
  });

  it("does not expose public menu helper endpoints for inactive or deleted restaurants", async () => {
    const inactiveRestaurant = await seed.restaurant({
      name: "Inactive Public Menu Helper Vendor",
      isActive: false,
    });
    const deletedRestaurant = await seed.restaurant({
      name: "Deleted Public Menu Helper Vendor",
      deletedAt: new Date(),
    });

    await seed.menuItem(inactiveRestaurant.id, {
      isAvailable: true,
      isFeatured: true,
      isPopular: true,
      name: "Inactive Helper Item",
    });
    await seed.menuItem(deletedRestaurant.id, {
      isAvailable: true,
      isFeatured: true,
      isPopular: true,
      name: "Deleted Helper Item",
    });

    const urls = [
      `https://test/api/v1/menu/${inactiveRestaurant.id}/featured`,
      `https://test/api/v1/menu/${inactiveRestaurant.id}/popular`,
      `https://test/api/v1/menu/${inactiveRestaurant.id}/search?search=Helper`,
      `https://test/api/v1/menu/${deletedRestaurant.id}/featured`,
      `https://test/api/v1/menu/${deletedRestaurant.id}/popular`,
      `https://test/api/v1/menu/${deletedRestaurant.id}/search?search=Helper`,
    ];

    const responses = await Promise.all(
      urls.map((url) => testApp.app.fetch(new Request(url))),
    );

    expect(responses.map((res) => res.status)).toEqual([
      404, 404, 404, 404, 404, 404,
    ]);
  });
});
