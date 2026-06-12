/**
 * QR Codes Routes
 * All HTTP routes for the QR codes feature
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../shared/middleware";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../shared/middleware";
import type { Env } from "../../../shared/types";
import { HTTP_STATUS, USER_ROLES } from "../../../shared/constants";
import { createSuccessResponse } from "../../../shared/utils";
import { badRequest, notFound } from "../../../shared/utils/api-error";
import { marketSlugParamSchema } from "../../markets/schemas/validation";

// Import schemas
import { qrCodeSchemas } from "../schemas/validation";
import type {
  BulkQRInput,
  CreateTemplateInput,
  GenerateQRInput,
  ListTemplatesInput,
  QRCodeBatchParamInput,
  QRCodeIdParamInput,
  QRStatsInput,
  QRTemplateIdParamInput,
  ShopQrCodeParamInput,
  UpdateTemplateInput,
} from "../schemas/validation";
import type { QRDownloadCaller } from "../types";

// Import services
import { QrCodesService } from "../services/QrCodesService";

const app = new Hono<{ Bindings: Env }>();

function qrDownloadCaller(user: {
  role: number;
  restaurantId?: string | number | null;
}): QRDownloadCaller {
  return {
    userRole: user.role,
    userRestaurantId:
      user.restaurantId == null ? undefined : String(user.restaurantId),
  };
}

// POST /generate - Generate single QR code
app.post(
  "/generate",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.CHEF,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateBody(qrCodeSchemas.generate),
  async (c) => {
    const data = c.get("validatedBody") as GenerateQRInput;
    const user = c.get("user");
    const service = new QrCodesService(c.env);

    const qrCode = await service.generateQR(
      data,
      user?.id,
      user?.restaurantId == null ? undefined : String(user.restaurantId),
    );

    return c.json(
      createSuccessResponse(qrCode, "QR code generated successfully"),
      HTTP_STATUS.CREATED,
    );
  },
);

// POST /bulk - Generate bulk QR codes
app.post(
  "/bulk",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(qrCodeSchemas.bulk),
  async (c) => {
    const data = c.get("validatedBody") as BulkQRInput;
    const user = c.get("user");
    const service = new QrCodesService(c.env);

    const batch = await service.generateBulkQR(
      data,
      user?.id,
      user?.restaurantId == null ? undefined : String(user.restaurantId),
    );

    return c.json(
      createSuccessResponse(batch, "Bulk QR codes generated successfully"),
      HTTP_STATUS.CREATED,
    );
  },
);

// GET /:id/download - Download QR code
app.get(
  "/:id/download",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.CHEF,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(qrCodeSchemas.qrCodeParams),
  async (c) => {
    const { id } = c.get("validatedParams") as QRCodeIdParamInput;
    const user = c.get("user");
    const service = new QrCodesService(c.env);

    const result = await service.downloadQR(id, qrDownloadCaller(user));

    if (!result) {
      throw notFound("QR code not found", "QR_CODE_NOT_FOUND");
    }

    return new Response(result.data, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  },
);

// GET /batch/:batchId/download - Download batch QR codes
app.get(
  "/batch/:batchId/download",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.CHEF,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(qrCodeSchemas.batchParams),
  async (c) => {
    const { batchId } = c.get("validatedParams") as QRCodeBatchParamInput;
    const user = c.get("user");
    const service = new QrCodesService(c.env);

    const result = await service.downloadBatch(batchId, qrDownloadCaller(user));

    if (!result) {
      throw notFound("Batch not found", "BATCH_NOT_FOUND");
    }

    return new Response(result.data, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  },
);

// GET /stats - Get QR code statistics
app.get(
  "/stats",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(qrCodeSchemas.stats),
  async (c) => {
    const query = c.get("validatedQuery") as QRStatsInput;
    const user = c.get("user");
    const service = new QrCodesService(c.env);

    const restaurantId =
      user?.role === USER_ROLES.ADMIN
        ? query.restaurantId !== undefined
          ? String(query.restaurantId)
          : user.restaurantId == null
            ? undefined
            : String(user.restaurantId)
        : user?.restaurantId == null
          ? undefined
          : String(user.restaurantId);

    if (user?.role !== USER_ROLES.ADMIN && !restaurantId) {
      throw badRequest("Restaurant ID is required");
    }

    const stats = await service.getStatistics(restaurantId);

    return c.json(createSuccessResponse(stats), HTTP_STATUS.OK);
  },
);

// Template management routes

// GET /templates - List QR code templates
app.get(
  "/templates",
  authMiddleware,
  validateQuery(qrCodeSchemas.listTemplates),
  async (c) => {
    const query = c.get("validatedQuery") as ListTemplatesInput;
    const service = new QrCodesService(c.env);

    const templates = await service.listTemplates(query.category);

    return c.json(createSuccessResponse(templates), HTTP_STATUS.OK);
  },
);

// GET /templates/:id - Get single template
app.get(
  "/templates/:id",
  authMiddleware,
  validateParams(qrCodeSchemas.params),
  async (c) => {
    const { id } = c.get("validatedParams") as QRTemplateIdParamInput;
    const service = new QrCodesService(c.env);

    const template = await service.getTemplate(id);

    if (!template) {
      throw notFound("Template not found", "TEMPLATE_NOT_FOUND");
    }

    return c.json(createSuccessResponse(template), HTTP_STATUS.OK);
  },
);

// POST /templates - Create new template
app.post(
  "/templates",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(qrCodeSchemas.createTemplate),
  async (c) => {
    const data = c.get("validatedBody") as CreateTemplateInput;
    const user = c.get("user");
    const service = new QrCodesService(c.env);

    // Inject createdBy from authenticated user
    const template = await service.createTemplate({
      ...data,
      createdBy: user?.id || 1,
    });

    return c.json(
      createSuccessResponse(template, "Template created successfully"),
      HTTP_STATUS.CREATED,
    );
  },
);

// PUT /templates/:id - Update template
app.put(
  "/templates/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(qrCodeSchemas.params),
  validateBody(qrCodeSchemas.updateTemplate),
  async (c) => {
    const { id } = c.get("validatedParams") as QRTemplateIdParamInput;
    const data = c.get("validatedBody") as UpdateTemplateInput;
    const service = new QrCodesService(c.env);

    const template = await service.updateTemplate(id, data);

    if (!template) {
      throw notFound("Template not found", "TEMPLATE_NOT_FOUND");
    }

    return c.json(
      createSuccessResponse(template, "Template updated successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// DELETE /templates/:id - Delete template
app.delete(
  "/templates/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(qrCodeSchemas.params),
  async (c) => {
    const { id } = c.get("validatedParams") as QRTemplateIdParamInput;
    const service = new QrCodesService(c.env);

    const deleted = await service.deleteTemplate(id);

    if (!deleted) {
      throw notFound("Template not found", "TEMPLATE_NOT_FOUND");
    }

    return c.json(
      createSuccessResponse(null, "Template deleted successfully"),
      HTTP_STATUS.OK,
    );
  },
);

// ==================== Shop QR Code Verification ====================

/**
 * GET /verify/market/:slug - Verify market-level QR code (PUBLIC)
 * This endpoint is public and does not require authentication.
 * Used by customers scanning market entrance QR codes.
 */
