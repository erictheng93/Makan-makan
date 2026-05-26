import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { validateQuery, validateParams } from "../../../middleware/validation";
import { DiscoveryService } from "../services/DiscoveryService";
import {
  dishCategoryQuerySchema,
  dishSearchQuerySchema,
  restaurantBrowseQuerySchema,
  restaurantIdParamSchema,
  serviceSearchQuerySchema,
} from "../schemas/validation";
import type { Env } from "../../../shared/types";

const routes = new Hono<{ Bindings: Env }>();

// GET /api/v1/discovery/search — public
routes.get("/search", validateQuery(dishSearchQuerySchema), async (c) => {
  const query = c.get("validatedQuery");
  const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

  const results = await service.searchDishes(query);

  return c.json({ success: true, data: results });
});

// GET /api/v1/discovery/categories — public
routes.get("/categories", validateQuery(dishCategoryQuerySchema), async (c) => {
  const query = c.get("validatedQuery");
  const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

  const data = await service.listDishCategories(query);

  return c.json({ success: true, data });
});

// GET /api/v1/discovery/services — public
routes.get("/services", validateQuery(serviceSearchQuerySchema), async (c) => {
  const query = c.get("validatedQuery");
  const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

  const results = await service.searchServices(query);

  return c.json({ success: true, data: results });
});

// GET /api/v1/discovery/restaurants — public
routes.get(
  "/restaurants",
  validateQuery(restaurantBrowseQuerySchema),
  async (c) => {
    const query = c.get("validatedQuery");
    const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

    const results = await service.browseRestaurants(query);

    return c.json({ success: true, data: results });
  },
);

// GET /api/v1/discovery/restaurants/:id/menu — public
routes.get(
  "/restaurants/:id/takeaway-eligibility",
  validateParams(restaurantIdParamSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

    const result = await service.getTakeawayEligibility(id);

    return c.json({ success: true, data: result });
  },
);

// GET /api/v1/discovery/restaurants/:id/menu — public
routes.get(
  "/restaurants/:id/menu",
  validateParams(restaurantIdParamSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

    const items = await service.getRestaurantMenu(id);

    return c.json({ success: true, data: { items } });
  },
);

// GET /api/v1/discovery/popular — public
routes.get("/popular", async (c) => {
  const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

  const results = await service.getPopular();

  return c.json({ success: true, data: results });
});

// POST /api/v1/discovery/reindex — admin only (role 0)
routes.post("/reindex", authMiddleware, requireRole([0]), async (c) => {
  const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

  const result = await service.reindex();

  return c.json({ success: true, data: result });
});

export default routes;
