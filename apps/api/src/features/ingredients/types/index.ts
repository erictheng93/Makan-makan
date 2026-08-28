// Re-export shared types (API contract)
export type {
  IngredientDefinitionResponse,
  CreateIngredientRequest,
  UpdateIngredientRequest,
  BulkImportRequest,
  RecipeEntryResponse,
  SetRecipeRequest,
} from "@makanmasak/shared-types";

import type {
  IngredientDefinitionResponse,
  RecipeEntryResponse,
} from "@makanmasak/shared-types";

// API-only types (service internals)

export interface IngredientListOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  includeInactive?: boolean;
}

export interface IIngredientService {
  list(
    restaurantId: string,
    options?: IngredientListOptions,
  ): Promise<{ items: IngredientDefinitionResponse[]; total: number }>;
  get(
    restaurantId: string,
    id: number,
  ): Promise<IngredientDefinitionResponse | null>;
  create(
    restaurantId: string,
    data: {
      name: string;
      unit: string;
      category?: string;
      costPerUnit?: number;
      supplier?: string;
      minStockLevel?: number;
      currentStock?: number;
    },
  ): Promise<IngredientDefinitionResponse>;
  update(
    restaurantId: string,
    id: number,
    data: Partial<{
      name: string;
      unit: string;
      category?: string;
      costPerUnit?: number;
      supplier?: string;
      minStockLevel?: number;
      currentStock?: number;
    }>,
  ): Promise<IngredientDefinitionResponse | null>;
  delete(restaurantId: string, id: number): Promise<boolean>;
  getCategories(restaurantId: string): Promise<string[]>;
  updateStock(
    restaurantId: string,
    id: number,
    quantity: number,
    userId?: string,
  ): Promise<boolean>;
}

/**
 * Every method takes `restaurantId` first. `menuItemId` and `ingredientId` are
 * global autoincrement keys, so they identify a row without identifying a
 * tenant — the route guard only proves the caller owns the restaurantId in the
 * path, and cannot vouch for a second id supplied alongside it (#265).
 */
export interface IRecipeService {
  getRecipe(
    restaurantId: string,
    menuItemId: number,
  ): Promise<RecipeEntryResponse[]>;
  setRecipe(
    restaurantId: string,
    menuItemId: number,
    entries: {
      ingredientId: number;
      quantityPerServing: number;
      unit: string;
      isOptional?: boolean;
    }[],
  ): Promise<void>;
  validateRecipe(
    restaurantId: string,
    menuItemId: number,
  ): Promise<{ valid: boolean; errors: string[] }>;
  getMenuItemsWithoutRecipes(
    restaurantId: string,
  ): Promise<{ id: number; name: string }[]>;
  getIngredientUsage(
    restaurantId: string,
    ingredientId: number,
  ): Promise<{ menuItemId: number; menuItemName: string }[]>;
}
