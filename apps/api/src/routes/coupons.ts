import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/validation'
import { CouponService } from '@makanmakan/database'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const validateCouponSchema = z.object({
  code: z.string().min(1).max(50),
  restaurantId: z.string().min(1),
  orderAmount: z.number().positive(),
  userId: z.number().int().positive().optional(),
  menuItems: z.array(z.object({
    menuItemId: z.number().int().positive(),
    quantity: z.number().int().positive()
  })).optional()
})

const createCouponSchema = z.object({
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

const updateCouponSchema = createCouponSchema.partial()

const couponFiltersSchema = z.object({
  restaurantId: z.string().optional(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  discountType: z.enum(['percentage', 'fixed']).optional(),
  validOnly: z.boolean().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
})

/**
 * 驗證優惠券代碼
 * POST /api/v1/coupons/validate
 * 公開端點，用於前端驗證優惠券
 */
app.post('/validate',
  validateBody(validateCouponSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const couponService = new CouponService(c.env.DB as any)

      const result = await couponService.validateCoupon(
        data.code,
        data.restaurantId,
        data.orderAmount,
        data.userId,
        data.menuItems
      )

      return c.json({
        success: true,
        data: result
      })

    } catch (error) {
      console.error('Coupon validation error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate coupon'
      }, 500)
    }
  }
)

/**
 * 獲取可用優惠券列表 (供客戶使用)
 * GET /api/v1/coupons/available/:restaurantId
 */
app.get('/available/:restaurantId',
  validateParams(z.object({ restaurantId: z.string() }) as any),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const couponService = new CouponService(c.env.DB as any)

      const availableCoupons = await couponService.getAvailableCoupons(restaurantId)

      return c.json({
        success: true,
        data: availableCoupons
      })

    } catch (error) {
      console.error('Get available coupons error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch available coupons'
      }, 500)
    }
  }
)

/**
 * 創建優惠券 (管理員和店主)
 * POST /api/v1/coupons
 */
app.post('/',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateBody(createCouponSchema as any),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      const couponService = new CouponService(c.env.DB as any)

      // 權限檢查：店主只能為自己的餐廳創建優惠券
      if (user.role === 1) {
        data.restaurantId = user.restaurantId
      }

      // 設置創建者
      data.createdBy = user.id

      const coupon = await couponService.createCoupon(data)

      return c.json({
        success: true,
        data: coupon
      }, 201)

    } catch (error) {
      console.error('Create coupon error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create coupon'
      }, 500)
    }
  }
)

/**
 * 獲取優惠券列表 (管理功能)
 * GET /api/v1/coupons
 */
app.get('/',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateQuery(couponFiltersSchema as any),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const user = c.get('user')
      const couponService = new CouponService(c.env.DB as any)

      const filters: any = { ...query }
      
      // 權限過濾：店主只能查看自己餐廳的優惠券
      if (user.role === 1) {
        filters.restaurantId = user.restaurantId
      }

      const result = await couponService.getCoupons(filters, query.page, query.limit)

      return c.json({
        success: true,
        data: result.coupons,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: Math.ceil(result.total / result.limit)
        }
      })

    } catch (error) {
      console.error('Get coupons error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch coupons'
      }, 500)
    }
  }
)

/**
 * 獲取單個優惠券詳情
 * GET /api/v1/coupons/:id
 */
app.get('/:id',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      const couponService = new CouponService(c.env.DB as any)

      const coupon = await couponService.getCoupon(parseInt(id))

      if (!coupon) {
        return c.json({
          success: false,
          error: 'Coupon not found'
        }, 404)
      }

      // 權限檢查：店主只能查看自己餐廳的優惠券
      if (user.role === 1 && coupon.restaurantId !== user.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      return c.json({
        success: true,
        data: coupon
      })

    } catch (error) {
      console.error('Get coupon error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch coupon'
      }, 500)
    }
  }
)

/**
 * 更新優惠券
 * PUT /api/v1/coupons/:id
 */
app.put('/:id',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateParams(commonSchemas.idParam as any),
  validateBody(updateCouponSchema as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const couponService = new CouponService(c.env.DB as any)

      // 獲取現有優惠券
      const existingCoupon = await couponService.getCoupon(parseInt(id))

      if (!existingCoupon) {
        return c.json({
          success: false,
          error: 'Coupon not found'
        }, 404)
      }

      // 權限檢查：店主只能更新自己餐廳的優惠券
      if (user.role === 1 && existingCoupon.restaurantId !== user.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const updatedCoupon = await couponService.updateCoupon(parseInt(id), data)

      return c.json({
        success: true,
        data: updatedCoupon
      })

    } catch (error) {
      console.error('Update coupon error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update coupon'
      }, 500)
    }
  }
)

/**
 * 停用優惠券
 * POST /api/v1/coupons/:id/deactivate
 */
app.post('/:id/deactivate',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      const couponService = new CouponService(c.env.DB as any)

      // 獲取現有優惠券
      const existingCoupon = await couponService.getCoupon(parseInt(id))

      if (!existingCoupon) {
        return c.json({
          success: false,
          error: 'Coupon not found'
        }, 404)
      }

      // 權限檢查：店主只能停用自己餐廳的優惠券
      if (user.role === 1 && existingCoupon.restaurantId !== user.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const deactivatedCoupon = await couponService.deactivateCoupon(parseInt(id))

      return c.json({
        success: true,
        data: deactivatedCoupon,
        message: 'Coupon deactivated successfully'
      })

    } catch (error) {
      console.error('Deactivate coupon error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate coupon'
      }, 500)
    }
  }
)

/**
 * 刪除優惠券
 * DELETE /api/v1/coupons/:id
 */
app.delete('/:id',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const couponService = new CouponService(c.env.DB as any)

      // 檢查優惠券是否存在
      const existingCoupon = await couponService.getCoupon(parseInt(id))

      if (!existingCoupon) {
        return c.json({
          success: false,
          error: 'Coupon not found'
        }, 404)
      }

      await couponService.deleteCoupon(parseInt(id))

      return c.json({
        success: true,
        message: 'Coupon deleted successfully'
      })

    } catch (error) {
      console.error('Delete coupon error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete coupon'
      }, 500)
    }
  }
)

/**
 * 獲取優惠券使用統計
 * GET /api/v1/coupons/:id/stats
 */
app.get('/:id/stats',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      const couponService = new CouponService(c.env.DB as any)

      // 獲取優惠券資訊
      const coupon = await couponService.getCoupon(parseInt(id))

      if (!coupon) {
        return c.json({
          success: false,
          error: 'Coupon not found'
        }, 404)
      }

      // 權限檢查：店主只能查看自己餐廳的優惠券統計
      if (user.role === 1 && coupon.restaurantId !== user.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }

      const stats = await couponService.getCouponStats(parseInt(id))

      return c.json({
        success: true,
        data: {
          coupon: {
            id: coupon.id,
            code: coupon.code,
            name: coupon.name,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue
          },
          stats
        }
      })

    } catch (error) {
      console.error('Get coupon stats error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch coupon statistics'
      }, 500)
    }
  }
)

export default app