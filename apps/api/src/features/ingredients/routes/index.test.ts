import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";

const authState = vi.hoisted(() => ({
  user: {
    id: "user-1",
    username: "owner",
    role: 1,
    restaurantId: "rest-1",
  } as AuthUser,
}));

vi.mock("../../../middleware/auth", async () => {
  const { forbidden } = await import("../../../shared/utils/api-error");
  return {
    authMiddleware: vi.fn(async (c, next) => {
      c.set("user", authState.user);
      await next();
    }),
    requireRole: vi.fn(
      () => async (_c: unknown, next: () => Promise<void>) => next(),
    ),
    // Faithful stand-in for the real requireRestaurantAccess: admins bypass,
    // everyone else must match the :restaurantId path param.
    requireRestaurantAccess:
      (param = "restaurantId") =>
      async (
        c: {
          get: (k: "user") => typeof authState.user;
          req: { param: (n: string) => string | undefined };
        },
        next: () => Promise<void>,
      ) => {
        const user = c.get("user");
        if (user?.role === 0) return next();
        if (
          !user?.restaurantId ||
          String(user.restaurantId) !== c.req.param(param)
        ) {
          throw forbidden("Access denied to this restaurant", "FORBIDDEN");
        }
        return next();
      },
  };
});

const ingredientFns = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  bulkImport: vi.fn(),
  getCategories: vi.fn(),
  updateStock: vi.fn(),
}));

const recipeFns = vi.hoisted(() => ({
  getRecipe: vi.fn(),
  setRecipe: vi.fn(),
  validateRecipe: vi.fn(),
  getMenuItemsWithoutRecipes: vi.fn(),
  getIngredientUsage: vi.fn(),
}));

vi.mock("../services/IngredientService", () => ({
  IngredientService: class {
    list = ingredientFns.list;
    get = ingredientFns.get;
    create = ingredientFns.create;
    update = ingredientFns.update;
    delete = ingredientFns.delete;
    bulkImport = ingredientFns.bulkImport;
    getCategories = ingredientFns.getCategories;
    updateStock = ingredientFns.updateStock;
  },
}));

vi.mock("../services/RecipeService", () => ({
  RecipeService: class {
    getRecipe = recipeFns.getRecipe;
    setRecipe = recipeFns.setRecipe;
    validateRecipe = recipeFns.validateRecipe;
    getMenuItemsWithoutRecipes = recipeFns.getMenuItemsWithoutRecipes;
    getIngredientUsage = recipeFns.getIngredientUsage;
  },
}));

import routes from "./index";
import { ApiError } from "../../../shared/utils/api-error";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }

  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function request(path: string, method = "GET", body?: unknown) {
  return routes.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    },
    { DB: {} } as never,
  );
}

const ingredient = {
  id: 11,
  name: "Rice",
  unit: "kg",
  category: "dry",
  costPerUnit: 2.5,
  supplier: "Staple Co",
  minStockLevel: 5,
  currentStock: 20,
  isActive: true,
};

function ingredientBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Rice",
    unit: "kg",
    category: "dry",
    costPerUnit: 2.5,
    supplier: "Staple Co",
    minStockLevel: 5,
    currentStock: 20,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  authState.user = {
    id: "user-1",
    username: "owner",
    role: 1,
    restaurantId: "rest-1",
  };

  ingredientFns.list.mockResolvedValue({
    items: [ingredient],
    total: 1,
  });
  ingredientFns.get.mockResolvedValue(ingredient);
  ingredientFns.create.mockResolvedValue(ingredient);
  ingredientFns.update.mockResolvedValue({ ...ingredient, name: "Brown rice" });
  ingredientFns.delete.mockResolvedValue(true);
  ingredientFns.bulkImport.mockResolvedValue({ imported: 1 });
  ingredientFns.getCategories.mockResolvedValue(["dry", "produce"]);
  ingredientFns.updateStock.mockResolvedValue(true);

  recipeFns.getRecipe.mockResolvedValue([
    {
      ingredientId: 11,
      ingredientName: "Rice",
      quantityPerServing: 0.2,
      unit: "kg",
      isOptional: false,
    },
  ]);
  recipeFns.setRecipe.mockResolvedValue(undefined);
  recipeFns.validateRecipe.mockResolvedValue({ valid: true, errors: [] });
  recipeFns.getMenuItemsWithoutRecipes.mockResolvedValue([
    { id: 51, name: "Plain rice" },
  ]);
  recipeFns.getIngredientUsage.mockResolvedValue([]);
});

