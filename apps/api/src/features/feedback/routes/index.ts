import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { FeedbackService } from "@makanmakan/database";
import {
  createFeedbackSchema,
  updateFeedbackSchema,
  updateFeedbackStatusSchema,
  addResponseSchema,
  feedbackFiltersSchema,
  feedbackIdParamSchema,
  responseIdParamSchema,
  updateResponseSchema,
} from "../schemas/validation";
import type { Env } from "../../../types/env";
import { notFound, forbidden } from "../../../shared/utils/api-error";

const routes = new Hono<{ Bindings: Env }>();

/** Owner (role=1) can only access their own feedback. Returns the feedback record. */
async function assertOwnerAccess(
  service: FeedbackService,
  feedbackId: number,
  user: { role: number; id: number },
) {
  const feedback = await service.getFeedbackById(feedbackId);
  if (!feedback) throw notFound("Feedback not found", "FEEDBACK_NOT_FOUND");
  if (user.role === 1 && feedback.userId !== user.id) {
    throw forbidden("Access denied", "FEEDBACK_ACCESS_DENIED");
  }
  return feedback;
}

routes.post(
  "/",
  authMiddleware,
  requireRole([1]),
  validateBody(createFeedbackSchema),
  async (c) => {
    const user = c.get("user");
    const data = c.get("validatedBody");
    const service = new FeedbackService(c.env.DB as any, c.env as any);

    if (!user.restaurantId) {
      return c.json(
        {
          success: false,
          error: {
            code: "NO_RESTAURANT",
            message: "No restaurant associated with this account",
          },
        },
        400,
      );
    }

    const feedback = await service.createFeedback({
      restaurantId: user.restaurantId,
      userId: user.id,
      category: data.category,
      priority: data.priority,
      relatedModule: data.relatedModule,
      subject: data.subject,
      description: data.description,
      attachmentUrls: data.attachmentUrls,
    });

    return c.json({ success: true, data: feedback }, 201);
  },
);

// Must be registered before /:id to avoid route conflict
routes.get("/stats", authMiddleware, requireRole([0]), async (c) => {
  const service = new FeedbackService(c.env.DB as any, c.env as any);
  const stats = await service.getFeedbackStats();
  return c.json({ success: true, data: stats });
});

routes.get(
  "/",
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(feedbackFiltersSchema),
  async (c) => {
    const user = c.get("user");
    const query = c.get("validatedQuery");
    const service = new FeedbackService(c.env.DB as any, c.env as any);

    const filters: any = {
      category: query.category,
      status: query.status,
      priority: query.priority,
      relatedModule: query.relatedModule,
      search: query.search,
    };

    // Owner role: only see own feedback
    if (user.role === 1) {
      filters.userId = user.id;
    } else if (query.restaurantId) {
      // Admin: optional filter by restaurant
      filters.restaurantId = query.restaurantId;
    }

    const result = await service.listFeedback(
      filters,
      query.page,
      query.limit,
      user.role === 0,
    );

    return c.json({ success: true, ...result });
  },
);

routes.get(
  "/:id",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(feedbackIdParamSchema),
  async (c) => {
    const user = c.get("user");
    const { id } = c.get("validatedParams");
    const service = new FeedbackService(c.env.DB as any, c.env as any);

    const feedback = await assertOwnerAccess(service, id, user);

    // Filter out internal responses for non-admins
    if (user.role !== 0) {
      feedback.responses = feedback.responses?.filter(
        (r: any) => !r.isInternal,
      );
    }

    return c.json({ success: true, data: feedback });
  },
);

routes.put(
  "/:id/status",
  authMiddleware,
  requireRole([0]),
  validateParams(feedbackIdParamSchema),
  validateBody(updateFeedbackStatusSchema),
  async (c) => {
    const user = c.get("user");
    const { id } = c.get("validatedParams");
    const { status } = c.get("validatedBody");
    const service = new FeedbackService(c.env.DB as any, c.env as any);

    const feedback = await service.updateFeedbackStatus(
      id,
      status,
      status === "resolved" ? user.id : undefined,
    );

    return c.json({
      success: true,
      data: feedback,
      message: "Status updated successfully",
    });
  },
);

routes.patch(
  "/:id",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(feedbackIdParamSchema),
  validateBody(updateFeedbackSchema),
  async (c) => {
    const user = c.get("user");
    const { id } = c.get("validatedParams");
    const data = c.get("validatedBody");
    const service = new FeedbackService(c.env.DB as any, c.env as any);

    if (user.role === 1) {
      await assertOwnerAccess(service, id, user);
    }

    const updated = await service.updateFeedback(
      id,
      data,
      user.id,
      user.role === 0,
    );

    if (!updated) {
      throw notFound(
        "Feedback not found or cannot be edited",
        "FEEDBACK_NOT_EDITABLE",
      );
    }

    return c.json({ success: true, data: updated });
  },
);

routes.delete(
  "/:id",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(feedbackIdParamSchema),
  async (c) => {
    const user = c.get("user");
    const { id } = c.get("validatedParams");
    const service = new FeedbackService(c.env.DB as any, c.env as any);

    if (user.role === 1) {
      await assertOwnerAccess(service, id, user);
    }

    const deleted = await service.deleteFeedback(id, user.id, user.role === 0);

    if (!deleted) {
      throw notFound(
        "Feedback not found or cannot be deleted",
        "FEEDBACK_NOT_DELETABLE",
      );
    }

    return c.json({ success: true });
  },
);

routes.post(
  "/:id/responses",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(feedbackIdParamSchema),
  validateBody(addResponseSchema),
  async (c) => {
    const user = c.get("user");
    const { id } = c.get("validatedParams");
    const { message, isInternal } = c.get("validatedBody");
    const service = new FeedbackService(c.env.DB as any, c.env as any);

    await assertOwnerAccess(service, id, user);

    // Only admins can post internal notes
    const internal = user.role === 0 ? (isInternal ?? false) : false;

    const response = await service.addResponse(id, user.id, message, internal);

    return c.json({ success: true, data: response }, 201);
  },
);

routes.put(
  "/:id/responses/:responseId",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(responseIdParamSchema),
  validateBody(updateResponseSchema),
  async (c) => {
    const user = c.get("user");
    const { id, responseId } = c.get("validatedParams");
    const { message } = c.get("validatedBody");
    const service = new FeedbackService(c.env.DB as any, c.env as any);

    if (user.role === 1) {
      await assertOwnerAccess(service, id, user);
    }

    const updated = await service.updateResponse(
      responseId,
      user.id,
      message,
      user.role === 0,
    );

    if (!updated)
      throw notFound("Response not found or not yours", "RESPONSE_NOT_FOUND");

    return c.json({ success: true, data: updated });
  },
);

routes.delete(
  "/:id/responses/:responseId",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(responseIdParamSchema),
  async (c) => {
    const user = c.get("user");
    const { id, responseId } = c.get("validatedParams");
    const service = new FeedbackService(c.env.DB as any, c.env as any);

    if (user.role === 1) {
      await assertOwnerAccess(service, id, user);
    }

    const deleted = await service.deleteResponse(
      responseId,
      user.id,
      user.role === 0,
    );

    if (!deleted)
      throw notFound("Response not found or not yours", "RESPONSE_NOT_FOUND");

    return c.json({ success: true });
  },
);

export default routes;
