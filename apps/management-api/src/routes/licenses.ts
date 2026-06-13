/**
 * License Management Routes
 *
 * Handles license generation and validation for independent deployments
 */

import { Hono } from "hono";
import { z } from "zod";
import type { ManagementEnv, LicenseTier, LicenseFeatures } from "../types";
import { generateLicenseKey } from "../utils/random";

const router = new Hono<{ Bindings: ManagementEnv }>();

// ============================================================
// License Features by Tier
// ============================================================

const LICENSE_FEATURES: Record<LicenseTier, LicenseFeatures> = {
  standard: {
    maxRestaurants: 1,
    aiAnalytics: false,
    advancedScheduling: true,
    leaveManagement: true,
    partnerships: false,
    customBranding: false,
    prioritySupport: false,
    apiAccess: false,
  },
  professional: {
    maxRestaurants: 3,
    aiAnalytics: true,
    advancedScheduling: true,
    leaveManagement: true,
    partnerships: true,
    customBranding: true,
    prioritySupport: true,
    apiAccess: false,
  },
  enterprise: {
    maxRestaurants: 10,
    aiAnalytics: true,
    advancedScheduling: true,
    leaveManagement: true,
    partnerships: true,
    customBranding: true,
    prioritySupport: true,
    apiAccess: true,
  },
};

// ============================================================
// Validation Schemas
// ============================================================

const generateLicenseSchema = z.object({
  tenantId: z.string().min(1),
  tier: z.enum(["standard", "professional", "enterprise"]),
  validityMonths: z.number().int().min(1).max(36).default(12),
});

const verifyLicenseSchema = z.object({
  tenantId: z.string().min(1),
  licenseKey: z.string().min(1),
  version: z.string(),
  timestamp: z.number(),
});

// ============================================================
// Helper Functions
// ============================================================

/**
 * Calculate expiration date
 */
function calculateExpirationDate(validityMonths: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + validityMonths);
  return date.toISOString();
}

// ============================================================
// Routes
// ============================================================

/**
 * Generate new license for tenant
 * POST /api/v1/licenses/generate
 */
