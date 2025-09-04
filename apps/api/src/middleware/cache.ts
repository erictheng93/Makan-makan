/**
 * 快取中間件
 * 提供路由級別的快取裝飾器和自動快取管理
 */

import { Context, Next } from 'hono'
import { createCacheService, CacheConfig, CACHE_STRATEGIES, CacheKeys } from '../services/CacheService'
import type { Env } from '../types/env'

// 快取中間件選項
export interface CacheMiddlewareOptions {
  strategy?: keyof typeof CACHE_STRATEGIES
  keyGenerator?: (c: Context) => string
  condition?: (c: Context) => boolean
  skipOnError?: boolean
  customConfig?: CacheConfig
}

// 快取響應接口
interface CachedResponse {
  data: unknown
  status: number
  headers: Record<string, string>
  timestamp: number
}

/**
 * 快取中間件工廠
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const cacheService = createCacheService(c.env.CACHE_KV)
    
    // 檢查快取條件
    if (options.condition && !options.condition(c)) {
      return await next()
    }

    // 生成快取鍵
    const cacheKey = options.keyGenerator 
      ? options.keyGenerator(c)
      : generateDefaultCacheKey(c)

    // 嘗試從快取獲取
    try {
      const cached = await cacheService.get<CachedResponse>(cacheKey)
      
      if (cached && cached.data) {
        // 設置響應頭
        Object.entries(cached.headers).forEach(([key, value]) => {
          c.header(key, value)
        })
        
        // 添加快取命中標識
        c.header('X-Cache', 'HIT')
        c.header('X-Cache-Timestamp', cached.timestamp.toString())
        
        return c.json(cached.data, cached.status as any)
      }
    } catch (error) {
      console.error('Cache middleware get error:', error)
      if (!options.skipOnError) {
        throw error
      }
    }

    // 快取未命中，執行路由處理
    await next()

    // 快取響應（只快取成功的響應）
    try {
      const response = c.res.clone()
      
      if (response.status >= 200 && response.status < 300) {
        const responseData = await response.json()
        
        const cachedResponse: CachedResponse = {
          data: responseData,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          timestamp: Date.now()
        }

        // 獲取快取配置
        const config = getCacheConfig(options)
        
        await cacheService.set(cacheKey, cachedResponse, config)
        
        // 添加快取未命中標識
        c.header('X-Cache', 'MISS')
      }
    } catch (error) {
      console.error('Cache middleware set error:', error)
      if (!options.skipOnError) {
        throw error
      }
    }
  }
}

/**
 * 自動快取失效中間件
 */
export function cacheInvalidationMiddleware(tags: string[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    await next()

    // 只在成功的寫操作後失效快取
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(c.req.method) && 
        c.res.status >= 200 && c.res.status < 300) {
      
      try {
        const cacheService = createCacheService(c.env.CACHE_KV)
        const invalidatedCount = await cacheService.invalidateByTags(tags)
        
        // 記錄失效操作
        console.log(`Cache invalidated: ${invalidatedCount} keys for tags: ${tags.join(', ')}`)
        
        // 添加響應頭
        c.header('X-Cache-Invalidated', invalidatedCount.toString())
        c.header('X-Cache-Tags', tags.join(','))
        
      } catch (error) {
        console.error('Cache invalidation error:', error)
      }
    }
  }
}

/**
 * 快取預熱中間件（用於應用啟動）
 */
export function cacheWarmupMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const cacheService = createCacheService(c.env.CACHE_KV)
    
    try {
      // 獲取需要預熱的數據
      const warmupData = await getWarmupData(c)
      
      if (warmupData.length > 0) {
        const successCount = await cacheService.warmup(warmupData)
        console.log(`Cache warmup completed: ${successCount}/${warmupData.length} keys`)
        
        c.header('X-Cache-Warmed', successCount.toString())
      }
      
    } catch (error) {
      console.error('Cache warmup error:', error)
    }
    
    await next()
  }
}

/**
 * 快取健康檢查中間件
 */
