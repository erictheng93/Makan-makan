import { Hono } from "hono";
import { z } from "zod";
import type { Context, Next } from "hono";
import {
  ApiError,
  badRequest,
  conflict,
  notFound,
  unauthorized,
} from "@makanmasak/utils";
import type { ManagementEnv } from "../types";
import { TenantService } from "../services/TenantService";

type InternalEnv = {
  Bindings: ManagementEnv;
};

const router = new Hono<InternalEnv>();

const provisionTenantSchema = z.object({
  businessName: z.string().min(2).max(100),
  contactEmail: z.email(),
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
    throw unauthorized(
      "Internal API token is required",
      "INTERNAL_AUTH_REQUIRED",
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
      throw badRequest("Validation failed", "VALIDATION_ERROR", error.issues);
    }
    if (error instanceof ApiError) throw error;

    console.error(
      "[Internal] Provision platform restaurant tenant error:",
      error,
    );
    throw new ApiError(
      "TENANT_PROVISION_FAILED",
      "Failed to provision tenant",
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
      throw notFound(
        "Tenant not found for platform restaurant",
        "TENANT_NOT_FOUND",
      );
    }

    return c.json({ success: true, data: { tenant } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw badRequest("Validation failed", "VALIDATION_ERROR", error.issues);
    }
    if (error instanceof ApiError) throw error;
    if (
      error instanceof Error &&
      error.message === "Tenant is already linked to a different owner"
    ) {
      throw conflict(error.message, "OWNER_LINK_CONFLICT");
    }

    console.error("[Internal] Link platform restaurant owner error:", error);
    throw new ApiError("OWNER_LINK_FAILED", "Failed to link owner", 500);
  }
});

export default router;
