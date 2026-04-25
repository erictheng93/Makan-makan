/**
 * Partnership Feature Validation Schemas
 * 特約商店體系驗證模式
 */

import { z } from "zod";

// ================================================
// PARTNERSHIP SCHEMAS
// ================================================

/**
 * 創建合作夥伴Schema
 */
export const createPartnershipSchema = z.object({
  partnerCode: z.string().min(2).max(50),
  partnerName: z.string().min(2).max(200),
  partnerNameEn: z.string().min(2).max(200).optional(),
  partnerType: z.enum([
    "university",
    "school",
    "corporation",
    "government",
    "ngo",
    "other",
  ]),

  // 聯絡資訊
  contactPerson: z.string().min(2).max(100),
  contactTitle: z.string().max(100).optional(),
  contactPhone: z.string().min(8).max(20),
  contactEmail: z.string().email(),
  address: z.string().max(500).optional(),

  // 合約資訊
  contractNumber: z.string().max(100).optional(),
  contractStartDate: z.number().int().positive(),
  contractEndDate: z.number().int().positive(),
  contractDocumentUrl: z.string().url().optional(),

  // 認證設定
  verificationMethod: z
    .enum(["manual", "email_domain", "id_card", "qr_code", "api"])
    .default("manual"),
  verificationConfig: z.record(z.any()).optional(),
  allowedEmailDomains: z.array(z.string()).optional(),

  // 優惠設定
  defaultDiscountType: z.enum(["percentage", "fixed"]).optional(),
  defaultDiscountValue: z.number().nonnegative().optional(),

  // 額外資訊
  logoUrl: z.string().url().optional(),
  description: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * 更新合作夥伴Schema
 */
export const updatePartnershipSchema = createPartnershipSchema.partial();

/**
 * 合作夥伴查詢過濾器Schema
 */
export const partnershipFiltersSchema = z.object({
  partnerType: z
    .enum(["university", "school", "corporation", "government", "ngo", "other"])
    .optional(),
  status: z
    .enum(["draft", "active", "suspended", "expired", "terminated"])
    .optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  search: z.string().optional(),
  contractActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("20"),
});

// ================================================
// PLAN SCHEMAS
// ================================================

/**
 * 創建方案Schema
 */
export const createPlanSchema = z.object({
  partnershipId: z.string().uuid(),
  restaurantId: z.string().min(1),

  // 方案資訊
  planCode: z.string().min(2).max(50),
  planName: z.string().min(2).max(200),
  planNameEn: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional(),

  // 折扣設定
  discountType: z.enum(["percentage", "fixed", "special_price"]),
  discountValue: z.number().nonnegative(),
  maxDiscountAmount: z.number().nonnegative().optional(),

  // 使用條件
  minOrderAmount: z.number().nonnegative().optional().default(0),
  maxOrderAmount: z.number().nonnegative().optional(),
  applicableMenuItems: z.array(z.string()).optional(),
  applicableCategories: z.array(z.string()).optional(),
  excludedMenuItems: z.array(z.string()).optional(),
  excludedCategories: z.array(z.string()).optional(),

  // 時間限制
  applicableDays: z.array(z.number().int().min(0).max(6)).optional(),
  applicableTimeSlots: z
    .array(
      z.object({
        start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      }),
    )
    .optional(),

  // 使用限制
  usageLimitPerMember: z.number().int().positive().optional(),
  usageLimitPerDay: z.number().int().positive().optional(),

  // 有效期
  validFrom: z.number().int().positive(),
  validTo: z.number().int().positive(),

  // 優先級和組合
  priority: z.number().int().optional().default(0),
  canCombineWithCoupons: z.boolean().optional().default(false),
  canCombineWithPromotions: z.boolean().optional().default(false),

  // 顯示設定
  badgeText: z.string().max(50).optional(),
  badgeColor: z.string().max(20).optional(),
  showOnMenu: z.boolean().optional().default(true),

  // 額外資訊
  termsAndConditions: z.string().max(2000).optional(),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * 更新方案Schema
 */
export const updatePlanSchema = createPlanSchema.partial().omit({
  partnershipId: true,
  restaurantId: true,
});

/**
 * 方案查詢過濾器Schema
 */
export const planFiltersSchema = z.object({
  partnershipId: z.string().uuid().optional(),
  restaurantId: z.string().optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  validOnly: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("20"),
});

/**
 * 驗證方案Schema
 */
export const validatePlanSchema = z.object({
  planId: z.string().uuid(),
  memberId: z.string().uuid(),
  orderAmount: z.number().positive(),
  menuItems: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
});

// ================================================
// MEMBER SCHEMAS
// ================================================

/**
 * 會員認證申請Schema
 */
export const memberVerificationSchema = z.object({
  partnershipId: z.string().uuid(),
  memberId: z.string().min(2).max(50), // 學號/工號
  memberType: z.enum([
    "student",
    "employee",
    "faculty",
    "alumni",
    "staff",
    "other",
  ]),
  fullName: z.string().min(2).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(8).max(20).optional(),

  // 認證資訊
  verificationMethod: z.enum([
    "manual",
    "email_domain",
    "id_card",
    "qr_code",
    "api",
  ]),
  verificationDocumentUrl: z.string().url().optional(),

  // 額外資訊
  department: z.string().max(200).optional(),
  gradeOrPosition: z.string().max(100).optional(),
  studentIdPhotoUrl: z.string().url().optional(),
});

/**
 * 審核會員Schema
 */
export const approveMemberSchema = z.object({
  verificationExpiry: z.number().int().positive().optional(),
});

/**
 * 拒絕會員Schema
 */
export const rejectMemberSchema = z.object({
  rejectionReason: z.string().min(5).max(500),
});

/**
 * 更新會員Schema
 */
export const updateMemberSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(8).max(20).optional(),
    department: z.string().max(200).optional(),
    gradeOrPosition: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .partial();

/**
 * 會員查詢過濾器Schema
 */
export const memberFiltersSchema = z.object({
  partnershipId: z.string().uuid().optional(),
  status: z
    .enum(["pending", "verified", "rejected", "expired", "suspended"])
    .optional(),
  memberType: z
    .enum(["student", "employee", "faculty", "alumni", "staff", "other"])
    .optional(),
  search: z.string().optional(),
  verifiedOnly: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("20"),
});

// ================================================
// USAGE LOG SCHEMAS
// ================================================

/**
 * 記錄使用Schema
 */
export const logUsageSchema = z.object({
  partnershipId: z.string().uuid(),
  planId: z.string().uuid(),
  memberId: z.string().uuid(),
  // orders.id is integer auto-increment in DB (not the same as the
  // partnership/plan/member text-UUID PKs). users.id is also integer.
  orderId: z.number().int().positive(),
  restaurantId: z.string().min(1),

  // 折扣資訊
  discountType: z.string(),
  discountValue: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),

  // 訂單資訊
  originalAmount: z.number().nonnegative(),
  finalAmount: z.number().nonnegative(),
  orderItems: z.array(z.any()).optional(),

  // 使用資訊
  channel: z.enum(["dine_in", "takeaway", "delivery", "online"]).optional(),
  verificationMethod: z.string().optional(),
  verifiedByUserId: z.number().int().positive().optional(),

  // 額外資訊
  metadata: z.record(z.any()).optional(),
});

/**
 * 使用記錄查詢過濾器Schema
 */
export const usageLogFiltersSchema = z.object({
  partnershipId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  restaurantId: z.string().optional(),
  status: z.enum(["pending", "completed", "cancelled", "refunded"]).optional(),
  startDate: z
    .string()
    .transform((val) => new Date(val).getTime())
    .optional(),
  endDate: z
    .string()
    .transform((val) => new Date(val).getTime())
    .optional(),
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("20"),
});

/**
 * 取消使用記錄Schema
 */
export const cancelUsageSchema = z.object({
  reason: z.string().min(5).max(500),
});

// ================================================
// COMMON SCHEMAS
// ================================================

/**
 * ID參數Schema
 */
export const idParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Partnership ID參數Schema
 */
export const partnershipIdParamSchema = z.object({
  partnershipId: z.string().uuid(),
});

/**
 * Plan ID參數Schema
 */
export const planIdParamSchema = z.object({
  planId: z.string().uuid(),
});

/**
 * Member ID參數Schema
 */
export const memberIdParamSchema = z.object({
  memberId: z.string().uuid(),
});

/**
 * 分頁Schema
 */
export const paginationSchema = z.object({
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("20"),
});

// ================================================
// TYPE EXPORTS
// ================================================

export type CreatePartnershipInput = z.infer<typeof createPartnershipSchema>;
export type UpdatePartnershipInput = z.infer<typeof updatePartnershipSchema>;
export type PartnershipFiltersInput = z.infer<typeof partnershipFiltersSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type PlanFiltersInput = z.infer<typeof planFiltersSchema>;
export type ValidatePlanInput = z.infer<typeof validatePlanSchema>;
export type MemberVerificationInput = z.infer<typeof memberVerificationSchema>;
export type ApproveMemberInput = z.infer<typeof approveMemberSchema>;
export type RejectMemberInput = z.infer<typeof rejectMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type MemberFiltersInput = z.infer<typeof memberFiltersSchema>;
export type LogUsageInput = z.infer<typeof logUsageSchema>;
export type UsageLogFiltersInput = z.infer<typeof usageLogFiltersSchema>;
export type CancelUsageInput = z.infer<typeof cancelUsageSchema>;
