import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { validateQuery, validateParams } from "../../../middleware/validation";
import { DiscoveryService } from "../services/DiscoveryService";
import {
  dishSearchQuerySchema,
  restaurantBrowseQuerySchema,
  restaurantIdParamSchema,
} from "../schemas/validation";
import type { Env } from "../../../shared/types";

const routes = new Hono<{ Bindings: Env }>();

// GET /api/v1/discovery/search — public
routes.get("/search", validateQuery(dishSearchQuerySchema), async (c) => {
  try {
    const query = c.get("validatedQuery");
    const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

    const results = await service.searchDishes(query);

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error("Discovery search error:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "DISCOVERY_SEARCH_FAILED",
          message:
            error instanceof Error ? error.message : "Failed to search dishes",
        },
      },
      500,
    );
  }
});

// GET /api/v1/discovery/restaurants — public
routes.get(
  "/restaurants",
  validateQuery(restaurantBrowseQuerySchema),
  async (c) => {
    try {
      const query = c.get("validatedQuery");
      const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

      const results = await service.browseRestaurants(query);

      return c.json({ success: true, data: results });
    } catch (error) {
      console.error("Discovery browse restaurants error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "DISCOVERY_BROWSE_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to browse restaurants",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/discovery/restaurants/:id/menu — public
routes.get(
  "/restaurants/:id/menu",
  validateParams(restaurantIdParamSchema),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");

      const items = await c.env.DB.prepare(
        `SELECT mi.id, mi.name, mi.description, mi.price, mi.is_available,
                mi.image_url, c.name as category_name
         FROM menu_items mi
         LEFT JOIN categories c ON mi.category_id = c.id
         WHERE mi.restaurant_id = ? AND mi.is_available = 1 AND mi.deleted_at_ms IS NULL
         ORDER BY c.sort_order ASC, mi.sort_order ASC`,
      )
        .bind(id)
        .all();

      return c.json({ success: true, data: { items: items.results } });
    } catch (error) {
      console.error("Discovery restaurant menu error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "DISCOVERY_MENU_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get restaurant menu",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/discovery/popular — public
routes.get("/popular", async (c) => {
  try {
    const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

    const results = await service.getPopular();

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error("Discovery popular error:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "DISCOVERY_POPULAR_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Failed to get popular items",
        },
      },
      500,
    );
  }
});

// POST /api/v1/discovery/reindex — admin only (role 0)
routes.post("/reindex", authMiddleware, requireRole([0]), async (c) => {
  try {
    const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

    const result = await service.reindex();

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error("Discovery reindex error:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "DISCOVERY_REINDEX_FAILED",
          message: error instanceof Error ? error.message : "Failed to reindex",
        },
      },
      500,
    );
  }
});

export default routes;
