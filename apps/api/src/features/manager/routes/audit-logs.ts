import { Hono } from "hono";
import type { Env } from "../../../types/env";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { validateQuery } from "../../../shared/middleware";
import { AuditLogService } from "../services/AuditLogService";
import { auditLogQuerySchema, type AuditLogQuery } from "../schemas/validation";

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/audit-logs
 * Admin-only read path. Filters: resourceId, resource, actorId,
 * onBehalfOfUserId, restaurantId, action.
 */
app.get(
  "/",
  authMiddleware,
  // Admin only — audit data is sensitive.
  requireRole([0]),
  validateQuery(auditLogQuerySchema),
  async (c) => {
    const query: AuditLogQuery = c.get("validatedQuery");
    const service = new AuditLogService(c.env);
    const result = await service.list(query);
    return c.json({ success: true, data: result }, 200);
  },
);

export default app;
