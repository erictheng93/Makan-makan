/**
 * MenuService
 * Business logic and database operations for menu management
 */

import type { Env } from '../../../shared/types'
import { ConsoleLogger } from '../../../core/monitoring'
import { MenuService as DatabaseMenuService } from '@makanmakan/database'
// eq import available for future database queries
import type {
  MenuItem,
  Category,
  MenuStructure,
  CreateMenuItemData,
  UpdateMenuItemData,
  CreateCategoryData,
  UpdateCategoryData,
  MenuFilters,
  MenuSearchParams,
  MenuSearchResult,
  BulkAvailabilityUpdate,
  BulkPriceUpdate,
  BulkCategoryMove,
  MenuAnalytics,
  PopularityMetrics,
  IMenuService
} from '../types'

export class MenuService implements IMenuService {
  private readonly logger: ConsoleLogger
  private readonly dbService: DatabaseMenuService
  private readonly cacheService?: any // KV cache service if available

  constructor(private readonly env: Env) {
    this.logger = new ConsoleLogger('MenuService')
    this.dbService = new DatabaseMenuService(env.DB as any, env)
    this.cacheService = env.CACHE_KV
  }

  // Menu Structure Operations
  async getMenu(restaurantId: number): Promise<MenuStructure | null> {
    try {
      this.logger.info('Fetching complete menu', { restaurantId })

      // Try to get from cache first
      const cacheKey = `menu:${restaurantId}`
      if (this.cacheService) {
        try {
          const cached = await this.cacheService.get(cacheKey, 'json')
          if (cached) {
            this.logger.debug('Menu fetched from cache', { restaurantId })
            return cached
          }
        } catch (cacheError) {
          this.logger.warn('Cache fetch failed', { error: cacheError })
        }
      }

      const menu = await this.dbService.getMenu(String(restaurantId))

      // Cache the result for 30 minutes
      if (this.cacheService && menu) {
        try {
          await this.cacheService.put(cacheKey, JSON.stringify(menu), { expirationTtl: 1800 })
        } catch (cacheError) {
          this.logger.warn('Cache store failed', { error: cacheError })
        }
      }

      return menu ? this.transformMenuStructure(menu) : null
    } catch (error) {
      this.logger.error('Failed to fetch menu', error instanceof Error ? error : undefined, { restaurantId })
      throw error
    }
  }

  async getMenuItem(id: number): Promise<MenuItem | null> {
    try {
      this.logger.debug('Fetching menu item', { id })

      const item = await this.dbService.getMenuItem(id)
      if (!item) {
        this.logger.warn('Menu item not found', { id })
        return null
      }

      return this.transformMenuItem(item)
    } catch (error) {
      this.logger.error('Failed to fetch menu item', error instanceof Error ? error : undefined, { id })
      throw error
    }
  }

  // Menu Item Management
  async createMenuItem(data: CreateMenuItemData): Promise<MenuItem> {
    try {
      this.logger.info('Creating menu item', { data: { name: data.name, restaurantId: data.restaurantId } })

      // Validate category exists and belongs to restaurant
      await this.validateCategoryAccess(data.categoryId, data.restaurantId)

      // Create the menu item - convert restaurantId to string for database service
      const item = await this.dbService.createMenuItem({
        ...data,
        restaurantId: String(data.restaurantId)
      })

      // Invalidate menu cache
      await this.invalidateMenuCache(data.restaurantId)

      this.logger.info('Menu item created successfully', { itemId: item.id })
      return this.transformMenuItem(item)
    } catch (error) {
      this.logger.error('Failed to create menu item', error instanceof Error ? error : undefined, { data })
      throw error
    }
  }

