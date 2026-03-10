/**
 * Restaurants Routes
 * HTTP route handlers for restaurant operations
 */

import { Hono } from "hono";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import {
  authMiddleware,
  requireRole,
  optionalAuth,
} from "../../../middleware/auth";
import { ConsoleLogger } from "../../../core/monitoring";
import { HTTP_STATUS, USER_ROLES } from "../../../shared/constants";
import type { Env } from "../../../shared/types";

import { RestaurantsService } from "../services/RestaurantsService";
import { restaurantSchemas } from "../schemas/validation";

const app = new Hono<{ Bindings: Env }>();
const logger = new ConsoleLogger("RestaurantsRoutes");

// Helper function for error formatting
const formatError = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

// Common schemas for parameters (reusing from validation middleware)
const commonSchemas = {
  idParam: restaurantSchemas.params,
};

/**
 * GET / - Get restaurants list (public API)
 * Query parameters: page, limit, type, district, isAvailable
 */
app.get("/", optionalAuth, validateQuery(restaurantSchemas.list), async (c) => {
  try {
    logger.debug("Getting restaurants list", {
      query: c.get("validatedQuery"),
    });

    const query = c.get("validatedQuery");
    const restaurantsService = new RestaurantsService(
      c.env.DB,
      c.env,
      c.env.CACHE_KV,
    );

    const result = await restaurantsService.getRestaurants(query);

    return c.json(
      {
        success: true,
        data: (result as any)?.restaurants || [],
        pagination: (result as any)?.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      },
      HTTP_STATUS.OK,
    );
  } catch (error) {
    logger.error("Failed to get restaurants", error as Error, {});
    return c.json(
      {
        success: false,
        error: formatError(error) || "Failed to fetch restaurants",
      },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * GET /popular - Get popular restaurants (public API)
 * Query parameters: limit
 */
app.get("/popular", validateQuery(restaurantSchemas.popular), async (c) => {
  try {
    logger.debug("Getting popular restaurants", {
      query: c.get("validatedQuery"),
    });

    const { limit } = c.get("validatedQuery");
    const restaurantsService = new RestaurantsService(
      c.env.DB,
      c.env,
      c.env.CACHE_KV,
    );

    const restaurants = await restaurantsService.getPopularRestaurants(limit);

    return c.json(
      {
        success: true,
        data: restaurants,
      },
      HTTP_STATUS.OK,
    );
  } catch (error) {
    logger.error("Failed to get popular restaurants", error as Error, {});
    return c.json(
      {
        success: false,
        error: formatError(error) || "Failed to fetch popular restaurants",
      },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * GET /nearby/:district - Search nearby restaurants (public API)
 * Parameters: district
 * Query parameters: limit
 */
app.get(
  "/nearby/:district",
  validateParams(restaurantSchemas.districtParams),
  validateQuery(restaurantSchemas.nearby),
  async (c) => {
    try {
      logger.debug("Searching nearby restaurants", {
        params: c.get("validatedParams"),
        query: c.get("validatedQuery"),
      });

      const { district } = c.get("validatedParams");
      const { limit } = c.get("validatedQuery");
      const restaurantsService = new RestaurantsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      const restaurants = await restaurantsService.searchNearbyRestaurants(
        district,
        limit,
      );

      return c.json(
        {
          success: true,
          data: restaurants,
        },
        HTTP_STATUS.OK,
      );
    } catch (error) {
      logger.error("Failed to search nearby restaurants", error as Error, {});
      return c.json(
        {
          success: false,
          error: formatError(error) || "Failed to search nearby restaurants",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * POST / - Create restaurant (admin only)
 * Body: CreateRestaurantData
 */
app.post(
  "/",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN]),
  validateBody(restaurantSchemas.create),
  async (c) => {
    try {
      logger.debug("Creating restaurant", { body: c.get("validatedBody") });

      const data = c.get("validatedBody");
      const restaurantsService = new RestaurantsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      const restaurant = await restaurantsService.createRestaurant(data);

      return c.json(
        {
          success: true,
          data: restaurant,
        },
        HTTP_STATUS.CREATED,
      );
    } catch (error) {
      logger.error("Failed to create restaurant", error as Error, {});
      return c.json(
        {
          success: false,
          error: formatError(error) || "Failed to create restaurant",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * GET /:id - Get restaurant details (public API)
 * Parameters: id
 */
app.get("/:id", validateParams(commonSchemas.idParam), async (c) => {
  try {
    logger.debug("Getting restaurant details", {
      params: c.get("validatedParams"),
    });

    const { id } = c.get("validatedParams");
    const restaurantsService = new RestaurantsService(
      c.env.DB,
      c.env,
      c.env.CACHE_KV,
    );

    const restaurant = await restaurantsService.getRestaurant(id);

    if (!restaurant) {
      return c.json(
        {
          success: false,
          error: "Restaurant not found",
        },
        HTTP_STATUS.NOT_FOUND,
      );
    }

    return c.json(
      {
        success: true,
        data: restaurant,
      },
      HTTP_STATUS.OK,
    );
  } catch (error) {
    logger.error("Failed to get restaurant", error as Error, {});
    return c.json(
      {
        success: false,
        error: formatError(error) || "Failed to fetch restaurant",
      },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * PUT /:id - Update restaurant (admin and shop owner)
 * Parameters: id
 * Body: UpdateRestaurantData
 */
app.put(
  "/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(commonSchemas.idParam),
  validateBody(restaurantSchemas.update),
  async (c) => {
    try {
      logger.debug("Updating restaurant", {
        params: c.get("validatedParams"),
        body: c.get("validatedBody"),
      });

      const { id } = c.get("validatedParams");
      const data = c.get("validatedBody");
      const user = c.get("user");
      const restaurantsService = new RestaurantsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // Shop owners can only update their own restaurant
      if (user.role === USER_ROLES.SHOP_OWNER && user.restaurantId !== id) {
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const restaurant = await restaurantsService.updateRestaurant(id, data);

      if (!restaurant) {
        return c.json(
          {
            success: false,
            error: "Restaurant not found",
          },
          HTTP_STATUS.NOT_FOUND,
        );
      }

      return c.json(
        {
          success: true,
          data: restaurant,
        },
        HTTP_STATUS.OK,
      );
    } catch (error) {
      logger.error("Failed to update restaurant", error as Error, {});
      return c.json(
        {
          success: false,
          error: formatError(error) || "Failed to update restaurant",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * DELETE /:id - Deactivate restaurant (admin only)
 * Parameters: id
 */
app.delete(
  "/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN]),
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      logger.debug("Deactivating restaurant", {
        params: c.get("validatedParams"),
      });

      const { id } = c.get("validatedParams");
      const restaurantsService = new RestaurantsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      const success = await restaurantsService.deactivateRestaurant(id);

      if (!success) {
        return c.json(
          {
            success: false,
            error: "Restaurant not found",
          },
          HTTP_STATUS.NOT_FOUND,
        );
      }

      return c.json(
        {
          success: true,
          message: "Restaurant deactivated successfully",
        },
        HTTP_STATUS.OK,
      );
    } catch (error) {
      logger.error("Failed to deactivate restaurant", error as Error, {});
      return c.json(
        {
          success: false,
          error: formatError(error) || "Failed to deactivate restaurant",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * GET /:id/stats - Get restaurant statistics (admin and shop owner)
 * Parameters: id
 */
app.get(
  "/:id/stats",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      logger.debug("Getting restaurant stats", {
        params: c.get("validatedParams"),
      });

      const { id } = c.get("validatedParams");
      const user = c.get("user");
      const restaurantsService = new RestaurantsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // Shop owners can only view their own restaurant stats
      if (user.role === USER_ROLES.SHOP_OWNER && user.restaurantId !== id) {
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const stats = await restaurantsService.getRestaurantStats(id);

      return c.json(
        {
          success: true,
          data: stats,
        },
        HTTP_STATUS.OK,
      );
    } catch (error) {
      logger.error("Failed to get restaurant stats", error as Error, {});
      return c.json(
        {
          success: false,
          error: formatError(error) || "Failed to fetch restaurant stats",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// ==================== Shop QR Code Endpoints ====================

/**
 * POST /:id/qr/shop/generate - Generate shop-level QR code
 * Parameters: id
 * For restaurants without table seating (e.g., chicken stall vendors)
 */
app.post(
  "/:id/qr/shop/generate",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      logger.debug("Generating shop QR code", {
        params: c.get("validatedParams"),
      });

      const { id } = c.get("validatedParams");
      const user = c.get("user");
      const restaurantsService = new RestaurantsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // Shop owners can only manage their own restaurant
      if (user.role === USER_ROLES.SHOP_OWNER && user.restaurantId !== id) {
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const result = await restaurantsService.generateShopQrCode(id);

      return c.json(
        {
          success: true,
          data: result,
        },
        HTTP_STATUS.CREATED,
      );
    } catch (error) {
      logger.error("Failed to generate shop QR code", error as Error, {});
      return c.json(
        {
          success: false,
          error: formatError(error) || "Failed to generate shop QR code",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * POST /:id/qr/shop/regenerate - Regenerate shop-level QR code
 * Parameters: id
 * Used when QR code is compromised or needs to be replaced
 */
app.post(
  "/:id/qr/shop/regenerate",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      logger.debug("Regenerating shop QR code", {
        params: c.get("validatedParams"),
      });

      const { id } = c.get("validatedParams");
      const user = c.get("user");
      const restaurantsService = new RestaurantsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // Shop owners can only manage their own restaurant
      if (user.role === USER_ROLES.SHOP_OWNER && user.restaurantId !== id) {
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const result = await restaurantsService.regenerateShopQrCode(id);

      return c.json(
        {
          success: true,
          data: result,
          message: "Shop QR code regenerated successfully",
        },
        HTTP_STATUS.OK,
      );
    } catch (error) {
      logger.error("Failed to regenerate shop QR code", error as Error, {});
      return c.json(
        {
          success: false,
          error: formatError(error) || "Failed to regenerate shop QR code",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * GET /:id/qr/shop - Get shop-level QR code information
 * Parameters: id
 */
app.get(
  "/:id/qr/shop",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      logger.debug("Getting shop QR code info", {
        params: c.get("validatedParams"),
      });

      const { id } = c.get("validatedParams");
      const user = c.get("user");
      const restaurantsService = new RestaurantsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // Shop owners can only view their own restaurant QR
      if (user.role === USER_ROLES.SHOP_OWNER && user.restaurantId !== id) {
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      const info = await restaurantsService.getShopQrCodeInfo(id);

      return c.json(
        {
          success: true,
          data: info,
        },
        HTTP_STATUS.OK,
      );
    } catch (error) {
      logger.error("Failed to get shop QR code info", error as Error, {});
      return c.json(
        {
          success: false,
          error: formatError(error) || "Failed to fetch shop QR code info",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * POST /:id/qr/shop/upload-image - Upload QR code image
 * Parameters: id
 * Body: { imageUrl: string }
 */
app.post(
  "/:id/qr/shop/upload-image",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(commonSchemas.idParam),
  validateBody(restaurantSchemas.uploadQrImage),
  async (c) => {
    try {
      logger.debug("Uploading shop QR code image", {
        params: c.get("validatedParams"),
        body: c.get("validatedBody"),
      });

      const { id } = c.get("validatedParams");
      const { imageUrl } = c.get("validatedBody");
      const user = c.get("user");
      const restaurantsService = new RestaurantsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // Shop owners can only manage their own restaurant
      if (user.role === USER_ROLES.SHOP_OWNER && user.restaurantId !== id) {
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      await restaurantsService.updateShopQrCodeImage(id, imageUrl);

      return c.json(
        {
          success: true,
          message: "QR code image uploaded successfully",
        },
        HTTP_STATUS.OK,
      );
    } catch (error) {
      logger.error("Failed to upload shop QR code image", error as Error, {});
      return c.json(
        {
          success: false,
          error: formatError(error) || "Failed to upload QR code image",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

/**
 * PUT /:id/shop-mode - Enable or disable shop mode
 * Parameters: id
 * Body: { enabled: boolean, settings?: ShopQrSettings }
 */
app.put(
  "/:id/shop-mode",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(commonSchemas.idParam),
  validateBody(restaurantSchemas.updateShopMode),
  async (c) => {
    try {
      logger.debug("Updating shop mode", {
        params: c.get("validatedParams"),
        body: c.get("validatedBody"),
      });

      const { id } = c.get("validatedParams");
      const { enabled, settings } = c.get("validatedBody");
      const user = c.get("user");
      const restaurantsService = new RestaurantsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // Shop owners can only manage their own restaurant
      if (user.role === USER_ROLES.SHOP_OWNER && user.restaurantId !== id) {
        return c.json(
          {
            success: false,
            error: "Access denied",
          },
          HTTP_STATUS.FORBIDDEN,
        );
      }

      await restaurantsService.updateShopMode(id, enabled, settings);

      return c.json(
        {
          success: true,
          message: `Shop mode ${enabled ? "enabled" : "disabled"} successfully`,
        },
        HTTP_STATUS.OK,
      );
    } catch (error) {
      logger.error("Failed to update shop mode", error as Error, {});
      return c.json(
        {
          success: false,
          error: formatError(error) || "Failed to update shop mode",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

export default app;
