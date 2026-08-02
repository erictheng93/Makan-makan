/**
 * QR Codes Routes
 * All HTTP routes for the QR codes feature
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../shared/middleware";
import { moduleGate } from "../../../middleware/moduleGate";
import { rateLimitMiddleware } from "../../../middleware/rateLimiter";
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
  SignedQrEntityParamInput,
  SignedQrQueryInput,
  UpdateTemplateInput,
} from "../schemas/validation";
import type { QRDownloadCaller } from "../types";

// Import services
import { QrCodesService } from "../services/QrCodesService";
import {
  SignedQrVerificationService,
  type SignedQrVerificationFailureReason,
} from "../services/SignedQrVerificationService";

const app = new Hono<{ Bindings: Env }>();

const signedQrVerifyRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyPrefix: "signed_qr_verify",
  message: "Too many QR verification attempts. Please try again later.",
});

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

function signedQrFailure(
  type: "table" | "seat",
  reason: SignedQrVerificationFailureReason,
) {
  const label = type === "table" ? "Table" : "Seat";
  const prefix = type === "table" ? "TABLE_QR" : "SEAT_QR";
  const suffixByReason: Record<SignedQrVerificationFailureReason, string> = {
    malformed: "MALFORMED",
    wrong_type: "WRONG_TYPE",
    signature_invalid: "SIGNATURE_INVALID",
    not_found: "NOT_FOUND",
    inactive: "INACTIVE",
    stale: "STALE",
    mismatch: "MISMATCH",
  };
  const messageByReason: Record<SignedQrVerificationFailureReason, string> = {
    malformed: `${label} QR code format is invalid`,
    wrong_type: `${label} QR code type does not match this endpoint`,
    signature_invalid: `${label} QR code signature is invalid`,
    not_found: `${label} QR code target was not found`,
    inactive: `${label} QR code is inactive or deleted`,
    stale: `${label} QR code has been regenerated`,
    mismatch: `${label} QR code does not match its target`,
  };

  return notFound(
    messageByReason[reason],
    `${prefix}_${suffixByReason[reason]}`,
  );
}

// POST /generate - Generate single QR code
//
// Intentionally NOT moduleGate("table_management"): this is a generic,
// content-based QR generator (arbitrary `content` string) shared across
// features — e.g. admin-dashboard's marketsService.generateMarketQr() calls
// this same endpoint to mint market-entrance QR codes, which has nothing to
// do with the table_management module. Gating it there would over-gate market
// QR generation. Only /bulk below is unambiguously table-shaped (its schema
// requires a `tables` array matching tables/routes bulk-qr).
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
// This is the table-QR bulk generator (schema requires a `tables` array) —
// the same capability as tables/routes POST /bulk-qr, which already carries
// moduleGate("table_management"). Gate it the same way for consistency.
app.post(
  "/bulk",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  moduleGate("table_management"),
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
      createdBy: user.id,
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
 * GET /verify/table - Resolve and verify a signed table QR code (PUBLIC)
 */
app.get(
  "/verify/table",
  signedQrVerifyRateLimit,
  validateQuery(qrCodeSchemas.signedQrQuery),
  async (c) => {
    const { qrCode } = c.get("validatedQuery") as SignedQrQueryInput;
    const service = new SignedQrVerificationService(c.env);
    const result = await service.verifyTableFromQrCode(qrCode);

    if (!result.valid) {
      throw signedQrFailure("table", result.reason);
    }

    return c.json(
      createSuccessResponse(result, "Table QR code verified successfully"),
      HTTP_STATUS.OK,
    );
  },
);

/**
 * GET /verify/seat - Resolve and verify a signed seat QR code (PUBLIC)
 */
app.get(
  "/verify/seat",
  signedQrVerifyRateLimit,
  validateQuery(qrCodeSchemas.signedQrQuery),
  async (c) => {
    const { qrCode } = c.get("validatedQuery") as SignedQrQueryInput;
    const service = new SignedQrVerificationService(c.env);
    const result = await service.verifySeatFromQrCode(qrCode);

    if (!result.valid) {
      throw signedQrFailure("seat", result.reason);
    }

    return c.json(
      createSuccessResponse(result, "Seat QR code verified successfully"),
      HTTP_STATUS.OK,
    );
  },
);

/**
 * GET /verify/table/:entityId - Verify a signed table QR code (PUBLIC)
 */
app.get(
  "/verify/table/:entityId",
  signedQrVerifyRateLimit,
  validateParams(qrCodeSchemas.signedQrEntity),
  validateQuery(qrCodeSchemas.signedQrQuery),
  async (c) => {
    const { entityId } = c.get("validatedParams") as SignedQrEntityParamInput;
    const { qrCode } = c.get("validatedQuery") as SignedQrQueryInput;
    const service = new SignedQrVerificationService(c.env);
    const result = await service.verifyTable(qrCode, entityId);

    if (!result.valid) {
      throw signedQrFailure("table", result.reason);
    }

    return c.json(
      createSuccessResponse(result, "Table QR code verified successfully"),
      HTTP_STATUS.OK,
    );
  },
);

/**
 * GET /verify/seat/:entityId - Verify a signed seat QR code (PUBLIC)
 */
app.get(
  "/verify/seat/:entityId",
  signedQrVerifyRateLimit,
  validateParams(qrCodeSchemas.signedQrEntity),
  validateQuery(qrCodeSchemas.signedQrQuery),
  async (c) => {
    const { entityId } = c.get("validatedParams") as SignedQrEntityParamInput;
    const { qrCode } = c.get("validatedQuery") as SignedQrQueryInput;
    const service = new SignedQrVerificationService(c.env);
    const result = await service.verifySeat(qrCode, entityId);

    if (!result.valid) {
      throw signedQrFailure("seat", result.reason);
    }

    return c.json(
      createSuccessResponse(result, "Seat QR code verified successfully"),
      HTTP_STATUS.OK,
    );
  },
);

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
