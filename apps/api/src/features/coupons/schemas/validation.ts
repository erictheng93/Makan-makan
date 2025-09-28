/**
 * Coupons Feature Validation Schemas
 *
 * Zod schemas for validating coupon-related requests
 */

import { z } from 'zod'

// 驗證 schemas
export const validateCouponSchema = z.object({
  code: z.string().min(1).max(50),
  restaurantId: z.string().min(1),
  orderAmount: z.number().positive(),
  userId: z.number().int().positive().optional(),
  menuItems: z.array(z.object({
    menuItemId: z.number().int().positive(),
    quantity: z.number().int().positive()
  })).optional()
})

export const createCouponSchema = z.object({
  restaurantId: z.string().optional(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().positive(),
  maxDiscountAmount: z.number().positive().optional(),
  minOrderAmount: z.number().min(0).optional(),
  applicableMenuItems: z.array(z.number().int().positive()).optional(),
  applicableCategories: z.array(z.number().int().positive()).optional(),
  usageLimit: z.number().int().positive().optional(),
  usageLimitPerUser: z.number().int().positive().optional(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional()
})

export const updateCouponSchema = createCouponSchema.partial()

export const couponFiltersSchema = z.object({
  restaurantId: z.string().optional(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  validOnly: z.boolean().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
})

export const useCouponSchema = z.object({
  couponId: z.number().int().positive(),
  orderId: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
  discountAmount: z.number().positive(),
  originalAmount: z.number().positive(),
  finalAmount: z.number().min(0)
})

export const distributeCouponSchema = z.object({
  couponId: z.number().int().positive(),
  distributionType: z.enum(['manual', 'auto', 'bulk', 'promotion']),
  targetType: z.enum(['all', 'user', 'group', 'new_user', 'vip']).optional(),
  targetCriteria: z.any().optional(),
  totalDistributed: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional()
})

export const createTemplateSchema = z.object({
  restaurantId: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  templateData: z.any(),
  isSystemTemplate: z.boolean().optional()
})

export const updateTemplateSchema = createTemplateSchema.partial()

// Common parameter schemas
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number)
})

export const restaurantIdParamSchema = z.object({
  restaurantId: z.string().min(1)
})

// Bulk operations schemas
export const bulkActionSchema = z.object({
  couponIds: z.array(z.number().int().positive()).min(1),
  action: z.enum(['activate', 'deactivate', 'delete'])
})

export const bulkCreateCouponsSchema = z.object({
  coupons: z.array(createCouponSchema).min(1).max(50), // Limit bulk operations
  skipValidation: z.boolean().optional().default(false)
})

// Analytics and reporting schemas
export const statsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  restaurantId: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed']).optional()
})

export const exportCouponsSchema = z.object({
  format: z.enum(['csv', 'json', 'xlsx']),
  filters: couponFiltersSchema.optional(),
  fields: z.array(z.string()).optional()
})

// Validation error messages
export const validationMessages = {
  required: '此欄位為必填項',
  invalidFormat: '格式不正確',
  tooShort: '長度太短',
  tooLong: '長度太長',
  invalidDiscountType: '折扣類型必須是 percentage 或 fixed',
  invalidDate: '日期格式不正確',
  futureDate: '結束日期必須晚於開始日期',
  positiveNumber: '必須是正數',
  invalidCode: '優惠券代碼只能包含字母和數字'
} as const