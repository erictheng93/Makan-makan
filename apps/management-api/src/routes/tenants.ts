/**
 * Tenant Management Routes
 *
 * CRUD operations for tenant management
 */

import { Hono } from "hono";
import { z } from "zod";
import type {
  ManagementEnv,
  Tenant,
  CreateTenantRequest,
  UpdateTenantRequest,
} from "../types";
import { TenantService } from "../services/TenantService";
import { randomBase36 } from "../utils/random";

const router = new Hono<{ Bindings: ManagementEnv }>();

// ============================================================
// Validation Schemas
// ============================================================

const createTenantSchema = z.object({
  businessName: z.string().min(2).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  subdomain: z
    .string()
    .min(3)
    .max(30)
    .regex(
      /^[a-z0-9-]+$/,
      "Subdomain must be lowercase alphanumeric with hyphens",
    )
    .optional(),
  customDomain: z.string().optional(),
  licenseTier: z.enum(["standard", "professional", "enterprise"]),
});

const updateTenantSchema = z.object({
  businessName: z.string().min(2).max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  customDomain: z.string().optional(),
  licenseTier: z.enum(["standard", "professional", "enterprise"]).optional(),
  status: z
    .enum(["pending", "provisioning", "active", "suspended", "terminated"])
    .optional(),
});

// ============================================================
// Routes
// ============================================================

/**
 * List all tenants
 * GET /api/v1/tenants
 */
router.get("/", async (c) => {
  const tenantService = new TenantService(c.env);

  // Parse query parameters
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const status = c.req.query("status");
  const search = c.req.query("search");

  try {
    const result = await tenantService.listTenants({
      page,
      limit,
      status: status as Tenant["status"] | undefined,
      search,
    });

    return c.json({
      success: true,
      data: result.tenants,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    console.error("[Tenants] List error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to list tenants",
        code: "LIST_FAILED",
      },
      500,
    );
  }
});

/**
 * Get tenant by ID
 * GET /api/v1/tenants/:id
 */
router.get("/:id", async (c) => {
  const tenantService = new TenantService(c.env);
  const tenantId = c.req.param("id");

  try {
    const tenant = await tenantService.getTenantById(tenantId);

    if (!tenant) {
      return c.json(
        {
          success: false,
          error: "Tenant not found",
          code: "NOT_FOUND",
        },
        404,
      );
    }

    return c.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error("[Tenants] Get error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get tenant",
        code: "GET_FAILED",
      },
      500,
    );
  }
});

/**
 * Create new tenant
 * POST /api/v1/tenants
 */
router.post("/", async (c) => {
  const tenantService = new TenantService(c.env);

  try {
    const body = await c.req.json();
    const validated = createTenantSchema.parse(body);

    // Auto-generate subdomain from businessName if not provided
    let subdomain = validated.subdomain;
    if (!subdomain) {
      const base = validated.businessName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 20);
      const suffix = randomBase36(6);
      subdomain = base ? `${base}-${suffix}` : `tenant-${suffix}`;
    }

    // Check subdomain availability
    const existing = await tenantService.getTenantBySubdomain(subdomain);
    if (existing) {
      return c.json(
        {
          success: false,
          error: "Subdomain already in use",
          code: "SUBDOMAIN_TAKEN",
        },
        409,
      );
    }

    const tenant = await tenantService.createTenant({
      ...validated,
      subdomain,
    } as CreateTenantRequest);

    return c.json(
      {
        success: true,
        data: tenant,
      },
      201,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: error.errors,
        },
        400,
      );
    }

    console.error("[Tenants] Create error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to create tenant",
        code: "CREATE_FAILED",
      },
      500,
    );
  }
});

/**
 * Update tenant
 * PATCH /api/v1/tenants/:id
 */
router.patch("/:id", async (c) => {
  const tenantService = new TenantService(c.env);
  const tenantId = c.req.param("id");

  try {
    const body = await c.req.json();
    const validated = updateTenantSchema.parse(body);

    const tenant = await tenantService.updateTenant(
      tenantId,
      validated as UpdateTenantRequest,
    );

    if (!tenant) {
      return c.json(
        {
          success: false,
          error: "Tenant not found",
          code: "NOT_FOUND",
        },
        404,
      );
    }

    return c.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: error.errors,
        },
        400,
      );
    }

    console.error("[Tenants] Update error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to update tenant",
        code: "UPDATE_FAILED",
      },
      500,
    );
  }
});

/**
 * Delete tenant (soft delete)
 * DELETE /api/v1/tenants/:id
 */
router.delete("/:id", async (c) => {
  const tenantService = new TenantService(c.env);
  const tenantId = c.req.param("id");

  try {
    const success = await tenantService.deleteTenant(tenantId);

    if (!success) {
      return c.json(
        {
          success: false,
          error: "Tenant not found",
          code: "NOT_FOUND",
        },
        404,
      );
    }

    return c.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error("[Tenants] Delete error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to delete tenant",
        code: "DELETE_FAILED",
      },
      500,
    );
  }
});

/**
 * Get tenant resources
 * GET /api/v1/tenants/:id/resources
 */
router.get("/:id/resources", async (c) => {
  const tenantService = new TenantService(c.env);
  const tenantId = c.req.param("id");

  try {
    const resources = await tenantService.getTenantResources(tenantId);

    return c.json({
      success: true,
      data: resources,
    });
  } catch (error) {
    console.error("[Tenants] Get resources error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get tenant resources",
        code: "GET_RESOURCES_FAILED",
      },
      500,
    );
  }
});

export default router;
