/**
 * Onboarding Routes
 *
 * Self-service onboarding API endpoints
 */

import { Hono } from "hono";
import { z } from "zod";
import type { ManagementEnv } from "../types";
import { OnboardingService } from "../services/OnboardingService";

const router = new Hono<{ Bindings: ManagementEnv }>();

// ============================================================
// Validation Schemas
// ============================================================

const createApplicationSchema = z.object({
  businessName: z.string().min(2).max(100),
  contactName: z.string().min(2).max(100),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(8).max(20),
  planId: z
    .enum(["standard", "professional", "enterprise", "trial"])
    .nullable()
    .optional(),
  subdomain: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      "Subdomain must be lowercase alphanumeric with hyphens",
    )
    .min(3)
    .max(30)
    .optional(),
});

const verifyCloudflareSchema = z.object({
  accountId: z.string().length(32, "Account ID must be 32 characters"),
  apiToken: z.string().min(40, "API Token must be at least 40 characters"),
});

// ============================================================
// Routes
// ============================================================

/**
 * Check subdomain availability
 * GET /api/v1/onboarding/subdomain/check?subdomain=xxx
 */
router.get("/subdomain/check", async (c) => {
  const onboardingService = new OnboardingService(c.env);
  const subdomain = c.req.query("subdomain");

  if (!subdomain) {
    return c.json(
      {
        success: false,
        error: "Subdomain query parameter is required",
        code: "MISSING_SUBDOMAIN",
      },
      400,
    );
  }

  // Validate subdomain format
  if (
    !/^[a-z0-9-]+$/.test(subdomain) ||
    subdomain.length < 3 ||
    subdomain.length > 30
  ) {
    return c.json(
      {
        success: false,
        error: "Invalid subdomain format",
        code: "INVALID_SUBDOMAIN",
      },
      400,
    );
  }

  try {
    const result =
      await onboardingService.checkSubdomainAvailability(subdomain);

    return c.json({
      success: true,
      data: {
        subdomain,
        available: result.available,
        suggestions: result.suggestions,
      },
    });
  } catch (error) {
    console.error("[Onboarding] Subdomain check error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to check subdomain availability",
        code: "CHECK_FAILED",
      },
      500,
    );
  }
});

/**
 * Create new application
 * POST /api/v1/onboarding/applications
 */
router.post("/applications", async (c) => {
  const onboardingService = new OnboardingService(c.env);

  try {
    const body = await c.req.json();
    const validated = createApplicationSchema.parse(body);

    // Get request metadata
    const ipAddress =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for") ||
      "unknown";
    const userAgent = c.req.header("user-agent") || "unknown";

    const application = await onboardingService.createApplication(validated, {
      ipAddress,
      userAgent,
    });

    return c.json(
      {
        success: true,
        data: {
          applicationId: application.id,
          assignedSubdomain: application.assignedSubdomain,
          status: application.status,
        },
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

    console.error("[Onboarding] Create application error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to create application",
        code: "CREATE_FAILED",
      },
      500,
    );
  }
});

/**
 * Get application by ID
 * GET /api/v1/onboarding/applications/:id
 */
router.get("/applications/:id", async (c) => {
  const onboardingService = new OnboardingService(c.env);
  const applicationId = c.req.param("id");

  try {
    const application = await onboardingService.getApplication(applicationId);

    if (!application) {
      return c.json(
        {
          success: false,
          error: "Application not found",
          code: "NOT_FOUND",
        },
        404,
      );
    }

    // Don't expose sensitive fields
    return c.json({
      success: true,
      data: {
        id: application.id,
        businessName: application.businessName,
        contactName: application.contactName,
        contactEmail: application.contactEmail,
        planId: application.planId,
        assignedSubdomain: application.assignedSubdomain,
        status: application.status,
        cfVerifiedAt: application.cfVerifiedAt,
        tenantId: application.tenantId,
        createdAt: application.createdAt,
        completedAt: application.completedAt,
      },
    });
  } catch (error) {
    console.error("[Onboarding] Get application error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get application",
        code: "GET_FAILED",
      },
      500,
    );
  }
});

/**
 * Verify Cloudflare credentials
 * POST /api/v1/onboarding/applications/:id/verify-cloudflare
 */
router.post("/applications/:id/verify-cloudflare", async (c) => {
  const onboardingService = new OnboardingService(c.env);
  const applicationId = c.req.param("id");

  try {
    const body = await c.req.json();
    const validated = verifyCloudflareSchema.parse(body);

    // Check application exists
    const application = await onboardingService.getApplication(applicationId);
    if (!application) {
      return c.json(
        {
          success: false,
          error: "Application not found",
          code: "NOT_FOUND",
        },
        404,
      );
    }

    // Check application is in correct state
    if (application.status !== "submitted") {
      return c.json(
        {
          success: false,
          error: `Application already in status: ${application.status}`,
          code: "INVALID_STATUS",
        },
        400,
      );
    }

    const result = await onboardingService.verifyCloudflareCredentials(
      applicationId,
      validated.accountId,
      validated.apiToken,
    );

    if (!result.valid) {
      return c.json(
        {
          success: false,
          error: result.error || "Cloudflare verification failed",
          code: "CF_VERIFICATION_FAILED",
          data: {
            verified: false,
            permissions: result.permissions,
          },
        },
        400,
      );
    }

    return c.json({
      success: true,
      data: {
        verified: true,
        permissions: result.permissions,
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

    console.error("[Onboarding] Verify CF error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to verify Cloudflare credentials",
        code: "VERIFY_FAILED",
      },
      500,
    );
  }
});

/**
 * Complete application and create tenant
 * POST /api/v1/onboarding/applications/:id/complete
 */
router.post("/applications/:id/complete", async (c) => {
  const onboardingService = new OnboardingService(c.env);
  const applicationId = c.req.param("id");

  try {
    // Check application exists
    const application = await onboardingService.getApplication(applicationId);
    if (!application) {
      return c.json(
        {
          success: false,
          error: "Application not found",
          code: "NOT_FOUND",
        },
        404,
      );
    }

    // Check application is in correct state
    if (application.status !== "cf_verified") {
      return c.json(
        {
          success: false,
          error: `Cannot complete application with status: ${application.status}`,
          code: "INVALID_STATUS",
        },
        400,
      );
    }

    const result = await onboardingService.completeApplication(applicationId);

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.error || "Failed to complete application",
          code: "COMPLETE_FAILED",
        },
        500,
      );
    }

    return c.json({
      success: true,
      data: {
        tenantId: result.tenantId,
        subdomain: result.subdomain,
        status: "completed",
      },
    });
  } catch (error) {
    console.error("[Onboarding] Complete application error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to complete application",
        code: "COMPLETE_FAILED",
      },
      500,
    );
  }
});

export default router;
