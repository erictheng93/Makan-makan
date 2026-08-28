import { drizzle } from "drizzle-orm/d1";
import {
  eq,
  and,
  desc,
  like,
  isNull,
  isNotNull,
  lte,
  sql,
  count,
} from "drizzle-orm";
import {
  ingredientDefinitions,
  ingredientStockMovements,
} from "@makanmasak/database";
import type {
  IngredientDefinitionResponse,
  CreateIngredientRequest,
  UpdateIngredientRequest,
} from "../types";
import type { BatchItem } from "drizzle-orm/batch";
import { fromCents, toCents } from "../../../shared/utils/money";

export class IngredientService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async list(
    restaurantId: string,
    options: {
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      lowStock?: boolean;
      includeInactive?: boolean;
    } = {},
  ): Promise<{ items: IngredientDefinitionResponse[]; total: number }> {
    const {
      page = 1,
      limit = 50,
      category,
      search,
      lowStock,
      includeInactive,
    } = options;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(ingredientDefinitions.restaurantId, restaurantId),
      isNull(ingredientDefinitions.deletedAt),
    ];

    if (!includeInactive) {
      conditions.push(eq(ingredientDefinitions.isActive, true));
    }
    if (category) {
      conditions.push(eq(ingredientDefinitions.category, category));
    }
    if (lowStock) {
      // At or below the threshold, matching the table's badge. Rows without a
      // threshold have nothing to be below and are excluded rather than
      // silently counted as healthy.
      conditions.push(
        and(
          isNotNull(ingredientDefinitions.minStockLevel),
          isNotNull(ingredientDefinitions.currentStock),
          lte(
            ingredientDefinitions.currentStock,
            ingredientDefinitions.minStockLevel,
          ),
        )!,
      );
    }

    if (search) {
      conditions.push(like(ingredientDefinitions.name, `%${search}%`));
    }

    const where = and(...conditions);

    const [countResult] = await this.db
      .select({ total: count() })
      .from(ingredientDefinitions)
      .where(where);
    const total = countResult?.total ?? 0;

    const rows = await this.db
      .select()
      .from(ingredientDefinitions)
      .where(where)
      .orderBy(ingredientDefinitions.name)
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map(rowToResponse),
      total,
    };
  }

  async get(
    restaurantId: string,
    id: number,
  ): Promise<IngredientDefinitionResponse | null> {
    const [row] = await this.db
      .select()
      .from(ingredientDefinitions)
      .where(
        and(
          eq(ingredientDefinitions.id, id),
          eq(ingredientDefinitions.restaurantId, restaurantId),
          isNull(ingredientDefinitions.deletedAt),
        ),
      )
      .limit(1);

    return row ? rowToResponse(row) : null;
  }

  async create(
    restaurantId: string,
    data: CreateIngredientRequest,
  ): Promise<IngredientDefinitionResponse> {
    const now = new Date();
    const [row] = await this.db
      .insert(ingredientDefinitions)
      .values({
        restaurantId,
        name: data.name,
        unit: data.unit,
        category: data.category ?? null,
        costPerUnitCents: toCents(data.costPerUnit),
        supplier: data.supplier ?? null,
        minStockLevel: data.minStockLevel ?? null,
        currentStock: data.currentStock ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return rowToResponse(row);
  }

  async update(
    restaurantId: string,
    id: number,
    data: UpdateIngredientRequest,
    userId?: string,
  ): Promise<IngredientDefinitionResponse | null> {
    const existing = await this.get(restaurantId, id);
    if (!existing) return null;
    if (data.currentStock === null) {
      throw new Error("Tracked stock cannot be cleared");
    }

    const updates: Record<string, unknown> = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.unit !== undefined) updates.unit = data.unit;
    if (data.category !== undefined) updates.category = data.category ?? null;
    if (data.costPerUnit !== undefined) {
      updates.costPerUnitCents = toCents(data.costPerUnit);
    }
    if (data.supplier !== undefined) updates.supplier = data.supplier ?? null;
    if (data.minStockLevel !== undefined)
      updates.minStockLevel = data.minStockLevel ?? null;
    if (data.currentStock !== undefined)
      updates.currentStock = data.currentStock;

    if (Object.keys(updates).length === 0) return existing;

    const movedTo = data.currentStock;
    const stockChanged =
      movedTo !== undefined && movedTo !== existing.currentStock;
    if (stockChanged) {
      const committed = await this.commitStockMovement({
        restaurantId,
        ingredientId: id,
        before: existing.currentStock,
        after: movedTo,
        updates,
        delta: movedTo - (existing.currentStock ?? 0),
        reason: "correction",
        userId,
      });
      if (!committed) return null;
    } else {
      updates.updatedAt = new Date();
      const result = await this.db
        .update(ingredientDefinitions)
        .set(updates)
        .where(
          and(
            eq(ingredientDefinitions.id, id),
            eq(ingredientDefinitions.restaurantId, restaurantId),
            isNull(ingredientDefinitions.deletedAt),
            data.currentStock === undefined
              ? undefined
              : eq(ingredientDefinitions.currentStock, data.currentStock),
          ),
        );
      if ((result.meta?.changes ?? 0) === 0) return null;
    }

    return this.get(restaurantId, id);
  }

  async delete(restaurantId: string, id: number): Promise<boolean> {
    const now = new Date();
    const result = await this.db
      .update(ingredientDefinitions)
      .set({ deletedAt: now, isActive: false, updatedAt: now })
      .where(
        and(
          eq(ingredientDefinitions.id, id),
          eq(ingredientDefinitions.restaurantId, restaurantId),
          isNull(ingredientDefinitions.deletedAt),
        ),
      );

    return (result.meta?.changes ?? 0) > 0;
  }

  async bulkImport(
    restaurantId: string,
    ingredients: CreateIngredientRequest[],
  ): Promise<{ imported: number }> {
    const now = new Date();
    await this.db.insert(ingredientDefinitions).values(
      ingredients.map((data) => ({
        restaurantId,
        name: data.name,
        unit: data.unit,
        category: data.category ?? null,
        costPerUnitCents: toCents(data.costPerUnit),
        supplier: data.supplier ?? null,
        minStockLevel: data.minStockLevel ?? null,
        currentStock: data.currentStock ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })),
    );
    return { imported: ingredients.length };
  }

  async getCategories(restaurantId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ category: ingredientDefinitions.category })
      .from(ingredientDefinitions)
      .where(
        and(
          eq(ingredientDefinitions.restaurantId, restaurantId),
          sql`${ingredientDefinitions.category} IS NOT NULL`,
          isNull(ingredientDefinitions.deletedAt),
          eq(ingredientDefinitions.isActive, true),
        ),
      )
      .orderBy(ingredientDefinitions.category);

    return rows.map((r) => r.category!);
  }

  private async commitStockMovement(entry: {
    restaurantId: string;
    ingredientId: number;
    before: number | null;
    after: number;
    updates?: Record<string, unknown>;
    delta: number;
    reason: string;
    note?: string | null;
    userId?: string;
  }): Promise<boolean> {
    const now = new Date();
    const balanceUpdate = this.db
      .update(ingredientDefinitions)
      .set({
        ...entry.updates,
        currentStock: entry.after,
        updatedAt: now,
      })
      .where(
        and(
          eq(ingredientDefinitions.id, entry.ingredientId),
          eq(ingredientDefinitions.restaurantId, entry.restaurantId),
          isNull(ingredientDefinitions.deletedAt),
          entry.before === null
            ? isNull(ingredientDefinitions.currentStock)
            : eq(ingredientDefinitions.currentStock, entry.before),
        ),
      ) as BatchItem<"sqlite">;

    // D1 batches are transactional. `changes()` gates this INSERT on the
    // immediately preceding conditional UPDATE, while a failed INSERT rolls
    // the balance change back with the rest of the batch.
    const movementInsert = this.db.insert(ingredientStockMovements).select(
      this.db
        .select({
          id: sql<number>`NULL`.as("id"),
          restaurantId: sql<string>`${entry.restaurantId}`.as("restaurant_id"),
          ingredientId: sql<number>`${entry.ingredientId}`.as("ingredient_id"),
          delta: sql<number>`${entry.delta}`.as("delta"),
          balanceAfter: ingredientDefinitions.currentStock,
          reason: sql<string>`${entry.reason}`.as("reason"),
          note: sql<string | null>`${entry.note ?? null}`.as("note"),
          orderId: sql<string | null>`NULL`.as("order_id"),
          createdBy: sql<string | null>`${entry.userId ?? null}`.as(
            "created_by",
          ),
          createdAt: sql<Date>`${now.getTime()}`.as("created_at_ms"),
        })
        .from(ingredientDefinitions)
        .where(
          and(
            eq(ingredientDefinitions.id, entry.ingredientId),
            eq(ingredientDefinitions.restaurantId, entry.restaurantId),
            eq(ingredientDefinitions.currentStock, entry.after),
            sql`changes() = 1`,
          ),
        ),
    ) as BatchItem<"sqlite">;

    const [updateResult] = await this.db.batch([balanceUpdate, movementInsert]);
    return (updateResult.meta?.changes ?? 0) > 0;
  }

  /**
   * Receive or consume stock by a signed delta -- the operation the owner
   * actually performs ("took in 10 kg", "threw away 2 kg"). Absolute updates
   * from the edit form and legacy endpoint are attributed corrections.
   *
   * The UPDATE is conditional on the row still holding the balance we read, so
   * two concurrent adjustments cannot both apply to the same starting figure
   * and lose one of the deltas. The balance and ledger write share one D1 batch.
   */
  async adjustStock(
    restaurantId: string,
    id: number,
    input: { delta: number; reason: string; note?: string | null },
    userId?: string,
  ): Promise<IngredientDefinitionResponse | null> {
    const existing = await this.get(restaurantId, id);
    if (!existing) return null;

    const before = existing.currentStock ?? 0;
    const after = before + input.delta;

    const committed = await this.commitStockMovement({
      restaurantId,
      ingredientId: id,
      before: existing.currentStock,
      after,
      delta: input.delta,
      reason: input.reason,
      note: input.note,
      userId,
    });
    if (!committed) return null;

    return this.get(restaurantId, id);
  }

  async listMovements(
    restaurantId: string,
    id: number,
    limit = 50,
  ): Promise<
    {
      id: number;
      delta: number;
      balanceAfter: number;
      reason: string;
      note: string | null;
      createdAt: Date;
    }[]
  > {
    return this.db
      .select({
        id: ingredientStockMovements.id,
        delta: ingredientStockMovements.delta,
        balanceAfter: ingredientStockMovements.balanceAfter,
        reason: ingredientStockMovements.reason,
        note: ingredientStockMovements.note,
        createdAt: ingredientStockMovements.createdAt,
      })
      .from(ingredientStockMovements)
      .where(
        and(
          eq(ingredientStockMovements.ingredientId, id),
          // Scoped by restaurant as well as ingredient: ingredient ids are a
          // global autoincrement, so the id alone does not identify a tenant
          // (#265).
          eq(ingredientStockMovements.restaurantId, restaurantId),
        ),
      )
      .orderBy(desc(ingredientStockMovements.createdAt))
      .limit(limit);
  }

  async updateStock(
    restaurantId: string,
    id: number,
    quantity: number,
    userId?: string,
  ): Promise<boolean> {
    return (
      (await this.update(
        restaurantId,
        id,
        { currentStock: quantity },
        userId,
      )) !== null
    );
  }
}

function rowToResponse(
  row: typeof ingredientDefinitions.$inferSelect,
): IngredientDefinitionResponse {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    category: row.category,
    costPerUnit:
      row.costPerUnitCents == null ? null : fromCents(row.costPerUnitCents),
    supplier: row.supplier,
    minStockLevel: row.minStockLevel,
    currentStock: row.currentStock,
    isActive: row.isActive,
  };
}
