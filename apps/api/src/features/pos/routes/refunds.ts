/**
 * 退款管理路由
 */

import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import {
  RefundService,
  type RefundServiceOptions,
} from "../services/RefundService";
import { processRefundSchema } from "../schemas";
import type { Env } from "../../../types/env";
import { badRequest, notFound } from "../../../shared/utils/api-error";
import { AlertService } from "../../../services/AlertService";
import { resolveOrderIdentity } from "../../../shared/services/order-identity";

const app = new Hono<{ Bindings: Env }>();
const processRefundRouteSchema = processRefundSchema.extend({
  originalOrderId: z.union([z.number().int().positive(), z.string().min(1)]),
});

function createRefundService(env: Env): RefundService {
  let alertSink: RefundServiceOptions["alertSink"];
  if (env.SLACK_WEBHOOK_URL || env.ALERT_EMAIL_TO) {
    const alertService = new AlertService(env);
    alertSink = (alert: Parameters<AlertService["sendAlert"]>[0]) =>
      alertService.sendAlert(alert);
  }

  return new RefundService(env.DB, { alertSink });
}

/**
 * 處理退款
 * POST /refunds/create
 */
app.post(
  "/create",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner only
  validateBody(processRefundRouteSchema),
  async (c) => {
    const data = c.get("validatedBody");
    const user = c.get("user");
    const registerId = c.req.header("X-Register-Id");
    const shiftId = c.req.header("X-Shift-Id");

    if (!registerId) {
      throw badRequest("需要指定收銀機ID");
    }

    const orderIdentity = await resolveOrderIdentity(
      c.env.DB,
      data.originalOrderId,
      {
        restaurantId:
          user.restaurantId !== undefined
            ? String(user.restaurantId)
            : undefined,
      },
    );
    const refundService = createRefundService(c.env);
    const result = await refundService.processRefund(
      { ...data, originalOrderId: orderIdentity.id },
      registerId,
      user.id,
      shiftId,
    );

    if (!result.success) {
      throw badRequest(result.error || "處理退款失敗");
    }

    return c.json({
      success: true,
      data: result.data
        ? { ...result.data, orderPublicId: orderIdentity.publicId }
        : result.data,
    });
  },
);

/**
 * 獲取退款記錄
 * GET /registers/:registerId/refunds
 */
app.get(
  "/registers/:registerId/refunds",
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(
    z.object({
      registerId: z.string().uuid(),
    }),
  ),
  validateQuery(
    z.object({
      startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      status: z
        .enum(["pending", "processing", "completed", "failed", "cancelled"])
        .optional(),
      orderId: z.string().regex(/^\d+$/).transform(Number).optional(),
      page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
      limit: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .optional()
        .default("20"),
    }),
  ),
  async (c) => {
    const { registerId } = c.get("validatedParams");
    const { startDate, endDate, status, orderId, page, limit } =
      c.get("validatedQuery");

    const refundService = createRefundService(c.env);
    const result = await refundService.getRefunds(registerId, {
      startDate,
      endDate,
      status,
      orderId,
      page,
      limit,
    });

    if (!result.success) {
      throw badRequest(result.error || "獲取退款記錄失敗");
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * 獲取退款詳情
 * GET /refunds/:refundId
 */
app.get(
  "/:refundId",
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(
    z.object({
      refundId: z.string().uuid(),
    }),
  ),
  async (c) => {
    const { refundId } = c.get("validatedParams");

    const refundService = createRefundService(c.env);
    const result = await refundService.getRefundDetail(refundId);

    if (!result.success) {
      if (result.error === "退款記錄不存在") {
        throw notFound("退款記錄不存在", "REFUND_NOT_FOUND");
      }
      throw badRequest(result.error || "獲取退款詳情失敗");
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * 審核退款
 * POST /refunds/:refundId/approve
 */
app.post(
  "/:refundId/approve",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner only
  validateParams(
    z.object({
      refundId: z.string().uuid(),
    }),
  ),
  async (c) => {
    const { refundId } = c.get("validatedParams");
    const user = c.get("user");

    const refundService = createRefundService(c.env);
    const result = await refundService.approveRefund(refundId, user.id);

    if (!result.success) {
      throw badRequest(result.error || "審核退款失敗");
    }

    return c.json({
      success: true,
      message: "退款已審核通過",
    });
  },
);

/**
 * 拒絕退款
 * POST /refunds/:refundId/reject
 */
app.post(
  "/:refundId/reject",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner only
  validateParams(
    z.object({
      refundId: z.string().uuid(),
    }),
  ),
  validateBody(
    z.object({
      reason: z.string().max(200).optional(),
    }),
  ),
  async (c) => {
    const { refundId } = c.get("validatedParams");
    const { reason } = c.get("validatedBody");
    const user = c.get("user");

    const refundService = createRefundService(c.env);
    const result = await refundService.rejectRefund(refundId, user.id, reason);

    if (!result.success) {
      throw badRequest(result.error || "拒絕退款失敗");
    }

    return c.json({
      success: true,
      message: "退款已拒絕",
    });
  },
);

/**
 * 取消退款
 * POST /refunds/:refundId/cancel
 */
app.post(
  "/:refundId/cancel",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner only
  validateParams(
    z.object({
      refundId: z.string().uuid(),
    }),
  ),
  validateBody(
    z.object({
      reason: z.string().max(200).optional(),
    }),
  ),
  async (c) => {
    const { refundId } = c.get("validatedParams");
    const { reason } = c.get("validatedBody");
    const user = c.get("user");

    const refundService = createRefundService(c.env);
    const result = await refundService.cancelRefund(refundId, user.id, reason);

    if (!result.success) {
      throw badRequest(result.error || "取消退款失敗");
    }

    return c.json({
      success: true,
      message: "退款已取消",
    });
  },
);

export default app;
