import { eq, and, desc, asc, count, sql } from "drizzle-orm";
import { BaseService } from "./base";
import { restaurants, categories, menuItems, tables, users } from "../schema";
import type { Restaurant } from "@makanmakan/shared-types";

export interface CreateRestaurantData {
  name: string;
  type: string;
  category: string;
  description?: string;
  address: string;
  district: string;
  city?: string;
  phone: string;
  email?: string;
  website?: string;
  businessHours?: any;
  latitude?: number | null;
  longitude?: number | null;
  logoUrl?: string;
  bannerUrl?: string;
}

export interface UpdateRestaurantData extends Partial<CreateRestaurantData> {
  isAvailable?: boolean;
  isActive?: boolean;
  settings?: any;
}

export class RestaurantService extends BaseService {
  // 創建餐廳
  async createRestaurant(data: CreateRestaurantData): Promise<Restaurant> {
    try {
      console.log("[RestaurantService] Creating restaurant with data:", data);
      const result = await this.db
        .insert(restaurants)
        .values({
          ...data,
          city: data.city || "台中市",
          isAvailable: true, // Default: restaurant is available
          isActive: true, // Default: restaurant is active
        })
        .returning();

      console.log("[RestaurantService] Insert result:", result);
      const [restaurant] = result;

      if (!restaurant) {
        console.error(
          "[RestaurantService] No restaurant returned from insert!",
        );
        throw new Error("Failed to create restaurant: no data returned");
      }

      console.log(
        "[RestaurantService] Restaurant created with ID:",
        restaurant.id,
      );
      return this.mapToRestaurant(restaurant);
    } catch (error) {
      this.handleError(error, "createRestaurant");
    }
  }

  // 獲取餐廳詳情 (by id (UUID v7))
  async getRestaurant(id: string): Promise<Restaurant | null> {
    try {
      const restaurant = await this.db.query.restaurants.findFirst({
        where: eq(restaurants.id, id),
        with: {
          categories: {
            where: eq(categories.isActive, true),
            orderBy: asc(categories.sortOrder),
          },
        },
      });

      return restaurant ? this.mapToRestaurant(restaurant) : null;
    } catch (error) {
      this.handleError(error, "getRestaurant");
    }
  }