describe("ingredients restaurant ownership (bug #7)", () => {
  it("blocks a role-1 owner from another restaurant's ingredients", async () => {
    authState.user = {
      id: "user-2",
      username: "owner",
      role: 1,
      restaurantId: "rest-1",
    };

    const readResponse = await request("/rest-2");
    expect(readResponse.status).toBe(403);
    expect(ingredientFns.list).not.toHaveBeenCalled();

    const writeResponse = await request("/rest-2", "POST", ingredientBody());
    expect(writeResponse.status).toBe(403);
    expect(ingredientFns.create).not.toHaveBeenCalled();

    const nestedResponse = await request("/rest-2/recipes/51");
    expect(nestedResponse.status).toBe(403);
    expect(recipeFns.getRecipe).not.toHaveBeenCalled();
  });

  it("allows a role-1 owner to access their own restaurant", async () => {
    authState.user = {
      id: "user-2",
      username: "owner",
      role: 1,
      restaurantId: "rest-1",
    };

    const response = await request("/rest-1");
    expect(response.status).toBe(200);
    expect(ingredientFns.list).toHaveBeenCalledWith(
      "rest-1",
      expect.any(Object),
    );
  });

  it("lets an admin (role 0) access any restaurant", async () => {
    authState.user = {
      id: "user-1",
      username: "admin",
      role: 0,
      restaurantId: undefined,
    };

    const response = await request("/rest-99");
    expect(response.status).toBe(200);
    expect(ingredientFns.list).toHaveBeenCalledWith(
      "rest-99",
      expect.any(Object),
    );
  });
});

