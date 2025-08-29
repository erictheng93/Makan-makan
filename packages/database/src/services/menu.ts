import { eq, and, desc, asc, count, like, sql, inArray } from 'drizzle-orm'
import { BaseService } from './base'
import { restaurants, categories, menuItems } from '../schema'
import type { MenuStructure, MenuItem, Category } from '@makanmakan/shared-types'

export interface CreateMenuItemData {
  restaurantId: number
  categoryId: number
  name: string
  description?: string
  ingredients?: string
  price: number
  originalPrice?: number
  imageUrl?: string
  imageVariants?: any
  spiceLevel?: number
  preparationTime?: number
  calories?: number
  dietaryInfo?: any
  allergens?: string[]
  options?: any
  availableHours?: any
  tags?: string[]
  keywords?: string
}

export interface UpdateMenuItemData extends Partial<CreateMenuItemData> {
  isAvailable?: boolean
  isFeatured?: boolean
  isPopular?: boolean
  sortOrder?: number
  inventoryCount?: number
}

export interface MenuFilters {
  categoryId?: number
  priceRange?: [number, number]
  spiceLevel?: number
  dietaryPreferences?: string[]
  isAvailable?: boolean
  isFeatured?: boolean
  search?: string
}

export class MenuService extends BaseService {
  