  // 獲取餐廳列表（帶分頁和搜尋）
  async getRestaurants(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      type?: string;
      district?: string;
      isAvailable?: boolean;
    } = {},
  ) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        type,
        district,
        isAvailable,
      } = params;
      const { offset } = this.createPagination(page, limit);

      // 建構查詢條件
      const conditions = [];

      if (search) {
        conditions.push(
          sql`${restaurants.name} LIKE ${`%${search}%`} OR ${restaurants.description} LIKE ${`%${search}%`}`,
        );
      }

      if (type) {
        conditions.push(eq(restaurants.type, type));
      }

      if (district) {
        conditions.push(eq(restaurants.district, district));
      }

      if (isAvailable !== undefined) {
        conditions.push(eq(restaurants.isAvailable, isAvailable));
      }

      // 總是篩選啟用的餐廳
      conditions.push(eq(restaurants.isActive, true));

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // 查詢餐廳列表 (only select needed fields for list view - excludes large JSON fields)
      const restaurantList = await this.db
        .select({
          id: restaurants.id,
          name: restaurants.name,
          type: restaurants.type,
          category: restaurants.category,
          description: restaurants.description,
          address: restaurants.address,
          district: restaurants.district,
          city: restaurants.city,
          phone: restaurants.phone,
          email: restaurants.email,
          website: restaurants.website,
          isAvailable: restaurants.isAvailable,
          isActive: restaurants.isActive,
          logoUrl: restaurants.logoUrl,
          bannerUrl: restaurants.bannerUrl,
          rating: restaurants.rating,
          reviewCount: restaurants.reviewCount,
          totalOrders: restaurants.totalOrders,
          enableShopMode: restaurants.enableShopMode,
          shopQrCode: restaurants.shopQrCode,
          createdAt: restaurants.createdAt,
          updatedAt: restaurants.updatedAt,
        })
        .from(restaurants)
        .where(whereClause)
        .orderBy(desc(restaurants.rating), asc(restaurants.name))
        .limit(limit)
        .offset(offset);

      // 查詢總數
      const [{ totalCount }] = await this.db
        .select({ totalCount: count() })
        .from(restaurants)
        .where(whereClause);

      return {
        restaurants: restaurantList.map((r) => this.mapToRestaurant(r)),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      this.handleError(error, "getRestaurants");
    }
  }

  // 更新餐廳
  async updateRestaurant(
    id: string,
    data: UpdateRestaurantData,
  ): Promise<Restaurant> {
    try {
      const [restaurant] = await this.db
        .update(restaurants)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(restaurants.id, id))
        .returning();

      if (!restaurant) {
        throw new Error("Restaurant not found");
      }

      return this.mapToRestaurant(restaurant);
    } catch (error) {
      this.handleError(error, "updateRestaurant");
    }
  }

  // 軟刪除餐廳
  async deactivateRestaurant(id: string): Promise<void> {
    try {
      const [restaurant] = await this.db
        .update(restaurants)
        .set({
          isActive: false,
          isAvailable: false,
          updatedAt: new Date(),
        })
        .where(eq(restaurants.id, id))
        .returning();

      if (!restaurant) {
        throw new Error("Restaurant not found");
      }
    } catch (error) {
      this.handleError(error, "deactivateRestaurant");
    }
  }

  // 獲取餐廳統計資訊 (by id (UUID v7))
  async getRestaurantStats(id: string) {
    try {
      const stats = await this.db
        .select({
          totalMenuItems: count(menuItems.id),
          totalTables: count(tables.id),
          totalStaff: count(users.id),
        })
        .from(restaurants)
        .leftJoin(
          menuItems,
          and(
            eq(menuItems.restaurantId, restaurants.id),
            eq(menuItems.isAvailable, true),
          ),
        )
        .leftJoin(
          tables,
          and(
            eq(tables.restaurantId, restaurants.id),
            eq(tables.isActive, true),
          ),
        )
        .leftJoin(
          users,
          and(eq(users.restaurantId, restaurants.id), eq(users.isActive, true)),
        )
        .where(eq(restaurants.id, id))
        .groupBy(restaurants.id);

      return (
        stats[0] || {
          totalMenuItems: 0,
          totalTables: 0,
          totalStaff: 0,
        }
      );
    } catch (error) {
      this.handleError(error, "getRestaurantStats");
    }
  }

  // 搜尋附近餐廳（基於地區）
  async searchNearbyRestaurants(
    district: string,
    limit: number = 10,
  ): Promise<Restaurant[]> {
    try {
      const rows = await this.db
        .select()
        .from(restaurants)
        .where(
          and(
            eq(restaurants.district, district),
            eq(restaurants.isAvailable, true),
            eq(restaurants.isActive, true),
          ),
        )
        .orderBy(desc(restaurants.rating))
        .limit(limit);
      return rows.map((row) => this.mapToRestaurant(row));
    } catch (error) {
      this.handleError(error, "searchNearbyRestaurants");
    }
  }

  // 獲取熱門餐廳
  async getPopularRestaurants(limit: number = 10): Promise<Restaurant[]> {
    try {
      const rows = await this.db
        .select()
        .from(restaurants)
        .where(
          and(
            eq(restaurants.isAvailable, true),
            eq(restaurants.isActive, true),
          ),
        )
        .orderBy(desc(restaurants.totalOrders), desc(restaurants.rating))
        .limit(limit);
      return rows.map((row) => this.mapToRestaurant(row));
    } catch (error) {
      this.handleError(error, "getPopularRestaurants");
    }
  }

  // ==================== 店家级别 QR Code 功能 ====================

  /**
   * 生成店家级别 QR Code
   * 适用于无桌号的外带/自取订单场景
   */
  async generateShopQrCode(restaurantId: string): Promise<{
    qrCode: string;
    qrCodeImageUrl: string | null;
    version: number;
  }> {
    try {
      const restaurant = await this.getRestaurant(restaurantId);
      if (!restaurant) {
        throw new Error("Restaurant not found");
      }

      // 如果已有 QR Code，直接返回
      if (restaurant.shopQrCode) {
        return {
          qrCode: restaurant.shopQrCode,
          qrCodeImageUrl: restaurant.shopQrCodeImageUrl || null,
          version: restaurant.shopQrVersion || 1,
        };
      }

      // 生成新的 QR Code：格式 SHOP-{restaurantId}-{timestamp}
      const timestamp = Math.floor(Date.now() / 1000);
      const qrCode = `SHOP-${restaurantId}-${timestamp}`;

      // 默认设置
      const defaultSettings = {
        displayName: restaurant.name,
        instructions: "扫描 QR Code 开始点餐",
        requirePhone: true,
      };

      // 更新数据库
      const [updated] = await this.db
        .update(restaurants)
        .set({
          shopQrCode: qrCode,
          shopQrVersion: 1,
          shopQrSettings: defaultSettings,
          updatedAt: new Date(),
        })
        .where(eq(restaurants.id, restaurantId))
        .returning();

      return {
        qrCode: updated.shopQrCode!,
        qrCodeImageUrl: updated.shopQrCodeImageUrl || null,
        version: updated.shopQrVersion || 1,
      };
    } catch (error) {
      this.handleError(error, "generateShopQrCode");
    }
  }

  /**
   * 重新生成店家 QR Code
   * 用于 QR Code 泄露或需要更换的情况
   */
  async regenerateShopQrCode(restaurantId: string): Promise<{
    qrCode: string;
    qrCodeImageUrl: string | null;
    version: number;
  }> {
    try {
      const restaurant = await this.getRestaurant(restaurantId);
      if (!restaurant) {
        throw new Error("Restaurant not found");
      }

      // 生成新的 QR Code
      const timestamp = Math.floor(Date.now() / 1000);
      const qrCode = `SHOP-${restaurantId}-${timestamp}`;
      const newVersion = (restaurant.shopQrVersion || 0) + 1;

      // 更新数据库
      const [updated] = await this.db
        .update(restaurants)
        .set({
          shopQrCode: qrCode,
          shopQrCodeImageUrl: null, // 清除旧的图片 URL
          shopQrVersion: newVersion,
          updatedAt: new Date(),
        })
        .where(eq(restaurants.id, restaurantId))
        .returning();

      return {
        qrCode: updated.shopQrCode!,
        qrCodeImageUrl: null,
        version: updated.shopQrVersion || newVersion,
      };
    } catch (error) {
      this.handleError(error, "regenerateShopQrCode");
    }
  }

  /**
   * 验证店家 QR Code 是否有效
   */
  async verifyShopQrCode(qrCode: string): Promise<{
    valid: boolean;
    restaurantId?: string;
    restaurant?: Restaurant;
  }> {
    try {
      // QR Code 格式验证：SHOP-{restaurantId}-{timestamp}
      if (!qrCode || !qrCode.startsWith("SHOP-")) {
        return { valid: false };
      }

      const restaurant = await this.db.query.restaurants.findFirst({
        where: and(
          eq(restaurants.shopQrCode, qrCode),
          eq(restaurants.isActive, true),
        ),
      });

      if (!restaurant) {
        return { valid: false };
      }

      return {
        valid: true,
        restaurantId: restaurant.id, // 返回 id (UUID v7)
        restaurant: this.mapToRestaurant(restaurant),
      };
    } catch (error) {
      this.handleError(error, "verifyShopQrCode");
    }
  }

  /**
   * 通过店家 QR Code 获取餐厅信息
   */
  async getRestaurantByShopQrCode(qrCode: string): Promise<Restaurant | null> {
    try {
      const result = await this.verifyShopQrCode(qrCode);
      return result.valid && result.restaurant ? result.restaurant : null;
    } catch (error) {
      this.handleError(error, "getRestaurantByShopQrCode");
    }
  }

  /**
   * 更新店家模式设置
   */
  async updateShopMode(
    restaurantId: string,
    enabled: boolean,
    settings?: {
      displayName?: string;
      instructions?: string;
      requirePhone?: boolean;
    },
  ): Promise<void> {
    try {
      const restaurant = await this.getRestaurant(restaurantId);
      if (!restaurant) {
        throw new Error("Restaurant not found");
      }

      // 如果启用店家模式但没有 QR Code，先生成一个
      if (enabled && !restaurant.shopQrCode) {
        await this.generateShopQrCode(restaurantId);
      }

      // 合并设置
      const currentSettings = restaurant.shopQrSettings || {};
      const newSettings = settings
        ? { ...currentSettings, ...settings }
        : currentSettings;

      // 更新数据库
      await this.db
        .update(restaurants)
        .set({
          enableShopMode: enabled,
          shopQrSettings: newSettings,
          updatedAt: new Date(),
        })
        .where(eq(restaurants.id, restaurantId));
    } catch (error) {
      this.handleError(error, "updateShopMode");
    }
  }

  /**
   * 获取店家 QR Code 信息
   */
  async getShopQrCodeInfo(restaurantId: string): Promise<{
    enabled: boolean;
    qrCode: string | null;
    qrCodeImageUrl: string | null;
    version: number;
    settings: any;
  }> {
    try {
      const restaurant = await this.getRestaurant(restaurantId);
      if (!restaurant) {
        throw new Error("Restaurant not found");
      }

      return {
        enabled: restaurant.enableShopMode || false,
        qrCode: restaurant.shopQrCode || null,
        qrCodeImageUrl: restaurant.shopQrCodeImageUrl || null,
        version: restaurant.shopQrVersion || 1,
        settings: restaurant.shopQrSettings || {
          displayName: restaurant.name,
          instructions: "扫描 QR Code 开始点餐",
          requirePhone: true,
        },
      };
    } catch (error) {
      this.handleError(error, "getShopQrCodeInfo");
    }
  }

  /**
   * 上传/更新店家 QR Code 图片 URL
   */
  async updateShopQrCodeImage(
    restaurantId: string,
    imageUrl: string,
  ): Promise<void> {
    try {
      await this.db
        .update(restaurants)
        .set({
          shopQrCodeImageUrl: imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(restaurants.id, restaurantId));
    } catch (error) {
      this.handleError(error, "updateShopQrCodeImage");
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
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
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
      supportsTakeaway: restaurant.supportsTakeaway,
      supportsDelivery: restaurant.supportsDelivery,
      status: restaurant.isActive ? 1 : 0, // Status.ACTIVE : Status.INACTIVE
      planType: restaurant.planType || 0,
      // 店家 QR Code 相关字段
      shopQrCode: restaurant.shopQrCode,
      shopQrCodeImageUrl: restaurant.shopQrCodeImageUrl,
      enableShopMode: restaurant.enableShopMode,
      shopQrSettings: restaurant.shopQrSettings,
      shopQrVersion: restaurant.shopQrVersion,
      createdAt: restaurant.createdAt,
      updatedAt: restaurant.updatedAt,
    } as Restaurant;
  }
}
