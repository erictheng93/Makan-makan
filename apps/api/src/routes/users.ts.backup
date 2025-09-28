import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/validation'
import { UserService, AuthService, USER_ROLES } from '@makanmakan/database'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 用戶角色名稱映射
const USER_ROLE_NAMES = {
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.OWNER]: 'Shop Owner',
  [USER_ROLES.CHEF]: 'Chef',
  [USER_ROLES.SERVICE]: 'Service Crew',
  [USER_ROLES.CASHIER]: 'Cashier',
  [USER_ROLES.CUSTOMER]: 'Customer'
} as const

// 驗證 schemas
const createUserSchema = z.object({
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

const updateUserSchema = z.object({
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

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(100),
  newPassword: z.string().min(6).max(100),
  confirmPassword: z.string().min(6).max(100)
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

const userFilterSchema = z.object({
  restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
  role: z.string().regex(/^\d+$/).transform(Number).optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  isVerified: z.string().transform(val => val === 'true').optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
})

// 權限檢查輔助函數
function canManageUser(currentUser: any, targetRole: number, targetRestaurantId?: number): boolean {
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
 * 獲取用戶列表
 * GET /api/v1/users
 */
app.get('/',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(userFilterSchema as any),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const currentUser = c.get('user')
      const userService = new UserService(c.env.DB as any)
      
      const filters = {
        ...query,
        page: query.page,
        limit: query.limit
      }
      
      // 權限過濾：店主只能查看自己餐廳的用戶
      if (currentUser.role === USER_ROLES.OWNER) {
        filters.restaurantId = currentUser.restaurantId
      }
      
      const result = currentUser.role === USER_ROLES.ADMIN 
        ? await userService.getAllUsers(filters)
        : await userService.getRestaurantUsers(currentUser.restaurantId!, filters)
      
      // 格式化用戶資料
      const formattedUsers = result.users.map((user: any) => ({
        ...user,
        role_name: USER_ROLE_NAMES[user.role as keyof typeof USER_ROLE_NAMES] || 'Unknown',
        is_active: user.isActive
      }))
      
      return c.json({
        success: true,
        data: formattedUsers,
        pagination: result.pagination
      })
      
    } catch (error) {
      console.error('Get users error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch users'
      }, 500)
    }
  }
)

/**
 * 獲取單一用戶詳情
 * GET /api/v1/users/:id
 */
app.get('/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.CHEF, USER_ROLES.SERVICE, USER_ROLES.CASHIER, USER_ROLES.CUSTOMER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const currentUser = c.get('user')
      const userService = new UserService(c.env.DB as any)
      
      const targetUser = await userService.getUserById(parseInt(id))
      
      if (!targetUser) {
        return c.json({
          success: false,
          error: 'User not found'
        }, 404)
      }
      
      // 權限檢查
      const canView = 
        currentUser.role === USER_ROLES.ADMIN || // 管理員可以查看所有人
        currentUser.id === parseInt(id) || // 用戶可以查看自己
        (currentUser.role === USER_ROLES.OWNER && targetUser.restaurantId === currentUser.restaurantId) // 店主可以查看同餐廳員工
      
      if (!canView) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 格式化用戶資料
      const safeUser = {
        id: targetUser.id,
        username: targetUser.username,
        role: targetUser.role,
        role_name: USER_ROLE_NAMES[targetUser.role as keyof typeof USER_ROLE_NAMES] || 'Unknown',
        restaurantId: targetUser.restaurantId,
        email: targetUser.email,
        fullName: targetUser.fullName,
        phone: targetUser.phone,
        address: targetUser.address,
        dateOfBirth: targetUser.dateOfBirth,
        profileImageUrl: targetUser.profileImageUrl,
        isActive: targetUser.isActive,
        isVerified: targetUser.isVerified,
        preferences: targetUser.preferences,
        totalOrders: targetUser.totalOrders,
        totalSpent: targetUser.totalSpent,
        lastLoginAt: targetUser.lastLoginAt,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt
      }
      
      return c.json({
        success: true,
        data: safeUser
      })
      
    } catch (error) {
      console.error('Get user error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user'
      }, 500)
    }
  }
)

/**
 * 創建用戶
 * POST /api/v1/users
 */
