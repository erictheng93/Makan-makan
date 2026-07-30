/**
 * Onboarding Routes
 *
 * Self-service onboarding API endpoints
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import {
  ApiError,
  badRequest,
  notFound,
  unauthorized,
} from "@makanmakan/utils";
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
): Promise<void> {
  const applicationSecret = c.req.header("X-Onboarding-Secret");
  const isValid =
    typeof applicationSecret === "string" &&
    (await onboardingService.verifyApplicationSecret(
      applicationId,
      applicationSecret,
    ));

  if (!isValid) {
    throw unauthorized(
      "Application secret is required",
      "APPLICATION_SECRET_REQUIRED",
    );
  }
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
      throw badRequest("Validation failed", "VALIDATION_ERROR", error.issues);
    }
    if (error instanceof ApiError) throw error;

    console.error("[Onboarding] Create application error:", error);
    throw new ApiError("CREATE_FAILED", "Failed to create application", 500);
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
    await requireApplicationSecret(c, onboardingService, applicationId);

    const application = await onboardingService.getApplication(applicationId);

    if (!application) {
      throw notFound("Application not found", "NOT_FOUND");
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
        tenantId: application.tenantId,
        createdAt: application.createdAt,
        completedAt: application.completedAt,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;

    console.error("[Onboarding] Get application error:", error);
    throw new ApiError("GET_FAILED", "Failed to get application", 500);
  }
});

export default router;
