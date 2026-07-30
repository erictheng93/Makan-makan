/**
 * Partnerships API OpenAPI Schemas
 * 特約商店體系 API Schema 定義
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { errorResponses } from "../config";

// Define enums first to avoid circular reference
const PartnershipStatus = z.enum(["active", "inactive", "expired", "pending"]);
const DiscountType = z.enum(["percentage", "fixed", "special_price"]);
const MemberStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "expired",
  "suspended",
]);
const UsageLogStatus = z.enum(["completed", "cancelled", "refunded"]);

/**
 * Partnerships API Schemas
 */
export const PartnershipsSchemas = {
  // Partnership Status
  PartnershipStatus,

  // Discount Type
  DiscountType,

  // Member Status
  MemberStatus,

  // Usage Log Status
  UsageLogStatus,

  // Partnership
  Partnership: z.object({
    id: z.number().int(),
    restaurantId: z.string(),
    partnerName: z.string(),
    partnerType: z.string(),
    contactName: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    contractStart: z.string().datetime().optional(),
    contractEnd: z.string().datetime().optional(),
    status: PartnershipStatus,
    notes: z.string().optional(),
    createdBy: z.number().int().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Create Partnership Request
  CreatePartnershipRequest: z.object({
    restaurantId: z.string().min(1, "Restaurant ID is required"),
    partnerName: z.string().min(1, "Partner name is required"),
    partnerType: z.string().min(1, "Partner type is required"),
    contactName: z.string().optional(),
    contactEmail: z.string().email("Invalid email format").optional(),
    contactPhone: z.string().optional(),
    contractStart: z.string().datetime().optional(),
    contractEnd: z.string().datetime().optional(),
    status: PartnershipStatus.default("active"),
    notes: z.string().optional(),
  }),

  // Update Partnership Request
  UpdatePartnershipRequest: z.object({
    partnerName: z.string().min(1).optional(),
    partnerType: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    contractStart: z.string().datetime().optional(),
    contractEnd: z.string().datetime().optional(),
    status: PartnershipStatus.optional(),
    notes: z.string().optional(),
  }),

  // Partnership Plan
  PartnershipPlan: z.object({
    id: z.number().int(),
    partnershipId: z.number().int(),
    planName: z.string(),
    discountType: DiscountType,
    discountValue: z.number().nonnegative(),
    maxDiscountAmount: z.number().nonnegative().optional(),
    applicableCategories: z.array(z.string()).optional(),
    applicableMenuItems: z.array(z.string()).optional(),
    usageLimit: z.number().int().nonnegative().optional(),
    validDays: z.array(z.number().int().min(0).max(6)).optional(),
    validTimeStart: z.string().optional(),
    validTimeEnd: z.string().optional(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Create Plan Request
  CreatePlanRequest: z.object({
    partnershipId: z.number().int(),
    planName: z.string().min(1, "Plan name is required"),
    discountType: DiscountType,
    discountValue: z.number().positive("Discount value must be positive"),
    maxDiscountAmount: z.number().nonnegative().optional(),
    applicableCategories: z.array(z.string()).optional(),
    applicableMenuItems: z.array(z.string()).optional(),
    usageLimit: z.number().int().nonnegative().optional(),
    validDays: z.array(z.number().int().min(0).max(6)).optional(),
    validTimeStart: z.string().optional(),
    validTimeEnd: z.string().optional(),
    isActive: z.boolean().default(true),
  }),

  // Update Plan Request
  UpdatePlanRequest: z.object({
    planName: z.string().min(1).optional(),
    discountType: DiscountType.optional(),
    discountValue: z.number().positive().optional(),
    maxDiscountAmount: z.number().nonnegative().optional(),
    applicableCategories: z.array(z.string()).optional(),
    applicableMenuItems: z.array(z.string()).optional(),
    usageLimit: z.number().int().nonnegative().optional(),
    validDays: z.array(z.number().int().min(0).max(6)).optional(),
    validTimeStart: z.string().optional(),
    validTimeEnd: z.string().optional(),
    isActive: z.boolean().optional(),
  }),

  // Validate Plan Request
  ValidatePlanRequest: z.object({
    planId: z.number().int(),
    memberId: z.number().int(),
    orderAmount: z.number().positive("Order amount must be positive"),
    menuItems: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
  }),

  // Validate Plan Response Data
  ValidatePlanResult: z.object({
    valid: z.boolean(),
    discountAmount: z.number().nonnegative(),
    finalAmount: z.number().nonnegative(),
    discountType: DiscountType,
    discountValue: z.number(),
    planName: z.string(),
    reason: z.string().optional(),
  }),

  // Partnership Member
  PartnershipMember: z.object({
    id: z.number().int(),
    partnershipId: z.number().int(),
    memberName: z.string(),
    memberIdentifier: z.string(),
    verificationStatus: MemberStatus,
    verificationDocument: z.string().optional(),
    verifiedBy: z.number().int().optional(),
    verificationExpiry: z.string().datetime().optional(),
    rejectionReason: z.string().optional(),
    notes: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Member Verification Request
  MemberVerificationRequest: z.object({
    partnershipId: z.number().int(),
    memberName: z.string().min(1, "Member name is required"),
    memberIdentifier: z.string().min(1, "Member identifier is required"),
    verificationDocument: z.string().optional(),
    notes: z.string().optional(),
  }),

  // Approve Member Request
  ApproveMemberRequest: z.object({
    verificationExpiry: z.string().datetime().optional(),
  }),

  // Reject Member Request
  RejectMemberRequest: z.object({
    rejectionReason: z.string().min(1, "Rejection reason is required"),
  }),

  // Usage Log
  UsageLog: z.object({
    id: z.number().int(),
    memberId: z.number().int(),
    planId: z.number().int(),
    orderId: z.number().int().optional(),
    originalAmount: z.number().nonnegative(),
    discountAmount: z.number().nonnegative(),
    finalAmount: z.number().nonnegative(),
    status: UsageLogStatus,
    verifiedByUserId: z.number().int().optional(),
    cancellationReason: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Log Usage Request
  LogUsageRequest: z.object({
    memberId: z.number().int(),
    planId: z.number().int(),
    orderId: z.number().int().optional(),
    originalAmount: z.number().positive("Original amount must be positive"),
    discountAmount: z.number().nonnegative(),
    finalAmount: z.number().nonnegative(),
  }),

  // Cancel Usage Request
  CancelUsageRequest: z.object({
    reason: z.string().min(1, "Cancellation reason is required"),
  }),

  // Partnership Statistics
  PartnershipStatistics: z.object({
    partnershipId: z.number().int(),
    totalMembers: z.number().int(),
    approvedMembers: z.number().int(),
    pendingMembers: z.number().int(),
    totalUsages: z.number().int(),
    totalDiscountGiven: z.number().nonnegative(),
    totalRevenue: z.number().nonnegative(),
    activePlans: z.number().int(),
  }),
};

/**
 * Partnerships API Routes
 */

// Create Partnership
export const createPartnershipRoute = createRoute({
  method: "post",
  path: "/api/v1/partnerships",
  tags: ["partnerships"],
  summary: "創建合作夥伴",
  description: "創建新的特約合作夥伴（需要管理員或店主權限）",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: PartnershipsSchemas.CreatePartnershipRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "合作夥伴創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.Partnership,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Get Partnerships
export const getPartnershipsRoute = createRoute({
  method: "get",
  path: "/api/v1/partnerships",
  tags: ["partnerships"],
  summary: "獲取合作夥伴列表",
  description: "獲取所有合作夥伴，支持分頁和過濾",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      restaurantId: z.string().optional(),
      status: PartnershipsSchemas.PartnershipStatus.optional(),
      partnerType: z.string().optional(),
      page: z.string().regex(/^\d+$/).transform(Number).prefault("1"),
      limit: z.string().regex(/^\d+$/).transform(Number).prefault("20"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取合作夥伴列表",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(PartnershipsSchemas.Partnership),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Get Partnership by ID
export const getPartnershipRoute = createRoute({
  method: "get",
  path: "/api/v1/partnerships/:id",
  tags: ["partnerships"],
  summary: "獲取合作夥伴詳情",
  description: "獲取指定合作夥伴的詳細信息",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "成功獲取合作夥伴詳情",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.Partnership,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Get Partnership Statistics
export const getPartnershipStatsRoute = createRoute({
  method: "get",
  path: "/api/v1/partnerships/:id/statistics",
  tags: ["partnerships"],
  summary: "獲取合作夥伴統計",
  description: "獲取合作夥伴的會員數、使用次數、折扣總額等統計數據",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "成功獲取統計數據",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.PartnershipStatistics,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Update Partnership
export const updatePartnershipRoute = createRoute({
  method: "put",
  path: "/api/v1/partnerships/:id",
  tags: ["partnerships"],
  summary: "更新合作夥伴",
  description: "更新合作夥伴的信息和合約狀態",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
    body: {
      content: {
        "application/json": {
          schema: PartnershipsSchemas.UpdatePartnershipRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "更新成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.Partnership,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

// Delete Partnership
export const deletePartnershipRoute = createRoute({
  method: "delete",
  path: "/api/v1/partnerships/:id",
  tags: ["partnerships"],
  summary: "刪除合作夥伴",
  description: "刪除合作夥伴（僅限管理員）",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "刪除成功",
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

// ======= Plan Routes =======

// Create Plan
export const createPlanRoute = createRoute({
  method: "post",
  path: "/api/v1/partnerships/plans",
  tags: ["partnerships"],
  summary: "創建特約方案",
  description:
    "創建新的特約優惠方案（支持百分比、固定金額、特殊價格三種折扣類型）",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: PartnershipsSchemas.CreatePlanRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "方案創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.PartnershipPlan,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Get Plans
export const getPlansRoute = createRoute({
  method: "get",
  path: "/api/v1/partnerships/plans",
  tags: ["partnerships"],
  summary: "獲取方案列表",
  description: "獲取特約方案列表，支持過濾和分頁",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      partnershipId: z.string().regex(/^\d+$/).transform(Number).optional(),
      isActive: z
        .string()
        .transform((val) => val === "true")
        .optional(),
      discountType: PartnershipsSchemas.DiscountType.optional(),
      page: z.string().regex(/^\d+$/).transform(Number).prefault("1"),
      limit: z.string().regex(/^\d+$/).transform(Number).prefault("20"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取方案列表",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(PartnershipsSchemas.PartnershipPlan),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    ...errorResponses(401),
  },
});

// Get Plan by ID
export const getPlanRoute = createRoute({
  method: "get",
  path: "/api/v1/partnerships/plans/:planId",
  tags: ["partnerships"],
  summary: "獲取方案詳情",
  description: "獲取特約方案的詳細信息",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      planId: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "成功獲取方案詳情",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.PartnershipPlan,
          }),
        },
      },
    },
    ...errorResponses(401, 404),
  },
});

// Validate Plan (Calculate Discount)
export const validatePlanRoute = createRoute({
  method: "post",
  path: "/api/v1/partnerships/plans/validate",
  tags: ["partnerships"],
  summary: "驗證方案並計算折扣",
  description: "收銀員驗證特約優惠，計算實際折扣金額",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: PartnershipsSchemas.ValidatePlanRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "驗證成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.ValidatePlanResult,
          }),
        },
      },
    },
    ...errorResponses(400, 401),
  },
});

// Update Plan
export const updatePlanRoute = createRoute({
  method: "put",
  path: "/api/v1/partnerships/plans/:planId",
  tags: ["partnerships"],
  summary: "更新方案",
  description: "更新特約方案的折扣規則和限制條件",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      planId: z.string().regex(/^\d+$/),
    }),
    body: {
      content: {
        "application/json": {
          schema: PartnershipsSchemas.UpdatePlanRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "更新成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.PartnershipPlan,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

// Delete Plan
export const deletePlanRoute = createRoute({
  method: "delete",
  path: "/api/v1/partnerships/plans/:planId",
  tags: ["partnerships"],
  summary: "刪除方案",
  description: "刪除特約方案",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      planId: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "刪除成功",
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

// ======= Member Routes =======

// Submit Member Verification
export const submitMemberVerificationRoute = createRoute({
  method: "post",
  path: "/api/v1/partnerships/members/verify",
  tags: ["partnerships"],
  summary: "提交會員認證申請",
  description: "學生/員工自助提交特約會員認證申請（公開端點）",
  request: {
    body: {
      content: {
        "application/json": {
          schema: PartnershipsSchemas.MemberVerificationRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "認證申請提交成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.PartnershipMember,
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(400),
  },
});

// Get Members
export const getMembersRoute = createRoute({
  method: "get",
  path: "/api/v1/partnerships/members",
  tags: ["partnerships"],
  summary: "獲取會員列表",
  description: "獲取特約會員列表，支持過濾和分頁",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      partnershipId: z.string().regex(/^\d+$/).transform(Number).optional(),
      verificationStatus: PartnershipsSchemas.MemberStatus.optional(),
      page: z.string().regex(/^\d+$/).transform(Number).prefault("1"),
      limit: z.string().regex(/^\d+$/).transform(Number).prefault("20"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取會員列表",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(PartnershipsSchemas.PartnershipMember),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Get Member by ID
export const getMemberRoute = createRoute({
  method: "get",
  path: "/api/v1/partnerships/members/:memberId",
  tags: ["partnerships"],
  summary: "獲取會員詳情",
  description: "獲取指定特約會員的詳細信息",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      memberId: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "成功獲取會員詳情",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.PartnershipMember,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Approve Member
export const approveMemberRoute = createRoute({
  method: "post",
  path: "/api/v1/partnerships/members/:memberId/approve",
  tags: ["partnerships"],
  summary: "審核通過會員認證",
  description: "管理員或店主審核通過會員認證申請",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      memberId: z.string().regex(/^\d+$/),
    }),
    body: {
      content: {
        "application/json": {
          schema: PartnershipsSchemas.ApproveMemberRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "審核通過成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.PartnershipMember,
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

// Reject Member
export const rejectMemberRoute = createRoute({
  method: "post",
  path: "/api/v1/partnerships/members/:memberId/reject",
  tags: ["partnerships"],
  summary: "拒絕會員認證",
  description: "管理員或店主拒絕會員認證申請",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      memberId: z.string().regex(/^\d+$/),
    }),
    body: {
      content: {
        "application/json": {
          schema: PartnershipsSchemas.RejectMemberRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "拒絕成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.PartnershipMember,
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

// Update Member
export const updateMemberRoute = createRoute({
  method: "put",
  path: "/api/v1/partnerships/members/:memberId",
  tags: ["partnerships"],
  summary: "更新會員資訊",
  description: "更新特約會員的資料和狀態",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      memberId: z.string().regex(/^\d+$/),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            memberName: z.string().min(1).optional(),
            memberIdentifier: z.string().optional(),
            notes: z.string().optional(),
            verificationExpiry: z.string().datetime().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "更新成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.PartnershipMember,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

// ======= Usage Log Routes =======

// Log Usage
export const logUsageRoute = createRoute({
  method: "post",
  path: "/api/v1/partnerships/usage",
  tags: ["partnerships"],
  summary: "記錄特約優惠使用",
  description: "收銀員記錄特約優惠的使用（需要收銀員或以上權限）",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: PartnershipsSchemas.LogUsageRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "使用記錄成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.UsageLog,
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Get Usage Logs
export const getUsageLogsRoute = createRoute({
  method: "get",
  path: "/api/v1/partnerships/usage",
  tags: ["partnerships"],
  summary: "獲取使用記錄列表",
  description: "獲取特約優惠的使用記錄，支持過濾和分頁",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      memberId: z.string().regex(/^\d+$/).transform(Number).optional(),
      planId: z.string().regex(/^\d+$/).transform(Number).optional(),
      status: PartnershipsSchemas.UsageLogStatus.optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      page: z.string().regex(/^\d+$/).transform(Number).prefault("1"),
      limit: z.string().regex(/^\d+$/).transform(Number).prefault("20"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取使用記錄",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(PartnershipsSchemas.UsageLog),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Cancel Usage
export const cancelUsageRoute = createRoute({
  method: "post",
  path: "/api/v1/partnerships/usage/:id/cancel",
  tags: ["partnerships"],
  summary: "取消使用記錄",
  description: "取消已完成的特約優惠使用記錄",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
    body: {
      content: {
        "application/json": {
          schema: PartnershipsSchemas.CancelUsageRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "取消成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.UsageLog,
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

// Refund Usage
export const refundUsageRoute = createRoute({
  method: "post",
  path: "/api/v1/partnerships/usage/:id/refund",
  tags: ["partnerships"],
  summary: "退款使用記錄",
  description: "對已取消的使用記錄進行退款處理",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "退款成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: PartnershipsSchemas.UsageLog,
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});