app.post('/',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(createUserSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const currentUser = c.get('user')
      const userService = new UserService(c.env.DB as any)
      
      // 權限檢查
      if (!canManageUser(currentUser, data.role, data.restaurantId)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to create this type of user'
        }, 403)
      }
      
      const newUser = await userService.createUser({
        username: data.username,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: data.role,
        restaurantId: data.restaurantId,
        address: data.address,
        dateOfBirth: data.dateOfBirth,
        profileImageUrl: data.profileImageUrl,
        preferences: data.preferences
      })
      
      const response = {
        ...newUser,
        role_name: USER_ROLE_NAMES[newUser.role as keyof typeof USER_ROLE_NAMES] || 'Unknown',
        is_active: newUser.isActive
      }
      
      return c.json({
        success: true,
        data: response
      }, 201)
      
    } catch (error) {
      console.error('Create user error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user'
      }, 500)
    }
  }
)

/**
 * 更新用戶資料
 * PUT /api/v1/users/:id
 */
app.put('/:id',
  authMiddleware,
  validateParams(commonSchemas.idParam as any),
  validateBody(updateUserSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const currentUser = c.get('user')
      const userService = new UserService(c.env.DB as any)
      
      // 獲取目標用戶
      const targetUser = await userService.getUserById(parseInt(id))
      
      if (!targetUser) {
        return c.json({
          success: false,
          error: 'User not found'
        }, 404)
      }
      
      // 權限檢查
      const canUpdate = 
        currentUser.role === USER_ROLES.ADMIN || // 管理員可以更新所有人
        currentUser.id === parseInt(id) || // 用戶可以更新自己
        (currentUser.role === USER_ROLES.OWNER && canManageUser(currentUser, targetUser.role, targetUser.restaurantId))
      
      if (!canUpdate) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const updatedUser = await userService.updateUser(parseInt(id), data)
      
      const response = {
        ...updatedUser,
        role_name: USER_ROLE_NAMES[updatedUser.role as keyof typeof USER_ROLE_NAMES] || 'Unknown',
        is_active: updatedUser.isActive
      }
      
      return c.json({
        success: true,
        data: response
      })
      
    } catch (error) {
      console.error('Update user error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user'
      }, 500)
    }
  }
)

/**
 * 修改密碼
 * POST /api/v1/users/:id/password
 */
app.post('/:id/password',
  authMiddleware,
  validateParams(commonSchemas.idParam as any),
  validateBody(updatePasswordSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { currentPassword, newPassword } = c.get('validatedBody')
      const currentUser = c.get('user')
      const authService = new AuthService(c.env.DB as any)
      
      // 只有用戶自己或管理員可以修改密碼
      if (currentUser.id !== parseInt(id) && currentUser.role !== USER_ROLES.ADMIN) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const result = await authService.changePassword(parseInt(id), currentPassword, newPassword)
      
      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }
      
      return c.json({
        success: true,
        message: 'Password updated successfully'
      })
      
    } catch (error) {
      console.error('Update password error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update password'
      }, 500)
    }
  }
)

/**
 * 停用/啟用用戶
 * PATCH /api/v1/users/:id/status
 */
app.patch('/:id/status',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  validateBody(z.object({
    isActive: z.boolean(),
    reason: z.string().max(200).optional()
  }) as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { isActive } = c.get('validatedBody')
      const currentUser = c.get('user')
      const userService = new UserService(c.env.DB as any)
      
      const targetUser = await userService.getUserById(parseInt(id))
      
      if (!targetUser) {
        return c.json({
          success: false,
          error: 'User not found'
        }, 404)
      }
      
      // 權限檢查
      if (!canManageUser(currentUser, targetUser.role, targetUser.restaurantId)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions'
        }, 403)
      }
      
      // 不能停用自己
      if (currentUser.id === parseInt(id) && !isActive) {
        return c.json({
          success: false,
          error: 'Cannot deactivate your own account'
        }, 400)
      }
      
      await userService.updateUser(parseInt(id), { isActive })
      
      return c.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
      })
      
    } catch (error) {
      console.error('Update user status error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user status'
      }, 500)
    }
  }
)

/**
 * 驗證用戶
 * PATCH /api/v1/users/:id/verify
 */
