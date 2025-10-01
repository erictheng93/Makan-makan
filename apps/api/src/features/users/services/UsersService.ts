import { UserService, AuthService, USER_ROLES } from '@makanmakan/database'
import type { Env } from '../../../types/env'
import type {
  CreateUserData,
  UpdateUserData,
  UserFilters,
  FormattedUser,
  UserStats
} from '../types'

/**
 * Enhanced Users Service with business logic and access control
 */
export class UsersService {
  private userService: UserService
  private authService: AuthService

  constructor(private env: Env) {
    this.userService = new UserService(env.DB as any, env)
    this.authService = new AuthService(env.DB as any, env)
  }

  /**
   * Check if current user can manage target user
   */
  canManageUser(currentUser: any, targetRole: number, targetRestaurantId?: number): boolean {
    // 管理員可以管理所有人
    if (currentUser.role === USER_ROLES.ADMIN) return true

    // 店主只能管理自己餐廳的員工（角色 2-5）
    if (currentUser.role === USER_ROLES.OWNER) {
      return targetRole >= USER_ROLES.CHEF && targetRole <= USER_ROLES.CUSTOMER &&
             targetRestaurantId === currentUser.restaurantId
    }

    return false
  }

  /**
   * Check if current user can view target user
   */
  canViewUser(currentUser: any, targetUser: any): boolean {
    return (
      currentUser.role === USER_ROLES.ADMIN || // 管理員可以查看所有人
      currentUser.id === targetUser.id || // 用戶可以查看自己
      (currentUser.role === USER_ROLES.OWNER && targetUser.restaurantId === currentUser.restaurantId) // 店主可以查看同餐廳員工
    )
  }

  /**
   * Check if current user can update target user
   */
  canUpdateUser(currentUser: any, targetUser: any): boolean {
    return (
      currentUser.role === USER_ROLES.ADMIN || // 管理員可以更新所有人
      currentUser.id === targetUser.id || // 用戶可以更新自己
      (currentUser.role === USER_ROLES.OWNER && this.canManageUser(currentUser, targetUser.role, targetUser.restaurantId))
    )
  }

  /**
   * Format user data for API response
   */
  formatUser(user: any): FormattedUser {
    const roleNames = {
      [USER_ROLES.ADMIN]: 'Admin',
      [USER_ROLES.OWNER]: 'Shop Owner',
      [USER_ROLES.CHEF]: 'Chef',
      [USER_ROLES.SERVICE]: 'Service Crew',
      [USER_ROLES.CASHIER]: 'Cashier',
      [USER_ROLES.CUSTOMER]: 'Customer'
    } as const

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      role_name: roleNames[user.role as keyof typeof roleNames] || 'Unknown',
      restaurantId: user.restaurantId,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      address: user.address,
      dateOfBirth: user.dateOfBirth,
      profileImageUrl: user.profileImageUrl,
      isActive: user.isActive,
      isVerified: user.isVerified,
      preferences: user.preferences,
      totalOrders: user.totalOrders,
      totalSpent: user.totalSpent,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  }

  /**
   * Get users list with filtering and access control
   */
  async getUsers(currentUser: any, filters: UserFilters) {
    // 權限過濾：店主只能查看自己餐廳的用戶
    if (currentUser.role === USER_ROLES.OWNER) {
      filters.restaurantId = currentUser.restaurantId
    }

    const result = currentUser.role === USER_ROLES.ADMIN
      ? await this.userService.getAllUsers(filters)
      : await this.userService.getRestaurantUsers(currentUser.restaurantId!, filters)

    // 格式化用戶資料
    const formattedUsers = result.users.map((user: any) => this.formatUser(user))

    return {
      success: true,
      data: formattedUsers,
      pagination: result.pagination
    }
  }

  /**
   * Get single user by ID with access control
   */
  async getUserById(currentUser: any, userId: number) {
    const targetUser = await this.userService.getUserById(userId)

    if (!targetUser) {
      return {
        success: false,
        error: 'User not found',
        status: 404
      }
    }

    // 權限檢查
    if (!this.canViewUser(currentUser, targetUser)) {
      return {
        success: false,
        error: 'Access denied',
        status: 403
      }
    }

    return {
      success: true,
      data: this.formatUser(targetUser)
    }
  }

  /**
   * Create new user with access control
   */
  async createUser(currentUser: any, userData: CreateUserData) {
    // 權限檢查
    if (!this.canManageUser(currentUser, userData.role, userData.restaurantId)) {
      return {
        success: false,
        error: 'Insufficient permissions to create this type of user',
        status: 403
      }
    }

    const newUser = await this.userService.createUser(userData)

    return {
      success: true,
      data: this.formatUser(newUser),
      status: 201
    }
  }

