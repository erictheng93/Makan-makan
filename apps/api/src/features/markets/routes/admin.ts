import { Hono } from "hono";
import { requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../../middleware/validation";
import type { Env } from "../../../shared/types";
import { SearchIndexSyncService } from "../../discovery/services/SearchIndexSyncService";
import {
  addMarketVendorSchema,
  adminMarketJoinRequestsQuerySchema,
  adminVendorCandidatesQuerySchema,
  approveMarketJoinRequestSchema,
  createMarketSchema,
  marketJoinRequestIdParamSchema,
  marketIdParamSchema,
  marketVendorParamSchema,
  updateMarketSchema,
} from "../schemas/validation";
import { MarketsService } from "../services/MarketsService";

const routes = new Hono<{ Bindings: Env }>();

routes.use("*", requireRole([0]));

routes.get(
  "/vendor-candidates",
  validateQuery(adminVendorCandidatesQuerySchema),
  async (c) => {
    const query = c.get("validatedQuery");
    const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
    const data = await service.listVendorCandidates(query);
    return c.json({ success: true, data });
  },
);

routes.get(
  "/join-requests",
  validateQuery(adminMarketJoinRequestsQuerySchema),
  async (c) => {
    const query = c.get("validatedQuery");
    const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
    const data = await service.listJoinRequests(query);
    return c.json({ success: true, data });
  },
);

routes.post(
  "/join-requests/:requestId/approve",
  validateParams(marketJoinRequestIdParamSchema),
  validateBody(approveMarketJoinRequestSchema),
  async (c) => {
    const { requestId } = c.get("validatedParams");
    const body = c.get("validatedBody");
    const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
    const result = await service.approveJoinRequest(requestId, body);

    if (result.status === "not_found") {
      return c.json(
        {
          success: false,
          error: {
            code: "MARKET_JOIN_REQUEST_NOT_FOUND",
            message: "Market join request not found",
          },
        },
        404,
      );
    }

    if (result.status === "not_pending") {
      return c.json(
        {
          success: false,
          error: {
            code: "MARKET_JOIN_REQUEST_NOT_PENDING",
            message: "Market join request is not pending",
          },
        },
        409,
      );
    }

    if (result.status === "market_not_found") {
      return c.json(
        {
          success: false,
          error: { code: "MARKET_NOT_FOUND", message: "Market not found" },
        },
        404,
      );
    }

    const sync = new SearchIndexSyncService(c.env.DB, c.env.CACHE_KV);
    await sync.onMarketMembershipChanged(result.membership.restaurantId);

    return c.json({
      success: true,
      data: { request: result.request, membership: result.membership },
    });
  },
);

routes.post(
  "/join-requests/:requestId/reject",
  validateParams(marketJoinRequestIdParamSchema),
  async (c) => {
    const { requestId } = c.get("validatedParams");
    const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
    const result = await service.rejectJoinRequest(requestId);

    if (result.status === "not_found") {
      return c.json(
        {
          success: false,
          error: {
            code: "MARKET_JOIN_REQUEST_NOT_FOUND",
            message: "Market join request not found",
          },
        },
        404,
      );
    }

    if (result.status === "not_pending") {
      return c.json(
        {
          success: false,
          error: {
            code: "MARKET_JOIN_REQUEST_NOT_PENDING",
            message: "Market join request is not pending",
          },
        },
        409,
      );
    }

    return c.json({ success: true, data: { request: result.request } });
  },
);

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

    const sync = new SearchIndexSyncService(c.env.DB, c.env.CACHE_KV);
    await sync.onMarketChanged(id);

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

  const sync = new SearchIndexSyncService(c.env.DB, c.env.CACHE_KV);
  await sync.onMarketChanged(id);

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
