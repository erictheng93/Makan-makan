import { USER_ROLES } from '@makanmakan/database'

/**
 * User role names mapping for display purposes
 */
export const _USER_ROLE_NAMES = {
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.OWNER]: 'Shop Owner',
  [USER_ROLES.CHEF]: 'Chef',
  [USER_ROLES.SERVICE]: 'Service Crew',
  [USER_ROLES.CASHIER]: 'Cashier',
  [USER_ROLES.CUSTOMER]: 'Customer'
} as const

/**
 * User creation data interface
 */
export interface CreateUserData {
  username: string
  fullName: string
  email?: string
  phone?: string
  password: string
  role: number
  restaurantId?: string
  address?: string
  dateOfBirth?: string
  profileImageUrl?: string
  preferences?: any
}

/**
 * User update data interface
 */
export interface UpdateUserData {
  email?: string
  phone?: string
  fullName?: string
  address?: string
  dateOfBirth?: string
  profileImageUrl?: string
  preferences?: any
  isActive?: boolean
  isVerified?: boolean
}

/**
 * Password update data interface
 */
export interface UpdatePasswordData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * User filter interface for search and listing
 */
export interface UserFilters {
  restaurantId?: string
  role?: number
  isActive?: boolean
  isVerified?: boolean
  search?: string
  page?: number
  limit?: number
}

/**
 * User status update interface
 */
export interface UserStatusUpdate {
  isActive: boolean
  reason?: string
}

/**
 * Reset password data interface
 */
export interface ResetPasswordData {
  newPassword: string
}

/**
 * User search query interface
 */
export interface UserSearchQuery {
  query: string
  restaurantId?: string
  limit?: number
}

/**
 * Formatted user response interface
 */
export interface FormattedUser {
  id: number
  username: string
  role: number
  role_name: string
  restaurantId?: string
  email?: string
  fullName: string
  phone?: string
  address?: string
  dateOfBirth?: string
  profileImageUrl?: string
  isActive: boolean
  isVerified: boolean
  preferences?: any
  totalOrders?: number
  totalSpent?: number
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

/**
 * User statistics interface
 */
export interface UserStats {
  summary: {
    total_users: number
    active_users: number
    inactive_users: number
    new_users_month: number
  }
  by_role: Record<number, {
    count: number
    role_name: string
  }>
}