  /**
   * Update user with access control
   */
  async updateUser(currentUser: any, userId: number, updateData: UpdateUserData) {
    // 獲取目標用戶
    const targetUser = await this.userService.getUserById(userId)

    if (!targetUser) {
      return {
        success: false,
        error: 'User not found',
        status: 404
      }
    }

    // 權限檢查
    if (!this.canUpdateUser(currentUser, targetUser)) {
      return {
        success: false,
        error: 'Access denied',
        status: 403
      }
    }

    const updatedUser = await this.userService.updateUser(userId, updateData)

    return {
      success: true,
      data: this.formatUser(updatedUser)
    }
  }

  /**
   * Change user password
   */
  async changePassword(currentUser: any, userId: number, currentPassword: string, newPassword: string) {
    // 只有用戶自己或管理員可以修改密碼
    if (currentUser.id !== userId && currentUser.role !== USER_ROLES.ADMIN) {
      return {
        success: false,
        error: 'Access denied',
        status: 403
      }
    }

    const result = await this.authService.changePassword(userId, currentPassword, newPassword)

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        status: 400
      }
    }

    return {
      success: true,
      message: 'Password updated successfully'
    }
  }

  /**
   * Update user status (activate/deactivate)
   */
  async updateUserStatus(currentUser: any, userId: number, isActive: boolean) {
    const targetUser = await this.userService.getUserById(userId)

    if (!targetUser) {
      return {
        success: false,
        error: 'User not found',
        status: 404
      }
    }

    // 權限檢查
    if (!this.canManageUser(currentUser, targetUser.role, targetUser.restaurantId)) {
      return {
        success: false,
        error: 'Insufficient permissions',
        status: 403
      }
    }

    // 不能停用自己
    if (currentUser.id === userId && !isActive) {
      return {
        success: false,
        error: 'Cannot deactivate your own account',
        status: 400
      }
    }

    await this.userService.updateUser(userId, { isActive })

    return {
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    }
  }

  /**
   * Verify user
   */
  async verifyUser(currentUser: any, userId: number) {
    const targetUser = await this.userService.getUserById(userId)

    if (!targetUser) {
      return {
        success: false,
        error: 'User not found',
        status: 404
      }
    }

    // 權限檢查
    if (!this.canManageUser(currentUser, targetUser.role, targetUser.restaurantId)) {
      return {
        success: false,
        error: 'Insufficient permissions',
        status: 403
      }
    }

    const success = await this.userService.verifyUser(userId)

    if (!success) {
      return {
        success: false,
        error: 'Failed to verify user',
        status: 500
      }
    }

    return {
      success: true,
      message: 'User verified successfully'
    }
  }

  /**
   * Reset user password (admin/owner only)
   */
  async resetPassword(currentUser: any, userId: number, newPassword: string) {
    const targetUser = await this.userService.getUserById(userId)

    if (!targetUser) {
      return {
        success: false,
        error: 'User not found',
        status: 404
      }
    }

    // 權限檢查
    if (!this.canManageUser(currentUser, targetUser.role, targetUser.restaurantId)) {
      return {
        success: false,
        error: 'Insufficient permissions',
        status: 403
      }
    }

    const success = await this.userService.resetPassword(userId, newPassword)

    if (!success) {
      return {
        success: false,
        error: 'Failed to reset password',
        status: 500
      }
    }

    return {
      success: true,
      message: 'Password reset successfully'
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(currentUser: any, restaurantId?: number): Promise<UserStats> {
    // 權限過濾
    let targetRestaurantId: number | undefined
    if (currentUser.role === USER_ROLES.OWNER) {
      targetRestaurantId = currentUser.restaurantId
    } else if (restaurantId) {
      targetRestaurantId = restaurantId
    }

    const stats = await this.userService.getUserStats(targetRestaurantId)

    const roleNames = {
      [USER_ROLES.ADMIN]: 'Admin',
      [USER_ROLES.OWNER]: 'Shop Owner',
      [USER_ROLES.CHEF]: 'Chef',
      [USER_ROLES.SERVICE]: 'Service Crew',
      [USER_ROLES.CASHIER]: 'Cashier',
      [USER_ROLES.CUSTOMER]: 'Customer'
    } as const

    // 格式化角色統計
    const formattedByRole = Object.entries(stats.byRole).reduce((acc, [role, count]) => {
      const roleNum = parseInt(role)
      acc[roleNum] = {
        count,
        role_name: roleNames[roleNum as keyof typeof roleNames] || 'Unknown'
      }
      return acc
    }, {} as any)

    return {
      summary: {
        total_users: stats.totalUsers,
        active_users: stats.activeUsers,
        inactive_users: stats.totalUsers - stats.activeUsers,
        new_users_month: stats.recentRegistrations
      },
      by_role: formattedByRole
    }
  }

  /**
   * Search users
   */
  async searchUsers(currentUser: any, query: string, restaurantId?: number, limit?: number) {
    // 權限過濾
    let targetRestaurantId: number | undefined
    if (currentUser.role === USER_ROLES.OWNER) {
      targetRestaurantId = currentUser.restaurantId
    } else if (restaurantId) {
      targetRestaurantId = restaurantId
    }

    const results = await this.userService.searchUsers(query, targetRestaurantId, limit)

    return results.map((user: any) => this.formatUser(user))
  }
}