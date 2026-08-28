import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

/**
 * Clearing a recipe (#287).
 *
 * `setRecipeSchema` used to require `.min(1)` on `ingredients`, and there is no
 * DELETE route for a recipe — PUT is the only writer. So the last row could not
 * be removed, which locked the owner into a deadlock: the recipe could not be
 * emptied, and the ingredient it referenced could not be deleted either
 * (`INGREDIENT_IN_USE`). After #278 that also meant a wrong recipe kept
 * deducting the wrong stock on every order with no way to stop it.
 *
 * `RecipeService.setRecipe` always supported the empty case — it is
 * DELETE-then-conditionally-INSERT — so the fix was to drop the `.min(1)`.
 * That makes this a schema-and-SQL boundary defect, which the mocked unit suite
 * cannot see: it stubs drizzle, so "the DELETE ran and the rows are gone" and
 * "the DELETE ran against nothing" look identical there. Hence real D1.
 *
 * The deletion test asserts the 409 BEFORE clearing as well as the 200 after.
 * Only the pair proves the deadlock is what opened; a lone 200 would also pass
 * against an ingredient that was never in a recipe to begin with.
 */
describe("Recipe clearing", () => {
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
   * SUBSCRIPTION_NOT_FOUND when a restaurant has no subscription row —
   * a 403 that would never reach the schema this file exists to cover.
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

  /** Read straight from the table — the endpoint's own view of it is what is under test. */
  async function recipeRows(menuItemId: number) {
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

  /** An owner with the inventory module, one dish, and one ingredient. */
  async function owner() {
    const restaurant = await seed.restaurant();
    await grantInventoryModule(restaurant.id);

    const menuItem = await seed.menuItem(restaurant.id, {
      name: "牛肉麵",
      priceCents: 20000,
      isAvailable: true,
    });
    const ingredientId = await seedIngredient(restaurant.id, "麵條");
    const token = await testApp.authHelper.ownerToken(1, restaurant.id);

    return { restaurant, menuItem, ingredientId, token };
  }

  async function setRecipe(
    restaurantId: string,
    menuItemId: number,
    token: string,
    ingredients: unknown[],
  ) {
    return call(
      `/ingredients/${restaurantId}/recipes/${menuItemId}`,
      token,
      "PUT",
      {
        ingredients,
      },
    );
  }

  it("empties a recipe when the owner removes every row", async () => {
    const { restaurant, menuItem, ingredientId, token } = await owner();

    const set = await setRecipe(restaurant.id, menuItem.id, token, [
      { ingredientId, quantityPerServing: 0.25, unit: "kg" },
    ]);
    expect(set.status).toBe(200);
    await expect(recipeRows(menuItem.id)).resolves.toHaveLength(1);

    // This is the request RecipeEditor sends once the owner deletes the last
    // row. It used to come back 400 VALIDATION_ERROR.
    const cleared = await setRecipe(restaurant.id, menuItem.id, token, []);
    expect(cleared.status).toBe(200);

    const read = await call(
      `/ingredients/${restaurant.id}/recipes/${menuItem.id}`,
      token,
    );
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toMatchObject({
      success: true,
      data: { recipe: [] },
    });
    await expect(recipeRows(menuItem.id)).resolves.toEqual([]);
  });

  it("releases the ingredient for deletion once its last recipe row is gone", async () => {
    const { restaurant, menuItem, ingredientId, token } = await owner();

    await setRecipe(restaurant.id, menuItem.id, token, [
      { ingredientId, quantityPerServing: 0.25, unit: "kg" },
    ]);

    const blocked = await call(
      `/ingredients/${restaurant.id}/${ingredientId}`,
      token,
      "DELETE",
    );
    expect(blocked.status).toBe(409);
    await expect(blocked.json()).resolves.toMatchObject({
      success: false,
      error: { code: "INGREDIENT_IN_USE" },
    });

    expect(
      (await setRecipe(restaurant.id, menuItem.id, token, [])).status,
    ).toBe(200);

    const deleted = await call(
      `/ingredients/${restaurant.id}/${ingredientId}`,
      token,
      "DELETE",
    );
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toMatchObject({
      success: true,
      data: { deleted: true },
    });
  });

  it("still refuses to clear another restaurant's recipe", async () => {
    // An empty body reaches setRecipe through a shorter path than a populated
    // one — it skips the ingredient-ownership lookup entirely — so the tenancy
    // guard (#265) has to sit ahead of that branch, not inside it. Clearing is
    // also the most destructive shape of the attack: it needs no valid
    // ingredient id of the victim's, only their menu item id.
    const attacker = await seed.restaurant();
    const victim = await seed.restaurant();
    await grantInventoryModule(attacker.id);

    const victimItem = await seed.menuItem(victim.id, {
      name: "招牌生魚片",
      priceCents: 88000,
      isAvailable: true,
    });
    const victimIngredient = await seedIngredient(victim.id, "鮪魚");
    const now = Date.now();
    await testApp.testDb.bindings.DB.prepare(
      `INSERT INTO menu_item_ingredients
         (menu_item_id, ingredient_id, quantity_per_serving, unit,
          is_optional, created_at_ms, updated_at_ms)
       VALUES (?, ?, 2.5, 'kg', 0, ?, ?)`,
    )
      .bind(victimItem.id, victimIngredient, now, now)
      .run();

    const token = await testApp.authHelper.ownerToken(1, attacker.id);
    const res = await setRecipe(attacker.id, victimItem.id, token, []);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: { code: "MENU_ITEM_NOT_FOUND" },
    });
    await expect(recipeRows(victimItem.id)).resolves.toEqual([
      {
        ingredient_id: victimIngredient,
        quantity_per_serving: 2.5,
        unit: "kg",
      },
    ]);
  });
});
