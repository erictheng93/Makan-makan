import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray, isNull, notInArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import {
  menuItemIngredients,
  ingredientDefinitions,
  menuItems,
} from "@makanmasak/database";
import { badRequest, notFound } from "../../../shared/utils/api-error";
import type { RecipeEntryResponse } from "../types";

/**
 * Recipes are addressed by `menuItemId`, which is a global autoincrement key,
 * while the route only proves the caller owns the `restaurantId` in the PATH.
 * Those are two different resources: an owner supplying their own restaurantId
 * and someone else's menuItemId passed the route guard and reached a query
 * scoped by `menu_item_id` alone, so they could read and overwrite another
 * restaurant's recipe by counting upward from id 1 (#265).
 *
 * Every method therefore takes the restaurantId and scopes on it here. The
 * route guard stays as the tenancy boundary for the path; this is the boundary
 * for the second identifier, which the route cannot check.
 */
export class RecipeService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * Resolve the menu item within the caller's restaurant, or 404.
   *
   * Deliberately notFound rather than forbidden: telling an attacker that the
   * id exists but belongs to someone else is itself a disclosure, and they
   * already control the only other input.
   */
  private async assertMenuItemInRestaurant(
    restaurantId: string,
    menuItemId: number,
  ): Promise<void> {
    const [row] = await this.db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.id, menuItemId),
          eq(menuItems.restaurantId, restaurantId),
        ),
      )
      .limit(1);

    if (!row) {
      throw notFound("Menu item not found", "MENU_ITEM_NOT_FOUND");
    }
  }

  async getRecipe(
    restaurantId: string,
    menuItemId: number,
  ): Promise<RecipeEntryResponse[]> {
    await this.assertMenuItemInRestaurant(restaurantId, menuItemId);

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
    restaurantId: string,
    menuItemId: number,
    entries: {
      ingredientId: number;
      quantityPerServing: number;
      unit: string;
      isOptional?: boolean;
    }[],
  ): Promise<void> {
    await this.assertMenuItemInRestaurant(restaurantId, menuItemId);

    // The body carries ingredient ids too, and they are the same shape of
    // unchecked second identifier: without this an owner could compose their
    // own dish out of another restaurant's ingredient rows, which then feed
    // that restaurant's forecast and purchasing through explodeForecast.
    const ingredientIds = [...new Set(entries.map((e) => e.ingredientId))];
    if (ingredientIds.length > 0) {
      const owned = await this.db
        .select({ id: ingredientDefinitions.id })
        .from(ingredientDefinitions)
        .where(
          and(
            inArray(ingredientDefinitions.id, ingredientIds),
            eq(ingredientDefinitions.restaurantId, restaurantId),
          ),
        );

      if (owned.length !== ingredientIds.length) {
        throw badRequest(
          "Recipe references an ingredient that does not belong to this restaurant",
          "INGREDIENT_NOT_IN_RESTAURANT",
        );
      }
    }

    const now = new Date();

    const writes: BatchItem<"sqlite">[] = [
      this.db
        .delete(menuItemIngredients)
        .where(
          eq(menuItemIngredients.menuItemId, menuItemId),
        ) as BatchItem<"sqlite">,
    ];

    if (entries.length > 0) {
      writes.push(
        this.db.insert(menuItemIngredients).values(
          entries.map((entry) => ({
            menuItemId,
            ingredientId: entry.ingredientId,
            quantityPerServing: entry.quantityPerServing,
            unit: entry.unit,
            isOptional: entry.isOptional ?? false,
            createdAt: now,
            updatedAt: now,
          })),
        ) as BatchItem<"sqlite">,
      );
    }

    await this.db.batch(
      writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
    );
  }

  async validateRecipe(
    restaurantId: string,
    menuItemId: number,
  ): Promise<{ valid: boolean; errors: string[] }> {
    await this.assertMenuItemInRestaurant(restaurantId, menuItemId);

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

  /**
   * Scoped by restaurant because the caller uses the result as a blocking
   * message: the delete route lists the dish names back to the owner, so an
   * unscoped query leaked another restaurant's menu through a 409.
   */
  async getIngredientUsage(
    restaurantId: string,
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
          eq(menuItems.restaurantId, restaurantId),
          isNull(menuItems.deletedAt),
        ),
      )
      .orderBy(menuItems.name);

    return rows;
  }
}
