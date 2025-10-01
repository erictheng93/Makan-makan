/**
 * RestaurantsService
 * Business logic for restaurant operations within the feature module
 */

import { RestaurantService as DatabaseRestaurantService } from '@makanmakan/database'
import { KVCacheService, type CacheService } from '../../../core/cache'
import { ConsoleLogger } from '../../../core/monitoring'
import { CACHE_TTL } from '../../../shared/constants'
import type { Env } from '../../../shared/types'
import type {
  Restaurant,
  EnhancedRestaurantStats,
  CreateRestaurantData,
  UpdateRestaurantData,
  RestaurantFilters,
  RestaurantEvent
} from '../types'

export class RestaurantsService {
  private dbService: DatabaseRestaurantService
  private cache: CacheService
  private logger: ConsoleLogger
  private env: Env

  constructor(
    db: Env['DB'],
    env: Env,
    kv?: Env['CACHE_KV']
  ) {
    this.dbService = new DatabaseRestaurantService(db, env)
    this.cache = kv ? new KVCacheService(kv) : new KVCacheService({} as any)
    this.logger = new ConsoleLogger('RestaurantsService')
    this.env = env
  }

  /**
   * Get restaurants with filtering and pagination
   */
  async getRestaurants(filters: RestaurantFilters) {
    try {
      this.logger.debug('Getting restaurants with filters', { filters })

      // Generate cache key based on filters
      const cacheKey = this.generateCacheKey('restaurants:list', filters)

      // Try to get from cache first
      const cached = await this.cache.get(cacheKey)
      if (cached) {
        this.logger.debug('Returning cached restaurants')
        return cached
      }

      // Get from database
      const result = await this.dbService.getRestaurants({
        page: filters.page,
        limit: filters.limit,
        type: filters.type,
        district: filters.district,
        isAvailable: filters.isAvailable
      })

      // Cache the result
      await this.cache.set(cacheKey, result, CACHE_TTL.MEDIUM)

      this.logger.info('Retrieved restaurants', {
        count: result.restaurants.length,
        total: result.pagination.total
      })

      return result as { restaurants: Restaurant[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
    } catch (error) {
      this.logger.error('Failed to get restaurants', error as Error, { filters })
      throw new Error('Failed to retrieve restaurants')
    }
  }

  /**
   * Get a single restaurant by ID
   */
  async getRestaurant(id: number): Promise<Restaurant | null> {
    try {
      this.logger.debug('Getting restaurant by ID', { id })

      // Try cache first
      const cacheKey = `restaurant:${id}`
      const cached = await this.cache.get<Restaurant>(cacheKey)
      if (cached) {
        this.logger.debug('Returning cached restaurant')
        return cached
      }

      // Get from database
      const restaurant = await this.dbService.getRestaurant(id)

      if (restaurant) {
        // Cache the result
        await this.cache.set(cacheKey, restaurant, CACHE_TTL.MEDIUM)
        this.logger.info('Retrieved restaurant', { id, name: restaurant.name })
      } else {
        this.logger.warn('Restaurant not found', { id })
      }

      return restaurant as Restaurant | null
    } catch (error) {
      this.logger.error('Failed to get restaurant', error as Error, { id })
      throw new Error('Failed to retrieve restaurant')
    }
  }

  /**
   * Create a new restaurant
   */
  async createRestaurant(data: CreateRestaurantData): Promise<Restaurant> {
    try {
      this.logger.debug('Creating restaurant', { name: data.name })

      const restaurant = await this.dbService.createRestaurant(data)

      // Clear relevant caches
      await this.invalidateListCaches()

      // Emit event
      await this.emitEvent({
        type: 'RESTAURANT_CREATED',
        payload: restaurant
      })

      this.logger.info('Restaurant created successfully', {
        id: restaurant.id,
        name: restaurant.name
      })

      return restaurant as Restaurant
    } catch (error) {
      this.logger.error('Failed to create restaurant', error as Error, { data })
      throw new Error('Failed to create restaurant')
    }
  }

  /**
   * Update an existing restaurant
   */
  async updateRestaurant(id: number, data: UpdateRestaurantData): Promise<Restaurant | null> {
    try {
      this.logger.debug('Updating restaurant', { id, data })

      const restaurant = await this.dbService.updateRestaurant(id, data)

      if (restaurant) {
        // Invalidate caches
        await this.cache.delete(`restaurant:${id}`)
        await this.invalidateListCaches()

        // Emit event
        await this.emitEvent({
          type: 'RESTAURANT_UPDATED',
          payload: restaurant
        })

        this.logger.info('Restaurant updated successfully', {
          id: restaurant.id,
          name: restaurant.name
        })
      } else {
        this.logger.warn('Restaurant not found for update', { id })
      }

      return restaurant as Restaurant | null
    } catch (error) {
      this.logger.error('Failed to update restaurant', error as Error, { id, data })
      throw new Error('Failed to update restaurant')
    }
  }

  /**
   * Deactivate a restaurant (soft delete)
   */
  async deactivateRestaurant(id: number): Promise<boolean> {
    try {
      this.logger.debug('Deactivating restaurant', { id })

      await this.dbService.deactivateRestaurant(id)

      // Invalidate caches
      await this.cache.delete(`restaurant:${id}`)
      await this.cache.delete(`restaurant:${id}:stats`)
      await this.invalidateListCaches()

      // Emit event
      await this.emitEvent({
        type: 'RESTAURANT_DEACTIVATED',
        payload: { id }
      })

      this.logger.info('Restaurant deactivated successfully', { id })
      return true
    } catch (error) {
      this.logger.error('Failed to deactivate restaurant', error as Error, { id })
      throw new Error('Failed to deactivate restaurant')
    }
  }

  /**
   * Get restaurant statistics
   */
  async getRestaurantStats(id: number): Promise<EnhancedRestaurantStats> {
    try {
      this.logger.debug('Getting restaurant stats', { id })

      // Try cache first
      const cacheKey = `restaurant:${id}:stats`
      const cached = await this.cache.get<EnhancedRestaurantStats>(cacheKey)
      if (cached) {
        this.logger.debug('Returning cached restaurant stats')
        return cached
      }

      // Get basic stats from database service
      const dbStats = await this.dbService.getRestaurantStats(id)

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
          retentionRate: 0
        }
      }

      // Cache the result
      await this.cache.set(cacheKey, stats, CACHE_TTL.SHORT)

      this.logger.info('Retrieved restaurant stats', { id })
      return stats
    } catch (error) {
      this.logger.error('Failed to get restaurant stats', error as Error, { id })
      throw new Error('Failed to retrieve restaurant statistics')
    }
  }

