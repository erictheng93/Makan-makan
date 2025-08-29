import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/validation'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 用戶角色定義
const USER_ROLES = {
  0: 'Admin',         // 系統管理員
  1: 'Shop Owner',    // 店主
  2: 'Chef',          // 廚師
  3: 'Service Crew',  // 送菜員
  4: 'Cashier'        // 收銀員
} as const

// 驗證 schemas
const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  role: z.number().int().min(0).max(4),
  restaurantId: z.number().int().positive().optional(),
  email: z.string().email().optional(),
  fullName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  permissions: z.any().optional(),
  isActive: z.boolean().default(true)
})

const updateUserSchema = createUserSchema.partial().omit({ username: true, password: true }).extend({
  newPassword: z.string().min(6).max(100).optional(),
  currentPassword: z.string().min(6).max(100).optional()
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
  search: z.string().optional(), // 搜尋用戶名或全名
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
})

// 權限檢查輔助函數
function canManageUser(currentUser: any, targetRole: number, targetRestaurantId?: number): boolean {
  // 管理員可以管理所有人
  if (currentUser.role === 0) return true
  
  // 店主只能管理自己餐廳的員工（角色 2-4）
  if (currentUser.role === 1) {
    return targetRole >= 2 && targetRole <= 4 && targetRestaurantId === currentUser.restaurantId
  }
  
  return false
}

/**
 * 獲取用戶列表
 * GET /api/v1/users
 */
