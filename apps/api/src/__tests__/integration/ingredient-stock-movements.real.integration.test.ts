import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { IngredientService } from "../../features/ingredients/services/IngredientService";

/**
 * The stock movement ledger (#277).
 *
 * `current_stock` used to be a bare scalar that only moved when an owner
 * retyped it, so a figure could not be explained. Every change now writes a
 * ledger row alongside the cached scalar.
 *
 * Real D1 throughout: the value is in the SQL — the conditional UPDATE that
 * makes concurrent adjustments safe, and the ledger staying in step with the
 * cache. The unit suite mocks drizzle wholesale and can show neither.
 */
describe("Ingredient stock movements", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;
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

  function service() {
    return new IngredientService(testApp.testDb.bindings.DB);
  }

  async function seedIngredient(currentStock: number | null) {
    const now = Date.now();
    const row = await testApp.testDb.bindings.DB.prepare(
      `INSERT INTO ingredient_definitions
         (restaurant_id, name, unit, current_stock, is_active,
          created_at_ms, updated_at_ms)
       VALUES (?, '雞胸肉', 'kg', ?, 1, ?, ?)
       RETURNING id`,
    )
      .bind(restaurantId, currentStock, now, now)
      .first<{ id: number }>();
    return row!.id;
  }

  it("receives stock and records the movement with its resulting balance", async () => {
    const id = await seedIngredient(4);

    const updated = await service().adjustStock(
      restaurantId,
      id,
      { delta: 10, reason: "purchase", note: "早市進貨" },
      "user-1",
    );

    expect(updated?.currentStock).toBe(14);

    const movements = await service().listMovements(restaurantId, id);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      delta: 10,
      // balance_after is stored so history reads without re-summing, and so a
      // drift against current_stock is visible rather than silent.
      balanceAfter: 14,
      reason: "purchase",
      note: "早市進貨",
    });
  });

  it("consumes stock with a negative delta", async () => {
    const id = await seedIngredient(10);

    const updated = await service().adjustStock(
      restaurantId,
      id,
      { delta: -2.5, reason: "waste" },
      "user-1",
    );

    expect(updated?.currentStock).toBe(7.5);
    await expect(
      service()
        .listMovements(restaurantId, id)
        .then((m) => m[0].delta),
    ).resolves.toBe(-2.5);
  });

  it("keeps the ledger and the cached scalar in step across several moves", async () => {
    const id = await seedIngredient(0);
    const svc = service();

    await svc.adjustStock(restaurantId, id, { delta: 10, reason: "purchase" });
    await svc.adjustStock(restaurantId, id, { delta: -3, reason: "waste" });
    await svc.adjustStock(restaurantId, id, { delta: 1.5, reason: "transfer" });

    const ingredient = await svc.get(restaurantId, id);
    const movements = await svc.listMovements(restaurantId, id);
    const summed = movements.reduce((total, m) => total + m.delta, 0);

    expect(ingredient?.currentStock).toBe(8.5);
    // The scalar is a cache of this sum; if they ever diverge the figure has
    // become unexplainable again, which is the whole defect.
    expect(summed).toBe(8.5);
    expect(movements[0].balanceAfter).toBe(8.5);
  });

  /**
   * Two adjustments issued together. Whichever interleaving D1 produces, the
   * invariant is the same: the cached scalar must equal the sum of the ledger.
   *
   * Without the conditional UPDATE both would compute from the same starting
   * balance and the last write would win, leaving two recorded movements whose
   * sum no longer matches the stored figure — a silently lost delta. Asserting
   * the invariant rather than a specific outcome keeps the test honest whether
   * D1 serialises the two or genuinely races them.
   */
  it("never loses a delta when two adjustments are issued together", async () => {
    const id = await seedIngredient(10);
    const svc = service();

    const results = await Promise.all([
      svc.adjustStock(restaurantId, id, { delta: 5, reason: "purchase" }),
      svc.adjustStock(restaurantId, id, { delta: 3, reason: "purchase" }),
    ]);

    const applied = results.filter(Boolean);
    expect(applied.length).toBeGreaterThanOrEqual(1);

    const ingredient = await svc.get(restaurantId, id);
    const movements = await svc.listMovements(restaurantId, id);

    // One ledger row per call that reported success — a rejected call must not
    // have written anything.
    expect(movements).toHaveLength(applied.length);
    const summed = movements.reduce((total, m) => total + m.delta, 0);
    expect(ingredient?.currentStock).toBe(10 + summed);
  });

  it("records an edit-form stock change as a correction", async () => {
    const id = await seedIngredient(10);

    // The edit form can still set stock directly; that is the right home for a
    // stocktake. It has to leave a trace, or the figure can still jump with
    // nothing to explain it.
    await service().update(restaurantId, id, { currentStock: 7 }, "user-1");

    const movements = await service().listMovements(restaurantId, id);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      delta: -3,
      balanceAfter: 7,
      reason: "correction",
    });
  });

  it("does not record a movement when an edit leaves stock untouched", async () => {
    const id = await seedIngredient(10);

    await service().update(restaurantId, id, { name: "去骨雞胸肉" }, "user-1");

    await expect(
      service().listMovements(restaurantId, id),
    ).resolves.toHaveLength(0);
  });

  it("scopes history by restaurant, not by the global ingredient id", async () => {
    const id = await seedIngredient(5);
    await service().adjustStock(restaurantId, id, {
      delta: 1,
      reason: "purchase",
    });

    const other = await seed.restaurant();
    // ingredient ids are a global autoincrement, so the id alone does not
    // identify a tenant (#265).
    await expect(
      service().listMovements(String(other.id), id),
    ).resolves.toEqual([]);
  });
});
