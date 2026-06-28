/**
 * Onboarding Routes
 *
 * Self-service onboarding API endpoints
 */

import { Hono } from "hono";
import type { Context } from "hono";
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
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

async function requireApplicationSecret(
  c: Context<{ Bindings: ManagementEnv }>,
  onboardingService: OnboardingService,
  applicationId: string,
): Promise<Response | null> {
  const applicationSecret = c.req.header("X-Onboarding-Secret");
  const isValid =
    typeof applicationSecret === "string" &&
    (await onboardingService.verifyApplicationSecret(
      applicationId,
      applicationSecret,
    ));

  if (isValid) return null;

  return c.json(
    {
      success: false,
      error: "Application secret is required",
      code: "APPLICATION_SECRET_REQUIRED",
    },
    401,
  );
}

// ============================================================
// Routes
// ============================================================

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
          applicationSecret: application.applicationSecret,
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
    const secretError = await requireApplicationSecret(
      c,
      onboardingService,
      applicationId,
    );
    if (secretError) return secretError;

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
        latitude: application.latitude,
        longitude: application.longitude,
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
 * Complete application and create tenant
 * POST /api/v1/onboarding/applications/:id/complete
 */
router.post("/applications/:id/complete", async (c) => {
  const onboardingService = new OnboardingService(c.env);
  const applicationId = c.req.param("id");

  try {
    const secretError = await requireApplicationSecret(
      c,
      onboardingService,
      applicationId,
    );
    if (secretError) return secretError;

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
    if (!["submitted", "cf_verified"].includes(application.status)) {
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
