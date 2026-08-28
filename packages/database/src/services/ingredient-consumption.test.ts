import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createTestDatabase,
  REAL_D1_SETUP_TIMEOUT_MS,
  type TestDatabase,
} from "../testing/create-test-database";
import {
  categories,
  ingredientDefinitions,
  ingredientStockMovements,
  menuItemIngredients,
  menuItems,
  restaurants,
} from "../schema";
import {
  IngredientConsumptionService,
  type OrderedItem,
} from "./ingredient-consumption";

/**
 * Run against real D1 rather than a mocked drizzle: every property under test
 * here lives in SQL -- the CASE that leaves an untracked balance NULL, the
 * restaurant scoping on the BOM join, and the SUM/HAVING that makes a second
 * cancellation a no-op. A mock would answer whatever it was told to.
 */
describe("IngredientConsumptionService", () => {
  let testDb: TestDatabase;
  let service: IngredientConsumptionService;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
    service = new IngredientConsumptionService(testDb.drizzle);
  });

  let seq = 0;
  const unique = () => `${(seq += 1)}`;

  async function seedRestaurant() {
    const now = new Date();
    const [row] = await testDb.drizzle
      .insert(restaurants)
      .values({
        name: `Restaurant ${unique()}`,
        type: "cafe",
        category: "food",
        description: "Consumption test",
        address: "1 Test Street",
        district: "Central",
        city: "Taipei",
        phone: "0200000000",
        email: `restaurant-${unique()}@example.com`,
        businessHours: {},
        settings: {},
        isAvailable: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      } as never)
      .returning();
    return row.id as string;
  }

  async function seedMenuItem(restaurantId: string) {
    const now = new Date();
    const [category] = await testDb.drizzle
      .insert(categories)
      .values({
        restaurantId,
        name: `Category ${unique()}`,
        sortOrder: 0,
        isActive: true,
        isVisible: true,
        createdAt: now,
        updatedAt: now,
      } as never)
      .returning();
    const [row] = await testDb.drizzle
      .insert(menuItems)
      .values({
        restaurantId,
        categoryId: category.id,
        name: `Dish ${unique()}`,
        price: 120,
        priceCents: 12000,
        isAvailable: true,
        sortOrder: 0,
        spiceLevel: 0,
        preparationTime: 10,
        dietaryInfo: {},
        allergens: [],
        tags: [],
        createdAt: now,
        updatedAt: now,
      } as never)
      .returning();
    return row.id as number;
  }

  async function seedIngredient(
    restaurantId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const now = new Date();
    const [row] = await testDb.drizzle
      .insert(ingredientDefinitions)
      .values({
        restaurantId,
        name: `Ingredient ${unique()}`,
        unit: "kg",
        currentStock: 20,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        ...overrides,
      } as never)
      .returning();
    return row.id as number;
  }

  async function seedRecipe(
    menuItemId: number,
    ingredientId: number,
    quantityPerServing: number,
    unit = "kg",
  ) {
    const now = new Date();
    await testDb.drizzle.insert(menuItemIngredients).values({
      menuItemId,
      ingredientId,
      quantityPerServing,
      unit,
      isOptional: false,
      createdAt: now,
      updatedAt: now,
    } as never);
  }

  async function stockOf(ingredientId: number) {
    const [row] = await testDb.drizzle
      .select({ currentStock: ingredientDefinitions.currentStock })
      .from(ingredientDefinitions)
      .where(eq(ingredientDefinitions.id, ingredientId));
    return row?.currentStock ?? null;
  }

  async function ledgerOf(restaurantId: string, ingredientId: number) {
    return testDb.drizzle
      .select({
        delta: ingredientStockMovements.delta,
        balanceAfter: ingredientStockMovements.balanceAfter,
        reason: ingredientStockMovements.reason,
        orderId: ingredientStockMovements.orderId,
      })
      .from(ingredientStockMovements)
      .where(
        and(
          eq(ingredientStockMovements.restaurantId, restaurantId),
          eq(ingredientStockMovements.ingredientId, ingredientId),
        ),
      );
  }

  async function commit(writes: unknown[]) {
    if (writes.length === 0) return;
    await testDb.drizzle.batch(writes as never);
  }

  async function consume(
    restaurantId: string,
    items: OrderedItem[],
    context: { orderId?: string; userId?: string } = {},
  ) {
    const writes = await service.buildConsumptionWrites(
      restaurantId,
      items,
      context,
    );
    await commit(writes);
    return writes;
  }

  async function restore(
    restaurantId: string,
    orderId: string,
    context: { userId?: string } = {},
  ) {
    const writes = await service.buildRestoreWritesForOrder(
      restaurantId,
      orderId,
      context,
    );
    await commit(writes);
    return writes;
  }

  it("deducts each ingredient by quantity per serving times the order quantity", async () => {
    const restaurantId = await seedRestaurant();
    const dish = await seedMenuItem(restaurantId);
    const rice = await seedIngredient(restaurantId, { currentStock: 20 });
    await seedRecipe(dish, rice, 0.25);

    await consume(restaurantId, [{ menuItemId: dish, quantity: 3 }], {
      orderId: "order-1",
    });

    expect(await stockOf(rice)).toBeCloseTo(19.25);
    expect(await ledgerOf(restaurantId, rice)).toEqual([
      expect.objectContaining({
        delta: -0.75,
        balanceAfter: 19.25,
        reason: "order_consumption",
        orderId: "order-1",
      }),
    ]);
  });

  it("aggregates one ingredient across every dish that names it", async () => {
    const restaurantId = await seedRestaurant();
    const curry = await seedMenuItem(restaurantId);
    const fried = await seedMenuItem(restaurantId);
    const rice = await seedIngredient(restaurantId, { currentStock: 20 });
    await seedRecipe(curry, rice, 0.2);
    await seedRecipe(fried, rice, 0.3);

    await consume(restaurantId, [
      { menuItemId: curry, quantity: 2 },
      { menuItemId: fried, quantity: 1 },
    ]);

    // 0.2*2 + 0.3*1 = 0.7, written once rather than as two movements.
    expect(await stockOf(rice)).toBeCloseTo(19.3);
    expect(await ledgerOf(restaurantId, rice)).toHaveLength(1);
  });

  it("deducts nothing for a dish with no recipe", async () => {
    const restaurantId = await seedRestaurant();
    const dish = await seedMenuItem(restaurantId);

    const writes = await consume(restaurantId, [
      { menuItemId: dish, quantity: 5 },
    ]);

    expect(writes).toEqual([]);
  });

  it("leaves an untracked ingredient untracked instead of driving it negative", async () => {
    const restaurantId = await seedRestaurant();
    const dish = await seedMenuItem(restaurantId);
    const uncounted = await seedIngredient(restaurantId, {
      currentStock: null,
    });
    await seedRecipe(dish, uncounted, 2);

    const writes = await consume(restaurantId, [
      { menuItemId: dish, quantity: 3 },
    ]);

    expect(await stockOf(uncounted)).toBeNull();
    expect(writes).toEqual([]);
    // A movement with no balance would be a number nobody can reconcile.
    expect(await ledgerOf(restaurantId, uncounted)).toEqual([]);
  });

  it("skips a recipe row whose unit disagrees with the stock unit", async () => {
    const restaurantId = await seedRestaurant();
    const dish = await seedMenuItem(restaurantId);
    const rice = await seedIngredient(restaurantId, {
      unit: "kg",
      currentStock: 20,
    });
    await seedRecipe(dish, rice, 200, "g");

    const writes = await consume(restaurantId, [
      { menuItemId: dish, quantity: 1 },
    ]);

    // Subtracting 200 g from 20 kg would read as a 180 kg deficit.
    expect(await stockOf(rice)).toBe(20);
    expect(writes).toEqual([]);
  });

  it("does not consume an ingredient the owner has retired", async () => {
    const restaurantId = await seedRestaurant();
    const dish = await seedMenuItem(restaurantId);
    const retired = await seedIngredient(restaurantId, {
      isActive: false,
      currentStock: 20,
    });
    await seedRecipe(dish, retired, 1);

    const writes = await consume(restaurantId, [
      { menuItemId: dish, quantity: 1 },
    ]);

    // isActive is filtered on the BOM read only, so this is the case that
    // pins that filter on its own -- and it matches loadBOM, which leaves a
    // retired ingredient out of the forecast too.
    expect(await stockOf(retired)).toBe(20);
    expect(writes).toEqual([]);
  });

  it("never touches another restaurant's ingredient", async () => {
    const mine = await seedRestaurant();
    const theirs = await seedRestaurant();
    const dish = await seedMenuItem(mine);
    const theirIngredient = await seedIngredient(theirs, { currentStock: 20 });
    // A BOM row naming a foreign ingredient -- what setRecipe now rejects, and
    // what rows written before it did still look like.
    await seedRecipe(dish, theirIngredient, 1);

    const writes = await consume(mine, [{ menuItemId: dish, quantity: 1 }]);

    // Two guards stand behind this: the BOM read is scoped by restaurant and
    // so is the UPDATE. They mask each other -- removing either one alone
    // keeps this test green -- so treat a pass as evidence for the property,
    // not for either layer individually.
    expect(await stockOf(theirIngredient)).toBe(20);
    expect(writes).toEqual([]);
  });

  it("lets stock go negative rather than blocking the order", async () => {
    const restaurantId = await seedRestaurant();
    const dish = await seedMenuItem(restaurantId);
    const rice = await seedIngredient(restaurantId, { currentStock: 1 });
    await seedRecipe(dish, rice, 0.5);

    await consume(restaurantId, [{ menuItemId: dish, quantity: 4 }]);

    expect(await stockOf(rice)).toBeCloseTo(-1);
    expect(await ledgerOf(restaurantId, rice)).toHaveLength(1);
  });

  it("loses no delta when two orders claim the same ingredient at once", async () => {
    const restaurantId = await seedRestaurant();
    const dish = await seedMenuItem(restaurantId);
    const rice = await seedIngredient(restaurantId, { currentStock: 20 });
    await seedRecipe(dish, rice, 0.5);

    // `current_stock = current_stock - X` is a read-modify-write inside one
    // SQL statement, so neither claim can be computed from a balance the
    // other has already moved -- no optimistic retry needed.
    await Promise.all([
      consume(restaurantId, [{ menuItemId: dish, quantity: 2 }], {
        orderId: "order-a",
      }),
      consume(restaurantId, [{ menuItemId: dish, quantity: 3 }], {
        orderId: "order-b",
      }),
    ]);

    // 20 - 1.0 - 1.5, not 20 - 1.5.
    expect(await stockOf(rice)).toBeCloseTo(17.5);
    expect(await ledgerOf(restaurantId, rice)).toHaveLength(2);
  });

  it("restores exactly what was taken even after the recipe changed", async () => {
    const restaurantId = await seedRestaurant();
    const dish = await seedMenuItem(restaurantId);
    const rice = await seedIngredient(restaurantId, { currentStock: 20 });
    await seedRecipe(dish, rice, 0.5);

    await consume(restaurantId, [{ menuItemId: dish, quantity: 2 }], {
      orderId: "order-9",
    });
    expect(await stockOf(rice)).toBeCloseTo(19);

    // The owner triples the recipe after the order was placed. Re-deriving the
    // amount would now put back 3 kg instead of the 1 kg actually taken.
    await testDb.drizzle
      .update(menuItemIngredients)
      .set({ quantityPerServing: 1.5 })
      .where(eq(menuItemIngredients.menuItemId, dish));

    await restore(restaurantId, "order-9");

    expect(await stockOf(rice)).toBeCloseTo(20);
    expect(await ledgerOf(restaurantId, rice)).toEqual([
      expect.objectContaining({ delta: -1, reason: "order_consumption" }),
      expect.objectContaining({
        delta: 1,
        balanceAfter: 20,
        reason: "order_cancellation",
      }),
    ]);
  });

  it("treats a second cancellation as a no-op", async () => {
    const restaurantId = await seedRestaurant();
    const dish = await seedMenuItem(restaurantId);
    const rice = await seedIngredient(restaurantId, { currentStock: 20 });
    await seedRecipe(dish, rice, 0.5);

    await consume(restaurantId, [{ menuItemId: dish, quantity: 2 }], {
      orderId: "order-dup",
    });

    await restore(restaurantId, "order-dup");
    const second = await restore(restaurantId, "order-dup");

    expect(second).toEqual([]);
    expect(await stockOf(rice)).toBeCloseTo(20);
    expect(await ledgerOf(restaurantId, rice)).toHaveLength(2);
  });
});
