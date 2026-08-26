import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

/**
 * Cross-tenant isolation on the recipe endpoints (#265).
 *
 * `requireRestaurantAccess("restaurantId")` only compares the PATH parameter to
 * the caller's own restaurant. The recipe routes then handed `menuItemId` —
 * a global autoincrement key the caller also controls — straight to a
 * RecipeService that scoped its queries by `menu_item_id` alone. An owner
 * supplying their own restaurantId and someone else's menuItemId therefore
 * passed the guard and reached another restaurant's recipe.
 *
 * `setRecipe` was the worse half: it is DELETE-then-INSERT, so the attack
 * destroyed the victim's recipe rather than merely reading it, and the ids are
 * enumerable from 1.
 *
 * Every test asserts BOTH halves — the attack is refused AND the victim's rows
 * are unchanged. A 404 that still wrote would pass the first assertion alone.
 *
 * These run against real D1 because the defect is in SQL scoping: the unit
 * tests mock drizzle, so they cannot tell a scoped query from an unscoped one.
 */
describe("Recipe endpoints — cross-tenant isolation", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    await testApp?.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  /**
   * /ingredients/* sits behind moduleGate("inventory"), which 403s with
   * SUBSCRIPTION_NOT_FOUND when a restaurant has no subscription row. Without
   * this the negative tests would still go red-to-green, but on the wrong 403 —
   * never reaching the ownership check they exist to cover.
   */
  async function grantInventoryModule(restaurantId: string) {
    await testApp.testDb.bindings.DB.prepare(
      `INSERT INTO shop_subscriptions
         (id, restaurant_id, plan_tier, is_active, module_overrides)
       VALUES (?, ?, 'pro', 1, '{"inventory":true}')`,
    )
      .bind(crypto.randomUUID(), restaurantId)
      .run();
  }

  async function seedIngredient(restaurantId: string, name: string) {
    const now = Date.now();
    const row = await testApp.testDb.bindings.DB.prepare(
      `INSERT INTO ingredient_definitions
         (restaurant_id, name, unit, is_active, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'kg', 1, ?, ?)
       RETURNING id`,
    )
      .bind(restaurantId, name, now, now)
      .first<{ id: number }>();
    return row!.id;
  }

  async function seedRecipeRow(menuItemId: number, ingredientId: number) {
    const now = Date.now();
    await testApp.testDb.bindings.DB.prepare(
      `INSERT INTO menu_item_ingredients
         (menu_item_id, ingredient_id, quantity_per_serving, unit,
          is_optional, created_at_ms, updated_at_ms)
       VALUES (?, ?, 2.5, 'kg', 0, ?, ?)`,
    )
      .bind(menuItemId, ingredientId, now, now)
      .run();
  }

  async function readRecipe(menuItemId: number) {
    const rows = await testApp.testDb.bindings.DB.prepare(
      `SELECT ingredient_id, quantity_per_serving, unit
         FROM menu_item_ingredients
        WHERE menu_item_id = ?
        ORDER BY ingredient_id`,
    )
      .bind(menuItemId)
      .all<{
        ingredient_id: number;
        quantity_per_serving: number;
        unit: string;
      }>();
    return rows.results;
  }

  /** Attacker with the inventory module, and a victim holding a real recipe. */
  async function twoRestaurants() {
    const attacker = await seed.restaurant();
    const victim = await seed.restaurant();
    await grantInventoryModule(String(attacker.id));

    const attackerItem = await seed.menuItem(attacker.id, {
      name: "A店牛肉麵",
      priceCents: 20000,
      isAvailable: true,
    });
    const victimItem = await seed.menuItem(victim.id, {
      name: "B店招牌生魚片",
      priceCents: 88000,
      isAvailable: true,
    });

    const attackerIngredient = await seedIngredient(
      String(attacker.id),
      "A店麵條",
    );
    const victimIngredient = await seedIngredient(String(victim.id), "B店鮪魚");
    await seedRecipeRow(victimItem.id, victimIngredient);

    const token = await testApp.authHelper.ownerToken(1, attacker.id);

    return {
      attacker,
      victim,
      attackerItem,
      victimItem,
      attackerIngredient,
      victimIngredient,
      token,
    };
  }

  const CSRF = "a".repeat(64);

  function call(path: string, token: string, method = "GET", body?: unknown) {
    return testApp.app.fetch(
      new Request(`https://test/api/v1${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-csrf-token": CSRF,
          cookie: `__Host-mm_csrf=${CSRF}`,
          origin: "http://localhost:3001",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  }

  it("refuses to read a recipe belonging to another restaurant", async () => {
    const { attacker, victimItem, token } = await twoRestaurants();

    const res = await call(
      `/ingredients/${attacker.id}/recipes/${victimItem.id}`,
      token,
    );

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: expect.objectContaining({ code: "MENU_ITEM_NOT_FOUND" }),
    });
  });

  it("refuses to overwrite a recipe belonging to another restaurant, and leaves it intact", async () => {
    const { attacker, victimItem, attackerIngredient, token } =
      await twoRestaurants();
    const before = await readRecipe(victimItem.id);
    expect(before).toHaveLength(1);

    const res = await call(
      `/ingredients/${attacker.id}/recipes/${victimItem.id}`,
      token,
      "PUT",
      {
        ingredients: [
          {
            ingredientId: attackerIngredient,
            quantityPerServing: 999,
            unit: "kg",
          },
        ],
      },
    );

    expect(res.status).toBe(404);
    // setRecipe deletes before it inserts, so the victim losing their recipe is
    // the real damage. Assert the rows are byte-for-byte what they were.
    await expect(readRecipe(victimItem.id)).resolves.toEqual(before);
  });

  it("refuses to validate a recipe belonging to another restaurant", async () => {
    const { attacker, victimItem, token } = await twoRestaurants();

    const res = await call(
      `/ingredients/${attacker.id}/recipes/${victimItem.id}/validate`,
      token,
      "POST",
    );

    expect(res.status).toBe(404);
  });

  it("refuses a recipe that references another restaurant's ingredient", async () => {
    const { attacker, attackerItem, victimIngredient, token } =
      await twoRestaurants();

    const res = await call(
      `/ingredients/${attacker.id}/recipes/${attackerItem.id}`,
      token,
      "PUT",
      {
        ingredients: [
          {
            ingredientId: victimIngredient,
            quantityPerServing: 1,
            unit: "kg",
          },
        ],
      },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: expect.objectContaining({ code: "INGREDIENT_NOT_IN_RESTAURANT" }),
    });
    // The attacker's own item must not have been given the foreign ingredient.
    await expect(readRecipe(attackerItem.id)).resolves.toEqual([]);
  });

  it("does not leak another restaurant's dish names through the delete conflict", async () => {
    const { attacker, victimIngredient, token } = await twoRestaurants();

    // The victim's ingredient IS used by the victim's dish. Before the fix the
    // usage lookup was unscoped, so this 409'd with "B店招牌生魚片" in the
    // message — an attacker could enumerate another restaurant's menu.
    const res = await call(
      `/ingredients/${attacker.id}/${victimIngredient}`,
      token,
      "DELETE",
    );

    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).not.toContain("B店招牌生魚片");
    expect(body).not.toContain("INGREDIENT_IN_USE");
  });

  it("still lets an owner manage their own recipe", async () => {
    const { attacker, attackerItem, attackerIngredient, token } =
      await twoRestaurants();

    const put = await call(
      `/ingredients/${attacker.id}/recipes/${attackerItem.id}`,
      token,
      "PUT",
      {
        ingredients: [
          {
            ingredientId: attackerIngredient,
            quantityPerServing: 1.5,
            unit: "kg",
          },
        ],
      },
    );
    expect(put.status).toBe(200);

    const get = await call(
      `/ingredients/${attacker.id}/recipes/${attackerItem.id}`,
      token,
    );
    expect(get.status).toBe(200);
    await expect(get.json()).resolves.toMatchObject({
      success: true,
      data: {
        recipe: [
          expect.objectContaining({
            ingredientId: attackerIngredient,
            quantityPerServing: 1.5,
          }),
        ],
      },
    });
  });
});
