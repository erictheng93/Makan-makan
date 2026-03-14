import type {
  IngredientDefinitionResponse,
  CreateIngredientRequest,
  UpdateIngredientRequest,
} from "../types";

interface IngredientRow {
  id: number;
  restaurant_id: string;
  name: string;
  unit: string;
  category: string | null;
  cost_per_unit: number | null;
  supplier: string | null;
  min_stock_level: number | null;
  current_stock: number | null;
  is_active: number;
  deleted_at_ms: number | null;
}

function rowToResponse(row: IngredientRow): IngredientDefinitionResponse {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    category: row.category,
    costPerUnit: row.cost_per_unit,
    supplier: row.supplier,
    minStockLevel: row.min_stock_level,
    currentStock: row.current_stock,
    isActive: row.is_active === 1,
  };
}

export class IngredientService {
  constructor(private db: D1Database) {}

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

    let whereClause = "WHERE restaurant_id = ? AND deleted_at_ms IS NULL";
    const params: (string | number)[] = [restaurantId];

    if (!includeInactive) {
      whereClause += " AND is_active = 1";
    }
    if (category) {
      whereClause += " AND category = ?";
      params.push(category);
    }
    if (search) {
      whereClause += " AND name LIKE ?";
      params.push(`%${search}%`);
    }

    const countResult = await this.db
      .prepare(
        `SELECT COUNT(*) as total FROM ingredient_definitions ${whereClause}`,
      )
      .bind(...params)
      .first<{ total: number }>();
    const total = countResult?.total || 0;

    const rows = await this.db
      .prepare(
        `SELECT * FROM ingredient_definitions ${whereClause} ORDER BY name ASC LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all<IngredientRow>();

    return {
      items: rows.results.map(rowToResponse),
      total,
    };
  }

  async get(
    restaurantId: string,
    id: number,
  ): Promise<IngredientDefinitionResponse | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM ingredient_definitions WHERE id = ? AND restaurant_id = ? AND deleted_at_ms IS NULL",
      )
      .bind(id, restaurantId)
      .first<IngredientRow>();

    return row ? rowToResponse(row) : null;
  }

  async create(
    restaurantId: string,
    data: CreateIngredientRequest,
  ): Promise<IngredientDefinitionResponse> {
    const now = Date.now();
    const result = await this.db
      .prepare(
        `INSERT INTO ingredient_definitions (restaurant_id, name, unit, category, cost_per_unit, supplier, min_stock_level, current_stock, is_active, created_at_ms, updated_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(
        restaurantId,
        data.name,
        data.unit,
        data.category ?? null,
        data.costPerUnit ?? null,
        data.supplier ?? null,
        data.minStockLevel ?? null,
        data.currentStock ?? null,
        now,
        now,
      )
      .run();

    const id =
      result.meta?.last_row_id ??
      (result as unknown as { lastRowId: number }).lastRowId;

    return {
      id: Number(id),
      name: data.name,
      unit: data.unit,
      category: data.category ?? null,
      costPerUnit: data.costPerUnit ?? null,
      supplier: data.supplier ?? null,
      minStockLevel: data.minStockLevel ?? null,
      currentStock: data.currentStock ?? null,
      isActive: true,
    };
  }

  async update(
    restaurantId: string,
    id: number,
    data: UpdateIngredientRequest,
  ): Promise<IngredientDefinitionResponse | null> {
    const existing = await this.get(restaurantId, id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name);
    }
    if (data.unit !== undefined) {
      fields.push("unit = ?");
      values.push(data.unit);
    }
    if (data.category !== undefined) {
      fields.push("category = ?");
      values.push(data.category ?? null);
    }
    if (data.costPerUnit !== undefined) {
      fields.push("cost_per_unit = ?");
      values.push(data.costPerUnit ?? null);
    }
    if (data.supplier !== undefined) {
      fields.push("supplier = ?");
      values.push(data.supplier ?? null);
    }
    if (data.minStockLevel !== undefined) {
      fields.push("min_stock_level = ?");
      values.push(data.minStockLevel ?? null);
    }
    if (data.currentStock !== undefined) {
      fields.push("current_stock = ?");
      values.push(data.currentStock ?? null);
    }

    if (fields.length === 0) return existing;

    fields.push("updated_at_ms = ?");
    values.push(Date.now());

    await this.db
      .prepare(
        `UPDATE ingredient_definitions SET ${fields.join(", ")} WHERE id = ? AND restaurant_id = ?`,
      )
      .bind(...values, id, restaurantId)
      .run();

    return this.get(restaurantId, id);
  }

  async delete(restaurantId: string, id: number): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE ingredient_definitions SET deleted_at_ms = ?, is_active = 0, updated_at_ms = ? WHERE id = ? AND restaurant_id = ? AND deleted_at_ms IS NULL",
      )
      .bind(Date.now(), Date.now(), id, restaurantId)
      .run();

    return (result.meta?.changes ?? 0) > 0;
  }

  async bulkImport(
    restaurantId: string,
    ingredients: CreateIngredientRequest[],
  ): Promise<{ imported: number }> {
    const now = Date.now();
    const statements = ingredients.map((data) =>
      this.db
        .prepare(
          `INSERT INTO ingredient_definitions (restaurant_id, name, unit, category, cost_per_unit, supplier, min_stock_level, current_stock, is_active, created_at_ms, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .bind(
          restaurantId,
          data.name,
          data.unit,
          data.category ?? null,
          data.costPerUnit ?? null,
          data.supplier ?? null,
          data.minStockLevel ?? null,
          data.currentStock ?? null,
          now,
          now,
        ),
    );

    await this.db.batch(statements);
    return { imported: ingredients.length };
  }

  async getCategories(restaurantId: string): Promise<string[]> {
    const rows = await this.db
      .prepare(
        "SELECT DISTINCT category FROM ingredient_definitions WHERE restaurant_id = ? AND category IS NOT NULL AND deleted_at_ms IS NULL AND is_active = 1 ORDER BY category",
      )
      .bind(restaurantId)
      .all<{ category: string }>();

    return rows.results.map((r) => r.category);
  }

  async updateStock(
    restaurantId: string,
    id: number,
    quantity: number,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        "UPDATE ingredient_definitions SET current_stock = ?, updated_at_ms = ? WHERE id = ? AND restaurant_id = ? AND deleted_at_ms IS NULL",
      )
      .bind(quantity, Date.now(), id, restaurantId)
      .run();

    return (result.meta?.changes ?? 0) > 0;
  }
}
