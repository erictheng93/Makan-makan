/**
 * Scheduling API OpenAPI Schemas
 * 排班管理 API Schema 定義
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { errorResponses } from "../config";

// Define enums first to avoid circular reference
const ShiftType = z.enum([
  "morning",
  "afternoon",
  "evening",
  "night",
  "full_day",
]);
const ShiftStatus = z.enum([
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);
const SwapStatus = z.enum(["pending", "approved", "rejected", "cancelled"]);
const DayOfWeek = z.number().int().min(0).max(6); // 0 = Sunday, 6 = Saturday

/**
 * Scheduling API Schemas
 */
export const SchedulingSchemas = {
  // Day of Week
  DayOfWeek,

  // Shift Type
  ShiftType,

  // Shift Status
  ShiftStatus,

  // Swap Request Status
  SwapStatus,

  // Shift Template
  ShiftTemplate: z.object({
    id: z.uuid(),
    restaurantId: z.uuid(),
    name: z.string(),
    shiftType: ShiftType,
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    durationMinutes: z.number().int().positive(),
    breakMinutes: z.number().int().nonnegative().default(0),
    requiredRole: z.number().int().min(0).max(4).optional(),
    minStaff: z.number().int().positive().default(1),
    maxStaff: z.number().int().positive(),
    color: z.string().optional(), // Hex color for UI display
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Create Shift Template Request
  CreateShiftTemplateRequest: z.object({
    restaurantId: z.uuid(),
    name: z.string().min(1, "Template name is required"),
    shiftType: ShiftType,
    startTime: z
      .string()
      .regex(
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Invalid time format (HH:MM)",
      ),
    endTime: z
      .string()
      .regex(
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Invalid time format (HH:MM)",
      ),
    breakMinutes: z.number().int().nonnegative().optional(),
    requiredRole: z.number().int().min(0).max(4).optional(),
    minStaff: z.number().int().positive().default(1),
    maxStaff: z.number().int().positive(),
    color: z.string().optional(),
  }),

  // Employee Schedule
  EmployeeSchedule: z.object({
    id: z.uuid(),
    restaurantId: z.uuid(),
    userId: z.uuid(),
    templateId: z.uuid().optional(),
    date: z.string().date(), // YYYY-MM-DD
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    shiftType: ShiftType,
    status: ShiftStatus,
    notes: z.string().optional(),
    clockIn: z.string().datetime().optional(),
    clockOut: z.string().datetime().optional(),
    actualHours: z.number().nonnegative().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Create Schedule Request
  CreateScheduleRequest: z.object({
    restaurantId: z.uuid(),
    userId: z.uuid(),
    templateId: z.uuid().optional(),
    date: z.string().date(),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    shiftType: ShiftType,
    notes: z.string().optional(),
  }),

  // Batch Create Schedules Request
  BatchCreateSchedulesRequest: z.object({
    restaurantId: z.uuid(),
    templateId: z.uuid(),
    userIds: z.array(z.uuid()).min(1, "At least one user required"),
    startDate: z.string().date(),
    endDate: z.string().date(),
    daysOfWeek: z.array(DayOfWeek),
  }),

  // Swap Request
  SwapRequest: z.object({
    id: z.uuid(),
    restaurantId: z.uuid(),
    requesterId: z.uuid(),
    requesterScheduleId: z.uuid(),
    targetUserId: z.uuid().optional(),
    targetScheduleId: z.uuid().optional(),
    status: SwapStatus,
    reason: z.string().optional(),
    approvedBy: z.uuid().optional(),
    approvedAt: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Create Swap Request
  CreateSwapRequestSchema: z.object({
    requesterScheduleId: z.uuid(),
    targetUserId: z.uuid().optional(),
    targetScheduleId: z.uuid().optional(),
    reason: z.string().optional(),
  }),

  // Clock In/Out Request
  ClockInOutRequest: z.object({
    scheduleId: z.uuid(),
    action: z.enum(["clock_in", "clock_out"]),
    timestamp: z.string().datetime().optional(), // Defaults to now
    location: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
      })
      .optional(),
  }),

  // Schedule Statistics
  ScheduleStatistics: z.object({
    restaurantId: z.uuid(),
    period: z.object({
      startDate: z.string().date(),
      endDate: z.string().date(),
    }),
    totalShifts: z.number().int(),
    completedShifts: z.number().int(),
    cancelledShifts: z.number().int(),
    noShowShifts: z.number().int(),
    totalHours: z.number(),
    averageHoursPerEmployee: z.number(),
    mostActiveEmployee: z
      .object({
        userId: z.uuid(),
        name: z.string(),
        totalHours: z.number(),
      })
      .optional(),
    swapRequestCount: z.number().int(),
    swapApprovalRate: z.number().min(0).max(1),
  }),
};

/**
 * Scheduling API Routes
 */

// Get Shift Templates
export const getShiftTemplatesRoute = createRoute({
  method: "get",
  path: "/api/v1/scheduling/:restaurantId/templates",
  tags: ["scheduling"],
  summary: "獲取班次模板列表",
  description: "獲取餐廳的所有班次模板",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.uuid(),
    }),
    query: z.object({
      shiftType: SchedulingSchemas.ShiftType.optional(),
      isActive: z
        .string()
        .transform((val) => val === "true")
        .optional(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取模板列表",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(SchedulingSchemas.ShiftTemplate),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Create Shift Template
export const createShiftTemplateRoute = createRoute({
  method: "post",
  path: "/api/v1/scheduling/templates",
  tags: ["scheduling"],
  summary: "創建班次模板",
  description: "創建新的班次模板",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SchedulingSchemas.CreateShiftTemplateRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "模板創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: SchedulingSchemas.ShiftTemplate,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Get Employee Schedules
export const getEmployeeSchedulesRoute = createRoute({
  method: "get",
  path: "/api/v1/scheduling/:restaurantId/schedules",
  tags: ["scheduling"],
  summary: "獲取員工排班",
  description: "獲取指定時間範圍內的員工排班",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.uuid(),
    }),
    query: z.object({
      userId: z.uuid().optional(),
      startDate: z.string().date(),
      endDate: z.string().date(),
      status: SchedulingSchemas.ShiftStatus.optional(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取排班",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(SchedulingSchemas.EmployeeSchedule),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Create Schedule
export const createScheduleRoute = createRoute({
  method: "post",
  path: "/api/v1/scheduling/schedules",
  tags: ["scheduling"],
  summary: "創建排班",
  description: "為員工創建新的排班",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SchedulingSchemas.CreateScheduleRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "排班創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: SchedulingSchemas.EmployeeSchedule,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Batch Create Schedules
export const batchCreateSchedulesRoute = createRoute({
  method: "post",
  path: "/api/v1/scheduling/schedules/batch",
  tags: ["scheduling"],
  summary: "批次創建排班",
  description: "使用模板為多個員工批次創建排班",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SchedulingSchemas.BatchCreateSchedulesRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "批次創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(SchedulingSchemas.EmployeeSchedule),
            meta: z.object({
              totalCreated: z.number().int(),
            }),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Create Swap Request
export const createSwapRequestRoute = createRoute({
  method: "post",
  path: "/api/v1/scheduling/swaps",
  tags: ["scheduling"],
  summary: "創建換班請求",
  description: "員工創建換班請求",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SchedulingSchemas.CreateSwapRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "換班請求創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: SchedulingSchemas.SwapRequest,
          }),
        },
      },
    },
    ...errorResponses(400, 401),
  },
});

// Update Swap Request Status
export const updateSwapRequestRoute = createRoute({
  method: "patch",
  path: "/api/v1/scheduling/swaps/:swapId",
  tags: ["scheduling"],
  summary: "更新換班請求狀態",
  description: "批准、拒絕或取消換班請求",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      swapId: z.uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            status: SchedulingSchemas.SwapStatus,
          }),
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
            data: SchedulingSchemas.SwapRequest,
          }),
        },
      },
    },
    ...errorResponses(400),
    ...errorResponses(401, 403, 404),
  },
});

// Clock In/Out
export const clockInOutRoute = createRoute({
  method: "post",
  path: "/api/v1/scheduling/clock",
  tags: ["scheduling"],
  summary: "打卡上下班",
  description: "員工打卡上班或下班",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SchedulingSchemas.ClockInOutRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "打卡成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: SchedulingSchemas.EmployeeSchedule,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 404),
  },
});

// Get Schedule Statistics
export const getScheduleStatsRoute = createRoute({
  method: "get",
  path: "/api/v1/scheduling/:restaurantId/statistics",
  tags: ["scheduling"],
  summary: "獲取排班統計",
  description: "獲取排班系統的統計數據",
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
            data: SchedulingSchemas.ScheduleStatistics,
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});
