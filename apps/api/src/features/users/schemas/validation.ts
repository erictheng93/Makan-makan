import { z } from 'zod'

/**
 * User creation validation schema
 */
export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  fullName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  password: z.string().min(6).max(100),
  role: z.number().int().min(0).max(5),
  restaurantId: z.number().int().positive().optional(),
  address: z.string().max(200).optional(),
  dateOfBirth: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
  preferences: z.any().optional()
})

/**
 * User update validation schema
 */
export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  fullName: z.string().min(1).max(100).optional(),
  address: z.string().max(200).optional(),
  dateOfBirth: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
  preferences: z.any().optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional()
})

/**
 * Password update validation schema
 */
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(100),
  newPassword: z.string().min(6).max(100),
  confirmPassword: z.string().min(6).max(100)
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

/**
 * User filter validation schema
 */
export const userFilterSchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  role: z.string().regex(/^\d+$/).transform(Number).optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  isVerified: z.string().transform(val => val === 'true').optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
})

/**
 * User status update validation schema
 */
export const userStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().max(200).optional()
})

/**
 * Reset password validation schema
 */
export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6).max(100)
})

/**
 * User statistics query validation schema
 */
export const userStatsSchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional()
})

/**
 * User search validation schema
 */
export const userSearchSchema = z.object({
  query: z.string().min(1),
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10')
})