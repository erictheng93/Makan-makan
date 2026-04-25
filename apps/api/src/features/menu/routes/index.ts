/**
 * Menu Routes
 * All HTTP routes for the menu feature
 */

import { Hono } from "hono";
import {
  authMiddleware,
  requireRole,
  requireRestaurantAccess,
  optionalAuth,
} from "../../../shared/middleware";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../shared/middleware";
import type { Env } from "../../../shared/types";
import { HTTP_STATUS, USER_ROLES } from "../../../shared/constants";
import { createSuccessResponse } from "../../../shared/utils";
import { notFound, forbidden } from "../../../shared/utils/api-error";
import { moduleGate } from "../../../middleware/moduleGate";

// Import schemas
import { menuSchemas } from "../schemas/validation";

// Import services
import { MenuService } from "../services/MenuService";

const app = new Hono<{ Bindings: Env }>();

// Public Menu Routes (no authentication required)

// GET /:restaurantId - Get complete menu (public API, optionally includes unavailable items for admins)
app.get(
  "/:restaurantId",
  optionalAuth,
  validateParams(menuSchemas.restaurantIdParam),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const service = new MenuService(c.env);

    // Authenticated admin/owner requests can see all items (including unavailable)
    const user = c.get("user");
    const includeAll =
      c.req.query("includeAll") === "true" &&
      user &&
      (user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.SHOP_OWNER);

    const menu = await service.getMenu(restaurantId, {
      includeUnavailable: !!includeAll,
    });

    return c.json(createSuccessResponse(menu), HTTP_STATUS.OK);
  },
);

// GET /:restaurantId/featured - Get featured items (public API)
app.get(
  "/:restaurantId/featured",
  validateParams(menuSchemas.restaurantIdParam),
  validateQuery(menuSchemas.featuredItemsQuery),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const { limit } = c.get("validatedQuery");
    const service = new MenuService(c.env);

    const items = await service.getFeaturedItems(restaurantId, limit);

    return c.json(createSuccessResponse(items), HTTP_STATUS.OK);
  },
);

// GET /:restaurantId/popular - Get popular items (public API)
app.get(
  "/:restaurantId/popular",
  validateParams(menuSchemas.restaurantIdParam),
  validateQuery(menuSchemas.popularItemsQuery),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const { limit } = c.get("validatedQuery");
    const service = new MenuService(c.env);

    const items = await service.getPopularItems(restaurantId, limit);

    return c.json(createSuccessResponse(items), HTTP_STATUS.OK);
  },
);

// GET /:restaurantId/search - Search menu items (public API)
app.get(
  "/:restaurantId/search",
  validateParams(menuSchemas.restaurantIdParam),
  validateQuery(menuSchemas.menuFilter),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const query = c.get("validatedQuery");
    const service = new MenuService(c.env);

    // Process price range
    const priceRange =
      query.minPrice || query.maxPrice
        ? ([query.minPrice || 0, query.maxPrice || 999999] as [number, number])
        : undefined;

    // Process dietary preferences
    const dietaryPreferences = query.dietaryPreferences
      ? query.dietaryPreferences.split(",").map((s: string) => s.trim())
      : undefined;

    const searchParams = {
      categoryId: query.categoryId,
      priceRange,
      spiceLevel: query.spiceLevel,
      dietaryPreferences,
      isAvailable: query.isAvailable,
      isFeatured: query.isFeatured,
      search: query.search,
      page: query.page,
      limit: query.limit,
    };

    const result = await service.searchMenuItems(restaurantId, searchParams);

    return c.json(
      {
        success: true,
        data: result.items,
        pagination: result.pagination,
      },
      HTTP_STATUS.OK,
    );
  },
);

// GET /items/:id - Get menu item details (public API with optional auth for view tracking)
app.get(
  "/items/:id",
  validateParams(menuSchemas.menuItemIdParam),
  optionalAuth,
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = new MenuService(c.env);

    const item = await service.getMenuItem(id);

    if (!item) {
      throw notFound("Menu item not found");
    }

    // Increment view count asynchronously (don't wait for completion)
    c.executionCtx.waitUntil(service.incrementViewCount(id));

    return c.json(createSuccessResponse(item), HTTP_STATUS.OK);
  },
);

// Protected Menu Management Routes (authentication required)

// POST /:restaurantId/items - Create menu item
app.post(
  "/:restaurantId/items",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER, USER_ROLES.CHEF]),
  requireRestaurantAccess("restaurantId"),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.createMenuItem),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const service = new MenuService(c.env);

    const item = await service.createMenuItem({
      ...data,
      restaurantId,
    } as Parameters<typeof service.createMenuItem>[0]);

    return c.json(
      createSuccessResponse(item, "Menu item created successfully"),
      HTTP_STATUS.CREATED,
    );
  },
);

