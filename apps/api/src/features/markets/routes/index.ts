import { Hono } from "hono";
import { validateParams, validateQuery } from "../../../middleware/validation";
import type { Env } from "../../../shared/types";
import { MarketsService } from "../services/MarketsService";
import {
  marketListQuerySchema,
  marketSlugParamSchema,
  marketVendorsQuerySchema,
  nearbyMarketsQuerySchema,
} from "../schemas/validation";

const routes = new Hono<{ Bindings: Env }>();

routes.get("/", validateQuery(marketListQuerySchema), async (c) => {
  const query = c.get("validatedQuery");
  const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
  const data = await service.listMarkets(query);
  return c.json({ success: true, data });
});

routes.get("/nearby", validateQuery(nearbyMarketsQuerySchema), async (c) => {
  const { lat, lng, radiusKm, limit } = c.get("validatedQuery");
  const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
  const data = await service.findNearby(lat, lng, radiusKm, limit);
  return c.json({ success: true, data });
});

routes.get("/areas", async (c) => {
  const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
  const data = await service.listAreas();
  return c.json({ success: true, data });
});

routes.get(
  "/:slug/vendors",
  validateParams(marketSlugParamSchema),
  validateQuery(marketVendorsQuerySchema),
  async (c) => {
    const { slug } = c.get("validatedParams");
    const query = c.get("validatedQuery");
    const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
    const data = await service.listVendors(slug, query);
    if (!data) {
      return c.json(
        {
          success: false,
          error: { code: "MARKET_NOT_FOUND", message: "Market not found" },
        },
        404,
      );
    }
    return c.json({ success: true, data });
  },
);

routes.get("/:slug", validateParams(marketSlugParamSchema), async (c) => {
  const { slug } = c.get("validatedParams");
  const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
  const data = await service.getMarketBySlug(slug);
  if (!data) {
    return c.json(
      {
        success: false,
        error: { code: "MARKET_NOT_FOUND", message: "Market not found" },
      },
      404,
    );
  }
  return c.json({ success: true, data });
});

export default routes;
