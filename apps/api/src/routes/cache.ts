/**
 * 快取管理 API
 * 提供快取統計、監控和管理功能
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateBody } from '../middleware/validation'
import { createCacheService, CACHE_STRATEGIES } from '../services/CacheService'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const invalidateTagsSchema = z.object({
  tags: z.array(z.string()).min(1).max(10),
  reason: z.string().max(200).optional()
})

const warmupSchema = z.object({
  keys: z.array(z.object({
    key: z.string(),
    strategy: z.enum(['MENU', 'RESTAURANT', 'ANALYTICS', 'SESSION', 'TABLE', 'QR_CODE'])
  })).min(1).max(50)
})

const cleanupSchema = z.object({
  maxAge: z.number().int().positive().max(86400).optional().default(3600), // 1小時默認
  dryRun: z.boolean().optional().default(false)
})

// 獲取快取統計（管理員專用）
app.get('/stats',
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    try {
      const cacheService = createCacheService(c.env.CACHE_KV)
      const stats = await cacheService.getStats()
      
      // 獲取更多詳細信息
      const expiringKeys = await cacheService.getExpiringKeys(30) // 30分鐘內過期
      
      const detailedStats = {
        ...stats,
        expiringIn30Min: expiringKeys.length,
        expiringKeys: expiringKeys.slice(0, 10), // 只返回前10個
        hitRatePercentage: (stats.averageHitRate * 100).toFixed(2),
        totalSizeMB: (stats.totalSize / 1024 / 1024).toFixed(2),
        strategies: Object.keys(CACHE_STRATEGIES),
        timestamp: Date.now()
      }

      return c.json({
        success: true,
        data: detailedStats
      })
    } catch (error) {
      console.error('Get cache stats error:', error)
      return c.json({
        success: false,
        error: 'Failed to retrieve cache statistics'
      }, 500)
    }
  }
)

// 獲取快取健康狀況
app.get('/health',
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    try {
      const cacheService = createCacheService(c.env.CACHE_KV)
      const stats = await cacheService.getStats()
      const expiringKeys = await cacheService.getExpiringKeys(5) // 5分鐘內過期
      
      // 評估快取健康狀況
      const health = {
        status: 'healthy' as 'healthy' | 'warning' | 'critical',
        issues: [] as string[],
        recommendations: [] as string[],
        metrics: {
          hitRate: stats.averageHitRate,
          totalKeys: stats.totalKeys,
          totalSize: stats.totalSize,
          expiringKeysCount: expiringKeys.length
        }
      }

      // 檢查命中率
      if (stats.averageHitRate < 0.3) {
        health.status = 'critical'
        health.issues.push('Very low cache hit rate (< 30%)')
        health.recommendations.push('Review caching strategies and increase TTL for frequently accessed data')
      } else if (stats.averageHitRate < 0.6) {
        health.status = 'warning'
        health.issues.push('Low cache hit rate (< 60%)')
        health.recommendations.push('Consider optimizing cache keys and strategies')
      }

      // 檢查即將過期的鍵
      if (expiringKeys.length > 100) {
        health.status = health.status === 'critical' ? 'critical' : 'warning'
        health.issues.push(`Many keys expiring soon (${expiringKeys.length})`)
        health.recommendations.push('Consider implementing cache warming for critical data')
      }

      // 檢查快取大小
      const sizeMB = stats.totalSize / 1024 / 1024
      if (sizeMB > 500) { // 500MB 警告
        health.status = health.status === 'critical' ? 'critical' : 'warning'
        health.issues.push('Large cache size detected')
        health.recommendations.push('Consider implementing cache cleanup policies')
      }

      return c.json({
        success: true,
        data: health
      })
    } catch (error) {
      console.error('Cache health check error:', error)
      return c.json({
        success: false,
        error: 'Failed to check cache health'
      }, 500)
    }
  }
)

// 根據標籤失效快取
app.post('/invalidate',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateBody(invalidateTagsSchema),
  async (c) => {
    try {
      const { tags, reason } = c.get('validatedBody')
      const cacheService = createCacheService(c.env.CACHE_KV)
      
      const invalidatedCount = await cacheService.invalidateByTags(tags)
      
      // 記錄操作日誌
      console.log(`Manual cache invalidation: ${invalidatedCount} keys invalidated for tags: ${tags.join(', ')}${reason ? ` (Reason: ${reason})` : ''}`)
      
      return c.json({
        success: true,
        data: {
          invalidatedCount,
          tags,
          reason,
          timestamp: Date.now()
        }
      })
    } catch (error) {
      console.error('Cache invalidation error:', error)
      return c.json({
        success: false,
        error: 'Failed to invalidate cache'
      }, 500)
    }
  }
)

// 清理過期快取
app.post('/cleanup',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateBody(cleanupSchema),
  async (c) => {
    try {
      const { maxAge, dryRun } = c.get('validatedBody')
      const cacheService = createCacheService(c.env.CACHE_KV)
      
      if (dryRun) {
        // 乾運行：只檢查會被清理的項目
        const expiringKeys = await cacheService.getExpiringKeys(maxAge / 60)
        
        return c.json({
          success: true,
          data: {
            dryRun: true,
            wouldCleanCount: expiringKeys.length,
            previewKeys: expiringKeys.slice(0, 20),
            maxAge,
            timestamp: Date.now()
          }
        })
      }
      
      const cleanedCount = await cacheService.cleanup()
      
      console.log(`Cache cleanup completed: ${cleanedCount} expired keys removed`)
      
      return c.json({
        success: true,
        data: {
          cleanedCount,
          maxAge,
          timestamp: Date.now()
        }
      })
    } catch (error) {
      console.error('Cache cleanup error:', error)
      return c.json({
        success: false,
        error: 'Failed to cleanup cache'
      }, 500)
    }
  }
)

// 快取預熱
app.post('/warmup',
  authMiddleware,
  requireRole([0]), // 僅管理員
  validateBody(warmupSchema),
  async (c) => {
    try {
      const { keys } = c.get('validatedBody')
      const cacheService = createCacheService(c.env.CACHE_KV)
      
      // 轉換鍵配置為預熱數據
      const warmupData = keys.map(({ key, strategy }: { key: string; strategy: keyof typeof CACHE_STRATEGIES }) => ({
        key,
        value: { prewarmed: true, timestamp: Date.now() }, // 預設值，實際應用中應該從數據庫獲取真實數據
        config: CACHE_STRATEGIES[strategy as keyof typeof CACHE_STRATEGIES]
      }))
      
      const successCount = await cacheService.warmup(warmupData)
      
      console.log(`Cache warmup completed: ${successCount}/${keys.length} keys warmed`)
      
      return c.json({
        success: true,
        data: {
          requestedCount: keys.length,
          successCount,
          failedCount: keys.length - successCount,
          timestamp: Date.now()
        }
      })
    } catch (error) {
      console.error('Cache warmup error:', error)
      return c.json({
        success: false,
        error: 'Failed to warmup cache'
      }, 500)
    }
  }
)

// 重置快取統計
app.delete('/stats',
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    try {
      const cacheService = createCacheService(c.env.CACHE_KV)
      await cacheService.resetStats()
      
      console.log('Cache statistics reset by admin')
      
      return c.json({
        success: true,
        data: {
          message: 'Cache statistics reset successfully',
          timestamp: Date.now()
        }
      })
    } catch (error) {
      console.error('Reset cache stats error:', error)
      return c.json({
        success: false,
        error: 'Failed to reset cache statistics'
      }, 500)
    }
  }
)

// 獲取快取配置信息
app.get('/config',
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    try {
      const configInfo = {
        strategies: Object.entries(CACHE_STRATEGIES).map(([name, config]) => ({
          name,
          ttl: config.ttl,
          ttlMinutes: Math.floor(config.ttl / 60),
          tags: config.tags,
          priority: config.priority,
          staleWhileRevalidate: 'staleWhileRevalidate' in config ? config.staleWhileRevalidate : undefined
        })),
        totalStrategies: Object.keys(CACHE_STRATEGIES).length,
        timestamp: Date.now()
      }
      
      return c.json({
        success: true,
        data: configInfo
      })
    } catch (error) {
      console.error('Get cache config error:', error)
      return c.json({
        success: false,
        error: 'Failed to retrieve cache configuration'
      }, 500)
    }
  }
)

// 測試快取功能
app.post('/test',
  authMiddleware,
  requireRole([0]), // 僅管理員
  async (c) => {
    try {
      const cacheService = createCacheService(c.env.CACHE_KV)
      const testKey = `test:${Date.now()}`
      const testData = { 
        message: 'Cache test', 
        timestamp: Date.now(),
        randomValue: Math.random()
      }
      
      // 設置測試數據
      await cacheService.set(testKey, testData, {
        ttl: 60, // 1分鐘
        tags: ['test'],
        priority: 'normal'
      })
      
      // 立即讀取測試
      const retrieved = await cacheService.get(testKey)
      
      // 清理測試數據
      await cacheService.delete(testKey)
      
      const testResult = {
        setSuccess: true,
        getSuccess: retrieved !== null,
        dataIntegrity: JSON.stringify(retrieved) === JSON.stringify(testData),
        deleteSuccess: true,
        testKey,
        timestamp: Date.now()
      }
      
      return c.json({
        success: true,
        data: testResult
      })
    } catch (error) {
      console.error('Cache test error:', error)
      return c.json({
        success: false,
        error: 'Cache test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500)
    }
  }
)

export default app