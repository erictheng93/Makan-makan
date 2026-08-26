import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { IngredientService } from "../../features/ingredients/services/IngredientService";

/**
 * The low-stock filter runs in SQL because the list is paginated: filtering
 * the loaded page client-side would report "nothing low" while page 2 is full
 * of it (#267).
 *
 * Real D1 rather than the mocked unit suite, which replaces drizzle wholesale
 * and so cannot tell one WHERE clause from another — and the whole value here
 * is in the boundary conditions.
 *
 * The filter has to agree with the badge in IngredientTable.vue. If they
 * diverge the owner gets the worst outcome: a row marked low that the filter
 * hides.
 */
describe("Ingredient low-stock filter", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;
  // ingredient_definitions.restaurant_id is a real FK, so the row has to hang
  // off a seeded restaurant rather than an invented id.
  let restaurantId: string;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    await testApp?.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
    const restaurant = await seed.restaurant();
    restaurantId = String(restaurant.id);
  });

  async function seedIngredient(
    name: string,
    currentStock: number | null,
    minStockLevel: number | null,
  ) {
    const now = Date.now();
    await testApp.testDb.bindings.DB.prepare(
      `INSERT INTO ingredient_definitions
         (restaurant_id, name, unit, current_stock, min_stock_level,
          is_active, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'kg', ?, ?, 1, ?, ?)`,
    )
      .bind(restaurantId, name, currentStock, minStockLevel, now, now)
      .run();
  }

  async function lowStockNames() {
    const service = new IngredientService(testApp.testDb.bindings.DB);
    const result = await service.list(restaurantId, { lowStock: true });
    return result.items.map((i) => i.name).sort();
  }

  it("includes an ingredient sitting exactly on its threshold", async () => {
    // The old badge used a strict `<`, so an ingredient at its minimum
    // rendered green — healthy-looking at the moment it stops being so.
    await seedIngredient("剛好到門檻", 20, 20);
    await seedIngredient("低於門檻", 5, 20);
    await seedIngredient("充足", 50, 20);

    await expect(lowStockNames()).resolves.toEqual(["低於門檻", "剛好到門檻"]);
  });

  it("excludes ingredients with no threshold rather than counting them healthy", async () => {
    // No minimum means there is nothing to be below. Including them would
    // flood the filter; treating them as "ok" is equally wrong, so they are
    // simply not low.
    await seedIngredient("沒有設門檻", 0, null);
    await seedIngredient("沒有庫存數字", null, 20);
    await seedIngredient("低於門檻", 1, 20);

    await expect(lowStockNames()).resolves.toEqual(["低於門檻"]);
  });

  it("returns everything when the filter is off", async () => {
    await seedIngredient("低於門檻", 1, 20);
    await seedIngredient("充足", 50, 20);

    const service = new IngredientService(testApp.testDb.bindings.DB);
    const all = await service.list(restaurantId, {});
    expect(all.items).toHaveLength(2);
  });
});