app.get('/',
  authMiddleware,
  requireRole([0, 1]), // 只有管理員和店主可以查看用戶列表
  validateQuery(userFilterSchema),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      
      let whereConditions = ['u.id IS NOT NULL']
      let params: any[] = []
      
      // 權限過濾
      if (user.role === 1) { // 店主只能查看自己餐廳的員工
        whereConditions.push('(u.role >= 2 AND u.restaurant_id = ?)')
        params.push(user.restaurantId)
      }
      
      // 其他過濾條件
      if (query.restaurantId) {
        whereConditions.push('u.restaurant_id = ?')
        params.push(query.restaurantId)
      }
      
      if (query.role !== undefined) {
        whereConditions.push('u.role = ?')
        params.push(query.role)
      }
      
      if (query.isActive !== undefined) {
        whereConditions.push('u.status = ?')
        params.push(query.isActive ? 'active' : 'inactive')
      }
      
      if (query.search) {
        whereConditions.push('(u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)')
        const searchTerm = `%${query.search}%`
        params.push(searchTerm, searchTerm, searchTerm)
      }
      
      // 獲取總數
      const countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        WHERE ${whereConditions.join(' AND ')}
      `
      const countResult = await c.env.DB.prepare(countQuery).bind(...params).first()
      const total = countResult?.total || 0
      
      // 分頁計算
      const offset = (query.page - 1) * query.limit
      
      // 獲取用戶列表
      const usersQuery = `
        SELECT 
          u.id, u.username, u.role, u.restaurant_id, u.email, 
          u.full_name, u.phone, u.status, u.last_login, u.created_at,
          r.name as restaurant_name,
          COUNT(CASE WHEN al.created_at >= datetime('now', '-30 days') THEN 1 END) as recent_activity
        FROM users u
        LEFT JOIN restaurants r ON u.restaurant_id = r.id
        LEFT JOIN audit_logs al ON u.id = al.user_id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `
      
      const usersResult = await c.env.DB.prepare(usersQuery)
        .bind(...params, query.limit, offset).all()
      
      // 格式化用戶資料
      const users = (usersResult.results || []).map((user: any) => ({
        ...user,
        role_name: USER_ROLES[user.role as keyof typeof USER_ROLES] || 'Unknown',
        is_active: user.status === 'active'
      }))
      
      const pagination = {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit)
      }
      
      return c.json({
        success: true,
        data: users,
        pagination
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
  requireRole([0, 1, 2, 3, 4]), // 所有角色都可以查看用戶資料
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const currentUser = c.get('user')
      
      const targetUser = await c.env.DB.prepare(`
        SELECT 
          u.*,
          r.name as restaurant_name
        FROM users u
        LEFT JOIN restaurants r ON u.restaurant_id = r.id
        WHERE u.id = ?
      `).bind(id).first()
      
      if (!targetUser) {
        return c.json({
          success: false,
          error: 'User not found'
        }, 404)
      }
      
      // 權限檢查
      const canView = 
        currentUser.role === 0 || // 管理員可以查看所有人
        currentUser.id === parseInt(id) || // 用戶可以查看自己
        (currentUser.role === 1 && targetUser.restaurant_id === currentUser.restaurantId) // 店主可以查看同餐廳員工
      
      if (!canView) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 獲取用戶活動記錄（僅管理員和店主，以及用戶自己）
      let recentActivity = []
      if (currentUser.role <= 1 || currentUser.id === parseInt(id)) {
        const activityResult = await c.env.DB.prepare(`
          SELECT action, resource, details, created_at
          FROM audit_logs 
          WHERE user_id = ? 
          ORDER BY created_at DESC 
          LIMIT 10
        `).bind(id).all()
        
        recentActivity = activityResult.results || []
      }
      
      // 隱藏敏感資料
      const safeUser = {
        id: targetUser.id,
        username: targetUser.username,
        role: targetUser.role,
        role_name: USER_ROLES[targetUser.role as keyof typeof USER_ROLES] || 'Unknown',
        restaurant_id: targetUser.restaurant_id,
        restaurant_name: targetUser.restaurant_name,
        email: targetUser.email,
        full_name: targetUser.full_name,
        phone: targetUser.phone,
        status: targetUser.status,
        is_active: targetUser.status === 'active',
        last_login: targetUser.last_login,
        created_at: targetUser.created_at,
        recent_activity: recentActivity
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
  requireRole([0, 1]), // 只有管理員和店主可以創建用戶
  validateBody(createUserSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const currentUser = c.get('user')
      
      // 權限檢查
      if (!canManageUser(currentUser, data.role, data.restaurantId)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to create this type of user'
        }, 403)
      }
      
      // 檢查用戶名是否已存在
      const existingUser = await c.env.DB.prepare(`
        SELECT id FROM users WHERE username = ?
      `).bind(data.username).first()
      
      if (existingUser) {
        return c.json({
          success: false,
          error: 'Username already exists'
        }, 409)
      }
      
      // 檢查郵箱是否已存在（如果提供）
      if (data.email) {
        const existingEmail = await c.env.DB.prepare(`
          SELECT id FROM users WHERE email = ?
        `).bind(data.email).first()
        
        if (existingEmail) {
          return c.json({
            success: false,
            error: 'Email already exists'
          }, 409)
        }
      }
      
      // 創建用戶（實際項目中應該對密碼進行加密）
      const result = await c.env.DB.prepare(`
        INSERT INTO users (
          username, password, role, restaurant_id, email, full_name, 
          phone, status, permissions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        data.username,
        data.password, // 注意：實際項目中應該使用 bcrypt 等加密
        data.role,
        data.restaurantId || null,
        data.email || null,
        data.fullName || null,
        data.phone || null,
        data.isActive ? 'active' : 'inactive',
        data.permissions ? JSON.stringify(data.permissions) : null
      ).run()
      
      const userId = result.meta.last_row_id as number
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        currentUser.id,
        'create_user',
        'users',
        JSON.stringify({ 
          createdUserId: userId, 
          username: data.username, 
          role: data.role,
          restaurantId: data.restaurantId 
        })
      ).run()
      
      // 獲取創建的用戶資料
      const newUser = await c.env.DB.prepare(`
        SELECT 
          u.id, u.username, u.role, u.restaurant_id, u.email, 
          u.full_name, u.phone, u.status, u.created_at,
          r.name as restaurant_name
        FROM users u
        LEFT JOIN restaurants r ON u.restaurant_id = r.id
        WHERE u.id = ?
      `).bind(userId).first()
      
      const response = {
        ...newUser,
        role_name: USER_ROLES[newUser.role as keyof typeof USER_ROLES] || 'Unknown',
        is_active: newUser.status === 'active'
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
  validateParams(commonSchemas.idParam),
  validateBody(updateUserSchema),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const currentUser = c.get('user')
      
      // 獲取目標用戶
      const targetUser = await c.env.DB.prepare(`
        SELECT * FROM users WHERE id = ?
      `).bind(id).first()
      
      if (!targetUser) {
        return c.json({
          success: false,
          error: 'User not found'
        }, 404)
      }
      
      // 權限檢查
      const canUpdate = 
        currentUser.role === 0 || // 管理員可以更新所有人
        currentUser.id === parseInt(id) || // 用戶可以更新自己（但有限制）
        (currentUser.role === 1 && canManageUser(currentUser, targetUser.role, targetUser.restaurant_id))
      
      if (!canUpdate) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      // 用戶自己更新時的限制
      if (currentUser.id === parseInt(id)) {
        // 不能修改自己的角色和餐廳
        if (data.role !== undefined || data.restaurantId !== undefined) {
          return c.json({
            success: false,
            error: 'Cannot modify your own role or restaurant assignment'
          }, 403)
        }
      }
      
      // 檢查郵箱重複
      if (data.email && data.email !== targetUser.email) {
        const existingEmail = await c.env.DB.prepare(`
          SELECT id FROM users WHERE email = ? AND id != ?
        `).bind(data.email, id).first()
        
        if (existingEmail) {
          return c.json({
            success: false,
            error: 'Email already exists'
          }, 409)
        }
      }
      
      // 如果要修改密碼，驗證舊密碼
      if (data.newPassword) {
        if (!data.currentPassword) {
          return c.json({
            success: false,
            error: 'Current password required to change password'
          }, 400)
        }
        
        if (targetUser.password !== data.currentPassword) {
          return c.json({
            success: false,
            error: 'Current password is incorrect'
          }, 400)
        }
      }
      
      // 構建更新查詢
      const updateFields = []
      const updateParams = []
      
      if (data.role !== undefined && currentUser.id !== parseInt(id)) {
        updateFields.push('role = ?')
        updateParams.push(data.role)
      }
      
      if (data.restaurantId !== undefined && currentUser.id !== parseInt(id)) {
        updateFields.push('restaurant_id = ?')
        updateParams.push(data.restaurantId)
      }
      
      if (data.email !== undefined) {
        updateFields.push('email = ?')
        updateParams.push(data.email)
      }
      
      if (data.fullName !== undefined) {
        updateFields.push('full_name = ?')
        updateParams.push(data.fullName)
      }
      
      if (data.phone !== undefined) {
        updateFields.push('phone = ?')
        updateParams.push(data.phone)
      }
      
      if (data.isActive !== undefined && currentUser.role <= 1) {
        updateFields.push('status = ?')
        updateParams.push(data.isActive ? 'active' : 'inactive')
      }
      
      if (data.newPassword) {
        updateFields.push('password = ?')
        updateParams.push(data.newPassword) // 實際應該加密
      }
      
      if (data.permissions !== undefined) {
        updateFields.push('permissions = ?')
        updateParams.push(JSON.stringify(data.permissions))
      }
      
      if (updateFields.length === 0) {
        return c.json({
          success: false,
          error: 'No fields to update'
        }, 400)
      }
      
      updateFields.push('updated_at = datetime(\'now\')')
      updateParams.push(id)
      
      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `
      
      await c.env.DB.prepare(updateQuery).bind(...updateParams).run()
      
      // 記錄審計日誌
      const changes = Object.keys(data).reduce((acc: any, key) => {
        if (key !== 'currentPassword' && key !== 'newPassword') {
          acc[key] = data[key as keyof typeof data]
        }
        return acc
      }, {})
      
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        currentUser.id,
        'update_user',
        'users',
        JSON.stringify({ targetUserId: id, changes })
      ).run()
      
      // 獲取更新後的用戶資料
      const updatedUser = await c.env.DB.prepare(`
        SELECT 
          u.id, u.username, u.role, u.restaurant_id, u.email, 
          u.full_name, u.phone, u.status, u.updated_at,
          r.name as restaurant_name
        FROM users u
        LEFT JOIN restaurants r ON u.restaurant_id = r.id
        WHERE u.id = ?
      `).bind(id).first()
      
      const response = {
        ...updatedUser,
        role_name: USER_ROLES[updatedUser.role as keyof typeof USER_ROLES] || 'Unknown',
        is_active: updatedUser.status === 'active'
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
  validateParams(commonSchemas.idParam),
  validateBody(updatePasswordSchema),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { currentPassword, newPassword } = c.get('validatedBody')
      const currentUser = c.get('user')
      
      // 只有用戶自己或管理員可以修改密碼
      if (currentUser.id !== parseInt(id) && currentUser.role !== 0) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const targetUser = await c.env.DB.prepare(`
        SELECT password FROM users WHERE id = ?
      `).bind(id).first()
      
      if (!targetUser) {
        return c.json({
          success: false,
          error: 'User not found'
        }, 404)
      }
      
      // 驗證當前密碼
      if (targetUser.password !== currentPassword) {
        return c.json({
          success: false,
          error: 'Current password is incorrect'
        }, 400)
      }
      
      // 更新密碼
      await c.env.DB.prepare(`
        UPDATE users 
        SET password = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(newPassword, id).run() // 實際應該加密
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        currentUser.id,
        'change_password',
        'users',
        JSON.stringify({ targetUserId: id })
      ).run()
      
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
  requireRole([0, 1]), // 只有管理員和店主
  validateParams(commonSchemas.idParam),
  validateBody(z.object({
    isActive: z.boolean(),
    reason: z.string().max(200).optional()
  })),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const { isActive, reason } = c.get('validatedBody')
      const currentUser = c.get('user')
      
      const targetUser = await c.env.DB.prepare(`
        SELECT * FROM users WHERE id = ?
      `).bind(id).first()
      
      if (!targetUser) {
        return c.json({
          success: false,
          error: 'User not found'
        }, 404)
      }
      
      // 權限檢查
      if (!canManageUser(currentUser, targetUser.role, targetUser.restaurant_id)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions'
        }, 403)
      }
      
      // 不能停用自己
      if (currentUser.id === parseInt(id)) {
        return c.json({
          success: false,
          error: 'Cannot deactivate your own account'
        }, 400)
      }
      
      const newStatus = isActive ? 'active' : 'inactive'
      
      await c.env.DB.prepare(`
        UPDATE users 
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(newStatus, id).run()
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        currentUser.id,
        isActive ? 'activate_user' : 'deactivate_user',
        'users',
        JSON.stringify({ targetUserId: id, reason: reason || 'No reason provided' })
      ).run()
      
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
 * 獲取用戶統計
 * GET /api/v1/users/stats
 */
app.get('/stats',
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number).optional()
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedQuery')
      const currentUser = c.get('user')
      
      let whereConditions = ['1=1']
      let params: any[] = []
      
      // 權限過濾
      if (currentUser.role === 1) {
        whereConditions.push('restaurant_id = ?')
        params.push(currentUser.restaurantId)
      } else if (restaurantId) {
        whereConditions.push('restaurant_id = ?')
        params.push(restaurantId)
      }
      
      const whereClause = whereConditions.join(' AND ')
      
      // 基本統計
      const basicStats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_users,
          SUM(CASE WHEN last_login >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as weekly_active_users,
          SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) as new_users_month
        FROM users 
        WHERE ${whereClause}
      `).bind(...params).first()
      
      // 按角色統計
      const roleStats = await c.env.DB.prepare(`
        SELECT 
          role,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
        FROM users 
        WHERE ${whereClause}
        GROUP BY role
        ORDER BY role
      `).bind(...params).all()
      
      // 按餐廳統計（僅管理員可見）
      let restaurantStats = []
      if (currentUser.role === 0) {
        const restaurantResult = await c.env.DB.prepare(`
          SELECT 
            r.id,
            r.name,
            COUNT(u.id) as user_count,
            SUM(CASE WHEN u.status = 'active' THEN 1 ELSE 0 END) as active_users
          FROM restaurants r
          LEFT JOIN users u ON r.id = u.restaurant_id
          GROUP BY r.id, r.name
          ORDER BY user_count DESC
        `).all()
        
        restaurantStats = restaurantResult.results || []
      }
      
      // 格式化角色統計
      const formattedRoleStats = (roleStats.results || []).map((stat: any) => ({
        ...stat,
        role_name: USER_ROLES[stat.role as keyof typeof USER_ROLES] || 'Unknown'
      }))
      
      return c.json({
        success: true,
        data: {
          summary: basicStats,
          by_role: formattedRoleStats,
          by_restaurant: restaurantStats
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

export default app