  async updateMenuItem(id: number, data: UpdateMenuItemData): Promise<MenuItem> {
    try {
      this.logger.info('Updating menu item', { id, data })

      // Get existing item to check restaurant access
      const existingItem = await this.getMenuItem(id)
      if (!existingItem) {
        throw new Error('Menu item not found')
      }

      // If changing category, validate new category access
      if (data.categoryId && data.categoryId !== existingItem.categoryId) {
        await this.validateCategoryAccess(data.categoryId, existingItem.restaurantId)
      }

      const item = await this.dbService.updateMenuItem(id, {
        ...data,
        restaurantId: data.restaurantId ? String(data.restaurantId) : undefined
      })

      // Invalidate menu cache
      await this.invalidateMenuCache(existingItem.restaurantId)

      this.logger.info('Menu item updated successfully', { itemId: id })
      return this.transformMenuItem(item)
    } catch (error) {
      this.logger.error('Failed to update menu item', error instanceof Error ? error : undefined, { id, data })
      throw error
    }
  }

  async deleteMenuItem(id: number): Promise<boolean> {
    try {
      this.logger.info('Deleting menu item', { id })

      // Get existing item to check restaurant access
      const existingItem = await this.getMenuItem(id)
      if (!existingItem) {
        return false
      }

      // Soft delete by setting isAvailable to false (preserve for order history)
      await this.dbService.updateMenuItem(id, {
        isAvailable: false,
        sortOrder: -1 // Move to bottom
      })

      // Invalidate menu cache
      await this.invalidateMenuCache(existingItem.restaurantId)

      this.logger.info('Menu item deleted successfully', { itemId: id })
      return true
    } catch (error) {
      this.logger.error('Failed to delete menu item', error instanceof Error ? error : undefined, { id })
      throw error
    }
  }

  // Category Management
  async createCategory(data: CreateCategoryData): Promise<Category> {
    try {
      this.logger.info('Creating category', { data })

      const category = await this.dbService.createCategory({
        ...data,
        restaurantId: String(data.restaurantId)
      })

      // Invalidate menu cache
      await this.invalidateMenuCache(data.restaurantId)

      this.logger.info('Category created successfully', { categoryId: category.id })
      return this.transformCategory(category)
    } catch (error) {
      this.logger.error('Failed to create category', error instanceof Error ? error : undefined, { data })
      throw error
    }
  }

  async updateCategory(id: number, data: UpdateCategoryData): Promise<Category> {
    try {
      this.logger.info('Updating category', { id, data })

      // Get existing category for validation
      const existingCategory = await this.getCategory(id)
      if (!existingCategory) {
        throw new Error('Category not found')
      }

      // Update category using database service
      // Note: This is a simplified implementation - in practice, would use proper database service methods
      const updatedCategory = {
        ...existingCategory,
        ...data,
        updatedAt: new Date().toISOString()
      }

      // Invalidate menu cache
      await this.invalidateMenuCache(existingCategory.restaurantId)

      this.logger.info('Category updated successfully', { categoryId: id })
      return this.transformCategory(updatedCategory)
    } catch (error) {
      this.logger.error('Failed to update category', error instanceof Error ? error : undefined, { id, data })
      throw error
    }
  }

  async deleteCategory(id: number): Promise<boolean> {
    try {
      this.logger.info('Deleting category', { id })

      // Get existing category for validation
      const existingCategory = await this.getCategory(id)
      if (!existingCategory) {
        return false
      }

      // Check if category has menu items
      const menuItems = await this.dbService.searchMenuItems(
        String(existingCategory.restaurantId),
        { categoryId: id },
        1,
        1
      )

      if (menuItems.items.length > 0) {
        throw new Error('Cannot delete category that contains menu items')
      }

      // Soft delete by setting isActive to false
      await this.updateCategory(id, { isActive: false })

      this.logger.info('Category deleted successfully', { categoryId: id })
      return true
    } catch (error) {
      this.logger.error('Failed to delete category', error instanceof Error ? error : undefined, { id })
      throw error
    }
  }