describe("ingredients routes", () => {
  it("lists ingredients with validated filters", async () => {
    const response = await request(
      "/rest-1?page=2&limit=10&category=dry&search=ri&includeInactive=true",
    );

    expect(response.status).toBe(200);
    expect(ingredientFns.list).toHaveBeenCalledWith("rest-1", {
      page: 2,
      limit: 10,
      category: "dry",
      search: "ri",
      includeInactive: true,
      lowStock: false,
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { items: [ingredient], total: 1 },
    });
  });

  it("creates and bulk imports ingredients", async () => {
    let response = await request("/rest-1", "POST", ingredientBody());

    expect(response.status).toBe(201);
    expect(ingredientFns.create).toHaveBeenCalledWith(
      "rest-1",
      ingredientBody(),
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { ingredient },
    });

    response = await request("/rest-1/bulk", "POST", {
      ingredients: [ingredientBody({ name: "Sugar" })],
    });

    expect(response.status).toBe(201);
    expect(ingredientFns.bulkImport).toHaveBeenCalledWith("rest-1", [
      ingredientBody({ name: "Sugar" }),
    ]);
  });

  it("returns categories and menu items missing recipes", async () => {
    let response = await request("/rest-1/categories");

    expect(response.status).toBe(200);
    expect(ingredientFns.getCategories).toHaveBeenCalledWith("rest-1");

    response = await request("/rest-1/recipes/missing");

    expect(response.status).toBe(200);
    expect(recipeFns.getMenuItemsWithoutRecipes).toHaveBeenCalledWith("rest-1");
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { menuItems: [{ id: 51, name: "Plain rice" }] },
    });
  });

  it("gets ingredient details and maps missing ingredients to 404", async () => {
    let response = await request("/rest-1/11");

    expect(response.status).toBe(200);
    expect(ingredientFns.get).toHaveBeenCalledWith("rest-1", 11);

    ingredientFns.get.mockResolvedValueOnce(null);

    response = await request("/rest-1/99");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "INGREDIENT_NOT_FOUND" },
    });
  });

  it("updates ingredient definitions and stock", async () => {
    let response = await request("/rest-1/11", "PUT", {
      name: "Brown rice",
      currentStock: 18,
    });

    expect(response.status).toBe(200);
    // The acting user is forwarded so a stock change made through the edit
    // form can be attributed on its `correction` ledger row (#277).
    expect(ingredientFns.update).toHaveBeenCalledWith(
      "rest-1",
      11,
      { name: "Brown rice", currentStock: 18 },
      "user-1",
    );

    ingredientFns.update.mockResolvedValueOnce(null);

    response = await request("/rest-1/99", "PUT", { name: "Missing" });

    expect(response.status).toBe(404);

    response = await request("/rest-1/11/stock", "PATCH", { quantity: 42 });

    expect(response.status).toBe(200);
    expect(ingredientFns.updateStock).toHaveBeenCalledWith("rest-1", 11, 42);

    ingredientFns.updateStock.mockResolvedValueOnce(false);

    response = await request("/rest-1/99/stock", "PATCH", { quantity: 1 });

    expect(response.status).toBe(404);
  });

  it("deletes unused ingredients and blocks recipe usage", async () => {
    let response = await request("/rest-1/11", "DELETE");

    expect(response.status).toBe(200);
    expect(recipeFns.getIngredientUsage).toHaveBeenCalledWith("rest-1", 11);
    expect(ingredientFns.delete).toHaveBeenCalledWith("rest-1", 11);

    recipeFns.getIngredientUsage.mockResolvedValueOnce([
      { menuItemId: 51, menuItemName: "Plain rice" },
      { menuItemId: 52, menuItemName: "Fried rice" },
    ]);

    response = await request("/rest-1/11", "DELETE");

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "INGREDIENT_IN_USE",
        message:
          "Cannot delete: ingredient is used in recipes for: " +
          "Plain rice, Fried rice",
      },
    });

    ingredientFns.delete.mockResolvedValueOnce(false);

    response = await request("/rest-1/99", "DELETE");

    expect(response.status).toBe(404);
  });

  it("reads, replaces, and validates recipes", async () => {
    let response = await request("/rest-1/recipes/51");

    expect(response.status).toBe(200);
    expect(recipeFns.getRecipe).toHaveBeenCalledWith("rest-1", 51);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        recipe: [
          {
            ingredientId: 11,
            ingredientName: "Rice",
            quantityPerServing: 0.2,
            unit: "kg",
            isOptional: false,
          },
        ],
      },
    });

    const recipeBody = {
      ingredients: [
        {
          ingredientId: 11,
          quantityPerServing: 0.2,
          unit: "kg",
          isOptional: true,
        },
      ],
    };

    response = await request("/rest-1/recipes/51", "PUT", recipeBody);

    expect(response.status).toBe(200);
    expect(recipeFns.setRecipe).toHaveBeenCalledWith(
      "rest-1",
      51,
      recipeBody.ingredients,
    );

    response = await request("/rest-1/recipes/51/validate", "POST");

    expect(response.status).toBe(200);
    expect(recipeFns.validateRecipe).toHaveBeenCalledWith("rest-1", 51);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { valid: true, errors: [] },
    });
  });

  it("clears a recipe with an empty ingredient list", async () => {
    const response = await request("/rest-1/recipes/51", "PUT", {
      ingredients: [],
    });

    expect(response.status).toBe(200);
    expect(recipeFns.setRecipe).toHaveBeenCalledWith("rest-1", 51, []);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { updated: true },
    });
  });

  it("rejects invalid path parameters and request bodies", async () => {
    let response = await request("/rest-1/not-numeric");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });

    response = await request("/rest-1/11/stock", "PATCH", { quantity: -1 });

    expect(response.status).toBe(400);
    expect(ingredientFns.updateStock).not.toHaveBeenCalled();
  });
});