// PUT /items/:id - Update menu item
app.put(
  "/items/:id",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER, USER_ROLES.CHEF]),
  validateParams(menuSchemas.menuItemIdParam),
  validateBody(menuSchemas.updateMenuItem),
  async (c) => {
    const { id } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const user = c.get("user");
    const service = new MenuService(c.env);

    // Get existing item to check restaurant access
    const existingItem = await service.getMenuItem(id);
    if (!existingItem) {
      throw notFound("Menu item not found");
    }

    // Check restaurant access for non-admin users
    if (
      user.role !== USER_ROLES.ADMIN &&
      user.restaurantId !== existingItem.restaurantId
    ) {
      throw forbidden("Access denied");
    }

    const item = await service.updateMenuItem(
      id,
      data as Parameters<typeof service.updateMenuItem>[1],
      existingItem,
    );

    return c.json(
      createSuccessResponse(item, "Menu item updated successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// DELETE /items/:id - Delete menu item
app.delete(
  "/items/:id",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(menuSchemas.menuItemIdParam),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user = c.get("user");
    const service = new MenuService(c.env);

    const existingItem = await service.getMenuItem(id);
    if (!existingItem) {
      throw notFound("Menu item not found");
    }

    if (
      user.role !== USER_ROLES.ADMIN &&
      user.restaurantId !== existingItem.restaurantId
    ) {
      throw forbidden("Access denied");
    }

    const deleted = await service.deleteMenuItem(id, existingItem);

    if (!deleted) {
      throw notFound("Menu item not found");
    }

    return c.json(
      createSuccessResponse(null, "Menu item deleted successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// PATCH /:restaurantId/items/availability - Batch update menu item availability
app.patch(
  "/:restaurantId/items/availability",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER, USER_ROLES.CHEF]),
  requireRestaurantAccess("restaurantId"),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.bulkAvailabilityUpdate),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const { updates } = c.get("validatedBody");
    const service = new MenuService(c.env);

    await service.batchUpdateAvailability(restaurantId, updates);

    return c.json(
      createSuccessResponse(
        null,
        "Menu items availability updated successfully",
      ),
      HTTP_STATUS.OK,
    );
  },
);

// PATCH /:restaurantId/items/prices - Batch update menu item prices
app.patch(
  "/:restaurantId/items/prices",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.bulkPriceUpdate),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const { updates } = c.get("validatedBody");
    const service = new MenuService(c.env);

    await service.batchUpdatePrices(restaurantId, updates);

    return c.json(
      createSuccessResponse(null, "Menu item prices updated successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// PATCH /:restaurantId/items/categories - Batch move items to different categories
app.patch(
  "/:restaurantId/items/categories",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.bulkCategoryMove),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const { updates } = c.get("validatedBody");
    const service = new MenuService(c.env);

    await service.batchMoveItems(restaurantId, updates);

    return c.json(
      createSuccessResponse(
        null,
        "Menu items moved to new categories successfully",
      ),
      HTTP_STATUS.OK,
    );
  },
);

// Category Management Routes

// POST /:restaurantId/categories - Create category
app.post(
  "/:restaurantId/categories",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.createCategory),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const service = new MenuService(c.env);

    const category = await service.createCategory({
      ...data,
      restaurantId,
    } as Parameters<typeof service.createCategory>[0]);

    return c.json(
      createSuccessResponse(category, "Category created successfully"),
      HTTP_STATUS.CREATED,
    );
  },
);

// PUT /categories/:id - Update category
app.put(
  "/categories/:id",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(menuSchemas.categoryIdParam),
  validateBody(menuSchemas.updateCategory),
  async (c) => {
    const { id } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const user = c.get("user");
    const service = new MenuService(c.env);

    // Check restaurant access BEFORE mutation
    const existingCategory = await service.getCategoryById(id);
    if (!existingCategory) {
      throw notFound("Category not found");
    }
    if (
      user.role !== USER_ROLES.ADMIN &&
      user.restaurantId !== existingCategory.restaurantId
    ) {
      throw forbidden("Access denied");
    }

    const category = await service.updateCategory(id, data);

    return c.json(
      createSuccessResponse(category, "Category updated successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// PATCH /:restaurantId/categories/reorder - Batch reorder categories
app.patch(
  "/:restaurantId/categories/reorder",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.categoryReorder),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const { categories } = c.get("validatedBody");
    const service = new MenuService(c.env);

    await service.reorderCategories(restaurantId, categories);

    return c.json(
      createSuccessResponse(null, "Categories reordered successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// DELETE /categories/:id - Delete category
app.delete(
  "/categories/:id",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(menuSchemas.categoryIdParam),
  async (c) => {
    const { id } = c.get("validatedParams");
    const user = c.get("user");
    const service = new MenuService(c.env);

    // Check restaurant access BEFORE deletion
    const existingCategory = await service.getCategoryById(id);
    if (!existingCategory) {
      throw notFound("Category not found or cannot be deleted");
    }
    if (
      user.role !== USER_ROLES.ADMIN &&
      user.restaurantId !== existingCategory.restaurantId
    ) {
      throw forbidden("Access denied");
    }

    const deleted = await service.deleteCategory(id);

    if (!deleted) {
      throw notFound("Category not found or cannot be deleted");
    }

    return c.json(
      createSuccessResponse(null, "Category deleted successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// Analytics Routes

// GET /:restaurantId/analytics - Get menu analytics
app.get(
  "/:restaurantId/analytics",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(menuSchemas.restaurantIdParam),
  validateQuery(menuSchemas.analyticsQuery),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const service = new MenuService(c.env);

    const analytics = await service.getMenuAnalytics(restaurantId);

    return c.json(createSuccessResponse(analytics), HTTP_STATUS.OK);
  },
);

// GET /:restaurantId/popularity - Get popularity metrics
app.get(
  "/:restaurantId/popularity",
  authMiddleware,
  moduleGate("menu_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(menuSchemas.restaurantIdParam),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const service = new MenuService(c.env);

    const metrics = await service.getPopularityMetrics(restaurantId);

    return c.json(createSuccessResponse(metrics), HTTP_STATUS.OK);
  },
);

export default app;
