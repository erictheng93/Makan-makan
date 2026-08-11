import { Hono } from "hono";
import { z } from "zod";
import { badRequest, notFound } from "@makanmasak/utils";
import type { ManagementEnv, OnboardingStatus } from "../types";
import { OnboardingService } from "../services/OnboardingService";

const router = new Hono<{ Bindings: ManagementEnv }>();

const onboardingStatusSchema = z.enum([
  "submitted",
  "provisioning",
  "completed",
  "rejected",
]);

const listApplicationsQuerySchema = z.object({
  status: onboardingStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

function publicApplication(application: {
  id: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  planId: string | null;
  latitude?: number;
  longitude?: number;
  requestedSubdomain?: string;
  assignedSubdomain?: string;
  status: OnboardingStatus;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  submittedAt?: string;
  completedAt?: string;
  updatedAt: string;
}) {
  return {
    id: application.id,
    businessName: application.businessName,
    contactName: application.contactName,
    contactEmail: application.contactEmail,
    contactPhone: application.contactPhone,
    planId: application.planId,
    latitude: application.latitude,
    longitude: application.longitude,
    requestedSubdomain: application.requestedSubdomain,
    assignedSubdomain: application.assignedSubdomain,
    status: application.status,
    tenantId: application.tenantId,
    ipAddress: application.ipAddress,
    userAgent: application.userAgent,
    createdAt: application.createdAt,
    submittedAt: application.submittedAt,
    completedAt: application.completedAt,
    updatedAt: application.updatedAt,
  };
}

router.get("/applications", async (c) => {
  const parsed = listApplicationsQuerySchema.safeParse({
    status: c.req.query("status"),
    page: c.req.query("page"),
    limit: c.req.query("limit"),
  });
  if (!parsed.success) {
    throw badRequest(
      "Validation failed",
      "VALIDATION_ERROR",
      parsed.error.issues,
    );
  }

  const service = new OnboardingService(c.env);
  const result = await service.listApplications(parsed.data);

  return c.json({
    success: true,
    data: {
      applications: result.applications.map(publicApplication),
      total: result.total,
      page: result.page,
      limit: result.limit,
    },
  });
});

router.post("/applications/:id/approve", async (c) => {
  const service = new OnboardingService(c.env);
  const result = await service.approveApplication(c.req.param("id"));

  if (!result.success) {
    if (result.error === "Application not found") {
      throw notFound(result.error, "NOT_FOUND");
    }
    throw badRequest(
      result.error ?? "Failed to approve application",
      "INVALID_STATUS",
    );
  }

  return c.json({
    success: true,
    data: {
      tenantId: result.tenantId,
      subdomain: result.subdomain,
      ownerAccount: result.ownerAccount,
      credentialDelivery: result.credentialDelivery,
      status: result.status ?? "completed",
    },
  });
});

router.post("/applications/:id/reject", async (c) => {
  const service = new OnboardingService(c.env);
  const result = await service.rejectApplication(c.req.param("id"));

  if (!result.success) {
    if (result.error === "Application not found") {
      throw notFound(result.error, "NOT_FOUND");
    }
    throw badRequest(
      result.error ?? "Failed to reject application",
      "INVALID_STATUS",
    );
  }

  return c.json({
    success: true,
    data: { status: result.status ?? "rejected" },
  });
});

export default router;
