import { Hono } from 'hono'
import { z } from 'zod'
import { MenuService } from '@makanmakan/database'
import { authMiddleware, requireRole, requireRestaurantAccess, optionalAuth } from '../middleware/auth'
import { validateBody, validateQuery, validateParams, commonSchemas } from '../middleware/validation'
import { menuCache, invalidateMenuCache, cacheHealthMiddleware } from '../middleware/cache'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const menuItemSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  ingredients: z.string().max(200).optional(),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  imageUrl: z.string().url().optional(),
  imageVariants: z.any().optional(),
  spiceLevel: z.number().int().min(0).max(5).optional().default(0),
  preparationTime: z.number().int().positive().optional().default(15),
  calories: z.number().int().positive().optional(),
  dietaryInfo: z.any().optional(),
  allergens: z.array(z.string()).optional(),
  options: z.any().optional(),
  availableHours: z.any().optional(),
  tags: z.array(z.string()).optional(),
  keywords: z.string().max(200).optional()
})

const updateMenuItemSchema = menuItemSchema.partial().extend({
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  inventoryCount: z.number().int().min(0).optional()
})

const menuFilterSchema = z.object({
  categoryId: z.string().regex(/^\d+$/).transform(Number).optional(),
  minPrice: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  maxPrice: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  spiceLevel: z.string().regex(/^\d+$/).transform(Number).optional(),
  dietaryPreferences: z.string().optional(),
  isAvailable: z.string().transform(val => val === 'true').optional(),
  isFeatured: z.string().transform(val => val === 'true').optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
})

const categorySchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  sortOrder: z.number().int().optional().default(0),
  imageUrl: z.string().url().optional()
})

// 獲取完整菜單（公開 API）
app.get('/:restaurantId',
  validateParams(commonSchemas.restaurantIdParam),
  menuCache(), // 使用新的快取中間件
  cacheHealthMiddleware(), // 添加快取健康檢查
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const menuService = new MenuService(c.env.DB as any)
      
      const menu = await menuService.getMenu(restaurantId)
      
      return c.json({
        success: true,
        data: menu
      })
    } catch (error) {
      console.error('Get menu error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch menu'
      }, 500)
    }
  }
)

// 獲取特色菜品（公開 API）
app.get('/:restaurantId/featured',
  validateParams(commonSchemas.restaurantIdParam),
  validateQuery(z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10')
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { limit } = c.get('validatedQuery')
      const menuService = new MenuService(c.env.DB as any)
      
      const items = await menuService.getFeaturedItems(restaurantId, limit)
      
      return c.json({
        success: true,
        data: items
      })
    } catch (error) {
      console.error('Get featured items error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch featured items'
      }, 500)
    }
  }
)

// 獲取熱門菜品（公開 API）
app.get('/:restaurantId/popular',
  validateParams(commonSchemas.restaurantIdParam),
  validateQuery(z.object({
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10')
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { limit } = c.get('validatedQuery')
      const menuService = new MenuService(c.env.DB as any)
      
      const items = await menuService.getPopularItems(restaurantId, limit)
      
      return c.json({
        success: true,
        data: items
      })
    } catch (error) {
      console.error('Get popular items error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch popular items'
      }, 500)
    }
  }
)

// 搜尋菜品（公開 API）
app.get('/:restaurantId/search',
  validateParams(commonSchemas.restaurantIdParam),
  validateQuery(menuFilterSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const query = c.get('validatedQuery')
      const menuService = new MenuService(c.env.DB as any)
      
      // 處理價格範圍
      const priceRange = (query.minPrice || query.maxPrice) 
        ? [query.minPrice || 0, query.maxPrice || 999999] as [number, number]
        : undefined
      
      // 處理飲食偏好
      const dietaryPreferences = query.dietaryPreferences 
        ? query.dietaryPreferences.split(',').map((s: string) => s.trim())
        : undefined
      
      const filters = {
        categoryId: query.categoryId,
        priceRange,
        spiceLevel: query.spiceLevel,
        dietaryPreferences,
        isAvailable: query.isAvailable,
        isFeatured: query.isFeatured,
        search: query.search
      }
      
      const result = await menuService.searchMenuItems(
        restaurantId,
        filters,
        query.page,
        query.limit
      )
      
      return c.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      })
    } catch (error) {
      console.error('Search menu items error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search menu items'
      }, 500)
    }
  }
)

