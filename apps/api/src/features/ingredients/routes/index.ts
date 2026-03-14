import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { IngredientService } from "../services/IngredientService";
import { RecipeService } from "../services/RecipeService";
import {
  restaurantIdParamSchema,
  ingredientIdParamSchema,
  menuItemIdParamSchema,
  createIngredientSchema,
  updateIngredientSchema,
  bulkImportSchema,
  updateStockSchema,
  setRecipeSchema,
  ingredientListQuerySchema,
} from "../schemas/validation";
import type { Env } from "../../../shared/types";

const routes = new Hono<{ Bindings: Env }>();

// GET /api/v1/ingredients/:restaurantId
routes.get(
  "/:restaurantId",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateQuery(ingredientListQuerySchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const query = c.get("validatedQuery");
      const service = new IngredientService(c.env.DB);

      const result = await service.list(restaurantId, query);

      return c.json({ success: true, data: result });
    } catch (error) {
      console.error("List ingredients error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INGREDIENT_LIST_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to list ingredients",
          },
        },
        500,
      );
    }
  },
);

// POST /api/v1/ingredients/:restaurantId
routes.post(
  "/:restaurantId",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateBody(createIngredientSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const body = c.get("validatedBody");
      const service = new IngredientService(c.env.DB);

      const ingredient = await service.create(restaurantId, body);

      return c.json({ success: true, data: { ingredient } }, 201);
    } catch (error) {
      console.error("Create ingredient error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INGREDIENT_CREATE_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to create ingredient",
          },
        },
        500,
      );
    }
  },
);

