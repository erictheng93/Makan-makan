import { Hono } from "hono";
import type { z } from "zod";
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
  importMarketVendorsSchema,
  marketJoinRequestIdParamSchema,
  marketIdParamSchema,
  marketVendorParamSchema,
  updateMarketSchema,
} from "../schemas/validation";
import { MarketsService } from "../services/MarketsService";
import { RestaurantsService } from "../../restaurants/services/RestaurantsService";

const routes = new Hono<{ Bindings: Env }>();

type ImportMarketVendorInput = z.infer<
  typeof importMarketVendorsSchema
>["vendors"][number];

type VendorImportIssue = {
  index: number;
  code:
    | "already_attached"
    | "city_defaulted"
    | "coordinates_missing"
    | "duplicate_in_payload"
    | "phone_defaulted"
    | "restaurant_not_found";
  severity: "blocking" | "warning";
  message: string;
  field?: "city" | "coordinates" | "phone";
  restaurantId?: string;
  restaurantName?: string;
};

const newVendorDuplicateKey = (vendor: ImportMarketVendorInput) =>
  vendor.restaurantId
    ? `id:${vendor.restaurantId}`
    : `new:${vendor.name?.trim().toLowerCase() ?? ""}\u0000${
        vendor.address?.trim().toLowerCase() ?? ""
      }`;

async function dryRunVendorImport(input: {
  vendors: ImportMarketVendorInput[];
  marketId: string;
  marketCity: string;
  marketsService: MarketsService;
  restaurantsService: RestaurantsService;
}) {
  const issues: VendorImportIssue[] = [];
  const results = [];
  const seen = new Set<string>();
  let wouldCreateRestaurants = 0;
  let wouldAttachVendors = 0;
  let skipped = 0;

  for (const [index, vendor] of input.vendors.entries()) {
    const duplicateKey = newVendorDuplicateKey(vendor);
    if (seen.has(duplicateKey)) {
      skipped += 1;
      issues.push({
        index,
        code: "duplicate_in_payload",
        severity: "blocking",
        message: "Vendor appears more than once in this import payload",
        restaurantId: vendor.restaurantId,
        restaurantName: vendor.name,
      });
      results.push({
        status: "skipped",
        reason: "duplicate_in_payload",
        restaurantId: vendor.restaurantId,
        restaurantName: vendor.name,
        stallNumber: vendor.stallNumber ?? null,
      });
      continue;
    }
    seen.add(duplicateKey);

    if (!vendor.restaurantId) {
      wouldCreateRestaurants += 1;
      wouldAttachVendors += 1;
      if (!vendor.phone) {
        issues.push({
          index,
          code: "phone_defaulted",
          severity: "warning",
          field: "phone",
          message: "Phone is missing and would default to 00000000",
          restaurantName: vendor.name,
        });
      }
      if (!vendor.city) {
        issues.push({
          index,
          code: "city_defaulted",
          severity: "warning",
          field: "city",
          message: `City is missing and would default to ${input.marketCity}`,
          restaurantName: vendor.name,
        });
      }
      if (
        typeof vendor.latitude !== "number" ||
        typeof vendor.longitude !== "number"
      ) {
        issues.push({
          index,
          code: "coordinates_missing",
          severity: "warning",
          field: "coordinates",
          message: "Coordinates are missing and map-based discovery is weaker",
          restaurantName: vendor.name,
        });
      }
      results.push({
        status: "would_create",
        restaurantName: vendor.name,
        stallNumber: vendor.stallNumber ?? null,
      });
      continue;
    }

    const restaurant = await input.restaurantsService.getRestaurant(
      vendor.restaurantId,
    );
    if (!restaurant || !restaurant.isActive) {
      skipped += 1;
      issues.push({
        index,
        code: "restaurant_not_found",
        severity: "blocking",
        message: "Restaurant was not found or is inactive",
        restaurantId: vendor.restaurantId,
        restaurantName: vendor.name,
      });
      results.push({
        status: "skipped",
        reason: "restaurant_not_found",
        restaurantId: vendor.restaurantId,
        restaurantName: vendor.name,
        stallNumber: vendor.stallNumber ?? null,
      });
      continue;
    }

    const memberships = await input.marketsService.listRestaurantMemberships(
      vendor.restaurantId,
    );
    if (
      memberships.memberships.some(
        (membership) => membership.marketId === input.marketId,
      )
    ) {
      skipped += 1;
      issues.push({
        index,
        code: "already_attached",
        severity: "blocking",
        message: "Restaurant already belongs to this market",
        restaurantId: vendor.restaurantId,
        restaurantName: restaurant.name,
      });
      results.push({
        status: "skipped",
        reason: "already_attached",
        restaurantId: vendor.restaurantId,
        restaurantName: restaurant.name,
        stallNumber: vendor.stallNumber ?? null,
      });
      continue;
    }

    wouldAttachVendors += 1;
    results.push({
      status: "would_attach",
      restaurantId: vendor.restaurantId,
      restaurantName: restaurant.name,
      stallNumber: vendor.stallNumber ?? null,
    });
  }

  return {
    dryRun: true,
    wouldCreateRestaurants,
    wouldAttachVendors,
    skipped,
    issueCount: issues.length,
    blockingIssueCount: issues.filter((issue) => issue.severity === "blocking")
      .length,
    warningIssueCount: issues.filter((issue) => issue.severity === "warning")
      .length,
    issues,
    results,
  };
}