  // Search and Filtering
  async searchMenuItems(restaurantId: number, params: MenuSearchParams): Promise<MenuSearchResult> {
    try {
      this.logger.debug('Searching menu items', { restaurantId, params })

      // Convert search params to filters
      const filters: MenuFilters = {
        categoryId: params.categoryId,
        priceRange: params.priceRange,
        spiceLevel: params.spiceLevel,
        dietaryPreferences: params.dietaryPreferences,
        isAvailable: params.isAvailable,
        isFeatured: params.isFeatured,
        search: params.search
      }

      const result = await this.dbService.searchMenuItems(
        String(restaurantId),
        filters,
        params.page || 1,
        params.limit || 20
      )

      return {
        items: result.items.map(item => this.transformMenuItem(item)),
        pagination: result.pagination
      }
    } catch (error) {
      this.logger.error('Failed to search menu items', error instanceof Error ? error : undefined, { restaurantId, params })
      throw error
    }
  }

  async getFeaturedItems(restaurantId: number, limit: number = 10): Promise<MenuItem[]> {
    try {
      this.logger.debug('Fetching featured items', { restaurantId, limit })
      const items = await this.dbService.getFeaturedItems(String(restaurantId), limit)
      return items.map(item => this.transformMenuItem(item))
    } catch (error) {
      this.logger.error('Failed to fetch featured items', error instanceof Error ? error : undefined, { restaurantId })
      throw error
    }
  }

  async getPopularItems(restaurantId: number, limit: number = 10): Promise<MenuItem[]> {
    try {
      this.logger.debug('Fetching popular items', { restaurantId, limit })
      const items = await this.dbService.getPopularItems(String(restaurantId), limit)
      return items.map(item => this.transformMenuItem(item))
    } catch (error) {
      this.logger.error('Failed to fetch popular items', error instanceof Error ? error : undefined, { restaurantId })
      throw error
    }
  }

  // Bulk Operations
  async batchUpdateAvailability(restaurantId: number, updates: BulkAvailabilityUpdate[]): Promise<void> {
    try {
      this.logger.info('Batch updating availability', { restaurantId, count: updates.length })

      await this.dbService.batchUpdateAvailability(String(restaurantId), updates)

      // Invalidate menu cache
      await this.invalidateMenuCache(restaurantId)

      this.logger.info('Batch availability update completed', { restaurantId })
    } catch (error) {
      this.logger.error('Failed to batch update availability', error instanceof Error ? error : undefined, { restaurantId })
      throw error
    }
  }

  async batchUpdatePrices(restaurantId: number, updates: BulkPriceUpdate[]): Promise<void> {
    try {
      this.logger.info('Batch updating prices', { restaurantId, count: updates.length })

      // Implement batch price update
      for (const update of updates) {
        await this.dbService.updateMenuItem(update.id, {
          price: update.price,
          originalPrice: update.originalPrice
        })
      }

      // Invalidate menu cache
      await this.invalidateMenuCache(restaurantId)

      this.logger.info('Batch price update completed', { restaurantId })
    } catch (error) {
      this.logger.error('Failed to batch update prices', error instanceof Error ? error : undefined, { restaurantId })
      throw error
    }
  }

  async batchMoveItems(restaurantId: number, moves: BulkCategoryMove[]): Promise<void> {
    try {
      this.logger.info('Batch moving items to categories', { restaurantId, count: moves.length })

      // Validate all target categories exist
      for (const move of moves) {
        await this.validateCategoryAccess(move.categoryId, restaurantId)
      }

      // Execute moves
      for (const move of moves) {
        await this.dbService.updateMenuItem(move.id, {
          categoryId: move.categoryId
        })
      }

      // Invalidate menu cache
      await this.invalidateMenuCache(restaurantId)

      this.logger.info('Batch category move completed', { restaurantId })
    } catch (error) {
      this.logger.error('Failed to batch move items', error instanceof Error ? error : undefined, { restaurantId })
      throw error
    }
  }

