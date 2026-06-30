import { Hono } from "hono";
import { z } from "zod";
import type { Context, Next } from "hono";
import type { ManagementEnv } from "../types";
import { TenantService } from "../services/TenantService";

type InternalEnv = {
  Bindings: ManagementEnv;
};

const router = new Hono<InternalEnv>();

const provisionTenantSchema = z.object({
  businessName: z.string().min(2).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(8).max(20).optional(),
  planId: z
    .enum(["trial", "standard", "professional", "enterprise"])
    .nullable()
    .optional(),
  subdomain: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9-]+$/)
    .nullable()
    .optional(),
});

const linkOwnerSchema = z.object({
  ownerUserId: z.string().min(1),
  ownerUsername: z.string().min(1).max(100),
});

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index++) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function requireInternalToken(c: Context<InternalEnv>, next: Next) {
  const expected = c.env.INTERNAL_API_TOKEN;
  const provided = c.req.header("X-Internal-API-Token");
  if (!expected || !provided || !constantTimeEqual(provided, expected)) {
    return c.json(
      {
        success: false,
        error: "Internal API token is required",
        code: "INTERNAL_AUTH_REQUIRED",
      },
      401,
    );
  }

  await next();
}

router.use("*", requireInternalToken);

router.post("/platform-restaurants/:restaurantId/tenant", async (c) => {
  try {
    const body = await c.req.json();
    const data = provisionTenantSchema.parse(body);
    const service = new TenantService(c.env);
    const tenant = await service.provisionPlatformRestaurantTenant({
      platformRestaurantId: c.req.param("restaurantId"),
      ...data,
    });

    return c.json({ success: true, data: { tenant } }, 201);
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

    console.error(
      "[Internal] Provision platform restaurant tenant error:",
      error,
    );
    return c.json(
      {
        success: false,
        error: "Failed to provision tenant",
        code: "TENANT_PROVISION_FAILED",
      },
      500,
    );
  }
});

router.patch("/platform-restaurants/:restaurantId/owner", async (c) => {
  try {
    const body = await c.req.json();
    const data = linkOwnerSchema.parse(body);
    const service = new TenantService(c.env);
    const tenant = await service.linkPlatformRestaurantOwner({
      platformRestaurantId: c.req.param("restaurantId"),
      ...data,
    });

    if (!tenant) {
      return c.json(
        {
          success: false,
          error: "Tenant not found for platform restaurant",
          code: "TENANT_NOT_FOUND",
        },
        404,
      );
    }

    return c.json({ success: true, data: { tenant } });
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
    if (
      error instanceof Error &&
      error.message === "Tenant is already linked to a different owner"
    ) {
      return c.json(
        {
          success: false,
          error: error.message,
          code: "OWNER_LINK_CONFLICT",
        },
        409,
      );
    }

    console.error("[Internal] Link platform restaurant owner error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to link owner",
        code: "OWNER_LINK_FAILED",
      },
      500,
    );
  }
});

export default router;
