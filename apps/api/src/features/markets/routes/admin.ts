import { Hono } from "hono";
import { requireRole } from "../../../middleware/auth";
import { validateBody, validateParams } from "../../../middleware/validation";
import type { Env } from "../../../shared/types";
import { SearchIndexSyncService } from "../../discovery/services/SearchIndexSyncService";
import {
  addMarketVendorSchema,
  createMarketSchema,
  marketIdParamSchema,
  marketVendorParamSchema,
  updateMarketSchema,
} from "../schemas/validation";
import { MarketsService } from "../services/MarketsService";

const routes = new Hono<{ Bindings: Env }>();

routes.use("*", requireRole([0]));

routes.post("/", validateBody(createMarketSchema), async (c) => {
  const body = c.get("validatedBody");
  const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
  const market = await service.createMarket(body);
  return c.json({ success: true, data: { market } }, 201);
});

routes.put(
  "/:id",
  validateParams(marketIdParamSchema),
  validateBody(updateMarketSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const body = c.get("validatedBody");
    const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
    const market = await service.updateMarket(id, body);

    if (!market) {
      return c.json(
        {
          success: false,
          error: { code: "MARKET_NOT_FOUND", message: "Market not found" },
        },
        404,
      );
    }

    return c.json({ success: true, data: { market } });
  },
);

routes.delete("/:id", validateParams(marketIdParamSchema), async (c) => {
  const { id } = c.get("validatedParams");
  const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
  const deleted = await service.softDeleteMarket(id);

  if (!deleted) {
    return c.json(
      {
        success: false,
        error: { code: "MARKET_NOT_FOUND", message: "Market not found" },
      },
      404,
    );
  }

  return c.json({ success: true, data: { deleted } });
});

routes.post(
  "/:id/vendors",
  validateParams(marketIdParamSchema),
  validateBody(addMarketVendorSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const body = c.get("validatedBody");
    const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
    const membership = await service.addVendor(id, body);

    if (!membership) {
      return c.json(
        {
          success: false,
          error: { code: "MARKET_NOT_FOUND", message: "Market not found" },
        },
        404,
      );
    }

    const sync = new SearchIndexSyncService(c.env.DB, c.env.CACHE_KV);
    await sync.onMarketMembershipChanged(body.restaurantId);

    return c.json({ success: true, data: { membership } }, 201);
  },
);

routes.delete(
  "/:id/vendors/:restaurantId",
  validateParams(marketVendorParamSchema),
  async (c) => {
    const { id, restaurantId } = c.get("validatedParams");
    const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
    const removed = await service.removeVendor(id, restaurantId);

    if (removed) {
      const sync = new SearchIndexSyncService(c.env.DB, c.env.CACHE_KV);
      await sync.onMarketMembershipChanged(restaurantId);
    }

    return c.json({ success: true, data: { removed } });
  },
);

export default routes;
