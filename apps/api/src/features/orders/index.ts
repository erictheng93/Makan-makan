/**
 * Orders Feature Module
 * Complete order management functionality for the MakanMakan platform
 */

import { Hono } from 'hono'
import type { Env, FeatureModule } from '../../shared/types'
import { ConsoleLogger } from '../../core/monitoring'

// Import feature components
import routes from './routes'
import { OrdersService } from './services/OrdersService'
import type {
  IOrdersService,
  Order as OrderEntity,
  CreateOrderData,
  OrderQueryFilters as OrderManagementFilters,
  OrderStats as OrderStatistics,
  CouponPreviewRequest,
  CouponValidation as CouponPreviewResponse
} from './types'

// Feature metadata
const FEATURE_NAME = 'orders'
const FEATURE_VERSION = '1.0.0'

/**
 * Orders Feature Module Class
 * Implements comprehensive order management functionality
 */
class OrdersModule implements FeatureModule {
  public readonly name = FEATURE_NAME
  public readonly version = FEATURE_VERSION
  public readonly routes: Hono<{ Bindings: Env }>
  private ordersService?: OrdersService
  private logger: ConsoleLogger

  constructor() {
    this.logger = new ConsoleLogger(FEATURE_NAME)
    this.routes = new Hono<{ Bindings: Env }>()
    this.setupRoutes()
    this.setupMiddleware()

    this.logger.info(`${FEATURE_NAME} module initialized`, {
      version: FEATURE_VERSION,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Setup feature routes
   */
  private setupRoutes() {
    // Mount all order routes
    this.routes.route('/', routes)
    
    this.logger.debug('Orders routes mounted', {
      endpoints: [
        'POST /',
        'GET /',
        'GET /:id',
        'PUT /:id/status',
        'DELETE /:id',
        'GET /stats',
        'GET /analytics',
        'POST /bulk',
        'POST /export',
        'GET /:id/receipt',
        'GET /active',
        'POST /preview-coupon'
      ]
    })
  }

  /**
   * Setup feature-specific middleware
   */
  private setupMiddleware() {
    // Request logging middleware
    this.routes.use('*', async (c, next) => {
      const start = Date.now()
      const method = c.req.method
      const path = c.req.path
      const userAgent = c.req.header('User-Agent') || 'unknown'
      
      try {
        await next()
        const duration = Date.now() - start
        const status = c.res.status
        
        this.logger.info('Orders API request completed', {
          method,
          path,
          status,
          duration: `${duration}ms`,
          userAgent: userAgent.substring(0, 100) // Limit UA length
        })
      } catch (error) {
        const duration = Date.now() - start
        
        this.logger.error('Orders API request failed', error instanceof Error ? error : undefined, {
          method,
          path,
          duration: `${duration}ms`,
          userAgent: userAgent.substring(0, 100)
        })
        
        throw error
      }
    })

    // Performance monitoring middleware
    this.routes.use('*', async (c, next) => {
      const start = performance.now()
      
      await next()
      
      const duration = performance.now() - start
      
      // Log slow requests (> 1 second)
      if (duration > 1000) {
        this.logger.warn('Slow orders API request detected', {
          method: c.req.method,
          path: c.req.path,
          duration: `${duration.toFixed(2)}ms`
        })
      }
      
      // Add performance headers
      c.res.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`)
      c.res.headers.set('X-Feature-Module', FEATURE_NAME)
      c.res.headers.set('X-Feature-Version', FEATURE_VERSION)
    })

    // Error handling middleware
    this.routes.onError((error, c) => {
      this.logger.error('Unhandled error in orders feature', error instanceof Error ? error : undefined, {
        path: c.req.path,
        method: c.req.method,
        timestamp: new Date().toISOString()
      })

      // Return standardized error response
      return c.json({
        success: false,
        error: {
          message: error.message,
          code: 'ORDERS_FEATURE_ERROR',
          timestamp: new Date().toISOString(),
          path: c.req.path
        }
      }, 500)
    })
  }

  /**
   * Get or create OrdersService instance
   */
  getService(env: Env): IOrdersService {
    if (!this.ordersService) {
      this.ordersService = new OrdersService(env)
      this.logger.debug('OrdersService instance created')
    }
    return this.ordersService
  }

  /**
   * Health check for the orders feature
   */
  getHealthStatus(env?: Env) {
    const healthData = {
      name: this.name,
      version: this.version,
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
      features: {
        orderCreation: true,
        orderStatusManagement: true,
        orderFiltering: true,
        orderAnalytics: true,
        couponIntegration: true,
        bulkOperations: true,
        exportFunctionality: true,
        receiptGeneration: true,
        realTimeUpdates: true,
        permissionSystem: true
      },
      endpoints: {
        create: 'POST /',
        list: 'GET /',
        get: 'GET /:id',
        updateStatus: 'PUT /:id/status',
        cancel: 'DELETE /:id',
        statistics: 'GET /stats',
        analytics: 'GET /analytics',
        bulk: 'POST /bulk',
        export: 'POST /export',
        receipt: 'GET /:id/receipt',
        active: 'GET /active',
        previewCoupon: 'POST /preview-coupon'
      },
      dependencies: {
        database: env ? 'connected' : 'unknown',
        cache: env ? 'connected' : 'unknown',
        orderService: 'available',
        couponService: 'available'
      }
    }

    // Test service instantiation if env is provided
    if (env) {
      try {
        const service = this.getService(env)
        healthData.dependencies.orderService = service ? 'healthy' : 'unhealthy'
      } catch (error) {
        this.logger.error('Health check failed for OrdersService', error instanceof Error ? error : undefined, {})
        healthData.status = 'unhealthy' as 'healthy'
        healthData.dependencies.orderService = 'failed'
      }
    }

    return healthData
  }

  /**
   * Get feature statistics and metrics
   */
  async getFeatureMetrics(env: Env): Promise<{
    performance: any
    usage: any
    errors: any
  }> {
    try {
      const _service = this.getService(env)

      // This would typically gather metrics from monitoring services
      // For now, return basic structure
      return {
        performance: {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          requestsPerSecond: 0,
          errorRate: 0
        },
        usage: {
          totalOrders: 0,
          ordersToday: 0,
          activeOrders: 0,
          popularOrderTypes: [],
          topRestaurants: []
        },
        errors: {
          totalErrors: 0,
          errorsByType: {},
          recentErrors: []
        }
      }
    } catch (error) {
      this.logger.error('Failed to get feature metrics', error instanceof Error ? error : undefined, {})
      throw error
    }
  }

  /**
   * Validate feature configuration
   */
  validateConfiguration(env: Env): {
    valid: boolean
    issues: string[]
  } {
    const issues: string[] = []

    // Check required environment variables
    if (!env.DB) {
      issues.push('Database (DB) binding is required')
    }

    if (!env.CACHE_KV) {
      issues.push('Cache KV namespace is required')
    }

    // Check optional but recommended variables
    if (!env.API_BASE_URL) {
      this.logger.warn('API_BASE_URL not set, SSE broadcasting may not work')
    }

    if (!env.INTERNAL_API_TOKEN) {
      this.logger.warn('INTERNAL_API_TOKEN not set, internal API calls may fail')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Initialize feature with environment
   */
  async initialize(env: Env): Promise<void> {
    this.logger.info('Initializing orders feature', {
      environment: env.NODE_ENV || 'unknown'
    })

    // Validate configuration
    const validation = this.validateConfiguration(env)
    if (!validation.valid) {
      const errorMessage = `Orders feature configuration validation failed: ${validation.issues.join(', ')}`
      this.logger.error(errorMessage)
      throw new Error(errorMessage)
    }

    // Initialize service
    try {
      const service = this.getService(env)
      this.logger.info('Orders feature initialized successfully', {
        serviceReady: !!service,
        featuresEnabled: Object.keys(this.getHealthStatus(env).features).length
      })
    } catch (error) {
      this.logger.error('Failed to initialize orders feature', error instanceof Error ? error : undefined, {})
      throw error
    }
  }

  /**
   * Cleanup feature resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up orders feature resources')
    
    // Clear service instance
    this.ordersService = undefined
    
    this.logger.info('Orders feature cleanup completed')
  }
}

// Export the feature module class
export { OrdersModule }

// Factory function for lazy initialization
let ordersModuleInstance: OrdersModule | null = null
export function createOrdersModule(): OrdersModule {
  if (!ordersModuleInstance) {
    ordersModuleInstance = new OrdersModule()
  }
  return ordersModuleInstance
}

// Export default for backward compatibility
export default {
  get routes() {
    return createOrdersModule().routes
  },
  getHealthStatus: (env?: Env) => createOrdersModule().getHealthStatus(env),
  getFeatureMetrics: (env: Env) => createOrdersModule().getFeatureMetrics(env),
  validateConfiguration: (env: Env) => createOrdersModule().validateConfiguration(env),
  initialize: (env: Env) => createOrdersModule().initialize(env),
  cleanup: () => createOrdersModule().cleanup(),
  getService: (env: Env) => createOrdersModule().getService(env)
}

// Export types for external use
export type {
  IOrdersService,
  OrderEntity,
  CreateOrderData,
  OrderManagementFilters,
  OrderStatistics,
  CouponPreviewRequest,
  CouponPreviewResponse
}

// Export specific orders types
export type {
  Order,
  OrderStatus,
  OrderQueryFilters,
  OrderStats,
  CouponValidation
} from './types'

// Export service class for direct instantiation if needed
export { OrdersService }

// Export validation schemas
export { orderSchemas } from './schemas/validation'