  // 獲取完整菜單結構
  async getMenu(restaurantId: number): Promise<MenuStructure> {
    try {
      const restaurant = await this.db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantId),
        with: {
          categories: {
            where: and(
              eq(categories.isActive, true),
              eq(categories.isVisible, true)
            ),
            orderBy: asc(categories.sortOrder),
            with: {
              menuItems: {
                where: and(
                  eq(menuItems.isAvailable, true)
                ),
                orderBy: [asc(menuItems.sortOrder), asc(menuItems.name)]
              }
            }
          }
        }
      })

      if (!restaurant) {
        throw new Error('Restaurant not found')
      }

      // 更新分類的商品數量
      await this.updateCategoryItemCounts(restaurantId)

      return {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          type: restaurant.type,
          address: restaurant.address,
          phone: restaurant.phone,
          isAvailable: restaurant.isAvailable
        },
        categories: restaurant.categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          sortOrder: cat.sortOrder,
          isActive: cat.isActive,
          imageUrl: cat.imageUrl,
          itemCount: cat.menuItems.length
        })),
        menuItems: restaurant.categories.flatMap(cat => 
          cat.menuItems.map(item => this.mapToMenuItem(item))
        )
      }
    } catch (error) {
      this.handleError(error, 'getMenu')
    }
  }

  // 獲取特色菜品
  async getFeaturedItems(restaurantId: number, limit: number = 10): Promise<MenuItem[]> {
    try {
      const items = await this.db
        .select()
        .from(menuItems)
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            eq(menuItems.isFeatured, true),
            eq(menuItems.isAvailable, true)
          )
        )
        .orderBy(desc(menuItems.orderCount), desc(menuItems.rating))
        .limit(limit)

      return items.map(item => this.mapToMenuItem(item))
    } catch (error) {
      this.handleError(error, 'getFeaturedItems')
    }
  }

  // 獲取熱門菜品
  async getPopularItems(restaurantId: number, limit: number = 10): Promise<MenuItem[]> {
    try {
      const items = await this.db
        .select()
        .from(menuItems)
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            eq(menuItems.isAvailable, true)
          )
        )
        .orderBy(desc(menuItems.orderCount), desc(menuItems.rating))
        .limit(limit)

      return items.map(item => this.mapToMenuItem(item))
    } catch (error) {
      this.handleError(error, 'getPopularItems')
    }
  }

  // 搜尋菜品
  async searchMenuItems(
    restaurantId: number, 
    filters: MenuFilters,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const { offset } = this.createPagination(page, limit)
      const conditions = [eq(menuItems.restaurantId, restaurantId)]

      // 建構查詢條件
      if (filters.categoryId) {
        conditions.push(eq(menuItems.categoryId, filters.categoryId))
      }

      if (filters.priceRange) {
        const [minPrice, maxPrice] = filters.priceRange
        conditions.push(
          and(
            sql`${menuItems.price} >= ${minPrice}`,
            sql`${menuItems.price} <= ${maxPrice}`
          )
        )
      }

      if (filters.spiceLevel !== undefined) {
        conditions.push(eq(menuItems.spiceLevel, filters.spiceLevel))
      }

      if (filters.isAvailable !== undefined) {
        conditions.push(eq(menuItems.isAvailable, filters.isAvailable))
      }

      if (filters.isFeatured !== undefined) {
        conditions.push(eq(menuItems.isFeatured, filters.isFeatured))
      }

      if (filters.search) {
        conditions.push(
          sql`(${menuItems.name} LIKE ${`%${filters.search}%`} OR ${menuItems.description} LIKE ${`%${filters.search}%`} OR ${menuItems.keywords} LIKE ${`%${filters.search}%`})`
        )
      }

      // 飲食偏好篩選
      if (filters.dietaryPreferences?.length) {
        const dietaryConditions = filters.dietaryPreferences.map(pref => 
          sql`json_extract(${menuItems.dietaryInfo}, '$.${pref}') = true`
        )
        conditions.push(sql`(${dietaryConditions.join(' OR ')})`)
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // 查詢結果
      const items = await this.db
        .select()
        .from(menuItems)
        .where(whereClause)
        .orderBy(desc(menuItems.isFeatured), desc(menuItems.orderCount), asc(menuItems.sortOrder))
        .limit(limit)
        .offset(offset)

      // 查詢總數
      const [{ totalCount }] = await this.db
        .select({ totalCount: count() })
        .from(menuItems)
        .where(whereClause)

      return {
        items: items.map(item => this.mapToMenuItem(item)),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    } catch (error) {
      this.handleError(error, 'searchMenuItems')
    }
  }

  // 創建菜單項目
  async createMenuItem(data: CreateMenuItemData): Promise<MenuItem> {
    try {
      const [item] = await this.db
        .insert(menuItems)
        .values(data)
        .returning()

      // 更新分類商品數量
      await this.updateCategoryItemCount(data.categoryId)

      return this.mapToMenuItem(item)
    } catch (error) {
      this.handleError(error, 'createMenuItem')
    }
  }

  // 更新菜單項目
  async updateMenuItem(id: number, data: UpdateMenuItemData): Promise<MenuItem> {
    try {
      const [item] = await this.db
        .update(menuItems)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(menuItems.id, id))
        .returning()

      if (!item) {
        throw new Error('Menu item not found')
      }

      return this.mapToMenuItem(item)
    } catch (error) {
      this.handleError(error, 'updateMenuItem')
    }
  }

  // 批量更新菜品可用性
  async batchUpdateAvailability(
    restaurantId: number,
    updates: { id: number; isAvailable: boolean }[]
  ): Promise<void> {
    try {
      for (const update of updates) {
        await this.db
          .update(menuItems)
          .set({ 
            isAvailable: update.isAvailable,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(menuItems.id, update.id),
              eq(menuItems.restaurantId, restaurantId)
            )
          )
      }
    } catch (error) {
      this.handleError(error, 'batchUpdateAvailability')
    }
  }

  // 更新菜品點餐次數
  async incrementOrderCount(menuItemId: number, increment: number = 1): Promise<void> {
    try {
      await this.db
        .update(menuItems)
        .set({
          orderCount: sql`${menuItems.orderCount} + ${increment}`,
          updatedAt: new Date()
        })
        .where(eq(menuItems.id, menuItemId))
    } catch (error) {
      this.handleError(error, 'incrementOrderCount')
    }
  }

  // 更新菜品瀏覽次數
  async incrementViewCount(menuItemId: number): Promise<void> {
    try {
      await this.db
        .update(menuItems)
        .set({
          viewCount: sql`${menuItems.viewCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(menuItems.id, menuItemId))
    } catch (error) {
      this.handleError(error, 'incrementViewCount')
    }
  }

  // 獲取菜品詳情
  async getMenuItem(id: number): Promise<MenuItem | null> {
    try {
      const item = await this.db.query.menuItems.findFirst({
        where: eq(menuItems.id, id),
        with: {
          category: true,
          restaurant: {
            columns: {
              id: true,
              name: true
            }
          }
        }
      })

      return item ? this.mapToMenuItem(item) : null
    } catch (error) {
      this.handleError(error, 'getMenuItem')
    }
  }

  // 創建或更新分類
  async createCategory(data: {
    restaurantId: number
    name: string
    description?: string
    sortOrder?: number
    imageUrl?: string
  }) {
    try {
      const [category] = await this.db
        .insert(categories)
        .values(data)
        .returning()

      return category
    } catch (error) {
      this.handleError(error, 'createCategory')
    }
  }

  // 更新分類商品數量
  private async updateCategoryItemCount(categoryId: number): Promise<void> {
    const [{ itemCount }] = await this.db
      .select({ itemCount: count() })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.categoryId, categoryId),
          eq(menuItems.isAvailable, true)
        )
      )

    await this.db
      .update(categories)
      .set({ 
        itemCount,
        updatedAt: new Date()
      })
      .where(eq(categories.id, categoryId))
  }

  // 更新所有分類商品數量
  private async updateCategoryItemCounts(restaurantId: number): Promise<void> {
    const restaurantCategories = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.restaurantId, restaurantId))

    for (const category of restaurantCategories) {
      await this.updateCategoryItemCount(category.id)
    }
  }

  // 資料轉換
  private mapToMenuItem(item: any): MenuItem {
    return {
      id: item.id,
      restaurantId: item.restaurantId,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      ingredients: item.ingredients,
      price: item.price,
      originalPrice: item.originalPrice,
      imageUrl: item.imageUrl,
      imageVariants: item.imageVariants,
      isAvailable: item.isAvailable,
      isFeatured: item.isFeatured,
      isPopular: item.isPopular,
      sortOrder: item.sortOrder,
      inventoryCount: item.inventoryCount,
      spiceLevel: item.spiceLevel,
      preparationTime: item.preparationTime,
      calories: item.calories,
      dietaryInfo: item.dietaryInfo,
      allergens: item.allergens,
      options: item.options,
      availableHours: item.availableHours,
      orderCount: item.orderCount,
      rating: item.rating,
      reviewCount: item.reviewCount,
      viewCount: item.viewCount,
      tags: item.tags,
      keywords: item.keywords,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }
  }
}