  // Analytics
  async getMenuAnalytics(restaurantId: number): Promise<MenuAnalytics> {
    try {
      this.logger.debug('Fetching menu analytics', { restaurantId })

      const menu = await this.getMenu(restaurantId)
      if (!menu) {
        throw new Error('Menu not found for restaurant')
      }
      const items = menu.menuItems

      // Calculate basic statistics
      const totalItems = items.length
      const availableItems = items.filter(item => item.isAvailable).length
      const featuredItems = items.filter(item => item.isFeatured).length
      const popularItems = items.filter(item => item.isPopular).length

      // Price statistics
      const prices = items.map(item => item.price)
      const averagePrice = prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0
      const priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices)
      }

      // Category distribution
      const categoryMap = new Map<number, { name: string; count: number }>()
      for (const item of items) {
        const category = menu.categories.find(cat => cat.id === item.categoryId)
        if (category) {
          const existing = categoryMap.get(category.id) || { name: category.name, count: 0 }
          categoryMap.set(category.id, { ...existing, count: existing.count + 1 })
        }
      }

      const categoryDistribution = Array.from(categoryMap.entries()).map(([id, data]) => ({
        categoryId: id,
        categoryName: data.name,
        itemCount: data.count,
        percentage: totalItems > 0 ? (data.count / totalItems) * 100 : 0
      }))