app.get(
  "/verify/market/:slug",
  validateParams(marketSlugParamSchema),
  async (c) => {
    const { slug } = c.get("validatedParams") as { slug: string };

    const { MarketsService } =
      await import("../../markets/services/MarketsService");
    const marketsService = new MarketsService(c.env.DB, c.env.CACHE_KV);
    const result = await marketsService.getMarketBySlug(slug);

    if (!result) {
      throw notFound("Invalid market QR code", "MARKET_QR_INVALID");
    }

    return c.json(
      createSuccessResponse(
        {
          valid: true,
          marketId: result.market.id,
          marketSlug: result.market.slug,
          marketName: result.market.name,
          marketUrl: `/markets/${result.market.slug}`,
          market: result.market,
        },
        "Market QR code verified successfully",
      ),
      HTTP_STATUS.OK,
    );
  },
);

/**
 * GET /verify/shop/:qrCode - Verify shop-level QR code (PUBLIC)
 * This endpoint is public and does not require authentication
 * Used by customers scanning shop QR codes
 */
app.get(
  "/verify/shop/:qrCode",
  validateParams(qrCodeSchemas.shopQrCode),
  async (c) => {
    const { qrCode } = c.get("validatedParams") as ShopQrCodeParamInput;

    // Import RestaurantsService dynamically to avoid circular dependencies
    const { RestaurantsService } =
      await import("../../restaurants/services/RestaurantsService");
    const restaurantsService = new RestaurantsService(
      c.env.DB,
      c.env,
      c.env.CACHE_KV,
    );

    const result = await restaurantsService.verifyShopQrCode(qrCode);

    if (!result.valid) {
      throw notFound("Invalid or expired QR code", "QR_CODE_INVALID");
    }

    return c.json(
      createSuccessResponse(
        {
          valid: true,
          restaurantId: result.restaurantId,
          restaurant: result.restaurant,
        },
        "QR code verified successfully",
      ),
      HTTP_STATUS.OK,
    );
  },
);

export default app;
