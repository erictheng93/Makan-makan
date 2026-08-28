import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { IngredientService } from "../../features/ingredients/services/IngredientService";

describe("Ingredient stock ledger — real D1 integration", () => {
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

  async function createIngredient(currentStock = 20) {
    const restaurant = await seed.restaurant();
    const result = await testApp.env.DB.prepare(
      `INSERT INTO ingredient_definitions
         (restaurant_id, name, unit, current_stock, is_active,
          created_at_ms, updated_at_ms)
       VALUES (?, 'Rice', 'kg', ?, 1, ?, ?)
       RETURNING id`,
    )
      .bind(restaurant.id, currentStock, Date.now(), Date.now())
      .first<{ id: number }>();
    if (!result) throw new Error("ingredient seed failed");
    return { restaurantId: String(restaurant.id), ingredientId: result.id };
  }

  it("records delta, edit-form, and legacy corrections with their actors", async () => {
    const { restaurantId, ingredientId } = await createIngredient();
    const service = new IngredientService(testApp.env.DB);

    await service.adjustStock(
      restaurantId,
      ingredientId,
      { delta: -5, reason: "waste", note: "spoiled" },
      "owner-adjust",
    );
    await service.update(
      restaurantId,
      ingredientId,
      { currentStock: 25 },
      "owner-edit",
    );
    await service.updateStock(restaurantId, ingredientId, 30, "owner-legacy");

    const ingredient = await testApp.env.DB.prepare(
      "SELECT current_stock FROM ingredient_definitions WHERE id = ?",
    )
      .bind(ingredientId)
      .first<{ current_stock: number }>();
    const movements = await testApp.env.DB.prepare(
      `SELECT delta, balance_after, reason, note, created_by
         FROM ingredient_stock_movements
        WHERE ingredient_id = ?
        ORDER BY id`,
    )
      .bind(ingredientId)
      .all();

    expect(ingredient?.current_stock).toBe(30);
    expect(movements.results).toEqual([
      {
        delta: -5,
        balance_after: 15,
        reason: "waste",
        note: "spoiled",
        created_by: "owner-adjust",
      },
      {
        delta: 10,
        balance_after: 25,
        reason: "correction",
        note: null,
        created_by: "owner-edit",
      },
      {
        delta: 5,
        balance_after: 30,
        reason: "correction",
        note: null,
        created_by: "owner-legacy",
      },
    ]);
  });

  it("rolls back the balance when the movement insert fails", async () => {
    const { restaurantId, ingredientId } = await createIngredient();
    const service = new IngredientService(testApp.env.DB);
    await testApp.env.DB.prepare(
      `CREATE TRIGGER reject_test_ingredient_movement
       BEFORE INSERT ON ingredient_stock_movements
       BEGIN
         SELECT RAISE(ABORT, 'injected movement failure');
       END`,
    ).run();

    try {
      await expect(
        service.adjustStock(restaurantId, ingredientId, {
          delta: 5,
          reason: "purchase",
        }),
      ).rejects.toThrow();

      const ingredient = await testApp.env.DB.prepare(
        "SELECT current_stock FROM ingredient_definitions WHERE id = ?",
      )
        .bind(ingredientId)
        .first<{ current_stock: number }>();
      const movementCount = await testApp.env.DB.prepare(
        "SELECT count(*) AS total FROM ingredient_stock_movements WHERE ingredient_id = ?",
      )
        .bind(ingredientId)
        .first<{ total: number }>();

      expect(ingredient?.current_stock).toBe(20);
      expect(movementCount?.total).toBe(0);
    } finally {
      await testApp.env.DB.prepare(
        "DROP TRIGGER IF EXISTS reject_test_ingredient_movement",
      ).run();
    }
  });
});
