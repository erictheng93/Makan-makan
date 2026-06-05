import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { validateQuery, validateParams } from "../../../middleware/validation";
import {
  DiscoveryService,
  createDiscoveryRead,
} from "../services/DiscoveryService";
import {
  dishCategoryQuerySchema,
  dishSearchQuerySchema,
  restaurantBrowseQuerySchema,
  restaurantIdParamSchema,
  serviceSearchQuerySchema,
  serviceTypeFacetQuerySchema,
} from "../schemas/validation";
import type { Env } from "../../../shared/types";

const routes = new Hono<{ Bindings: Env }>();

// GET /api/v1/discovery/index-status — admin only (role 0)
routes.get("/index-status", authMiddleware, requireRole([0]), async (c) => {
  // Admin freshness check → read from primary, not a replica.
  const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

  const result = await service.getIndexStatus();

  return c.json({ success: true, data: result });
});

// GET /api/v1/discovery/search — public
routes.get("/search", validateQuery(dishSearchQuerySchema), async (c) => {
  const query = c.get("validatedQuery");
  const service = createDiscoveryRead(c.env);

  const results = await service.searchDishes(query);

  return c.json({ success: true, data: results });
});

// GET /api/v1/discovery/categories — public
routes.get("/categories", validateQuery(dishCategoryQuerySchema), async (c) => {
  const query = c.get("validatedQuery");
  const service = createDiscoveryRead(c.env);

  const data = await service.listDishCategories(query);

  return c.json({ success: true, data });
});

// GET /api/v1/discovery/services — public
routes.get("/services", validateQuery(serviceSearchQuerySchema), async (c) => {
  const query = c.get("validatedQuery");
  const service = createDiscoveryRead(c.env);

  const results = await service.searchServices(query);

  return c.json({ success: true, data: results });
});

// GET /api/v1/discovery/service-types — public
routes.get(
  "/service-types",
  validateQuery(serviceTypeFacetQuerySchema),
  async (c) => {
    const query = c.get("validatedQuery");
    const service = createDiscoveryRead(c.env);

    const data = await service.listServiceTypes(query);

    return c.json({ success: true, data });
  },
);

// GET /api/v1/discovery/restaurants — public
routes.get(
  "/restaurants",
  validateQuery(restaurantBrowseQuerySchema),
  async (c) => {
    const query = c.get("validatedQuery");
    const service = createDiscoveryRead(c.env);

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
    const service = createDiscoveryRead(c.env);

    const result = await service.getTakeawayEligibility(id);

    return c.json({ success: true, data: result });
  },
);

// GET /api/v1/discovery/restaurants/:id/markets — public
routes.get(
  "/restaurants/:id/markets",
  validateParams(restaurantIdParamSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = createDiscoveryRead(c.env);

    const data = await service.getRestaurantMarkets(id);

    return c.json({ success: true, data });
  },
);

// GET /api/v1/discovery/restaurants/:id/services — public
routes.get(
  "/restaurants/:id/services",
  validateParams(restaurantIdParamSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = createDiscoveryRead(c.env);

    const services = await service.getRestaurantServices(id);

    return c.json({ success: true, data: { services } });
  },
);

// GET /api/v1/discovery/restaurants/:id/menu — public
routes.get(
  "/restaurants/:id/menu",
  validateParams(restaurantIdParamSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const service = createDiscoveryRead(c.env);

    const items = await service.getRestaurantMenu(id);

    return c.json({ success: true, data: { items } });
  },
);

// GET /api/v1/discovery/popular — public
routes.get("/popular", async (c) => {
  const service = createDiscoveryRead(c.env);

  const results = await service.getPopular();

  return c.json({ success: true, data: results });
});

// POST /api/v1/discovery/reindex — admin only (role 0)
routes.post("/reindex", authMiddleware, requireRole([0]), async (c) => {
  // Write-heavy rebuild → use primary directly.
  const service = new DiscoveryService(c.env.DB, c.env.CACHE_KV);

  const result = await service.reindex();

  return c.json({ success: true, data: result });
});

export default routes;
