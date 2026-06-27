/**
 * Notification Routes
 * HTTP routes for notification testing and management
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { authMiddleware, requireRole } from "../../../shared/middleware";
import { validateBody } from "../../../shared/middleware";
import type { Env } from "../../../shared/types";
import { HTTP_STATUS, USER_ROLES } from "../../../shared/constants";
import { createSuccessResponse } from "../../../shared/utils";
import { z } from "zod";

// Import service
import { NotificationService } from "@makanmakan/database";

const app = new Hono<{ Bindings: Env }>();

// ========================================
// Validation Schemas
// ========================================

const testNotificationSchema = z.object({
  recipientEmail: z.string().email(),
  category: z.enum([
    "leave_request_submitted",
    "leave_request_approved",
    "leave_request_rejected",
    "leave_request_cancelled",
    "schedule_created",
    "schedule_updated",
    "schedule_cancelled",
    "swap_request_created",
    "swap_request_approved",
    "swap_request_rejected",
    "shift_reminder",
  ]),
  type: z.enum(["email", "sms"]).default("email"),
});

const sendNotificationSchema = z.object({
  recipientId: z.string().trim().min(1),
  recipientEmail: z.string().email(),
  category: z.enum([
    "leave_request_submitted",
    "leave_request_approved",
    "leave_request_rejected",
    "leave_request_cancelled",
    "schedule_created",
    "schedule_updated",
    "schedule_cancelled",
    "swap_request_created",
    "swap_request_approved",
    "swap_request_rejected",
    "shift_reminder",
  ]),
  type: z.enum(["email", "sms"]).default("email"),
  data: z.record(z.string(), z.any()),
  priority: z.enum(["high", "normal", "low"]).default("normal"),
  recipientPhone: z.string().optional(),
});

type SendNotificationContext = Context<
  { Bindings: Env } & {
    Variables: {
      validatedBody: z.infer<typeof sendNotificationSchema>;
    };
  }
>;

// ========================================
// POST /test - Send test notification
// ========================================
app.post(
  "/test",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(testNotificationSchema),
  async (c) => {
    const data = c.get("validatedBody");
    const service = new NotificationService(c.env.DB, c.env);

    // Send test notification with sample data
    const result = await service.sendTestNotification(
      data.type,
      data.recipientEmail,
    );

    if (result.success) {
      return c.json(
        createSuccessResponse({
          message: "Test notification sent successfully",
          details: result,
        }),
        HTTP_STATUS.OK,
      );
    } else {
      return c.json(
        {
          success: false,
          error: result.error || "Failed to send test notification",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// ========================================
// GET /templates - Get available notification templates
// ========================================
app.get(
  "/templates",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  async (c) => {
    // NotificationService instance available for future use
    // const _service = new NotificationService(c.env.DB, c.env)

    // Get all available templates
    const templates = [
      {
        category: "leave_request_submitted",
        name: "Leave Request Submitted",
        description: "Sent when an employee submits a leave request",
        availableChannels: ["email"],
        requiredVariables: [
          "employeeName",
          "leaveType",
          "startDate",
          "endDate",
          "totalDays",
        ],
      },
      {
        category: "leave_request_approved",
        name: "Leave Request Approved",
        description: "Sent when a leave request is approved",
        availableChannels: ["email"],
        requiredVariables: [
          "employeeName",
          "leaveType",
          "startDate",
          "endDate",
          "totalDays",
          "approverName",
        ],
      },
      {
        category: "leave_request_rejected",
        name: "Leave Request Rejected",
        description: "Sent when a leave request is rejected",
        availableChannels: ["email"],
        requiredVariables: [
          "employeeName",
          "leaveType",
          "startDate",
          "endDate",
          "rejectionReason",
        ],
      },
      {
        category: "leave_request_cancelled",
        name: "Leave Request Cancelled",
        description: "Sent when a leave request is cancelled",
        availableChannels: ["email"],
        requiredVariables: [
          "employeeName",
          "leaveType",
          "startDate",
          "endDate",
        ],
      },
      {
        category: "schedule_created",
        name: "Schedule Created",
        description: "Sent when a new schedule is created for an employee",
        availableChannels: ["email", "sms"],
        requiredVariables: [
          "employeeName",
          "shiftName",
          "scheduleDate",
          "startTime",
          "endTime",
        ],
      },
      {
        category: "schedule_updated",
        name: "Schedule Updated",
        description: "Sent when an existing schedule is modified",
        availableChannels: ["email", "sms"],
        requiredVariables: [
          "employeeName",
          "shiftName",
          "scheduleDate",
          "startTime",
          "endTime",
        ],
      },
      {
        category: "schedule_cancelled",
        name: "Schedule Cancelled",
        description: "Sent when a schedule is cancelled",
        availableChannels: ["email", "sms"],
        requiredVariables: [
          "employeeName",
          "shiftName",
          "scheduleDate",
          "startTime",
          "endTime",
          "cancellationReason",
        ],
      },
      {
        category: "swap_request_created",
        name: "Swap Request Created",
        description: "Sent when an employee creates a shift swap request",
        availableChannels: ["email"],
        requiredVariables: [
          "requesterName",
          "targetName",
          "scheduleDate",
          "startTime",
          "endTime",
          "requestType",
          "reason",
        ],
      },
      {
        category: "swap_request_approved",
        name: "Swap Request Approved",
        description: "Sent when a swap request is approved by manager",
        availableChannels: ["email"],
        requiredVariables: [
          "requesterName",
          "managerName",
          "scheduleDate",
          "startTime",
          "endTime",
          "requestType",
        ],
      },
      {
        category: "swap_request_rejected",
        name: "Swap Request Rejected",
        description: "Sent when a swap request is rejected by manager",
        availableChannels: ["email"],
        requiredVariables: [
          "requesterName",
          "managerName",
          "scheduleDate",
          "startTime",
          "endTime",
          "requestType",
          "rejectionReason",
        ],
      },
      {
        category: "shift_reminder",
        name: "Shift Reminder",
        description: "Sent as a reminder before an upcoming shift",
        availableChannels: ["email", "sms"],
        requiredVariables: [
          "employeeName",
          "shiftName",
          "scheduleDate",
          "startTime",
          "hoursUntil",
        ],
      },
    ];

    return c.json(
      createSuccessResponse({
        templates,
        totalCount: templates.length,
        supportedChannels: ["email", "sms"],
        configuredProviders: {
          email: !!c.env.RESEND_API_KEY,
          sms: !!(c.env.TWILIO_ACCOUNT_SID && c.env.TWILIO_AUTH_TOKEN),
        },
      }),
      HTTP_STATUS.OK,
    );
  },
);

// ========================================
// POST /send - Manually send a notification
// ========================================
app.post(
  "/send",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(sendNotificationSchema),
  async (c) => {
    const notificationData = c.get("validatedBody");
    const recipientGuard = await validateNotificationRecipientScope(
      c,
      notificationData,
    );
    if (recipientGuard) return recipientGuard;

    const service = new NotificationService(c.env.DB, c.env);

    // Send the notification
    const result = await service.sendNotification(notificationData);

    if (result.success) {
      return c.json(
        createSuccessResponse({
          message: "Notification sent successfully",
          channel: notificationData.type,
          category: notificationData.category,
        }),
        HTTP_STATUS.OK,
      );
    } else {
      return c.json(
        {
          success: false,
          error: result.errors.join(", ") || "Failed to send notification",
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

async function validateNotificationRecipientScope(
  c: SendNotificationContext,
  notificationData: z.infer<typeof sendNotificationSchema>,
): Promise<Response | null> {
  const user = c.get("user");
  if (user.role === USER_ROLES.ADMIN) return null;

  const recipient = (await c.env.DB.prepare(
    `SELECT restaurant_id, email FROM users WHERE id = ?`,
  )
    .bind(notificationData.recipientId)
    .first()) as {
    restaurant_id?: string | number | null;
    email?: string | null;
  } | null;

  if (!recipient) {
    return c.json(
      { success: false, error: "Notification recipient not found" },
      HTTP_STATUS.NOT_FOUND,
    );
  }

  const userRestaurantId =
    user.restaurantId === undefined || user.restaurantId === null
      ? null
      : String(user.restaurantId);
  const recipientRestaurantId =
    recipient.restaurant_id === undefined || recipient.restaurant_id === null
      ? null
      : String(recipient.restaurant_id);

  if (!userRestaurantId || recipientRestaurantId !== userRestaurantId) {
    return c.json(
      {
        success: false,
        error: "Cannot send notifications to another restaurant",
      },
      HTTP_STATUS.FORBIDDEN,
    );
  }

  if (
    recipient.email &&
    recipient.email.toLowerCase() !==
      notificationData.recipientEmail.toLowerCase()
  ) {
    return c.json(
      { success: false, error: "Recipient email does not match user" },
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  return null;
}

export default app;
