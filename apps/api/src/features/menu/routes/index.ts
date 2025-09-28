/**
 * Menu Routes
 * All HTTP routes for the menu feature
 */

import { Hono } from 'hono'
import { authMiddleware, requireRole, requireRestaurantAccess, optionalAuth } from '../../../shared/middleware'
import { validateBody, validateQuery, validateParams } from '../../../shared/middleware'
import type { Env } from '../../../shared/types'
import { HTTP_STATUS, USER_ROLES } from '../../../shared/constants'
import { createSuccessResponse, createErrorResponse } from '../../../shared/utils'

// Import schemas
import { menuSchemas } from '../schemas/validation'

// Import services
import { MenuService } from '../services/MenuService'

const app = new Hono<{ Bindings: Env }>()

// Public Menu Routes (no authentication required)

// GET /:restaurantId - Get complete menu (public API)
app.get('/:restaurantId',
  validateParams(menuSchemas.restaurantIdParam),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const service = new MenuService(c.env)

      const menu = await service.getMenu(restaurantId)

      return c.json(createSuccessResponse(menu), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get menu error:', error)
      return c.json(
        createErrorResponse('Failed to fetch menu'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /:restaurantId/featured - Get featured items (public API)
app.get('/:restaurantId/featured',
  validateParams(menuSchemas.restaurantIdParam),
  validateQuery(menuSchemas.featuredItemsQuery),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { limit } = c.get('validatedQuery')
      const service = new MenuService(c.env)

      const items = await service.getFeaturedItems(restaurantId, limit)

      return c.json(createSuccessResponse(items), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get featured items error:', error)
      return c.json(
        createErrorResponse('Failed to fetch featured items'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /:restaurantId/popular - Get popular items (public API)
app.get('/:restaurantId/popular',
  validateParams(menuSchemas.restaurantIdParam),
  validateQuery(menuSchemas.popularItemsQuery),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { limit } = c.get('validatedQuery')
      const service = new MenuService(c.env)

      const items = await service.getPopularItems(restaurantId, limit)

      return c.json(createSuccessResponse(items), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get popular items error:', error)
      return c.json(
        createErrorResponse('Failed to fetch popular items'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /:restaurantId/search - Search menu items (public API)
app.get('/:restaurantId/search',
  validateParams(menuSchemas.restaurantIdParam),
  validateQuery(menuSchemas.menuFilter),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const query = c.get('validatedQuery')
      const service = new MenuService(c.env)

      // Process price range
      const priceRange = (query.minPrice || query.maxPrice)
        ? [query.minPrice || 0, query.maxPrice || 999999] as [number, number]
        : undefined

      // Process dietary preferences
      const dietaryPreferences = query.dietaryPreferences
        ? query.dietaryPreferences.split(',').map((s: string) => s.trim())
        : undefined

      const searchParams = {
        categoryId: query.categoryId,
        priceRange,
        spiceLevel: query.spiceLevel,
        dietaryPreferences,
        isAvailable: query.isAvailable,
        isFeatured: query.isFeatured,
        search: query.search,
        page: query.page,
        limit: query.limit
      }

      const result = await service.searchMenuItems(restaurantId, searchParams)

      return c.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      }, HTTP_STATUS.OK)
    } catch (error) {
      console.error('Search menu items error:', error)
      return c.json(
        createErrorResponse('Failed to search menu items'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /items/:id - Get menu item details (public API with optional auth for view tracking)
app.get('/items/:id',
  validateParams(menuSchemas.menuItemIdParam),
  optionalAuth,
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const service = new MenuService(c.env)

      const item = await service.getMenuItem(id)

      if (!item) {
        return c.json(
          createErrorResponse('Menu item not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      // Increment view count asynchronously (don't wait for completion)
      c.executionCtx.waitUntil(service.incrementViewCount(id))

      return c.json(createSuccessResponse(item), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get menu item error:', error)
      return c.json(
        createErrorResponse('Failed to fetch menu item'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// Protected Menu Management Routes (authentication required)

// POST /:restaurantId/items - Create menu item
app.post('/:restaurantId/items',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER, USER_ROLES.CHEF]),
  requireRestaurantAccess('restaurantId'),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.createMenuItem),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const service = new MenuService(c.env)

      const item = await service.createMenuItem({
        ...data,
        restaurantId
      })

      return c.json(
        createSuccessResponse(item, 'Menu item created successfully'),
        HTTP_STATUS.CREATED
      )
    } catch (error) {
      console.error('Create menu item error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to create menu item'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// PUT /items/:id - Update menu item
app.put('/items/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER, USER_ROLES.CHEF]),
  validateParams(menuSchemas.menuItemIdParam),
  validateBody(menuSchemas.updateMenuItem),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new MenuService(c.env)

      // Get existing item to check restaurant access
      const existingItem = await service.getMenuItem(id)
      if (!existingItem) {
        return c.json(
          createErrorResponse('Menu item not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      // Check restaurant access for non-admin users
      if (user.role !== USER_ROLES.ADMIN && user.restaurantId !== existingItem.restaurantId) {
        return c.json(
          createErrorResponse('Access denied'),
          HTTP_STATUS.FORBIDDEN
        )
      }

      const item = await service.updateMenuItem(id, data)

      return c.json(
        createSuccessResponse(item, 'Menu item updated successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Update menu item error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to update menu item'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// DELETE /items/:id - Delete menu item
app.delete('/items/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(menuSchemas.menuItemIdParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      const service = new MenuService(c.env)

      // Get existing item to check restaurant access
      const existingItem = await service.getMenuItem(id)
      if (!existingItem) {
        return c.json(
          createErrorResponse('Menu item not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      // Check restaurant access for non-admin users
      if (user.role !== USER_ROLES.ADMIN && user.restaurantId !== existingItem.restaurantId) {
        return c.json(
          createErrorResponse('Access denied'),
          HTTP_STATUS.FORBIDDEN
        )
      }

      const deleted = await service.deleteMenuItem(id)

      if (!deleted) {
        return c.json(
          createErrorResponse('Menu item not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return c.json(
        createSuccessResponse(null, 'Menu item deleted successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Delete menu item error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to delete menu item'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// PATCH /:restaurantId/items/availability - Batch update menu item availability
app.patch('/:restaurantId/items/availability',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER, USER_ROLES.CHEF]),
  requireRestaurantAccess('restaurantId'),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.bulkAvailabilityUpdate),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { updates } = c.get('validatedBody')
      const service = new MenuService(c.env)

      await service.batchUpdateAvailability(restaurantId, updates)

      return c.json(
        createSuccessResponse(null, 'Menu items availability updated successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Batch update availability error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to update menu items availability'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// PATCH /:restaurantId/items/prices - Batch update menu item prices
app.patch('/:restaurantId/items/prices',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.bulkPriceUpdate),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { updates } = c.get('validatedBody')
      const service = new MenuService(c.env)

      await service.batchUpdatePrices(restaurantId, updates)

      return c.json(
        createSuccessResponse(null, 'Menu item prices updated successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Batch update prices error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to update menu item prices'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// PATCH /:restaurantId/items/categories - Batch move items to different categories
app.patch('/:restaurantId/items/categories',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.bulkCategoryMove),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const { updates } = c.get('validatedBody')
      const service = new MenuService(c.env)

      await service.batchMoveItems(restaurantId, updates)

      return c.json(
        createSuccessResponse(null, 'Menu items moved to new categories successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Batch move categories error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to move menu items'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// Category Management Routes

// POST /:restaurantId/categories - Create category
app.post('/:restaurantId/categories',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.createCategory),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const service = new MenuService(c.env)

      const category = await service.createCategory({
        ...data,
        restaurantId
      })

      return c.json(
        createSuccessResponse(category, 'Category created successfully'),
        HTTP_STATUS.CREATED
      )
    } catch (error) {
      console.error('Create category error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to create category'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// PUT /categories/:id - Update category
app.put('/categories/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(menuSchemas.categoryIdParam),
  validateBody(menuSchemas.updateCategory),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      const service = new MenuService(c.env)

      const category = await service.updateCategory(id, data)

      // Check restaurant access for non-admin users
      if (user.role !== USER_ROLES.ADMIN && user.restaurantId !== category.restaurantId) {
        return c.json(
          createErrorResponse('Access denied'),
          HTTP_STATUS.FORBIDDEN
        )
      }

      return c.json(
        createSuccessResponse(category, 'Category updated successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Update category error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to update category'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// DELETE /categories/:id - Delete category
app.delete('/categories/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(menuSchemas.categoryIdParam),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const _user = c.get('user')
      const service = new MenuService(c.env)

      // For non-admin users, restaurant access is checked within the service
      const deleted = await service.deleteCategory(id)

      if (!deleted) {
        return c.json(
          createErrorResponse('Category not found or cannot be deleted'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return c.json(
        createSuccessResponse(null, 'Category deleted successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Delete category error:', error)
      return c.json(
        createErrorResponse(error instanceof Error ? error.message : 'Failed to delete category'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// Analytics Routes

// GET /:restaurantId/analytics - Get menu analytics
app.get('/:restaurantId/analytics',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(menuSchemas.restaurantIdParam),
  validateQuery(menuSchemas.analyticsQuery),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const service = new MenuService(c.env)

      const analytics = await service.getMenuAnalytics(restaurantId)

      return c.json(createSuccessResponse(analytics), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get menu analytics error:', error)
      return c.json(
        createErrorResponse('Failed to fetch menu analytics'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /:restaurantId/popularity - Get popularity metrics
app.get('/:restaurantId/popularity',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess('restaurantId'),
  validateParams(menuSchemas.restaurantIdParam),
  async (c) => {
    try {
      const { restaurantId } = c.get('validatedParams')
      const service = new MenuService(c.env)

      const metrics = await service.getPopularityMetrics(restaurantId)

      return c.json(createSuccessResponse(metrics), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Get popularity metrics error:', error)
      return c.json(
        createErrorResponse('Failed to fetch popularity metrics'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

export default app