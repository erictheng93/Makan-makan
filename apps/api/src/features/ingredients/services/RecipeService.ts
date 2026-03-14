import type { RecipeEntryResponse } from "../types";

interface RecipeRow {
  id: number;
  menu_item_id: number;
  ingredient_id: number;
  quantity_per_serving: number;
  unit: string;
  is_optional: number;
  ingredient_name?: string;
}

export class RecipeService {
  constructor(private db: D1Database) {}

  async getRecipe(menuItemId: number): Promise<RecipeEntryResponse[]> {
    const rows = await this.db
      .prepare(
        `SELECT mii.*, id_def.name as ingredient_name
         FROM menu_item_ingredients mii
         JOIN ingredient_definitions id_def ON mii.ingredient_id = id_def.id
         WHERE mii.menu_item_id = ?
         ORDER BY id_def.name`,
      )
      .bind(menuItemId)
      .all<RecipeRow>();

    return rows.results.map((row) => ({
      ingredientId: row.ingredient_id,
      ingredientName: row.ingredient_name || "",
      quantityPerServing: row.quantity_per_serving,
      unit: row.unit,
      isOptional: row.is_optional === 1,
    }));
  }

  async setRecipe(
    menuItemId: number,
    entries: {
      ingredientId: number;
      quantityPerServing: number;
      unit: string;
      isOptional?: boolean;
    }[],
  ): Promise<void> {
    const now = Date.now();
    const deleteStmt = this.db
      .prepare("DELETE FROM menu_item_ingredients WHERE menu_item_id = ?")
      .bind(menuItemId);

    const insertStatements = entries.map((entry) =>
      this.db
        .prepare(
          `INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_per_serving, unit, is_optional, created_at_ms, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          menuItemId,
          entry.ingredientId,
          entry.quantityPerServing,
          entry.unit,
          entry.isOptional ? 1 : 0,
          now,
          now,
        ),
    );

    await this.db.batch([deleteStmt, ...insertStatements]);
  }

  async validateRecipe(
    menuItemId: number,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const recipe = await this.db
      .prepare(
        "SELECT mii.ingredient_id, id_def.name, id_def.is_active, id_def.deleted_at_ms FROM menu_item_ingredients mii LEFT JOIN ingredient_definitions id_def ON mii.ingredient_id = id_def.id WHERE mii.menu_item_id = ?",
      )
      .bind(menuItemId)
      .all<{
        ingredient_id: number;
        name: string | null;
        is_active: number | null;
        deleted_at_ms: number | null;
      }>();

    if (recipe.results.length === 0) {
      errors.push("No recipe entries found for this menu item");
      return { valid: false, errors };
    }

    for (const row of recipe.results) {
      if (!row.name) {
        errors.push(`Ingredient #${row.ingredient_id} does not exist`);
      } else if (row.deleted_at_ms) {
        errors.push(`Ingredient "${row.name}" has been deleted`);
      } else if (!row.is_active) {
        errors.push(`Ingredient "${row.name}" is inactive`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async getMenuItemsWithoutRecipes(
    restaurantId: string,
  ): Promise<{ id: number; name: string }[]> {
    const rows = await this.db
      .prepare(
        `SELECT mi.id, mi.name
         FROM menu_items mi
         WHERE mi.restaurant_id = ?
         AND mi.is_available = 1
         AND mi.deleted_at_ms IS NULL
         AND mi.id NOT IN (SELECT DISTINCT menu_item_id FROM menu_item_ingredients)
         ORDER BY mi.name`,
      )
      .bind(restaurantId)
      .all<{ id: number; name: string }>();

    return rows.results;
  }

  async getIngredientUsage(
    ingredientId: number,
  ): Promise<{ menuItemId: number; menuItemName: string }[]> {
    const rows = await this.db
      .prepare(
        `SELECT mi.id as menu_item_id, mi.name as menu_item_name
         FROM menu_item_ingredients mii
         JOIN menu_items mi ON mii.menu_item_id = mi.id
         WHERE mii.ingredient_id = ?
         AND mi.deleted_at_ms IS NULL
         ORDER BY mi.name`,
      )
      .bind(ingredientId)
      .all<{ menu_item_id: number; menu_item_name: string }>();

    return rows.results.map((r) => ({
      menuItemId: r.menu_item_id,
      menuItemName: r.menu_item_name,
    }));
  }
}