// POST /api/v1/ingredients/:restaurantId/bulk
routes.post(
  "/:restaurantId/bulk",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateBody(bulkImportSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const { ingredients } = c.get("validatedBody");
      const service = new IngredientService(c.env.DB);

      const result = await service.bulkImport(restaurantId, ingredients);

      return c.json({ success: true, data: result }, 201);
    } catch (error) {
      console.error("Bulk import error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INGREDIENT_BULK_IMPORT_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to bulk import ingredients",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/ingredients/:restaurantId/categories
routes.get(
  "/:restaurantId/categories",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const service = new IngredientService(c.env.DB);

      const categories = await service.getCategories(restaurantId);

      return c.json({ success: true, data: { categories } });
    } catch (error) {
      console.error("Get categories error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INGREDIENT_CATEGORIES_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get categories",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/ingredients/:restaurantId/recipes/missing
routes.get(
  "/:restaurantId/recipes/missing",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const service = new RecipeService(c.env.DB);

      const menuItems = await service.getMenuItemsWithoutRecipes(restaurantId);

      return c.json({ success: true, data: { menuItems } });
    } catch (error) {
      console.error("Get missing recipes error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "RECIPE_MISSING_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get menu items without recipes",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/ingredients/:restaurantId/:id
routes.get(
  "/:restaurantId/:id",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(ingredientIdParamSchema),
  async (c) => {
    try {
      const { restaurantId, id } = c.get("validatedParams");
      const service = new IngredientService(c.env.DB);

      const ingredient = await service.get(restaurantId, id);
      if (!ingredient) {
        return c.json(
          {
            success: false,
            error: {
              code: "INGREDIENT_NOT_FOUND",
              message: "Ingredient not found",
            },
          },
          404,
        );
      }

      return c.json({ success: true, data: { ingredient } });
    } catch (error) {
      console.error("Get ingredient error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INGREDIENT_GET_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get ingredient",
          },
        },
        500,
      );
    }
  },
);

// PUT /api/v1/ingredients/:restaurantId/:id
routes.put(
  "/:restaurantId/:id",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(ingredientIdParamSchema),
  validateBody(updateIngredientSchema),
  async (c) => {
    try {
      const { restaurantId, id } = c.get("validatedParams");
      const body = c.get("validatedBody");
      const service = new IngredientService(c.env.DB);

      const ingredient = await service.update(restaurantId, id, body);
      if (!ingredient) {
        return c.json(
          {
            success: false,
            error: {
              code: "INGREDIENT_NOT_FOUND",
              message: "Ingredient not found",
            },
          },
          404,
        );
      }

      return c.json({ success: true, data: { ingredient } });
    } catch (error) {
      console.error("Update ingredient error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INGREDIENT_UPDATE_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to update ingredient",
          },
        },
        500,
      );
    }
  },
);

// PATCH /api/v1/ingredients/:restaurantId/:id/stock
routes.patch(
  "/:restaurantId/:id/stock",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(ingredientIdParamSchema),
  validateBody(updateStockSchema),
  async (c) => {
    try {
      const { restaurantId, id } = c.get("validatedParams");
      const { quantity } = c.get("validatedBody");
      const service = new IngredientService(c.env.DB);

      const updated = await service.updateStock(restaurantId, id, quantity);
      if (!updated) {
        return c.json(
          {
            success: false,
            error: {
              code: "INGREDIENT_NOT_FOUND",
              message: "Ingredient not found",
            },
          },
          404,
        );
      }

      return c.json({ success: true, data: { updated: true } });
    } catch (error) {
      console.error("Update stock error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "STOCK_UPDATE_FAILED",
            message:
              error instanceof Error ? error.message : "Failed to update stock",
          },
        },
        500,
      );
    }
  },
);

// DELETE /api/v1/ingredients/:restaurantId/:id
routes.delete(
  "/:restaurantId/:id",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(ingredientIdParamSchema),
  async (c) => {
    try {
      const { restaurantId, id } = c.get("validatedParams");

      // Check if ingredient is used in any recipe
      const recipeService = new RecipeService(c.env.DB);
      const usage = await recipeService.getIngredientUsage(id);
      if (usage.length > 0) {
        const names = usage.map((u) => u.menuItemName).join(", ");
        return c.json(
          {
            success: false,
            error: {
              code: "INGREDIENT_IN_USE",
              message: `Cannot delete: ingredient is used in recipes for: ${names}`,
            },
          },
          409,
        );
      }

      const service = new IngredientService(c.env.DB);
      const deleted = await service.delete(restaurantId, id);
      if (!deleted) {
        return c.json(
          {
            success: false,
            error: {
              code: "INGREDIENT_NOT_FOUND",
              message: "Ingredient not found",
            },
          },
          404,
        );
      }

      return c.json({ success: true, data: { deleted: true } });
    } catch (error) {
      console.error("Delete ingredient error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INGREDIENT_DELETE_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to delete ingredient",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/ingredients/:restaurantId/recipes/:menuItemId
routes.get(
  "/:restaurantId/recipes/:menuItemId",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(menuItemIdParamSchema),
  async (c) => {
    try {
      const { menuItemId } = c.get("validatedParams");
      const service = new RecipeService(c.env.DB);

      const recipe = await service.getRecipe(menuItemId);

      return c.json({ success: true, data: { recipe } });
    } catch (error) {
      console.error("Get recipe error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "RECIPE_GET_FAILED",
            message:
              error instanceof Error ? error.message : "Failed to get recipe",
          },
        },
        500,
      );
    }
  },
);

// PUT /api/v1/ingredients/:restaurantId/recipes/:menuItemId
routes.put(
  "/:restaurantId/recipes/:menuItemId",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(menuItemIdParamSchema),
  validateBody(setRecipeSchema),
  async (c) => {
    try {
      const { menuItemId } = c.get("validatedParams");
      const { ingredients } = c.get("validatedBody");
      const service = new RecipeService(c.env.DB);

      await service.setRecipe(menuItemId, ingredients);

      return c.json({ success: true, data: { updated: true } });
    } catch (error) {
      console.error("Set recipe error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "RECIPE_SET_FAILED",
            message:
              error instanceof Error ? error.message : "Failed to set recipe",
          },
        },
        500,
      );
    }
  },
);

// POST /api/v1/ingredients/:restaurantId/recipes/:menuItemId/validate
routes.post(
  "/:restaurantId/recipes/:menuItemId/validate",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(menuItemIdParamSchema),
  async (c) => {
    try {
      const { menuItemId } = c.get("validatedParams");
      const service = new RecipeService(c.env.DB);

      const result = await service.validateRecipe(menuItemId);

      return c.json({ success: true, data: result });
    } catch (error) {
      console.error("Validate recipe error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "RECIPE_VALIDATE_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to validate recipe",
          },
        },
        500,
      );
    }
  },
);

export default routes;