router.post("/generate", async (c) => {
  try {
    const body = await c.req.json();
    const validated = generateLicenseSchema.parse(body);

    // Generate unique code from tenant ID
    const licenseKey = generateLicenseKey(validated.tier);
    const expiresAt = calculateExpirationDate(validated.validityMonths);

    // Store license in database
    const stmt = c.env.MANAGEMENT_DB.prepare(`
      INSERT INTO licenses (id, tenant_id, license_key, tier, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const licenseId = crypto.randomUUID();
    await stmt
      .bind(
        licenseId,
        validated.tenantId,
        licenseKey,
        validated.tier,
        expiresAt,
        new Date().toISOString(),
      )
      .run();

    // Update tenant with license key
    await c.env.MANAGEMENT_DB.prepare(
      `
      UPDATE tenants SET license_key = ?, license_tier = ?, license_expires_at = ?, updated_at = ?
      WHERE id = ?
    `,
    )
      .bind(
        licenseKey,
        validated.tier,
        expiresAt,
        new Date().toISOString(),
        validated.tenantId,
      )
      .run();

    return c.json({
      success: true,
      data: {
        licenseId,
        licenseKey,
        tier: validated.tier,
        features: LICENSE_FEATURES[validated.tier],
        expiresAt,
      },
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

    console.error("[Licenses] Generate error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to generate license",
        code: "GENERATE_FAILED",
      },
      500,
    );
  }
});

/**
 * Verify license (called by independent deployments)
 * POST /api/v1/licenses/verify
 */
router.post("/verify", async (c) => {
  try {
    const body = await c.req.json();
    const validated = verifyLicenseSchema.parse(body);

    // Query license from database
    const result = await c.env.MANAGEMENT_DB.prepare(
      `
      SELECT t.id, t.license_key, t.license_tier, t.license_expires_at, t.status
      FROM tenants t
      WHERE t.id = ? AND t.license_key = ?
    `,
    )
      .bind(validated.tenantId, validated.licenseKey)
      .first<{
        id: string;
        license_key: string;
        license_tier: LicenseTier;
        license_expires_at: string;
        status: string;
      }>();

    if (!result) {
      return c.json({
        valid: false,
        error: "Invalid license key or tenant ID",
      });
    }

    // Check tenant status
    if (result.status !== "active") {
      return c.json({
        valid: false,
        error: `Tenant is ${result.status}`,
      });
    }

    // Check expiration
    if (result.license_expires_at) {
      const expiryDate = new Date(result.license_expires_at);
      if (expiryDate < new Date()) {
        return c.json({
          valid: false,
          error: "License has expired",
          expiresAt: result.license_expires_at,
        });
      }
    }

    // License is valid
    return c.json({
      valid: true,
      tier: result.license_tier,
      features: LICENSE_FEATURES[result.license_tier],
      expiresAt: result.license_expires_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          valid: false,
          error: "Invalid request format",
        },
        400,
      );
    }

    console.error("[Licenses] Verify error:", error);
    return c.json(
      {
        valid: false,
        error: "Verification failed",
      },
      500,
    );
  }
});

/**
 * Get license info for tenant
 * GET /api/v1/licenses/:tenantId
 */
router.get("/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");

  try {
    const result = await c.env.MANAGEMENT_DB.prepare(
      `
      SELECT id, license_key, license_tier, license_expires_at, status
      FROM tenants
      WHERE id = ?
    `,
    )
      .bind(tenantId)
      .first<{
        id: string;
        license_key: string;
        license_tier: LicenseTier;
        license_expires_at: string;
        status: string;
      }>();

    if (!result) {
      return c.json(
        {
          success: false,
          error: "Tenant not found",
          code: "NOT_FOUND",
        },
        404,
      );
    }

    const isExpired = result.license_expires_at
      ? new Date(result.license_expires_at) < new Date()
      : false;

    return c.json({
      success: true,
      data: {
        tenantId: result.id,
        licenseKey: result.license_key,
        tier: result.license_tier,
        features: LICENSE_FEATURES[result.license_tier],
        expiresAt: result.license_expires_at,
        status: result.status,
        isExpired,
      },
    });
  } catch (error) {
    console.error("[Licenses] Get error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get license info",
        code: "GET_FAILED",
      },
      500,
    );
  }
});

/**
 * Renew license
 * POST /api/v1/licenses/:tenantId/renew
 */
router.post("/:tenantId/renew", async (c) => {
  const tenantId = c.req.param("tenantId");

  try {
    const body = await c.req.json();
    const validityMonths = body.validityMonths || 12;

    // Get current tenant
    const tenant = await c.env.MANAGEMENT_DB.prepare(
      `
      SELECT id, license_tier, license_expires_at FROM tenants WHERE id = ?
    `,
    )
      .bind(tenantId)
      .first<{
        id: string;
        license_tier: LicenseTier;
        license_expires_at: string;
      }>();

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

    // Calculate new expiration (from current expiry or now, whichever is later)
    const currentExpiry = tenant.license_expires_at
      ? new Date(tenant.license_expires_at)
      : new Date();
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
    baseDate.setMonth(baseDate.getMonth() + validityMonths);
    const newExpiresAt = baseDate.toISOString();

    // Update tenant
    await c.env.MANAGEMENT_DB.prepare(
      `
      UPDATE tenants SET license_expires_at = ?, updated_at = ? WHERE id = ?
    `,
    )
      .bind(newExpiresAt, new Date().toISOString(), tenantId)
      .run();

    return c.json({
      success: true,
      data: {
        tenantId,
        tier: tenant.license_tier,
        newExpiresAt,
        addedMonths: validityMonths,
      },
    });
  } catch (error) {
    console.error("[Licenses] Renew error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to renew license",
        code: "RENEW_FAILED",
      },
      500,
    );
  }
});

/**
 * Upgrade license tier
 * POST /api/v1/licenses/:tenantId/upgrade
 */
router.post("/:tenantId/upgrade", async (c) => {
  const tenantId = c.req.param("tenantId");

  try {
    const body = await c.req.json();
    const newTier = body.tier as LicenseTier;

    if (!["standard", "professional", "enterprise"].includes(newTier)) {
      return c.json(
        {
          success: false,
          error: "Invalid tier",
          code: "VALIDATION_ERROR",
        },
        400,
      );
    }

    // Get current tenant
    const tenant = await c.env.MANAGEMENT_DB.prepare(
      `
      SELECT id, license_tier FROM tenants WHERE id = ?
    `,
    )
      .bind(tenantId)
      .first<{
        id: string;
        license_tier: LicenseTier;
      }>();

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

    // Generate new license key for new tier
    const newLicenseKey = generateLicenseKey(newTier);

    // Update tenant
    await c.env.MANAGEMENT_DB.prepare(
      `
      UPDATE tenants SET license_tier = ?, license_key = ?, updated_at = ? WHERE id = ?
    `,
    )
      .bind(newTier, newLicenseKey, new Date().toISOString(), tenantId)
      .run();

    return c.json({
      success: true,
      data: {
        tenantId,
        previousTier: tenant.license_tier,
        newTier,
        newLicenseKey,
        features: LICENSE_FEATURES[newTier],
      },
    });
  } catch (error) {
    console.error("[Licenses] Upgrade error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to upgrade license",
        code: "UPGRADE_FAILED",
      },
      500,
    );
  }
});

export default router;
