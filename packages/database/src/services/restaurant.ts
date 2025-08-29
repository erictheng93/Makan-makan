import { eq, and, desc, asc, count, like, sql } from 'drizzle-orm'
import { BaseService } from './base'
import { restaurants, categories, menuItems, tables, users } from '../schema'
import type { Restaurant } from '@makanmakan/shared-types'

export interface CreateRestaurantData {
  name: string
  type: string
  category: string
  description?: string
  address: string
  district: string
  city?: string
  phone: string
  email?: string
  website?: string
  businessHours?: any
  logoUrl?: string
  bannerUrl?: string
}

export interface UpdateRestaurantData extends Partial<CreateRestaurantData> {
  isAvailable?: boolean
  isActive?: boolean
  settings?: any
}

export class RestaurantService extends BaseService {
  
  // 創建餐廳
  async createRestaurant(data: CreateRestaurantData): Promise<Restaurant> {
    try {
      const [restaurant] = await this.db
        .insert(restaurants)
        .values({
          ...data,
          city: data.city || '台中市'
        })
        .returning()

      return this.mapToRestaurant(restaurant)
    } catch (error) {
      this.handleError(error, 'createRestaurant')
    }
  }

  // 獲取餐廳詳情
  async getRestaurant(id: number): Promise<Restaurant | null> {
    try {
      const restaurant = await this.db.query.restaurants.findFirst({
        where: eq(restaurants.id, id),
        with: {
          categories: {
            where: eq(categories.isActive, true),
            orderBy: asc(categories.sortOrder)
          }
        }
      })

      return restaurant ? this.mapToRestaurant(restaurant) : null
    } catch (error) {
      this.handleError(error, 'getRestaurant')
    }
  }

  // 獲取餐廳列表（帶分頁和搜尋）
  async getRestaurants(params: {
    page?: number
    limit?: number
    search?: string
    type?: string
    district?: string
    isAvailable?: boolean
  } = {}) {
    try {
      const { page = 1, limit = 20, search, type, district, isAvailable } = params
      const { offset } = this.createPagination(page, limit)

      // 建構查詢條件
      const conditions = []
      
      if (search) {
        conditions.push(
          sql`${restaurants.name} LIKE ${`%${search}%`} OR ${restaurants.description} LIKE ${`%${search}%`}`
        )
      }
      
      if (type) {
        conditions.push(eq(restaurants.type, type))
      }
      
      if (district) {
        conditions.push(eq(restaurants.district, district))
      }
      
      if (isAvailable !== undefined) {
        conditions.push(eq(restaurants.isAvailable, isAvailable))
      }

      // 總是篩選啟用的餐廳
      conditions.push(eq(restaurants.isActive, true))

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // 查詢餐廳列表
      const restaurantList = await this.db
        .select()
        .from(restaurants)
        .where(whereClause)
        .orderBy(desc(restaurants.rating), asc(restaurants.name))
        .limit(limit)
        .offset(offset)

      // 查詢總數
      const [{ totalCount }] = await this.db
        .select({ totalCount: count() })
        .from(restaurants)
        .where(whereClause)

      return {
        restaurants: restaurantList.map(r => this.mapToRestaurant(r)),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    } catch (error) {
      this.handleError(error, 'getRestaurants')
    }
  }

  // 更新餐廳
  async updateRestaurant(id: number, data: UpdateRestaurantData): Promise<Restaurant> {
    try {
      const [restaurant] = await this.db
        .update(restaurants)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(restaurants.id, id))
        .returning()

      if (!restaurant) {
        throw new Error('Restaurant not found')
      }

      return this.mapToRestaurant(restaurant)
    } catch (error) {
      this.handleError(error, 'updateRestaurant')
    }
  }

  // 軟刪除餐廳
  async deactivateRestaurant(id: number): Promise<void> {
    try {
      const [restaurant] = await this.db
        .update(restaurants)
        .set({ 
          isActive: false,
          isAvailable: false,
          updatedAt: new Date()
        })
        .where(eq(restaurants.id, id))
        .returning()

      if (!restaurant) {
        throw new Error('Restaurant not found')
      }
    } catch (error) {
      this.handleError(error, 'deactivateRestaurant')
    }
  }

  // 獲取餐廳統計資訊
  async getRestaurantStats(id: number) {
    try {
      const stats = await this.db
        .select({
          totalMenuItems: count(menuItems.id),
          totalTables: count(tables.id),
          totalStaff: count(users.id)
        })
        .from(restaurants)
        .leftJoin(menuItems, and(
          eq(menuItems.restaurantId, restaurants.id),
          eq(menuItems.isAvailable, true)
        ))
        .leftJoin(tables, and(
          eq(tables.restaurantId, restaurants.id),
          eq(tables.isActive, true)
        ))
        .leftJoin(users, and(
          eq(users.restaurantId, restaurants.id),
          eq(users.isActive, true)
        ))
        .where(eq(restaurants.id, id))
        .groupBy(restaurants.id)

      return stats[0] || {
        totalMenuItems: 0,
        totalTables: 0,
        totalStaff: 0
      }
    } catch (error) {
      this.handleError(error, 'getRestaurantStats')
    }
  }

  // 搜尋附近餐廳（基於地區）
  async searchNearbyRestaurants(district: string, limit: number = 10) {
    try {
      return await this.db
        .select()
        .from(restaurants)
        .where(
          and(
            eq(restaurants.district, district),
            eq(restaurants.isAvailable, true),
            eq(restaurants.isActive, true)
          )
        )
        .orderBy(desc(restaurants.rating))
        .limit(limit)
    } catch (error) {
      this.handleError(error, 'searchNearbyRestaurants')
    }
  }

  // 獲取熱門餐廳
  async getPopularRestaurants(limit: number = 10) {
    try {
      return await this.db
        .select()
        .from(restaurants)
        .where(
          and(
            eq(restaurants.isAvailable, true),
            eq(restaurants.isActive, true)
          )
        )
        .orderBy(desc(restaurants.totalOrders), desc(restaurants.rating))
        .limit(limit)
    } catch (error) {
      this.handleError(error, 'getPopularRestaurants')
    }
  }

  // 資料轉換
  private mapToRestaurant(restaurant: any): Restaurant {
    return {
      id: restaurant.id,
      name: restaurant.name,
      type: restaurant.type,
      category: restaurant.category,
      description: restaurant.description,
      address: restaurant.address,
      district: restaurant.district,
      city: restaurant.city,
      phone: restaurant.phone,
      email: restaurant.email,
      website: restaurant.website,
      businessHours: restaurant.businessHours,
      isAvailable: restaurant.isAvailable,
      isActive: restaurant.isActive,
      logoUrl: restaurant.logoUrl,
      bannerUrl: restaurant.bannerUrl,
      imageUrls: restaurant.imageUrls,
      settings: restaurant.settings,
      rating: restaurant.rating,
      reviewCount: restaurant.reviewCount,
      totalOrders: restaurant.totalOrders,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt
    }
  }
}