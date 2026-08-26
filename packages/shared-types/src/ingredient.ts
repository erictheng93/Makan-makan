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
/**
 * What the admin ingredient form emits: name and unit are always present
 * (both are required inputs), while the optional numerics carry `null` to mean
 * "the owner cleared this". The create endpoint rejects null and the update
 * endpoint uses it to clear, so the form picks per mode and the caller narrows
 * to the matching request type.
 */
export type IngredientFormPayload = Omit<
  CreateIngredientRequest,
  "category" | "costPerUnit" | "supplier" | "minStockLevel" | "currentStock"
> &
  Pick<
    UpdateIngredientRequest,
    "category" | "costPerUnit" | "supplier" | "minStockLevel" | "currentStock"
  >;

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

// --- Stock movements (#277) ---

/**
 * Open in the database so a later writer (order consumption, #278) can add its
 * own tag without a migration; closed at the API boundary so nothing an owner
 * types lands in the column.
 */
export const STOCK_MOVEMENT_REASONS = [
  "purchase",
  "waste",
  "correction",
  "transfer",
] as const;

export type StockMovementReason = (typeof STOCK_MOVEMENT_REASONS)[number];

export interface StockMovement {
  id: number;
  /** Signed: positive receives, negative consumes or writes off. */
  delta: number;
  /** Stock after this movement, so history reads without re-summing. */
  balanceAfter: number;
  reason: string;
  note: string | null;
  createdAt: string | number | Date;
}
