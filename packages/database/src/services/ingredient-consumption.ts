import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
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

/** Rows the caller appends to its own batch so they commit with the order. */
export type MovementInsert = BatchItem<"sqlite">;

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
   * Returns UPDATE and ledger statements for the owning order mutation to
   * commit together in one D1 batch. This service never writes stock alone.
   */
  async buildConsumptionWrites(
    restaurantId: string,
    items: OrderedItem[],
    context: { orderId?: string | SQL<string>; userId?: string } = {},
  ): Promise<MovementInsert[]> {
    const required = await this.resolveRequirements(restaurantId, items);
    if (required.size === 0) return [];

    return this.buildDeltaWrites(
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
   * Put back what a shrinking or removed order line took.
   *
   * Unlike `buildRestoreWritesForOrder` this re-derives the amount from the
   * recipe rather than netting the ledger, because the ledger only records an
   * `order_id` -- there is no per-order-item reference to net against. A BOM
   * edited between the order and the change therefore returns today's figure,
   * not the one deducted. That is the accepted cost of not adding an
   * `order_item_id` column; the whole-order restore still nets correctly
   * afterwards, because the positive rows written here reduce the outstanding
   * sum the same way the negative ones raised it.
   *
   * ponytail: recipe-derived, not ledger-derived. Add
   * `ingredient_stock_movements.order_item_id` and net per item if BOM churn
   * during an open order ever produces a real drift complaint.
   */
  async buildRestoreWritesForItems(
    restaurantId: string,
    items: OrderedItem[],
    context: { orderId?: string; userId?: string } = {},
  ): Promise<MovementInsert[]> {
    const required = await this.resolveRequirements(restaurantId, items);
    if (required.size === 0) return [];

    return this.buildDeltaWrites(
      restaurantId,
      [...required].map(([ingredientId, quantity]) => ({
        ingredientId,
        delta: quantity,
      })),
      "order_item_removal",
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
  async buildRestoreWritesForOrder(
    restaurantId: string,
    orderId: string,
    context: { userId?: string } = {},
  ): Promise<MovementInsert[]> {
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

    if (outstanding.length === 0) return [];

    return this.buildDeltaWrites(
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
        currentStock: ingredientDefinitions.currentStock,
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
        if (row.currentStock === null) continue;
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

  private async buildDeltaWrites(
    restaurantId: string,
    deltas: { ingredientId: number; delta: number }[],
    reason: "order_consumption" | "order_cancellation" | "order_item_removal",
    context: { orderId?: string | SQL<string>; userId?: string },
  ): Promise<MovementInsert[]> {
    const now = new Date();
    return deltas.flatMap(({ ingredientId, delta }) => [
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
            isNotNull(ingredientDefinitions.currentStock),
          ),
        ) as BatchItem<"sqlite">,
      // INSERT ... SELECT shares the same live-row predicate as the UPDATE.
      // A deleted or newly-untracked ingredient therefore produces neither a
      // ledger row nor a nullable balance_after constraint failure.
      this.db.insert(ingredientStockMovements).select(
        this.db
          .select({
            id: sql<number>`NULL`.as("id"),
            restaurantId: sql<string>`${restaurantId}`.as("restaurant_id"),
            ingredientId: sql<number>`${ingredientId}`.as("ingredient_id"),
            delta: sql<number>`${delta}`.as("delta"),
            balanceAfter: ingredientDefinitions.currentStock,
            reason: sql<string>`${reason}`.as("reason"),
            note: sql<string | null>`NULL`.as("note"),
            orderId: sql<string | null>`${context.orderId ?? null}`.as(
              "order_id",
            ),
            createdBy: sql<string | null>`${context.userId ?? null}`.as(
              "created_by",
            ),
            createdAt: sql<Date>`${now.getTime()}`.as("created_at_ms"),
          })
          .from(ingredientDefinitions)
          .where(
            and(
              eq(ingredientDefinitions.id, ingredientId),
              eq(ingredientDefinitions.restaurantId, restaurantId),
              isNull(ingredientDefinitions.deletedAt),
              isNotNull(ingredientDefinitions.currentStock),
            ),
          ),
      ) as BatchItem<"sqlite">,
    ]);
  }
}
