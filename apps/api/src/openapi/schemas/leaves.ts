/**
 * Leaves API OpenAPI Schemas
 * 請假管理 API Schema 定義
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { errorResponses } from "../config";

// Define enums first to avoid circular reference
const LeaveType = z.enum([
  "annual",
  "sick",
  "personal",
  "unpaid",
  "maternity",
  "paternity",
  "other",
]);
const LeaveStatus = z.enum(["pending", "approved", "rejected", "cancelled"]);
const HalfDayType = z.enum(["morning", "afternoon", "none"]);

/**
 * Leaves API Schemas
 */
export const LeavesSchemas = {
  // Leave Type
  LeaveType,

  // Leave Status
  LeaveStatus,

  // Half Day Type
  HalfDayType,

  // Leave Request
  LeaveRequest: z.object({
    id: z.uuid(),
    restaurantId: z.uuid(),
    userId: z.uuid(),
    leaveType: LeaveType,
    startDate: z.string().date(),
    endDate: z.string().date(),
    halfDayType: HalfDayType.default("none"),
    totalDays: z.number().positive(),
    reason: z.string(),
    status: LeaveStatus,
    reviewerId: z.uuid().optional(),
    reviewerNotes: z.string().optional(),
    reviewedAt: z.string().datetime().optional(),
    attachments: z.array(z.url()).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Create Leave Request
  CreateLeaveRequest: z.object({
    restaurantId: z.uuid(),
    userId: z.uuid(),
    leaveType: LeaveType,
    startDate: z.string().date(),
    endDate: z.string().date(),
    halfDayType: HalfDayType.default("none"),
    reason: z.string().min(1, "Reason is required"),
    attachments: z.array(z.url()).optional(),
  }),

  // Update Leave Status Request
  UpdateLeaveStatusRequest: z.object({
    status: LeaveStatus,
    reviewerNotes: z.string().optional(),
  }),

  // Leave Balance
  LeaveBalance: z.object({
    id: z.uuid(),
    restaurantId: z.uuid(),
    userId: z.uuid(),
    leaveType: LeaveType,
    year: z.number().int(),
    totalAllowed: z.number().nonnegative(),
    used: z.number().nonnegative(),
    pending: z.number().nonnegative(),
    remaining: z.number().nonnegative(),
    carried: z.number().nonnegative().default(0), // Carried from previous year
    updatedAt: z.string().datetime(),
  }),

  // Leave Policy
  LeavePolicy: z.object({
    id: z.uuid(),
    restaurantId: z.uuid(),
    leaveType: LeaveType,
    name: z.string(),
    defaultDays: z.number().nonnegative(),
    maxCarryForward: z.number().nonnegative().default(0),
    requiresApproval: z.boolean().default(true),
    advanceNoticeDays: z.number().int().nonnegative().default(0),
    maxConsecutiveDays: z.number().int().positive().optional(),
    description: z.string().optional(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Leave Statistics
  LeaveStatistics: z.object({
    restaurantId: z.uuid(),
    period: z.object({
      startDate: z.string().date(),
      endDate: z.string().date(),
    }),
    totalRequests: z.number().int(),
    approvedRequests: z.number().int(),
    rejectedRequests: z.number().int(),
    pendingRequests: z.number().int(),
    totalDaysTaken: z.number(),
    byLeaveType: z.array(
      z.object({
        leaveType: LeaveType,
        count: z.number().int(),
        totalDays: z.number(),
      }),
    ),
    mostCommonReason: z.string().optional(),
    averageProcessingDays: z.number().optional(),
  }),
};

/**
 * Leaves API Routes
 */

// Get Leave Requests
export const getLeaveRequestsRoute = createRoute({
  method: "get",
  path: "/api/v1/leaves/:restaurantId/requests",
  tags: ["leaves"],
  summary: "獲取請假申請列表",
  description: "獲取餐廳的請假申請，支持過濾和分頁",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.uuid(),
    }),
    query: z.object({
      userId: z.uuid().optional(),
      leaveType: LeavesSchemas.LeaveType.optional(),
      status: LeavesSchemas.LeaveStatus.optional(),
      startDate: z.string().date().optional(),
      endDate: z.string().date().optional(),
      page: z.string().regex(/^\d+$/).transform(Number).prefault("1"),
      pageSize: z.string().regex(/^\d+$/).transform(Number).prefault("20"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取請假列表",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(LeavesSchemas.LeaveRequest),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              pageSize: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Create Leave Request
export const createLeaveRequestRoute = createRoute({
  method: "post",
  path: "/api/v1/leaves/requests",
  tags: ["leaves"],
  summary: "創建請假申請",
  description: "員工提交新的請假申請",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: LeavesSchemas.CreateLeaveRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "請假申請創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: LeavesSchemas.LeaveRequest,
          }),
        },
      },
    },
    ...errorResponses(400, 401),
  },
});

// Update Leave Request Status
export const updateLeaveStatusRoute = createRoute({
  method: "patch",
  path: "/api/v1/leaves/requests/:requestId",
  tags: ["leaves"],
  summary: "更新請假狀態",
  description: "主管審批或拒絕請假申請",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      requestId: z.uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: LeavesSchemas.UpdateLeaveStatusRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "狀態更新成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: LeavesSchemas.LeaveRequest,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
    ...errorResponses(404),
  },
});

// Get Leave Balances
export const getLeaveBalancesRoute = createRoute({
  method: "get",
  path: "/api/v1/leaves/:restaurantId/balances",
  tags: ["leaves"],
  summary: "獲取假期餘額",
  description: "獲取員工的各類假期餘額",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.uuid(),
    }),
    query: z.object({
      userId: z.uuid().optional(),
      year: z
        .string()
        .regex(/^\d{4}$/)
        .transform(Number)
        .optional(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取假期餘額",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(LeavesSchemas.LeaveBalance),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Get Leave Policies
export const getLeavePoliciesRoute = createRoute({
  method: "get",
  path: "/api/v1/leaves/:restaurantId/policies",
  tags: ["leaves"],
  summary: "獲取請假政策",
  description: "獲取餐廳的請假政策配置",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.uuid(),
    }),
    query: z.object({
      isActive: z
        .string()
        .transform((val) => val === "true")
        .optional(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取政策列表",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(LeavesSchemas.LeavePolicy),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Get Leave Statistics
export const getLeaveStatsRoute = createRoute({
  method: "get",
  path: "/api/v1/leaves/:restaurantId/statistics",
  tags: ["leaves"],
  summary: "獲取請假統計",
  description: "獲取請假系統的統計數據",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.uuid(),
    }),
    query: z.object({
      startDate: z.string().date(),
      endDate: z.string().date(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取統計數據",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: LeavesSchemas.LeaveStatistics,
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Cancel Leave Request
export const cancelLeaveRequestRoute = createRoute({
  method: "delete",
  path: "/api/v1/leaves/requests/:requestId",
  tags: ["leaves"],
  summary: "取消請假申請",
  description: "員工取消自己的請假申請（僅限 pending 狀態）",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      requestId: z.uuid(),
    }),
  },
  responses: {
    200: {
      description: "請假申請已取消",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});