export function cacheHealthMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const cacheService = createCacheService(c.env.CACHE_KV)
    
    try {
      const stats = await cacheService.getStats()
      const expiringKeys = await cacheService.getExpiringKeys(10) // 10分鐘內過期的鍵
      
      // 如果快取健康狀況不佳，記錄警告
      if (stats.averageHitRate < 0.5) {
        console.warn(`Low cache hit rate: ${(stats.averageHitRate * 100).toFixed(2)}%`)
      }
      
      if (expiringKeys.length > 50) {
        console.warn(`Many keys expiring soon: ${expiringKeys.length}`)
      }
      
      // 添加快取健康信息到響應頭
      c.header('X-Cache-Hit-Rate', (stats.averageHitRate * 100).toFixed(2))
      c.header('X-Cache-Keys-Count', stats.totalKeys.toString())
      
    } catch (error) {
      console.error('Cache health check error:', error)
    }
    
    await next()
  }
}

// 輔助函數

/**
 * 生成默認快取鍵
 */
function generateDefaultCacheKey(c: Context): string {
  const url = new URL(c.req.url)
  const method = c.req.method
  const path = url.pathname
  const query = url.search
  
  return `route:${method}:${path}${query}`
}

/**
 * 獲取快取配置
 */
function getCacheConfig(options: CacheMiddlewareOptions): CacheConfig {
  if (options.customConfig) {
    return options.customConfig
  }
  
  if (options.strategy && CACHE_STRATEGIES[options.strategy]) {
    return CACHE_STRATEGIES[options.strategy]
  }
  
  // 默認快取配置
  return {
    ttl: 300, // 5分鐘
    tags: ['default'],
    priority: 'normal'
  }
}

/**
 * 獲取預熱數據
 */
async function getWarmupData(_c: Context<{ Bindings: Env }>): Promise<Array<{ key: string; value: unknown; config: CacheConfig }>> {
  const warmupData: Array<{ key: string; value: unknown; config: CacheConfig }> = []
  
  try {
    // 這裡可以根據業務需求添加預熱邏輯
    // 例如：預熱熱門餐廳的菜單、常用的分析數據等
    
    // 示例：預熱系統健康狀態
    warmupData.push({
      key: CacheKeys.analytics(0, 'system_health'),
      value: { status: 'healthy', timestamp: Date.now() },
      config: CACHE_STRATEGIES.ANALYTICS
    })
    
  } catch (error) {
    console.error('Generate warmup data error:', error)
  }
  
  return warmupData
}

// 快取裝飾器助手

/**
 * 菜單快取裝飾器
 */
export const menuCache = (keyGenerator?: (c: Context) => string) => 
  cacheMiddleware({
    strategy: 'MENU',
    keyGenerator: keyGenerator || ((c) => {
      const restaurantId = c.req.param('restaurantId')
      return CacheKeys.menu(parseInt(restaurantId))
    }),
    condition: (c) => c.req.method === 'GET'
  })

/**
 * 餐廳快取裝飾器
 */
export const restaurantCache = (keyGenerator?: (c: Context) => string) =>
  cacheMiddleware({
    strategy: 'RESTAURANT',
    keyGenerator: keyGenerator || ((c) => {
      const id = c.req.param('id') || c.req.param('restaurantId')
      return CacheKeys.restaurant(parseInt(id))
    }),
    condition: (c) => c.req.method === 'GET'
  })

/**
 * 分析數據快取裝飾器
 */
export const analyticsCache = (period: string = 'daily') =>
  cacheMiddleware({
    strategy: 'ANALYTICS',
    keyGenerator: (c) => {
      const restaurantId = c.req.param('restaurantId')
      return CacheKeys.analytics(parseInt(restaurantId), period)
    },
    condition: (c) => c.req.method === 'GET'
  })

/**
 * 桌台快取裝飾器
 */
export const tableCache = () =>
  cacheMiddleware({
    strategy: 'TABLE',
    keyGenerator: (c) => {
      const restaurantId = c.req.param('restaurantId')
      const tableId = c.req.param('tableId')
      return CacheKeys.table(parseInt(restaurantId), parseInt(tableId))
    },
    condition: (c) => c.req.method === 'GET'
  })

// 快取失效裝飾器

/**
 * 菜單失效裝飾器
 */
export const invalidateMenuCache = cacheInvalidationMiddleware(['menu'])

/**
 * 餐廳失效裝飾器  
 */
export const invalidateRestaurantCache = cacheInvalidationMiddleware(['restaurant'])

/**
 * 分析數據失效裝飾器
 */
export const invalidateAnalyticsCache = cacheInvalidationMiddleware(['analytics'])

/**
 * 桌台失效裝飾器
 */
export const invalidateTableCache = cacheInvalidationMiddleware(['table'])