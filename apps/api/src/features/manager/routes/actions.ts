import { Hono } from "hono";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { validateBody } from "../../../shared/middleware";
import { ManagerActionsService } from "../services/ManagerActionsService";
import {
  managerActionSchema,
  type ManagerActionInput,
} from "../schemas/validation";

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /api/v1/manager/actions
 * Execute a delegation-aware action. When `onBehalfOfUserId` is supplied
 * the audit trail stamps the actual actor and the delegating user as
 * separate columns (M1 release gate).
 */
app.post(
  "/actions",
  authMiddleware,
  // Admin or Owner — managers currently share Role 1 with owners. When an
  // explicit MANAGER role is introduced, add it here.
  requireRole([0, 1]),
  validateBody(managerActionSchema),
  async (c) => {
    const input: ManagerActionInput = c.get("validatedBody");
    const user: AuthUser = c.get("user");

    const service = new ManagerActionsService(c.env);
    const result = await service.execute(input, user);

    return c.json({ success: true, data: result }, 201);
  },
);

export default app;
