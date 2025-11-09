import { drizzle } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'
import * as schema from '../schema'
import { QueryCache, buildCacheKey, type QueryCacheOptions } from '../utils/query-cache'
import { getConnectionManager, type ConnectionManager } from '../utils/connection-manager'

export interface CloudflareEnv {
  JWT_SECRET: string
  NODE_ENV?: string
  CACHE_KV?: KVNamespace
  // Notification providers
  RESEND_API_KEY?: string
  NOTIFICATION_FROM_EMAIL?: string
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  TWILIO_PHONE_NUMBER?: string
  // Test support
  MOCK_DRIZZLE_DB?: any
  [key: string]: any
}

// 基礎服務類別
export class BaseService {
  protected db: ReturnType<typeof drizzle<typeof schema>>
  protected d1: D1Database
  protected env: CloudflareEnv
  protected queryCache: QueryCache
  protected connectionManager: ConnectionManager

  constructor(d1: D1Database, env: CloudflareEnv, mockDb?: any) {
    this.d1 = d1
    this.env = env

    // In test environment, allow injecting a mock Drizzle instance
    // Priority: mockDb parameter > env.MOCK_DRIZZLE_DB > real drizzle
    if (mockDb && env.NODE_ENV === 'test') {
      console.log('[BaseService] Using mock Drizzle instance (from parameter)')
      this.db = mockDb
    } else if (env.MOCK_DRIZZLE_DB && env.NODE_ENV === 'test') {
      console.log('[BaseService] Using mock Drizzle instance (from env)')
      this.db = env.MOCK_DRIZZLE_DB
    } else {
      this.db = drizzle(d1, {
        schema,
        logger: env.NODE_ENV === 'development'
      })
    }

    this.queryCache = new QueryCache(env.CACHE_KV)
    this.connectionManager = getConnectionManager()
  }

  /**
   * Execute query with caching support
   * For frequently accessed, read-only queries
   */
  protected async cachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions
  ): Promise<T> {
    return this.queryCache.getOrExecute(cacheKey, queryFn, options)
  }

  /**
   * Invalidate cache by key or tags
   */
  protected async invalidateCache(keyOrTags: string | string[], type: 'key' | 'tag' = 'key'): Promise<void> {
    await this.queryCache.invalidate(keyOrTags, type)
  }

  /**
   * Build consistent cache keys
   */
  protected buildCacheKey(resource: string, identifier: string | number, suffix?: string): string {
    return buildCacheKey(resource, identifier, suffix)
  }

  /**
   * Execute query with connection management
   * Provides retry logic, timeout handling, and batching
   */
  protected async managedQuery<T>(
    queryFn: () => Promise<T>,
    options?: {
      priority?: number
      timeout?: number
      maxRetries?: number
      batchable?: boolean
    }
  ): Promise<T> {
    return this.connectionManager.executeQuery(queryFn, options)
  }

  /**
   * Get connection metrics for monitoring
   */
  protected getConnectionMetrics() {
    return this.connectionManager.getMetrics()
  }

  // 通用錯誤處理
  protected handleError(error: any, operation: string): never {
    console.error(`Database error in ${operation}:`, error)
    
    if (error.message?.includes('UNIQUE constraint failed')) {
      throw new Error('Record already exists')
    }
    
    if (error.message?.includes('FOREIGN KEY constraint failed')) {
      throw new Error('Related record not found')
    }
    
    if (error.message?.includes('NOT NULL constraint failed')) {
      throw new Error('Required field missing')
    }
    
    throw new Error(`Database operation failed: ${operation}`)
  }

  // 分頁輔助函數
  protected createPagination(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit
    return { limit, offset }
  }

  // 生成訂單號碼
  protected generateOrderNumber(restaurantId: number): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 4)
    return `${restaurantId}-${timestamp}-${random}`.toUpperCase()
  }

  // 計算總金額
  protected calculateOrderTotal(
    subtotal: number,
    taxRate: number = 0,
    serviceChargeRate: number = 0,
    discountAmount: number = 0
  ) {
    const taxAmount = subtotal * taxRate
    const serviceCharge = subtotal * serviceChargeRate
    const totalAmount = subtotal + taxAmount + serviceCharge - discountAmount
    
    return {
      subtotal,
      taxAmount,
      serviceCharge,
      discountAmount,
      totalAmount
    }
  }
}