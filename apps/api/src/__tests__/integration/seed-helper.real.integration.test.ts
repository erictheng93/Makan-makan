import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmakan/database/testing";
import { buildSeedHelpers } from "./helpers/seed-helper";

describe("buildSeedHelpers", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  });
  afterAll(async () => {
    await testDb.dispose();
  });
  beforeEach(async () => {
    await testDb.truncateAll();
  });

  it("seed.restaurant inserts a restaurant and returns its id", async () => {
    const seed = buildSeedHelpers(testDb);
    const restaurant = await seed.restaurant();
    expect(restaurant.id).toBeTruthy();

    const row = await testDb.db
      .prepare(`SELECT name FROM restaurants WHERE id = ?`)
      .bind(restaurant.id)
      .first();
    expect(row).toBeTruthy();
  });

  it("seed.menuItem requires an existing restaurantId", async () => {
    const seed = buildSeedHelpers(testDb);
    const r = await seed.restaurant();
    const item = await seed.menuItem(r.id);
    expect(item.id).toBeTruthy();

    const row = await testDb.db
      .prepare(`SELECT restaurant_id FROM menu_items WHERE id = ?`)
      .bind(item.id)
      .first<{ restaurant_id: string | number }>();
    expect(String(row?.restaurant_id)).toBe(String(r.id));
  });

  it("seed.order creates an order linked to a restaurant", async () => {
    const seed = buildSeedHelpers(testDb);
    const r = await seed.restaurant();
    const order = await seed.order(r.id);
    expect(order.id).toBeTruthy();
  });
});