app.patch('/:id/verify',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const currentUser = c.get('user')
      const userService = new UserService(c.env.DB as any)
      
      const targetUser = await userService.getUserById(parseInt(id))
      
      if (!targetUser) {
        return c.json({
          success: false,
          error: 'User not found'
        }, 404)
      }
      
      // 權限檢查
      if (!canManageUser(currentUser, targetUser.role, targetUser.restaurantId)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions'
        }, 403)
      }
      
      const success = await userService.verifyUser(parseInt(id))
      
      if (!success) {
        return c.json({
          success: false,
          error: 'Failed to verify user'
        }, 500)
      }
      
      return c.json({
        success: true,
        message: 'User verified successfully'
      })
      
    } catch (error) {
      console.error('Verify user error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify user'
      }, 500)
    }
  }
)

/**
 * 重設用戶密碼
 * POST /api/v1/users/:id/reset-password
 */
app.post('/:id/reset-password',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  validateBody(z.object({
    newPassword: z.string().min(6).max(100)
  }) as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { newPassword } = c.get('validatedBody')
      const currentUser = c.get('user')
      const userService = new UserService(c.env.DB as any)
      
      const targetUser = await userService.getUserById(parseInt(id))
      
      if (!targetUser) {
        return c.json({
          success: false,
          error: 'User not found'
        }, 404)
      }
      
      // 權限檢查
      if (!canManageUser(currentUser, targetUser.role, targetUser.restaurantId)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions'
        }, 403)
      }
      
      const success = await userService.resetPassword(parseInt(id), newPassword)
      
      if (!success) {
        return c.json({
          success: false,
          error: 'Failed to reset password'
        }, 500)
      }
      
      return c.json({
        success: true,
        message: 'Password reset successfully'
      })
      
    } catch (error) {
      console.error('Reset password error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset password'
      }, 500)
    }
  }
)

/**
 * 獲取用戶統計
 * GET /api/v1/users/stats
 */
app.get('/stats',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional()
  }) as any),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedQuery')
      const currentUser = c.get('user')
      const userService = new UserService(c.env.DB as any)
      
      // 權限過濾
      let targetRestaurantId: number | undefined
      if (currentUser.role === USER_ROLES.OWNER) {
        targetRestaurantId = currentUser.restaurantId
      } else if (restaurantId) {
        targetRestaurantId = restaurantId
      }
      
      const stats = await userService.getUserStats(targetRestaurantId)
      
      // 格式化角色統計
      const formattedByRole = Object.entries(stats.byRole).reduce((acc, [role, count]) => {
        const roleNum = parseInt(role)
        acc[roleNum] = {
          count,
          role_name: USER_ROLE_NAMES[roleNum as keyof typeof USER_ROLE_NAMES] || 'Unknown'
        }
        return acc
      }, {} as any)
      
      return c.json({
        success: true,
        data: {
          summary: {
            total_users: stats.totalUsers,
            active_users: stats.activeUsers,
            inactive_users: stats.totalUsers - stats.activeUsers,
            new_users_month: stats.recentRegistrations
          },
          by_role: formattedByRole
        }
      })
      
    } catch (error) {
      console.error('Get user stats error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user statistics'
      }, 500)
    }
  }
)

/**
 * 搜尋用戶
 * GET /api/v1/users/search
 */
app.get('/search',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(z.object({
    query: z.string().min(1),
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10')
  }) as any),
  async (c) => {
    try {
      const { query, restaurantId, limit } = c.get('validatedQuery')
      const currentUser = c.get('user')
      const userService = new UserService(c.env.DB as any)
      
      // 權限過濾
      let targetRestaurantId: number | undefined
      if (currentUser.role === USER_ROLES.OWNER) {
        targetRestaurantId = currentUser.restaurantId
      } else if (restaurantId) {
        targetRestaurantId = restaurantId
      }
      
      const results = await userService.searchUsers(query, targetRestaurantId, limit)
      
      const formattedResults = results.map((user: any) => ({
        ...user,
        role_name: USER_ROLE_NAMES[user.role as keyof typeof USER_ROLE_NAMES] || 'Unknown'
      }))
      
      return c.json({
        success: true,
        data: formattedResults
      })
      
    } catch (error) {
      console.error('Search users error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search users'
      }, 500)
    }
  }
)

export default app