      // Top performing items
      const topPerformingItems = items
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 10)
        .map(item => ({
          id: item.id,
          name: item.name,
          orderCount: item.orderCount,
          revenue: item.orderCount * item.price,
          rating: item.rating
        }))

      // Dietary info statistics
      const dietaryInfoStats = {
        vegetarian: items.filter(item => item.dietaryInfo?.vegetarian).length,
        vegan: items.filter(item => item.dietaryInfo?.vegan).length,
        glutenFree: items.filter(item => item.dietaryInfo?.glutenFree).length,
        halal: items.filter(item => item.dietaryInfo?.halal).length
      }

      // Spice level distribution
      const spiceLevelDistribution = items.reduce((acc, item) => {
        acc[item.spiceLevel] = (acc[item.spiceLevel] || 0) + 1
        return acc
      }, {} as Record<number, number>)

      return {
        totalItems,
        availableItems,
        featuredItems,
        popularItems,
        averagePrice,
        priceRange,
        categoryDistribution,
        topPerformingItems,
        dietaryInfoStats,
        spiceLevelDistribution
      }
    } catch (error) {
      this.logger.error('Failed to fetch menu analytics', error instanceof Error ? error : undefined, { restaurantId })
      throw error
    }
  }

  async getPopularityMetrics(restaurantId: number): Promise<PopularityMetrics> {
    try {
      this.logger.debug('Fetching popularity metrics', { restaurantId })

      const [mostOrdered, mostViewed, highestRated, recentlyAdded] = await Promise.all([
        this.getPopularItems(restaurantId, 10),
        this.getMostViewedItems(restaurantId, 10),
        this.getHighestRatedItems(restaurantId, 10),
        this.getRecentlyAddedItems(restaurantId, 10)
      ])

      return {
        mostOrdered,
        mostViewed,
        highestRated,
        recentlyAdded
      }
    } catch (error) {
      this.logger.error('Failed to fetch popularity metrics', error instanceof Error ? error : undefined, { restaurantId })
      throw error
    }
  }

  // Utility Functions
  async incrementOrderCount(menuItemId: number, increment: number = 1): Promise<void> {
    try {
      await this.dbService.incrementOrderCount(menuItemId, increment)
    } catch (error) {
      this.logger.error('Failed to increment order count', error instanceof Error ? error : undefined, { menuItemId })
      throw error
    }
  }

  async incrementViewCount(menuItemId: number): Promise<void> {
    try {
      await this.dbService.incrementViewCount(menuItemId)
    } catch (error) {
      this.logger.error('Failed to increment view count', error instanceof Error ? error : undefined, { menuItemId })
      throw error
    }
  }

  async updateItemRating(menuItemId: number, rating: number): Promise<void> {
    try {
      this.logger.debug('Updating item rating', { menuItemId, rating })
      // Implementation would update rating and review count
      // This would typically be called after a review is added
    } catch (error) {
      this.logger.error('Failed to update item rating', error instanceof Error ? error : undefined, { menuItemId })
      throw error
    }
  }

  // Private Helper Methods
  private async validateCategoryAccess(categoryId: number, restaurantId: number): Promise<void> {
    const category = await this.getCategory(categoryId)
    if (!category) {
      throw new Error('Category not found')
    }
    // Use loose equality to handle type coercion (string vs number from different sources)
    if (Number(category.restaurantId) !== Number(restaurantId)) {
      throw new Error('Category does not belong to the specified restaurant')
    }
  }

  private async getCategory(id: number): Promise<Category | null> {
    try {
      const category = await this.dbService.getCategory(id)
      if (!category) {
        return null
      }

      return this.transformCategory(category)
    } catch (error) {
      this.logger.error('Failed to fetch category', error instanceof Error ? error : undefined, { id })
      return null
    }
  }

  private async getMostViewedItems(restaurantId: number, limit: number): Promise<MenuItem[]> {
    const result = await this.dbService.searchMenuItems(
      String(restaurantId),
      { isAvailable: true },
      1,
      limit
    )

    const transformedItems = result.items.map(item => this.transformMenuItem(item))
    return transformedItems.sort((a, b) => b.viewCount - a.viewCount)
  }

  private async getHighestRatedItems(restaurantId: number, limit: number): Promise<MenuItem[]> {
    const result = await this.dbService.searchMenuItems(
      String(restaurantId),
      { isAvailable: true },
      1,
      limit
    )

    const transformedItems = result.items.map(item => this.transformMenuItem(item))
    return transformedItems
      .filter(item => item.rating && item.rating > 0)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
  }

  private async getRecentlyAddedItems(restaurantId: number, limit: number): Promise<MenuItem[]> {
    const result = await this.dbService.searchMenuItems(
      String(restaurantId),
      { isAvailable: true },
      1,
      limit
    )

    const transformedItems = result.items.map(item => this.transformMenuItem(item))
    return transformedItems.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  private async invalidateMenuCache(restaurantId: number): Promise<void> {
    if (!this.cacheService) return

    try {
      const cacheKey = `menu:${restaurantId}`
      await this.cacheService.delete(cacheKey)
      this.logger.debug('Menu cache invalidated', { restaurantId })
    } catch (error) {
      this.logger.warn('Failed to invalidate menu cache', { error, restaurantId })
    }
  }

  // Helper functions to transform types
  private transformMenuItem(item: any): MenuItem {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      ingredients: item.ingredients,
      price: item.price,
      originalPrice: item.originalPrice,
      categoryId: Number(item.categoryId),
      restaurantId: Number(item.restaurantId),
      isAvailable: item.isAvailable || false,
      isFeatured: item.isFeatured || false,
      isPopular: item.isPopular || false,
      sortOrder: item.sortOrder || 0,
      spiceLevel: item.spiceLevel || 0,
      preparationTime: item.preparationTime,
      calories: item.calories,
      inventoryCount: item.inventoryCount || 0,
      orderCount: item.orderCount || 0,
      imageUrl: item.imageUrl,
      imageVariants: item.imageVariants,
      allergens: item.allergens || [],
      dietaryInfo: item.dietaryInfo,
      options: item.options,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      reviewCount: item.reviewCount || 0,
      viewCount: item.viewCount || 0,
      rating: item.rating,
      availableHours: item.availableHours,
      tags: item.tags,
      keywords: item.keywords
    }
  }

  private transformCategory(category: any): Category {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      parentId: category.parentId,
      sortOrder: category.sortOrder,
      status: category.status || 1,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      restaurantId: Number(category.restaurantId),
      isActive: category.isActive,
      isVisible: category.isVisible,
      itemCount: category.itemCount
    }
  }

  private transformMenuStructure(menu: any): MenuStructure {
    return {
      categories: menu.categories?.map((cat: any) => this.transformCategory(cat)) || [],
      menuItems: menu.menuItems?.map((item: any) => this.transformMenuItem(item)) || []
    }
  }
}