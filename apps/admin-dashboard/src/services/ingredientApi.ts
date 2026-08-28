import { api } from "./api";
import type {
  StockMovement,
  ManualStockMovementReason,
  IngredientDefinitionResponse,
  CreateIngredientRequest,
  UpdateIngredientRequest,
  RecipeEntryResponse,
  SetRecipeRequest,
} from "@makanmasak/shared-types";

export const ingredientApi = {
  // --- Ingredient CRUD ---

  async list(
    restaurantId: string,
    params?: {
      lowStock?: boolean;
      page?: number;
      limit?: number;
      category?: string;
      search?: string;
      includeInactive?: boolean;
    },
  ): Promise<{
    items: IngredientDefinitionResponse[];
    total: number;
  }> {
    const queryParams: Record<string, string> = {};
    if (params?.page) queryParams.page = String(params.page);
    if (params?.limit) queryParams.limit = String(params.limit);
    if (params?.category) queryParams.category = params.category;
    if (params?.search) queryParams.search = params.search;
    if (params?.includeInactive) queryParams.includeInactive = "true";
    if (params?.lowStock) queryParams.lowStock = "true";

    const res = await api.get<{
      items: IngredientDefinitionResponse[];
      total: number;
    }>(`/ingredients/${restaurantId}`, queryParams);
    return res.data.data!;
  },

  async get(
    restaurantId: string,
    id: number,
  ): Promise<IngredientDefinitionResponse> {
    const res = await api.get<{
      ingredient: IngredientDefinitionResponse;
    }>(`/ingredients/${restaurantId}/${id}`);
    return res.data.data!.ingredient;
  },

  async create(
    restaurantId: string,
    data: CreateIngredientRequest,
  ): Promise<IngredientDefinitionResponse> {
    const res = await api.post<{
      ingredient: IngredientDefinitionResponse;
    }>(`/ingredients/${restaurantId}`, data);
    return res.data.data!.ingredient;
  },

  async update(
    restaurantId: string,
    id: number,
    data: UpdateIngredientRequest,
  ): Promise<IngredientDefinitionResponse> {
    const res = await api.put<{
      ingredient: IngredientDefinitionResponse;
    }>(`/ingredients/${restaurantId}/${id}`, data);
    return res.data.data!.ingredient;
  },

  async updateStock(
    restaurantId: string,
    id: number,
    quantity: number,
  ): Promise<void> {
    await api.patch(`/ingredients/${restaurantId}/${id}/stock`, { quantity });
  },

  /**
   * Signed delta for an explained purchase, write-off, correction, or transfer.
   * The legacy absolute endpoint remains available and records a correction.
   */
  async adjustStock(
    restaurantId: string,
    id: number,
    input: {
      delta: number;
      reason: ManualStockMovementReason;
      note?: string | null;
    },
  ): Promise<IngredientDefinitionResponse> {
    const res = await api.post<IngredientDefinitionResponse>(
      `/ingredients/${restaurantId}/${id}/movements`,
      input,
    );
    return res.data.data!;
  },

  async listMovements(
    restaurantId: string,
    id: number,
  ): Promise<StockMovement[]> {
    const res = await api.get<{ movements: StockMovement[] }>(
      `/ingredients/${restaurantId}/${id}/movements`,
    );
    return res.data.data!.movements;
  },

  async remove(restaurantId: string, id: number): Promise<void> {
    await api.delete(`/ingredients/${restaurantId}/${id}`);
  },

  async bulkImport(
    restaurantId: string,
    ingredients: CreateIngredientRequest[],
  ): Promise<{ imported: number }> {
    const res = await api.post<{ imported: number }>(
      `/ingredients/${restaurantId}/bulk`,
      { ingredients },
    );
    return res.data.data!;
  },

  async getCategories(restaurantId: string): Promise<string[]> {
    const res = await api.get<{ categories: string[] }>(
      `/ingredients/${restaurantId}/categories`,
    );
    return res.data.data!.categories;
  },

  // --- Recipe CRUD ---

  async getRecipe(
    restaurantId: string,
    menuItemId: number,
  ): Promise<RecipeEntryResponse[]> {
    const res = await api.get<{ recipe: RecipeEntryResponse[] }>(
      `/ingredients/${restaurantId}/recipes/${menuItemId}`,
    );
    return res.data.data!.recipe;
  },

  async setRecipe(
    restaurantId: string,
    menuItemId: number,
    data: SetRecipeRequest,
  ): Promise<void> {
    await api.put(`/ingredients/${restaurantId}/recipes/${menuItemId}`, data);
  },

  async validateRecipe(
    restaurantId: string,
    menuItemId: number,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const res = await api.post<{ valid: boolean; errors: string[] }>(
      `/ingredients/${restaurantId}/recipes/${menuItemId}/validate`,
    );
    return res.data.data!;
  },

  /**
   * Dishes to choose from when editing a recipe.
   *
   * getMissingRecipes only returns the ones WITHOUT a recipe, so on its own it
   * makes a recipe editable exactly once — set it, and the dish drops off the
   * list forever. The menu read returns every item (an authenticated owner
   * sees unavailable ones too), and the two are diffed to mark which still
   * need a recipe.
   */
  async listMenuItems(
    restaurantId: string,
  ): Promise<{ id: number; name: string }[]> {
    const res = await api.get<{
      menuItems: { id: number; name: string }[];
    }>(`/menu/${restaurantId}`);
    return (res.data.data?.menuItems ?? []).map((item) => ({
      id: item.id,
      name: item.name,
    }));
  },

  async getMissingRecipes(
    restaurantId: string,
  ): Promise<{ id: number; name: string }[]> {
    const res = await api.get<{
      menuItems: { id: number; name: string }[];
    }>(`/ingredients/${restaurantId}/recipes/missing`);
    return res.data.data!.menuItems;
  },
};
