import { Hono } from 'hono'
import { z } from 'zod'
import { RestaurantService } from '@makanmakan/database'
import { authMiddleware, requireRole, optionalAuth } from '../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/validation'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const createRestaurantSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  category: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  address: z.string().min(1).max(200),
  district: z.string().min(1).max(50),
  city: z.string().max(50).optional(),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  businessHours: z.any().optional(),
  logoUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional()
})

const updateRestaurantSchema = createRestaurantSchema.partial().extend({
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  settings: z.any().optional()
})

const restaurantFilterSchema = commonSchemas.paginationQuery.extend({
  type: z.string().optional(),
  district: z.string().optional(),
  isAvailable: z.string().transform(val => val === 'true').optional()
})

// 獲取餐廳列表（公開 API）
app.get('/', 
  optionalAuth,
  validateQuery(restaurantFilterSchema),
  async (c) => {
    try {
      const query = c.get('validatedQuery')
      const restaurantService = new RestaurantService(c.env.DB)
      
      const result = await restaurantService.getRestaurants(query)
      
      return c.json({
        success: true,
        data: result.restaurants,
        pagination: result.pagination
      })
    } catch (error) {
      console.error('Get restaurants error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch restaurants'
      }, 500)
    }
  }
)

// 獲取單一餐廳詳情（公開 API）
app.get('/:id', 
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const restaurantService = new RestaurantService(c.env.DB)
      
      const restaurant = await restaurantService.getRestaurant(id)
      
      if (!restaurant) {
        return c.json({
          success: false,
          error: 'Restaurant not found'
        }, 404)
      }
      
      return c.json({
        success: true,
        data: restaurant
      })
    } catch (error) {
      console.error('Get restaurant error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch restaurant'
      }, 500)
    }
  }
)

// 創建餐廳（僅管理員）
app.post('/',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateBody(createRestaurantSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const restaurantService = new RestaurantService(c.env.DB)
      
      const restaurant = await restaurantService.createRestaurant(data)
      
      return c.json({
        success: true,
        data: restaurant
      }, 201)
    } catch (error) {
      console.error('Create restaurant error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create restaurant'
      }, 500)
    }
  }
)

// 更新餐廳
app.put('/:id',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateParams(commonSchemas.idParam),
  validateBody(updateRestaurantSchema),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const restaurantService = new RestaurantService(c.env.DB)
      
      // 店主只能更新自己的餐廳
      if (user.role === 1 && user.restaurantId !== id) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const restaurant = await restaurantService.updateRestaurant(id, data)
      
      return c.json({
        success: true,
        data: restaurant
      })
    } catch (error) {
      console.error('Update restaurant error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update restaurant'
      }, 500)
    }
  }
)

// 停用餐廳（僅管理員）
app.delete('/:id',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const restaurantService = new RestaurantService(c.env.DB)
      
      await restaurantService.deactivateRestaurant(id)
      
      return c.json({
        success: true,
        message: 'Restaurant deactivated successfully'
      })
    } catch (error) {
      console.error('Deactivate restaurant error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate restaurant'
      }, 500)
    }
  }
)

// 獲取餐廳統計
app.get('/:id/stats',
  authMiddleware,
  requireRole([0, 1]), // 管理員和店主
  validateParams(commonSchemas.idParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      const restaurantService = new RestaurantService(c.env.DB)
      
      // 店主只能查看自己的餐廳統計
      if (user.role === 1 && user.restaurantId !== id) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const stats = await restaurantService.getRestaurantStats(id)
      
      return c.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('Get restaurant stats error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch restaurant stats'
      }, 500)
    }
  }
)

// 搜尋附近餐廳（公開 API）
app.get('/nearby/:district',
  validateParams(z.object({
    district: z.string().min(1)
  })),
  validateQuery(z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10')
  })),
  async (c) => {
    try {
      const { district } = c.get('validatedParams')
      const { limit } = c.get('validatedQuery')
      const restaurantService = new RestaurantService(c.env.DB)
      
      const restaurants = await restaurantService.searchNearbyRestaurants(district, limit)
      
      return c.json({
        success: true,
        data: restaurants
      })
    } catch (error) {
      console.error('Search nearby restaurants error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search nearby restaurants'
      }, 500)
    }
  }
)

// 獲取熱門餐廳（公開 API）
app.get('/popular',
  validateQuery(z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10')
  })),
  async (c) => {
    try {
      const { limit } = c.get('validatedQuery')
      const restaurantService = new RestaurantService(c.env.DB)
      
      const restaurants = await restaurantService.getPopularRestaurants(limit)
      
      return c.json({
        success: true,
        data: restaurants
      })
    } catch (error) {
      console.error('Get popular restaurants error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch popular restaurants'
      }, 500)
    }
  }
)

export default app