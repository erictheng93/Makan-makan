import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import routes from "../routes";
import { ApiError } from "../../../shared/utils/api-error";

// Mock auth middleware to pass through
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => next()),
  requireRole: () => vi.fn((c: any, next: any) => next()),
}));

vi.mock("../../../middleware/validation", () => ({
  validateBody: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedBody", {
        name: "Chicken",
        unit: "kg",
        category: "Meat",
      });
      return next();
    }),
  validateQuery: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedQuery", { page: 1, limit: 50 });
      return next();
    }),
  validateParams: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedParams", {
        restaurantId: "test-restaurant",
        id: 1,
        menuItemId: 10,
      });
      return next();
    }),
}));

// Mock IngredientService
const mockIngredientService = {
  list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  get: vi.fn().mockResolvedValue({
    id: 1,
    name: "Chicken",
    unit: "kg",
    category: "Meat",
    costPerUnit: 100,
    supplier: null,
    minStockLevel: null,
    currentStock: null,
    isActive: true,
  }),
  create: vi.fn().mockResolvedValue({
    id: 1,
    name: "Chicken",
    unit: "kg",
    category: "Meat",
    costPerUnit: null,
    supplier: null,
    minStockLevel: null,
    currentStock: null,
    isActive: true,
  }),
  update: vi.fn().mockResolvedValue({
    id: 1,
    name: "Updated Chicken",
    unit: "kg",
    category: "Meat",
    costPerUnit: null,
    supplier: null,
    minStockLevel: null,
    currentStock: null,
    isActive: true,
  }),
  delete: vi.fn().mockResolvedValue(true),
  bulkImport: vi.fn().mockResolvedValue({ imported: 3 }),
  getCategories: vi.fn().mockResolvedValue(["Meat", "Vegetable"]),
  updateStock: vi.fn().mockResolvedValue(true),
};

vi.mock("../services/IngredientService", () => ({
  IngredientService: vi.fn(function () {
    return mockIngredientService;
  }),
}));

// Mock RecipeService
const mockRecipeService = {
  getRecipe: vi.fn().mockResolvedValue([]),
  setRecipe: vi.fn().mockResolvedValue(undefined),
  validateRecipe: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
  getMenuItemsWithoutRecipes: vi.fn().mockResolvedValue([]),
  getIngredientUsage: vi.fn().mockResolvedValue([]),
};

vi.mock("../services/RecipeService", () => ({
  RecipeService: vi.fn(function () {
    return mockRecipeService;
  }),
}));

describe("Ingredient Routes", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    // Inject mock env bindings so c.env.DB is accessible
    app.use("*", async (c, next) => {
      (c as any).env = { DB: {}, CACHE_KV: {} };
      await next();
    });
    app.route("/", routes);

    // Mirror global error handler for ApiError
    app.onError((err, c) => {
      if (err instanceof ApiError) {
        return c.json(
          { success: false, error: { code: err.code, message: err.message } },
          err.status as any,
        );
      }
      return c.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: err.message },
        },
        500,
      );
    });
  });

  describe("GET /:restaurantId", () => {
    it("returns ingredient list", async () => {
      const res = await app.request("/test-restaurant", { method: "GET" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);

      expect(mockIngredientService.list).toHaveBeenCalledOnce();
    });
  });

  describe("POST /:restaurantId", () => {
    it("creates an ingredient", async () => {
      const res = await app.request("/test-restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Chicken", unit: "kg" }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.ingredient).toBeDefined();

      expect(mockIngredientService.create).toHaveBeenCalledOnce();
    });
  });

  describe("GET /:restaurantId/:id", () => {
    it("returns a single ingredient", async () => {
      const res = await app.request("/test-restaurant/1", { method: "GET" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);

      expect(mockIngredientService.get).toHaveBeenCalledOnce();
    });

    it("returns 404 for missing ingredient", async () => {
      mockIngredientService.get.mockResolvedValueOnce(null);
      const res = await app.request("/test-restaurant/999", { method: "GET" });
      expect(res.status).toBe(404);

      expect(mockIngredientService.get).toHaveBeenCalledOnce();
    });
  });

  describe("PUT /:restaurantId/:id", () => {
    it("updates an ingredient", async () => {
      const res = await app.request("/test-restaurant/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Chicken" }),
      });
      expect(res.status).toBe(200);

      expect(mockIngredientService.update).toHaveBeenCalledOnce();
    });
  });

  describe("DELETE /:restaurantId/:id", () => {
    it("deletes an ingredient not in use", async () => {
      const res = await app.request("/test-restaurant/1", { method: "DELETE" });
      expect(res.status).toBe(200);

      expect(mockRecipeService.getIngredientUsage).toHaveBeenCalledOnce();
      expect(mockIngredientService.delete).toHaveBeenCalledOnce();
    });

    it("returns 409 if ingredient is in use", async () => {
      mockRecipeService.getIngredientUsage.mockResolvedValueOnce([
        { menuItemId: 10, menuItemName: "Chicken Rice" },
      ]);
      const res = await app.request("/test-restaurant/1", { method: "DELETE" });
      expect(res.status).toBe(409);

      expect(mockRecipeService.getIngredientUsage).toHaveBeenCalledOnce();
      expect(mockIngredientService.delete).not.toHaveBeenCalled();
    });
  });

  describe("GET /:restaurantId/categories", () => {
    it("returns categories list", async () => {
      const res = await app.request("/test-restaurant/categories", {
        method: "GET",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);

      expect(mockIngredientService.getCategories).toHaveBeenCalledOnce();
    });
  });

  describe("GET /:restaurantId/recipes/:menuItemId", () => {
    it("returns recipe entries", async () => {
      const res = await app.request("/test-restaurant/recipes/10", {
        method: "GET",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);

      expect(mockRecipeService.getRecipe).toHaveBeenCalledOnce();
    });
  });

  describe("PUT /:restaurantId/recipes/:menuItemId", () => {
    it("sets recipe entries", async () => {
      const res = await app.request("/test-restaurant/recipes/10", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: [
            { ingredientId: 1, quantityPerServing: 0.5, unit: "kg" },
          ],
        }),
      });
      expect(res.status).toBe(200);

      expect(mockRecipeService.setRecipe).toHaveBeenCalledOnce();
    });
  });

  describe("POST /:restaurantId/recipes/:menuItemId/validate", () => {
    it("validates recipe", async () => {
      const res = await app.request("/test-restaurant/recipes/10/validate", {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);

      expect(mockRecipeService.validateRecipe).toHaveBeenCalledOnce();
    });
  });
});
