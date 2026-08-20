// Ingredient & Recipe shared types (API contract between backend and frontend)

// --- Ingredient Definitions ---

export interface IngredientDefinitionResponse {
  id: number;
  name: string;
  unit: string;
  category: string | null;
  costPerUnit: number | null;
  supplier: string | null;
  minStockLevel: number | null;
  currentStock: number | null;
  isActive: boolean;
}

export interface CreateIngredientRequest {
  name: string;
  unit: string;
  category?: string;
  costPerUnit?: number;
  supplier?: string;
  minStockLevel?: number;
  currentStock?: number;
}

/**
 * `null` clears an optional field; omitting it leaves the stored value alone.
 * `IngredientService.update` distinguishes the two via `!== undefined` before
 * falling back to `?? null`, and `ingredient_definitions` stores these columns
 * nullable, so the request type has to admit null for clearing to be reachable.
 */
export type UpdateIngredientRequest = {
  name?: string;
  unit?: string;
  category?: string | null;
  costPerUnit?: number | null;
  supplier?: string | null;
  minStockLevel?: number | null;
  currentStock?: number | null;
};

export interface BulkImportRequest {
  ingredients: CreateIngredientRequest[];
}

// --- Recipe (BOM) ---

export interface RecipeEntryResponse {
  ingredientId: number;
  ingredientName: string;
  quantityPerServing: number;
  unit: string;
  isOptional: boolean;
}

export interface SetRecipeRequest {
  ingredients: {
    ingredientId: number;
    quantityPerServing: number;
    unit: string;
    isOptional?: boolean;
  }[];
}

// --- Ingredient Forecast ---

export interface IngredientForecastContributingItem {
  menuItemId: number;
  menuItemName: string;
  quantity: number;
}

export interface IngredientForecastItem {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  predictedQuantity: number;
  confidence: number;
  contributingItems: IngredientForecastContributingItem[];
  currentStock?: number;
  gap?: number;
}

export interface IngredientForecastResult {
  date: string;
  ingredients: IngredientForecastItem[];
  generatedBy: "statistical" | "ai_enhanced";
  metadata: {
    dataSourceDays: number;
    model: string;
    generatedAt: string;
  };
}
