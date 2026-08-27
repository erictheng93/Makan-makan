import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../schema";
import {
  ingredientDefinitions,
  ingredientStockMovements,
  menuItemIngredients,
  menuItems,
} from "../schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface OrderedItem {
  menuItemId: number;
  quantity: number;
}

/**
 * One ingredient's share of an order, already aggregated across every dish
 * that names it. `delta` is the signed amount actually written -- negative
 * for consumption, positive for a restore -- which is what makes undoing one
 * a matter of negating it rather than knowing which way it went.
 */
export interface IngredientClaim {
  ingredientId: number;
  delta: number;
  balanceAfter: number;
}

/** Rows the caller appends to its own batch so they commit with the order. */
export type MovementInsert = BatchItem<"sqlite">;

export interface ClaimResult {
  claims: IngredientClaim[];
  movementWrites: MovementInsert[];
}

const EMPTY: ClaimResult = { claims: [], movementWrites: [] };

/**
 * Units are free text on both sides with no conversion layer, so the most this
 * can do is refuse to be fooled by whitespace and capitalisation. "Kg" and
 * "kg" are the same unit; "g" and "kg" are not, and never will be without a
 * conversion table.
 */
function unitsMatch(recipeUnit: string, stockUnit: string): boolean {
  return recipeUnit.trim().toLowerCase() === stockUnit.trim().toLowerCase();
}

/**
 * Deducts ingredient stock when an order is placed and puts it back when the
 * order is cancelled (#278).
 *
 * Three decisions from the issue are load-bearing here:
 *
 * - A dish with no recipe deducts nothing. Most dishes have no BOM yet, and
 *   refusing to sell them would be worse than an unchanged figure.
 * - Running short does not block the order. Ingredient stock is a hand-counted
 *   figure; menu-item `inventoryCount` is the one that guards availability.
 *   Stock is allowed to go negative, which is the honest reading of "the
 *   recipe says we used more than we had counted".
 * - An ingredient whose stock is NULL is untracked, not zero. Deducting from
 *   it would fabricate a negative where the truth is "nobody has counted this
 *   yet", so those rows are skipped -- the same shape `menuItems`
 *   `inventoryCount` already uses.
 */
export class IngredientConsumptionService {
  constructor(private readonly db: Db) {}

  /**
   * Deduct every ingredient the ordered dishes consume.
   *
   * The UPDATEs run in one `db.batch`, so the whole deduction is atomic and
   * costs a single round trip. The ledger rows are handed back rather than
   * written, so the caller can commit them in the same batch as the order --
   * if that batch fails, the movement rows never exist and only the stock
   * needs restoring.
   */
  async claim(
    restaurantId: string,
    items: OrderedItem[],
    context: { orderId?: string | SQL<string>; userId?: string } = {},
  ): Promise<ClaimResult> {
    const required = await this.resolveRequirements(restaurantId, items);
    if (required.size === 0) return EMPTY;

    return this.applyDeltas(
      restaurantId,
      [...required].map(([ingredientId, quantity]) => ({
        ingredientId,
        delta: -quantity,
      })),
      "order_consumption",
      context,
    );
  }

  /**
   * Put back exactly what an order took.
   *
   * The amounts come from the ledger, not from the recipe: a BOM edited
   * between the order and the cancellation would otherwise return a different
   * figure than was deducted, and "cancelling restores the original stock" is
   * the property this has to hold.
   *
   * Netting every movement for the order also makes this idempotent -- a
   * second cancellation sees consumption and reversal summing to zero and
   * writes nothing.
   */
  async restoreForOrder(
    restaurantId: string,
    orderId: string,
    context: { userId?: string } = {},
  ): Promise<ClaimResult> {
    const outstanding = await this.db
      .select({
        ingredientId: ingredientStockMovements.ingredientId,
        net: sql<number>`SUM(${ingredientStockMovements.delta})`,
      })
      .from(ingredientStockMovements)
      .where(
        and(
          eq(ingredientStockMovements.orderId, orderId),
          eq(ingredientStockMovements.restaurantId, restaurantId),
        ),
      )
      .groupBy(ingredientStockMovements.ingredientId)
      .having(sql`SUM(${ingredientStockMovements.delta}) != 0`);

    if (outstanding.length === 0) return EMPTY;

    return this.applyDeltas(
      restaurantId,
      outstanding.map((row) => ({
        ingredientId: row.ingredientId,
        delta: -row.net,
      })),
      "order_cancellation",
      { orderId, userId: context.userId },
    );
  }

  /**
   * Undo a stock change whose batch never committed -- in either direction.
   * The ledger rows that went with it died in the same batch, so this writes
   * none of its own and the ledger simply never saw the attempt.
   */
  async revertUncommitted(
    restaurantId: string,
    claims: IngredientClaim[],
  ): Promise<void> {
    if (claims.length === 0) return;

    await this.applyDeltas(
      restaurantId,
      claims.map((claim) => ({
        ingredientId: claim.ingredientId,
        delta: -claim.delta,
      })),
      "order_cancellation",
      {},
      { recordMovements: false },
    );
  }

