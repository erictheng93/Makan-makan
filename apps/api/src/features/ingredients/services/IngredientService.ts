import { drizzle } from "drizzle-orm/d1";
import { eq, and, like, isNull, sql, count } from "drizzle-orm";
import { ingredientDefinitions } from "@makanmakan/database";
import type {
  IngredientDefinitionResponse,
  CreateIngredientRequest,
  UpdateIngredientRequest,
} from "../types";
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
      includeInactive?: boolean;
    } = {},
  ): Promise<{ items: IngredientDefinitionResponse[]; total: number }> {
    const { page = 1, limit = 50, category, search, includeInactive } = options;
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
        costPerUnit: data.costPerUnit ?? null,
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
  ): Promise<IngredientDefinitionResponse | null> {
    const existing = await this.get(restaurantId, id);
    if (!existing) return null;

    const updates: Record<string, unknown> = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.unit !== undefined) updates.unit = data.unit;
    if (data.category !== undefined) updates.category = data.category ?? null;
    if (data.costPerUnit !== undefined) {
      updates.costPerUnit = data.costPerUnit ?? null;
      updates.costPerUnitCents = toCents(data.costPerUnit);
    }
    if (data.supplier !== undefined) updates.supplier = data.supplier ?? null;
    if (data.minStockLevel !== undefined)
      updates.minStockLevel = data.minStockLevel ?? null;
    if (data.currentStock !== undefined)
      updates.currentStock = data.currentStock ?? null;

    if (Object.keys(updates).length === 0) return existing;

    updates.updatedAt = new Date();

    await this.db
      .update(ingredientDefinitions)
      .set(updates)
      .where(
        and(
          eq(ingredientDefinitions.id, id),
          eq(ingredientDefinitions.restaurantId, restaurantId),
        ),
      );

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
        costPerUnit: data.costPerUnit ?? null,
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

  async updateStock(
    restaurantId: string,
    id: number,
    quantity: number,
  ): Promise<boolean> {
    const result = await this.db
      .update(ingredientDefinitions)
      .set({ currentStock: quantity, updatedAt: new Date() })
      .where(
        and(
          eq(ingredientDefinitions.id, id),
          eq(ingredientDefinitions.restaurantId, restaurantId),
          isNull(ingredientDefinitions.deletedAt),
        ),
      );

    return (result.meta?.changes ?? 0) > 0;
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
      row.costPerUnitCents == null
        ? row.costPerUnit
        : fromCents(row.costPerUnitCents),
    supplier: row.supplier,
    minStockLevel: row.minStockLevel,
    currentStock: row.currentStock,
    isActive: row.isActive,
  };
}