// 獲取菜品詳情（公開 API）
app.get('/items/:id',
  validateParams(commonSchemas.idParam),
  optionalAuth,
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const menuService = new MenuService(c.env.DB as any)
      
      const item = await menuService.getMenuItem(id)
      
      if (!item) {
        return c.json({
          success: false,
          error: 'Menu item not found'
        }, 404)
      }
      
      // 增加瀏覽次數（非同步）
      c.executionCtx.waitUntil(menuService.incrementViewCount(id))
      
      return c.json({
        success: true,
        data: item
      })
    } catch (error) {
      console.error('Get menu item error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch menu item'
      }, 500)
    }
  }
)

// 創建菜品
app.post('/:restaurantId/items',
  authMiddleware,
  requireRole([0, 1, 2]), // 管理員、店主、廚師
  requireRestaurantAccess('restaurantId'),
  validateParams(commonSchemas.restaurantIdParam),
  validateBody(menuItemSchema),
  invalidateMenuCache, // 使用新的快取失效中間件
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const menuService = new MenuService(c.env.DB as any)
      
      const item = await menuService.createMenuItem({
        ...data,
        restaurantId
      })
      
      return c.json({
        success: true,
        data: item
      }, 201)
    } catch (error) {
      console.error('Create menu item error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create menu item'
      }, 500)
    }
  }
)

// 更新菜品
app.put('/items/:id',
  authMiddleware,
  requireRole([0, 1, 2]), // 管理員、店主、廚師
  validateParams(commonSchemas.idParam),
  validateBody(updateMenuItemSchema),
  invalidateMenuCache, // 使用新的快取失效中間件
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const menuService = new MenuService(c.env.DB as any)
      
      // 獲取菜品以檢查餐廳權限
      const existingItem = await menuService.getMenuItem(id)
      if (!existingItem) {
        return c.json({
          success: false,
          error: 'Menu item not found'
        }, 404)
      }
      
      // 檢查餐廳權限
      if (user.role !== 0 && user.restaurantId !== existingItem.restaurantId) {
        return c.json({
          success: false,
          error: 'Access denied'
        }, 403)
      }
      
      const item = await menuService.updateMenuItem(id, data)
      
      return c.json({
        success: true,
        data: item
      })
    } catch (error) {
      console.error('Update menu item error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update menu item'
      }, 500)
    }
  }
)

// 批量更新菜品可用性
app.patch('/:restaurantId/items/availability',
  authMiddleware,
  requireRole([0, 1, 2]), // 管理員、店主、廚師
  requireRestaurantAccess('restaurantId'),
  validateParams(commonSchemas.restaurantIdParam),
  invalidateMenuCache, // 使用新的快取失效中間件
  validateBody(z.object({
    updates: z.array(z.object({
      id: z.number().int().positive(),
      isAvailable: z.boolean()
    })).min(1)
  })),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { updates } = c.get('validatedBody')
      const menuService = new MenuService(c.env.DB as any)
      
      await menuService.batchUpdateAvailability(restaurantId, updates)
      
      return c.json({
        success: true,
        message: 'Menu items availability updated successfully'
      })
    } catch (error) {
      console.error('Batch update availability error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update menu items availability'
      }, 500)
    }
  }
)

// 創建分類
app.post('/:restaurantId/categories',
  authMiddleware,
  requireRole([0, 1]), // 管理員、店主
  requireRestaurantAccess('restaurantId'),
  validateParams(commonSchemas.restaurantIdParam),
  validateBody(categorySchema),
  invalidateMenuCache, // 使用新的快取失效中間件
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const menuService = new MenuService(c.env.DB as any)
      
      const category = await menuService.createCategory({
        ...data,
        restaurantId
      })
      
      return c.json({
        success: true,
        data: category
      }, 201)
    } catch (error) {
      console.error('Create category error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create category'
      }, 500)
    }
  }
)

export default app