  /**
   * What the ordered dishes consume, aggregated by ingredient.
   *
   * Optional recipe rows are included: `loadBOM` in IngredientForecastService
   * counts them too, and a forecast that expects an ingredient to be consumed
   * while the deduction skips it would drift apart by design.
   */
  private async resolveRequirements(
    restaurantId: string,
    items: OrderedItem[],
  ): Promise<Map<number, number>> {
    const required = new Map<number, number>();
    const menuItemIds = [...new Set(items.map((item) => item.menuItemId))];
    if (menuItemIds.length === 0) return required;

    const rows = await this.db
      .select({
        menuItemId: menuItemIngredients.menuItemId,
        ingredientId: menuItemIngredients.ingredientId,
        quantityPerServing: menuItemIngredients.quantityPerServing,
        recipeUnit: menuItemIngredients.unit,
        stockUnit: ingredientDefinitions.unit,
      })
      .from(menuItemIngredients)
      .innerJoin(
        ingredientDefinitions,
        eq(menuItemIngredients.ingredientId, ingredientDefinitions.id),
      )
      .innerJoin(menuItems, eq(menuItemIngredients.menuItemId, menuItems.id))
      .where(
        and(
          inArray(menuItemIngredients.menuItemId, menuItemIds),
          // Both sides are scoped: an ingredient id is a global autoincrement,
          // so the dish's restaurant alone does not establish that the
          // ingredient belongs here (#265).
          eq(menuItems.restaurantId, restaurantId),
          eq(ingredientDefinitions.restaurantId, restaurantId),
          eq(ingredientDefinitions.isActive, true),
          isNull(ingredientDefinitions.deletedAt),
        ),
      );

    const perDish = new Map<number, typeof rows>();
    for (const row of rows) {
      const list = perDish.get(row.menuItemId) ?? [];
      list.push(row);
      perDish.set(row.menuItemId, list);
    }

    for (const item of items) {
      for (const row of perDish.get(item.menuItemId) ?? []) {
        // The recipe and the stock figure are two free-text units. Subtracting
        // 200 (g) from 20 (kg) would read as a 180 kg deficit and poison the
        // forecast that consumes this number, so a mismatch is skipped rather
        // than guessed at. setRecipe rejects new mismatches; this covers rows
        // written before it did.
        if (!unitsMatch(row.recipeUnit, row.stockUnit)) {
          console.warn(
            `[IngredientConsumption] skipped ingredient ${row.ingredientId} for menu item ${row.menuItemId}: recipe unit "${row.recipeUnit}" does not match stock unit "${row.stockUnit}"`,
          );
          continue;
        }

        const consumed = row.quantityPerServing * item.quantity;
        if (consumed === 0) continue;
        required.set(
          row.ingredientId,
          (required.get(row.ingredientId) ?? 0) + consumed,
        );
      }
    }

    return required;
  }

  private async applyDeltas(
    restaurantId: string,
    deltas: { ingredientId: number; delta: number }[],
    reason: "order_consumption" | "order_cancellation",
    context: { orderId?: string | SQL<string>; userId?: string },
    options: { recordMovements?: boolean } = {},
  ): Promise<ClaimResult> {
    const statements = deltas.map(
      ({ ingredientId, delta }) =>
        this.db
          .update(ingredientDefinitions)
          .set({
            // NULL means untracked, and it stays untracked.
            currentStock: sql`CASE WHEN ${ingredientDefinitions.currentStock} IS NULL THEN NULL ELSE ${ingredientDefinitions.currentStock} + ${delta} END`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(ingredientDefinitions.id, ingredientId),
              eq(ingredientDefinitions.restaurantId, restaurantId),
              isNull(ingredientDefinitions.deletedAt),
            ),
          )
          .returning({
            id: ingredientDefinitions.id,
            currentStock: ingredientDefinitions.currentStock,
          }) as BatchItem<"sqlite">,
    );

    const results = (await this.db.batch(
      statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
    )) as Array<Array<{ id: number; currentStock: number | null }>>;

    const claims: IngredientClaim[] = [];
    const movements: (typeof ingredientStockMovements.$inferInsert)[] = [];
    const now = new Date();

    results.forEach((rows, index) => {
      const updated = rows?.[0];
      // No row means the ingredient was deleted between the read and the
      // write; a NULL balance means it is untracked. Neither is a claim, and
      // neither gets a ledger row -- a movement with no balance would be a
      // number nobody can reconcile.
      if (!updated || updated.currentStock === null) return;

      const { ingredientId, delta } = deltas[index];
      claims.push({
        ingredientId,
        delta,
        balanceAfter: updated.currentStock,
      });
      if (options.recordMovements === false) return;
      movements.push({
        restaurantId,
        ingredientId,
        delta,
        balanceAfter: updated.currentStock,
        reason,
        orderId: (context.orderId ?? null) as string | null,
        createdBy: context.userId ?? null,
        createdAt: now,
      });
    });

    const movementWrites: MovementInsert[] =
      movements.length > 0
        ? [
            this.db
              .insert(ingredientStockMovements)
              .values(movements) as BatchItem<"sqlite">,
          ]
        : [];

    return { claims, movementWrites };
  }
}
