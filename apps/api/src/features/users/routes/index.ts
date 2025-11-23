import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../../../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../../../middleware/validation'
import { USER_ROLES } from '@makanmakan/database'
import type { Env } from '../../../types/env'
import { UsersService } from '../services/UsersService'
import {
  createUserSchema,
  updateUserSchema,
  updatePasswordSchema,
  userFilterSchema,
  userStatusSchema,
  resetPasswordSchema,
  userStatsSchema,
  userSearchSchema
} from '../schemas/validation'

const app = new Hono<{ Bindings: Env }>()

/**
 * 安全地記錄錯誤，避免循環引用問題
 */
function logError(operation: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  console.error(`${operation} error:`, errorMessage)
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
      const usersService = new UsersService(c.env)

      const result = await usersService.getUsers(currentUser, query)

      return c.json(result)

    } catch (error) {
      logError('Get users', error)
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
      const usersService = new UsersService(c.env)

      const result = await usersService.getUserById(currentUser, parseInt(id))

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, result.status as any || 500)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      logError('Get user', error)
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
      const usersService = new UsersService(c.env)

      const result = await usersService.createUser(currentUser, data)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, result.status as any || 500)
      }

      return c.json({
        success: true,
        data: result.data
      }, result.status as any || 200)

    } catch (error) {
      logError('Create user', error)
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
      const usersService = new UsersService(c.env)

      const result = await usersService.updateUser(currentUser, parseInt(id), data)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, result.status as any || 500)
      }

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      logError('Update user', error)
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
      const usersService = new UsersService(c.env)

      const result = await usersService.changePassword(currentUser, parseInt(id), currentPassword, newPassword)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, result.status as any || 500)
      }

      return c.json({
        success: true,
        message: result.message
      })

    } catch (error) {
      logError('Update password', error)
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
  validateBody(userStatusSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { isActive } = c.get('validatedBody')
      const currentUser = c.get('user')
      const usersService = new UsersService(c.env)

      const result = await usersService.updateUserStatus(currentUser, parseInt(id), isActive)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, result.status as any || 500)
      }

      return c.json({
        success: true,
        message: result.message
      })

    } catch (error) {
      logError('Update user status', error)
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
      const usersService = new UsersService(c.env)

      const result = await usersService.verifyUser(currentUser, parseInt(id))

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, result.status as any || 500)
      }

      return c.json({
        success: true,
        message: result.message
      })

    } catch (error) {
      logError('Verify user', error)
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
  validateBody(resetPasswordSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { newPassword } = c.get('validatedBody')
      const currentUser = c.get('user')
      const usersService = new UsersService(c.env)

      const result = await usersService.resetPassword(currentUser, parseInt(id), newPassword)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, result.status as any || 500)
      }

      return c.json({
        success: true,
        message: result.message
      })

    } catch (error) {
      logError('Reset password', error)
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
  validateQuery(userStatsSchema as any),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedQuery')
      const currentUser = c.get('user')
      const usersService = new UsersService(c.env)

      const stats = await usersService.getUserStats(currentUser, restaurantId)

      return c.json({
        success: true,
        data: stats
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
  validateQuery(userSearchSchema as any),
  async (c) => {
    try {
      const { query, restaurantId, limit } = c.get('validatedQuery')
      const currentUser = c.get('user')
      const usersService = new UsersService(c.env)

      const results = await usersService.searchUsers(currentUser, query, restaurantId, limit)

      return c.json({
        success: true,
        data: results
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