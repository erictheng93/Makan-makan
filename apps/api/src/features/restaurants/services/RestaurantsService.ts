/**
 * RestaurantsService
 * Business logic for restaurant operations within the feature module
 */

import { drizzle } from "drizzle-orm/d1";
import { asc, eq, isNull, and } from "drizzle-orm";
import {
  RestaurantService as DatabaseRestaurantService,
  restaurantFaqs,
  restaurants,
} from "@makanmakan/database";
import { KVCacheService, type CacheService } from "../../../core/cache";
import { ConsoleLogger } from "../../../core/monitoring";
import { CACHE_TTL } from "../../../shared/constants";
import type { Env } from "../../../shared/types";
import { SubscriptionService } from "../../subscriptions/services/SubscriptionService";
import type {
  Restaurant,
  EnhancedRestaurantStats,
  CreateRestaurantData,
  UpdateRestaurantData,
  RestaurantFilters,
  RestaurantEvent,
} from "../types";

interface RestaurantListResult {
  restaurants: Restaurant[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type ShopQrSettings = Record<string, unknown>;

interface ShopQrCodeInfo {
  qrCode: string | null;
  qrCodeImageUrl: string | null;
  enabled: boolean;
  version: number;
  settings: ShopQrSettings;
}

interface ShopQrVerificationResult {
  valid: boolean;
  restaurantId?: string;
  restaurant?: Restaurant;
}

export interface MessagingChannels {
  line?: string;
  whatsapp?: string;
  instagram?: string;
  telegram?: string;
}

export interface RestaurantFaqInput {
  question: string;
  answer: string;
  keywords?: string[];
  displayOrder?: number;
  isActive?: boolean;
}

export interface RestaurantContactProfile {
  restaurantId: string;
  messagingChannels: MessagingChannels;
  faqs: Array<{
    id: number;
    question: string;
    answer: string;
    keywords: string[];
    displayOrder: number;
    isActive: boolean;
  }>;
}

class NoopCacheService implements CacheService {
  async get<T>(): Promise<T | null> {
    return null;
  }

  async set<T>(_key: string, _value: T, _ttl?: number): Promise<void> {}

  async delete(): Promise<boolean> {
    return true;
  }

  async clear(): Promise<void> {}
}

export class RestaurantsService {
  private dbService: DatabaseRestaurantService;
  private db;
  private subscriptionService: SubscriptionService;
  private cache: CacheService;
  private logger: ConsoleLogger;
  private env: Env;

  constructor(db: Env["DB"], env: Env, kv?: Env["CACHE_KV"]) {
    this.dbService = new DatabaseRestaurantService(db, env);
    this.db = drizzle(db);
    this.subscriptionService = new SubscriptionService(db);
    this.cache = kv ? new KVCacheService(kv) : new NoopCacheService();
    this.logger = new ConsoleLogger("RestaurantsService");
    this.env = env;
  }

  /**
   * Get restaurants with filtering and pagination
   */
  async getRestaurants(
    filters: RestaurantFilters,
  ): Promise<RestaurantListResult> {
    try {
      this.logger.debug("Getting restaurants with filters", { filters });

      // Generate cache key based on filters
      const cacheKey = this.generateCacheKey(
        "restaurants:list",
        filters as Record<string, unknown>,
      );

      // Try to get from cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached restaurants");
        return cached as RestaurantListResult;
      }

      // Get from database
      const result = await this.dbService.getRestaurants({
        page: filters.page,
        limit: filters.limit,
        type: filters.type,
        district: filters.district,
        isAvailable: filters.isAvailable,
      });

      // Cache the result
      await this.cache.set(cacheKey, result, CACHE_TTL.MEDIUM);

      this.logger.info("Retrieved restaurants", {
        count: result.restaurants.length,
        total: result.pagination.total,
      });

      return result as {
        restaurants: Restaurant[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    } catch (error) {
      this.logger.error("Failed to get restaurants", error as Error, {
        filters,
      });
      throw new Error("Failed to retrieve restaurants");
    }
  }

  /**
   * Get a single restaurant by ID
   */
  async getRestaurant(id: string): Promise<Restaurant | null> {
    try {
      this.logger.debug("Getting restaurant by ID", { id });

      // Try cache first
      const cacheKey = `restaurant:${id}`;
      const cached = await this.cache.get<Restaurant>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached restaurant");
        return cached;
      }

      // Get from database
      const restaurant = await this.dbService.getRestaurant(id);

      if (restaurant) {
        // Cache the result
        await this.cache.set(cacheKey, restaurant, CACHE_TTL.MEDIUM);
        this.logger.info("Retrieved restaurant", { id, name: restaurant.name });
      } else {
        this.logger.warn("Restaurant not found", { id });
      }

      return restaurant as Restaurant | null;
    } catch (error) {
      this.logger.error("Failed to get restaurant", error as Error, { id });
      throw new Error("Failed to retrieve restaurant");
    }
  }

  /**
   * Create a new restaurant
   */
  async createRestaurant(data: CreateRestaurantData): Promise<Restaurant> {
    try {
      this.logger.debug("Creating restaurant", { name: data.name });

      const restaurant = await this.dbService.createRestaurant(data);

      // Auto-create a 30-day trial subscription for the new restaurant
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      try {
        await this.subscriptionService.create({
          restaurantId: restaurant.id,
          planTier: "trial",
          trialEndsAt,
        });
        this.logger.info("Trial subscription created", {
          restaurantId: restaurant.id,
          trialEndsAt,
        });
      } catch (subError) {
        // Non-fatal — log and continue. Admin can create subscription manually.
        this.logger.error(
          "Failed to auto-create subscription (non-fatal)",
          subError as Error,
          { restaurantId: restaurant.id },
        );
      }

      // Clear relevant caches
      await this.invalidateListCaches();

      // Emit event
      await this.emitEvent({
        type: "RESTAURANT_CREATED",
        payload: restaurant,
      });

      this.logger.info("Restaurant created successfully", {
        id: restaurant.id,
        name: restaurant.name,
      });

      return restaurant as Restaurant;
    } catch (error) {
      this.logger.error("Failed to create restaurant", error as Error, {
        data,
      });
      throw new Error("Failed to create restaurant");
    }
  }

  /**
   * Update an existing restaurant
   */
  async updateRestaurant(
    id: string,
    data: UpdateRestaurantData,
  ): Promise<Restaurant | null> {
    try {
      this.logger.debug("Updating restaurant", { id, data });

      const restaurant = await this.dbService.updateRestaurant(id, data);

      if (restaurant) {
        // Invalidate caches
        await this.cache.delete(`restaurant:${id}`);
        await this.invalidateListCaches();

        // Emit event
        await this.emitEvent({
          type: "RESTAURANT_UPDATED",
          payload: restaurant,
        });

        this.logger.info("Restaurant updated successfully", {
          id: restaurant.id,
          name: restaurant.name,
        });
      } else {
        this.logger.warn("Restaurant not found for update", { id });
      }

      return restaurant as Restaurant | null;
    } catch (error) {
      this.logger.error("Failed to update restaurant", error as Error, {
        id,
        data,
      });
      throw new Error("Failed to update restaurant");
    }
  }

  async getContactProfile(
    id: string,
    options: { includeInactiveFaqs?: boolean } = {},
  ): Promise<RestaurantContactProfile | null> {
    const [restaurant] = await this.db
      .select({
        id: restaurants.id,
        messagingChannels: restaurants.messagingChannels,
      })
      .from(restaurants)
      .where(
        and(
          eq(restaurants.id, id),
          eq(restaurants.isActive, true),
          isNull(restaurants.deletedAt),
        ),
      )
      .limit(1);

    if (!restaurant) return null;

    const faqConditions = [eq(restaurantFaqs.restaurantId, id)];
    if (!options.includeInactiveFaqs) {
      faqConditions.push(eq(restaurantFaqs.isActive, true));
    }

    const faqs = await this.db
      .select()
      .from(restaurantFaqs)
      .where(and(...faqConditions))
      .orderBy(asc(restaurantFaqs.displayOrder), asc(restaurantFaqs.id));

    return {
      restaurantId: restaurant.id,
      messagingChannels: restaurant.messagingChannels ?? {},
      faqs: faqs.map((faq) => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        keywords: faq.keywords ?? [],
        displayOrder: faq.displayOrder,
        isActive: faq.isActive,
      })),
    };
  }