routes.use("*", requireRole([0]));

routes.get("/readiness", async (c) => {
  const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
  const data = await service.listAdminReadiness({ limit: 100 });
  return c.json({ success: true, data });
});

routes.get("/area-readiness", async (c) => {
  const service = new MarketsService(c.env.DB, c.env.CACHE_KV);
  const data = await service.listAreaReadiness();
  return c.json({ success: true, data });
});

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
    const existing = await service.getActiveVendorMembership(
      id,
      body.restaurantId,
    );

    if (existing) {
      return c.json(
        {
          success: false,
          error: {
            code: "MARKET_VENDOR_ALREADY_ATTACHED",
            message: "Restaurant already belongs to this market",
          },
        },
        409,
      );
    }

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

routes.post(
  "/:id/vendor-imports",
  validateParams(marketIdParamSchema),
  validateBody(importMarketVendorsSchema),
  async (c) => {
    const { id } = c.get("validatedParams");
    const { dryRun = false, vendors } = c.get("validatedBody");
    const marketsService = new MarketsService(c.env.DB, c.env.CACHE_KV);
    const restaurantsService = new RestaurantsService(
      c.env.DB,
      c.env,
      c.env.CACHE_KV,
    );
    const market = await marketsService.getMarketById(id);

    if (!market || market.deletedAt) {
      return c.json(
        {
          success: false,
          error: { code: "MARKET_NOT_FOUND", message: "Market not found" },
        },
        404,
      );
    }

    if (dryRun) {
      const data = await dryRunVendorImport({
        vendors,
        marketId: id,
        marketCity: market.city,
        marketsService,
        restaurantsService,
      });
      return c.json({ success: true, data });
    }

    const sync = new SearchIndexSyncService(c.env.DB, c.env.CACHE_KV);
    const results = [];
    let createdRestaurants = 0;
    let attachedVendors = 0;
    let skipped = 0;

    for (const vendor of vendors) {
      let restaurantId = vendor.restaurantId;
      let restaurantName = vendor.name;
      let status: "attached" | "created" = "attached";

      if (!restaurantId) {
        const restaurant = await restaurantsService.createRestaurant({
          name: vendor.name!,
          type: vendor.type ?? "market_stall",
          category: vendor.category ?? "food",
          description: vendor.description,
          address: vendor.address!,
          district: vendor.district!,
          city: vendor.city ?? market.city,
          phone: vendor.phone ?? "00000000",
          email: vendor.email,
          website: vendor.website,
          latitude: vendor.latitude ?? null,
          longitude: vendor.longitude ?? null,
          businessHours: market.openingHours ?? {},
        });
        restaurantId = restaurant.id;
        restaurantName = restaurant.name;
        status = "created";
        createdRestaurants += 1;
      } else {
        const restaurant = await restaurantsService.getRestaurant(restaurantId);
        if (!restaurant || !restaurant.isActive) {
          skipped += 1;
          results.push({
            status: "skipped",
            reason: "restaurant_not_found",
            restaurantId,
            restaurantName,
            stallNumber: vendor.stallNumber ?? null,
          });
          continue;
        }
        restaurantName = restaurant.name;
      }

      const memberships =
        await marketsService.listRestaurantMemberships(restaurantId);
      if (
        memberships.memberships.some((membership) => membership.marketId === id)
      ) {
        skipped += 1;
        results.push({
          status: "skipped",
          reason: "already_attached",
          restaurantId,
          restaurantName,
          stallNumber: vendor.stallNumber ?? null,
        });
        continue;
      }

      const membership = await marketsService.addVendor(id, {
        restaurantId,
        stallNumber: vendor.stallNumber,
        isPrimary: vendor.isPrimary,
      });

      if (!membership) {
        skipped += 1;
        results.push({
          status: "skipped",
          reason: "market_not_found",
          restaurantId,
          restaurantName,
          stallNumber: vendor.stallNumber ?? null,
        });
        continue;
      }

      await sync.onMarketMembershipChanged(restaurantId);
      attachedVendors += 1;
      results.push({
        status,
        restaurantId,
        restaurantName,
        membershipId: membership.id,
        stallNumber: membership.stallNumber,
      });
    }

    const catalogReadiness = await marketsService.getCatalogReadiness(id);

    return c.json({
      success: true,
      data: {
        createdRestaurants,
        attachedVendors,
        skipped,
        catalogReadiness,
        results,
      },
    });
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