  /**
   * Search for nearby restaurants by district
   */
  async searchNearbyRestaurants(district: string, limit: number): Promise<Restaurant[]> {
    try {
      this.logger.debug('Searching nearby restaurants', { district, limit })

      const cacheKey = `restaurants:nearby:${district}:${limit}`
      const cached = await this.cache.get<Restaurant[]>(cacheKey)
      if (cached) {
        this.logger.debug('Returning cached nearby restaurants')
        return cached
      }

      const restaurants = await this.dbService.searchNearbyRestaurants(district, limit)

      // Cache the result
      await this.cache.set(cacheKey, restaurants, CACHE_TTL.MEDIUM)

      this.logger.info('Retrieved nearby restaurants', {
        district,
        count: restaurants.length
      })

      return restaurants as unknown as Restaurant[]
    } catch (error) {
      this.logger.error('Failed to search nearby restaurants', error as Error, { district, limit })
      throw new Error('Failed to search nearby restaurants')
    }
  }

  /**
   * Get popular restaurants
   */
  async getPopularRestaurants(limit: number): Promise<Restaurant[]> {
    try {
      this.logger.debug('Getting popular restaurants', { limit })

      const cacheKey = `restaurants:popular:${limit}`
      const cached = await this.cache.get<Restaurant[]>(cacheKey)
      if (cached) {
        this.logger.debug('Returning cached popular restaurants')
        return cached
      }

      const restaurants = await this.dbService.getPopularRestaurants(limit)

      // Cache the result
      await this.cache.set(cacheKey, restaurants, CACHE_TTL.MEDIUM)

      this.logger.info('Retrieved popular restaurants', { count: restaurants.length })

      return restaurants as unknown as Restaurant[]
    } catch (error) {
      this.logger.error('Failed to get popular restaurants', error as Error, { limit })
      throw new Error('Failed to retrieve popular restaurants')
    }
  }

  /**
   * Generate cache key with consistent formatting
   */
  private generateCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedKeys = Object.keys(params).sort()
    const keyParts = sortedKeys.map(key => `${key}:${params[key]}`).join(':')
    return keyParts ? `${prefix}:${keyParts}` : prefix
  }

  /**
   * Invalidate all list-related caches
   */
  private async invalidateListCaches(): Promise<void> {
    const patterns = [
      'restaurants:list:*',
      'restaurants:nearby:*',
      'restaurants:popular:*'
    ]

    for (const pattern of patterns) {
      await this.cache.clear(pattern)
    }
  }

  /**
   * Emit restaurant events (for future event bus integration)
   */
  private async emitEvent(event: RestaurantEvent): Promise<void> {
    try {
      this.logger.debug('Emitting restaurant event', {
        type: event.type,
        payload: event.payload
      })

      // In the future, this could integrate with an event bus
      // For now, just log the event
    } catch (error) {
      this.logger.error('Failed to emit event', error as Error, { event })
      // Don't throw here as event emission shouldn't break the main flow
    }
  }
}