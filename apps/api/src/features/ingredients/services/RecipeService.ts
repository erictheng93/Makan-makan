import { drizzle } from "drizzle-orm/d1";
import { eq, and, isNull, notInArray } from "drizzle-orm";
import {
  menuItemIngredients,
  ingredientDefinitions,
  menuItems,
} from "@makanmakan/database";
import type { RecipeEntryResponse } from "../types";

export class RecipeService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async getRecipe(menuItemId: number): Promise<RecipeEntryResponse[]> {
    const rows = await this.db
      .select({
        ingredientId: menuItemIngredients.ingredientId,
        ingredientName: ingredientDefinitions.name,
        quantityPerServing: menuItemIngredients.quantityPerServing,
        unit: menuItemIngredients.unit,
        isOptional: menuItemIngredients.isOptional,
      })
      .from(menuItemIngredients)
      .innerJoin(
        ingredientDefinitions,
        eq(menuItemIngredients.ingredientId, ingredientDefinitions.id),
      )
      .where(eq(menuItemIngredients.menuItemId, menuItemId))
      .orderBy(ingredientDefinitions.name);

    return rows.map((row) => ({
      ingredientId: row.ingredientId,
      ingredientName: row.ingredientName || "",
      quantityPerServing: row.quantityPerServing,
      unit: row.unit,
      isOptional: row.isOptional,
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
    const now = new Date();

    await this.db.transaction(async (tx) => {
      await tx
        .delete(menuItemIngredients)
        .where(eq(menuItemIngredients.menuItemId, menuItemId));

      if (entries.length > 0) {
        await tx.insert(menuItemIngredients).values(
          entries.map((entry) => ({
            menuItemId,
            ingredientId: entry.ingredientId,
            quantityPerServing: entry.quantityPerServing,
            unit: entry.unit,
            isOptional: entry.isOptional ?? false,
            createdAt: now,
            updatedAt: now,
          })),
        );
      }
    });
  }

  async validateRecipe(
    menuItemId: number,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const recipe = await this.db
      .select({
        ingredientId: menuItemIngredients.ingredientId,
        name: ingredientDefinitions.name,
        isActive: ingredientDefinitions.isActive,
        deletedAt: ingredientDefinitions.deletedAt,
      })
      .from(menuItemIngredients)
      .leftJoin(
        ingredientDefinitions,
        eq(menuItemIngredients.ingredientId, ingredientDefinitions.id),
      )
      .where(eq(menuItemIngredients.menuItemId, menuItemId));

    if (recipe.length === 0) {
      errors.push("No recipe entries found for this menu item");
      return { valid: false, errors };
    }

    for (const row of recipe) {
      if (!row.name) {
        errors.push(`Ingredient #${row.ingredientId} does not exist`);
      } else if (row.deletedAt) {
        errors.push(`Ingredient "${row.name}" has been deleted`);
      } else if (!row.isActive) {
        errors.push(`Ingredient "${row.name}" is inactive`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async getMenuItemsWithoutRecipes(
    restaurantId: string,
  ): Promise<{ id: number; name: string }[]> {
    const usedMenuItemIds = this.db
      .selectDistinct({ menuItemId: menuItemIngredients.menuItemId })
      .from(menuItemIngredients);

    return this.db
      .select({ id: menuItems.id, name: menuItems.name })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.restaurantId, restaurantId),
          eq(menuItems.isAvailable, true),
          isNull(menuItems.deletedAt),
          notInArray(menuItems.id, usedMenuItemIds),
        ),
      )
      .orderBy(menuItems.name);
  }

  async getIngredientUsage(
    ingredientId: number,
  ): Promise<{ menuItemId: number; menuItemName: string }[]> {
    const rows = await this.db
      .select({
        menuItemId: menuItems.id,
        menuItemName: menuItems.name,
      })
      .from(menuItemIngredients)
      .innerJoin(menuItems, eq(menuItemIngredients.menuItemId, menuItems.id))
      .where(
        and(
          eq(menuItemIngredients.ingredientId, ingredientId),
          isNull(menuItems.deletedAt),
        ),
      )
      .orderBy(menuItems.name);

    return rows;
  }
}