  async updateContactProfile(
    id: string,
    input: {
      messagingChannels: MessagingChannels;
      faqs: RestaurantFaqInput[];
    },
  ): Promise<RestaurantContactProfile | null> {
    const [existing] = await this.db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(
        and(
          eq(restaurants.id, id),
          eq(restaurants.isActive, true),
          isNull(restaurants.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) return null;

    const now = new Date();
    await this.db
      .update(restaurants)
      .set({
        messagingChannels: removeEmptyChannels(input.messagingChannels),
        updatedAt: now,
      })
      .where(eq(restaurants.id, id));

    await this.db
      .delete(restaurantFaqs)
      .where(eq(restaurantFaqs.restaurantId, id));

    if (input.faqs.length > 0) {
      await this.db.insert(restaurantFaqs).values(
        input.faqs.map((faq, index) => ({
          restaurantId: id,
          question: faq.question,
          answer: faq.answer,
          keywords: faq.keywords ?? [],
          displayOrder: faq.displayOrder ?? index,
          isActive: faq.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }

    await this.cache.delete(`restaurant:${id}`);
    await this.cache.delete(`restaurant:${id}:contact-profile`);
    await this.invalidateListCaches();

    return this.getContactProfile(id);
  }

  /**
   * Deactivate a restaurant (soft delete)
   */
  async deactivateRestaurant(id: string): Promise<boolean> {
    try {
      this.logger.debug("Deactivating restaurant", { id });

      await this.dbService.deactivateRestaurant(id);

      // Invalidate caches
      await this.cache.delete(`restaurant:${id}`);
      await this.cache.delete(`restaurant:${id}:stats`);
      await this.invalidateListCaches();

      // Emit event
      await this.emitEvent({
        type: "RESTAURANT_DEACTIVATED",
        payload: { id },
      });

      this.logger.info("Restaurant deactivated successfully", { id });
      return true;
    } catch (error) {
      this.logger.error("Failed to deactivate restaurant", error as Error, {
        id,
      });
      throw new Error("Failed to deactivate restaurant");
    }
  }

  /**
   * Get restaurant statistics
   */
  async getRestaurantStats(id: string): Promise<EnhancedRestaurantStats> {
    try {
      this.logger.debug("Getting restaurant stats", { id });

      // Try cache first
      const cacheKey = `restaurant:${id}:stats`;
      const cached = await this.cache.get<EnhancedRestaurantStats>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached restaurant stats");
        return cached;
      }

      // Get basic stats from database service
      const dbStats = await this.dbService.getRestaurantStats(id);

      // Transform to expected format (extend with additional metrics)
      const stats: EnhancedRestaurantStats = {
        totalOrders: 0, // Would need to join with orders table
        todayOrders: 0, // Would need date filtering
        totalRevenue: 0, // Would need to calculate from orders
        todayRevenue: 0, // Would need date filtering
        averageOrderValue: 0, // Would need to calculate
        activeMenuItems: dbStats.totalMenuItems || 0,
        totalTables: dbStats.totalTables || 0,
        occupiedTables: 0, // Would need real-time table status
        popularItems: [], // Would need to join with order_items
        ordersByHour: [], // Would need hourly breakdown
        customerRetention: {
          newCustomers: 0,
          returningCustomers: 0,
          retentionRate: 0,
        },
      };

      // Cache the result
      await this.cache.set(cacheKey, stats, CACHE_TTL.SHORT);

      this.logger.info("Retrieved restaurant stats", { id });
      return stats;
    } catch (error) {
      this.logger.error("Failed to get restaurant stats", error as Error, {
        id,
      });
      throw new Error("Failed to retrieve restaurant statistics");
    }
  }

  /**
   * Search for nearby restaurants by district
   */
  async searchNearbyRestaurants(
    district: string,
    limit: number,
  ): Promise<Restaurant[]> {
    try {
      this.logger.debug("Searching nearby restaurants", { district, limit });

      const cacheKey = `restaurants:nearby:${district}:${limit}`;
      const cached = await this.cache.get<Restaurant[]>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached nearby restaurants");
        return cached;
      }

      const restaurants = await this.dbService.searchNearbyRestaurants(
        district,
        limit,
      );

      // Cache the result
      await this.cache.set(cacheKey, restaurants, CACHE_TTL.MEDIUM);

      this.logger.info("Retrieved nearby restaurants", {
        district,
        count: restaurants.length,
      });

      return restaurants as unknown as Restaurant[];
    } catch (error) {
      this.logger.error("Failed to search nearby restaurants", error as Error, {
        district,
        limit,
      });
      throw new Error("Failed to search nearby restaurants");
    }
  }

  /**
   * Get popular restaurants
   */
  async getPopularRestaurants(limit: number): Promise<Restaurant[]> {
    try {
      this.logger.debug("Getting popular restaurants", { limit });

      const cacheKey = `restaurants:popular:${limit}`;
      const cached = await this.cache.get<Restaurant[]>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached popular restaurants");
        return cached;
      }

      const restaurants = await this.dbService.getPopularRestaurants(limit);

      // Cache the result
      await this.cache.set(cacheKey, restaurants, CACHE_TTL.MEDIUM);

      this.logger.info("Retrieved popular restaurants", {
        count: restaurants.length,
      });

      return restaurants as unknown as Restaurant[];
    } catch (error) {
      this.logger.error("Failed to get popular restaurants", error as Error, {
        limit,
      });
      throw new Error("Failed to retrieve popular restaurants");
    }
  }

  /**
   * Generate cache key with consistent formatting
   */
  private generateCacheKey(
    prefix: string,
    params: Record<string, unknown>,
  ): string {
    const sortedKeys = Object.keys(params).sort();
    const keyParts = sortedKeys.map((key) => `${key}:${params[key]}`).join(":");
    return keyParts ? `${prefix}:${keyParts}` : prefix;
  }

  /**
   * Invalidate all list-related caches
   */
  private async invalidateListCaches(): Promise<void> {
    const patterns = [
      "restaurants:list:*",
      "restaurants:nearby:*",
      "restaurants:popular:*",
    ];

    for (const pattern of patterns) {
      await this.cache.clear(pattern);
    }
  }

  /**
   * Emit restaurant events (for future event bus integration)
   */
  private async emitEvent(event: RestaurantEvent): Promise<void> {
    try {
      this.logger.debug("Emitting restaurant event", {
        type: event.type,
        payload: event.payload,
      });

      // In the future, this could integrate with an event bus
      // For now, just log the event
    } catch (error) {
      this.logger.error("Failed to emit event", error as Error, { event });
      // Don't throw here as event emission shouldn't break the main flow
    }
  }

  // ==================== Shop QR Code Methods ====================

  /**
   * Generate shop-level QR code for a restaurant
   */
  async generateShopQrCode(id: string): Promise<{
    qrCode: string;
    qrCodeImageUrl: string | null;
    version: number;
  }> {
    try {
      this.logger.debug("Generating shop QR code", { id });

      const result = await this.dbService.generateShopQrCode(id);

      // Invalidate caches
      await this.cache.delete(`restaurant:${id}`);
      await this.cache.delete(`restaurant:${id}:shop-qr`);

      this.logger.info("Shop QR code generated successfully", {
        id,
        qrCode: result.qrCode,
      });

      return result;
    } catch (error) {
      this.logger.error("Failed to generate shop QR code", error as Error, {
        id,
      });
      throw new Error("Failed to generate shop QR code");
    }
  }

  /**
   * Regenerate shop-level QR code (increments version)
   */
  async regenerateShopQrCode(id: string): Promise<{
    qrCode: string;
    qrCodeImageUrl: string | null;
    version: number;
  }> {
    try {
      this.logger.debug("Regenerating shop QR code", { id });

      const result = await this.dbService.regenerateShopQrCode(id);

      // Invalidate caches
      await this.cache.delete(`restaurant:${id}`);
      await this.cache.delete(`restaurant:${id}:shop-qr`);

      this.logger.info("Shop QR code regenerated successfully", {
        id,
        qrCode: result.qrCode,
        version: result.version,
      });

      return result;
    } catch (error) {
      this.logger.error("Failed to regenerate shop QR code", error as Error, {
        id,
      });
      throw new Error("Failed to regenerate shop QR code");
    }
  }

  /**
   * Get shop QR code information
   */
  async getShopQrCodeInfo(id: string): Promise<ShopQrCodeInfo> {
    try {
      this.logger.debug("Getting shop QR code info", { id });

      // Try cache first
      const cacheKey = `restaurant:${id}:shop-qr`;
      const cached = await this.cache.get<ShopQrCodeInfo>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached shop QR info");
        return cached;
      }

      const info = await this.dbService.getShopQrCodeInfo(id);

      // Cache the result
      await this.cache.set(cacheKey, info, CACHE_TTL.MEDIUM);

      this.logger.info("Retrieved shop QR code info", { id });

      return info;
    } catch (error) {
      this.logger.error("Failed to get shop QR code info", error as Error, {
        id,
      });
      throw new Error("Failed to retrieve shop QR code information");
    }
  }

  /**
   * Update shop QR code image URL
   */
  async updateShopQrCodeImage(id: string, imageUrl: string): Promise<void> {
    try {
      this.logger.debug("Updating shop QR code image", { id, imageUrl });

      await this.dbService.updateShopQrCodeImage(id, imageUrl);

      // Invalidate caches
      await this.cache.delete(`restaurant:${id}`);
      await this.cache.delete(`restaurant:${id}:shop-qr`);

      this.logger.info("Shop QR code image updated successfully", { id });
    } catch (error) {
      this.logger.error("Failed to update shop QR code image", error as Error, {
        id,
        imageUrl,
      });
      throw new Error("Failed to update shop QR code image");
    }
  }

  /**
   * Enable or disable shop mode with settings
   */
  async updateShopMode(
    id: string,
    enabled: boolean,
    settings?: ShopQrSettings,
  ): Promise<void> {
    try {
      this.logger.debug("Updating shop mode", { id, enabled, settings });

      await this.dbService.updateShopMode(id, enabled, settings);

      // Invalidate caches
      await this.cache.delete(`restaurant:${id}`);
      await this.cache.delete(`restaurant:${id}:shop-qr`);
      await this.invalidateListCaches();

      this.logger.info("Shop mode updated successfully", { id, enabled });
    } catch (error) {
      this.logger.error("Failed to update shop mode", error as Error, {
        id,
        enabled,
      });
      throw new Error("Failed to update shop mode");
    }
  }

  /**
   * Verify shop QR code and get restaurant information
   */
  async verifyShopQrCode(qrCode: string): Promise<ShopQrVerificationResult> {
    try {
      this.logger.debug("Verifying shop QR code", { qrCode });

      const result = await this.dbService.verifyShopQrCode(qrCode);

      this.logger.info("Shop QR code verification complete", {
        qrCode,
        valid: result.valid,
        restaurantId: result.restaurantId,
      });

      return {
        valid: result.valid,
        restaurantId: result.restaurantId,
        restaurant: result.restaurant as Restaurant | undefined,
      };
    } catch (error) {
      this.logger.error("Failed to verify shop QR code", error as Error, {
        qrCode,
      });
      throw new Error("Failed to verify shop QR code");
    }
  }
}

function removeEmptyChannels(channels: MessagingChannels): MessagingChannels {
  return Object.fromEntries(
    Object.entries(channels).filter(
      ([, value]) => typeof value === "string" && value.length > 0,
    ),
  ) as MessagingChannels;
}
