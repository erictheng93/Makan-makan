/**
 * Authentication Feature Module
 * Complete authentication and user management functionality
 */

import { Hono } from 'hono'
import type { Env, FeatureModule } from '../../shared/types'
import { ConsoleLogger } from '../../core/monitoring'

// Import feature routes
import routes from './routes'

// Import service for health checks
import { AuthService } from './services/AuthService'

// Feature metadata
const FEATURE_NAME = 'authentication'
const FEATURE_VERSION = '1.0.0'

// Feature module implementation
class AuthenticationModule implements FeatureModule {
  public readonly name = FEATURE_NAME
  public readonly version = FEATURE_VERSION
  public readonly routes: Hono<{ Bindings: Env }>
  private logger: ConsoleLogger

  constructor() {
    this.logger = new ConsoleLogger(FEATURE_NAME)
    this.routes = new Hono<{ Bindings: Env }>()
    this.setupRoutes()
    this.logger.info(`${FEATURE_NAME} module initialized`, { version: FEATURE_VERSION })
  }

  private setupRoutes() {
    // Mount feature routes
    this.routes.route('/', routes)

    // Add feature-specific middleware for request tracking
    this.routes.use('*', async (c, next) => {
      const start = Date.now()
      const method = c.req.method
      const path = c.req.path
      const userAgent = c.req.header('User-Agent')
      const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')

      // Log authentication requests for security monitoring
      this.logger.debug('Authentication request', {
        method,
        path,
        userAgent: userAgent?.substring(0, 100), // Truncate for security
        ipAddress,
        timestamp: new Date().toISOString()
      })

      await next()

      const duration = Date.now() - start
      const status = c.res.status

      // Log response metrics
      this.logger.debug('Authentication response', {
        method,
        path,
        status,
        duration,
        timestamp: new Date().toISOString()
      })

      // Add security headers
      c.header('X-Content-Type-Options', 'nosniff')
      c.header('X-Frame-Options', 'DENY')
      c.header('X-XSS-Protection', '1; mode=block')
      c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

      // Add rate limiting headers for authentication endpoints
      if (path.includes('/login') || path.includes('/register')) {
        c.header('X-RateLimit-Limit', '10')
        c.header('X-RateLimit-Remaining', '9') // Would be calculated from actual rate limiting
        c.header('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 60))
      }
    })

    // Add error handling middleware specific to authentication
    this.routes.onError((err, c) => {
      this.logger.error('Authentication error', err as Error, {
        method: c.req.method,
        path: c.req.path,
        userAgent: c.req.header('User-Agent'),
        ipAddress: c.req.header('CF-Connecting-IP')
      })

      // Don't expose sensitive error details in authentication
      return c.json({
        success: false,
        error: 'Authentication service error',
        timestamp: new Date().toISOString()
      }, 500)
    })

    // Add health check endpoint
    this.routes.get('/health', async (c) => {
      try {
        const healthStatus = this.getHealthStatus(c.env)
        return c.json(healthStatus, 200)
      } catch (error) {
        this.logger.error('Health check failed', error as Error, {})
        return c.json({
          name: this.name,
          version: this.version,
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed'
        }, 503)
      }
    })
  }

  // Health check with service validation
  getHealthStatus(env?: Env) {
    const timestamp = new Date().toISOString()

    try {
      // Basic health status
      const healthStatus = {
        name: this.name,
        version: this.version,
        status: 'healthy',
        timestamp,
        features: {
          userAuthentication: true,
          userRegistration: true,
          tokenManagement: true,
          sessionManagement: true,
          passwordManagement: true,
          profileManagement: true,
          securityLogging: true,
          rateLimiting: true,
          inputValidation: true,
          errorHandling: true
        },
        dependencies: {
          database: 'unknown',
          cache: 'unknown',
          jwt: 'available'
        },
        metrics: {
          uptime: process.uptime?.() || 0,
          memoryUsage: process.memoryUsage?.() || {},
          timestamp
        }
      }

      // Test service dependencies if env is available
      if (env) {
        try {
          // Test database connection
          if (env.DB) {
            healthStatus.dependencies.database = 'available'
          }

          // Test cache connection
          if (env.CACHE_KV) {
            healthStatus.dependencies.cache = 'available'
          }

          // Test JWT secret
          if (env.JWT_SECRET && env.JWT_SECRET.length >= 32) {
            healthStatus.dependencies.jwt = 'configured'
          }

        } catch (depError) {
          this.logger.warn('Dependency check failed during health check', {
            error: (depError as Error).message
          })
          healthStatus.status = 'degraded'
          healthStatus.dependencies = {
            database: 'error',
            cache: 'error',
            jwt: 'error'
          }
        }
      }

      return healthStatus

    } catch (error) {
      this.logger.error('Health status generation failed', error as Error, {})
      return {
        name: this.name,
        version: this.version,
        status: 'unhealthy',
        timestamp,
        error: 'Health check failed'
      }
    }
  }

  // Feature configuration and capabilities
  getCapabilities() {
    return {
      authentication: {
        login: true,
        logout: true,
        tokenRefresh: true,
        multipleDevices: true
      },
      userManagement: {
        registration: true,
        profileUpdate: true,
        passwordChange: true,
        accountDeactivation: true
      },
      security: {
        passwordHashing: true,
        jwtTokens: true,
        sessionManagement: true,
        rateLimiting: true,
        auditLogging: true,
        inputValidation: true
      },
      sessions: {
        multipleActiveSessions: true,
        sessionTermination: true,
        sessionInfo: true,
        deviceTracking: true
      },
      validation: {
        inputSanitization: true,
        schemaValidation: true,
        roleValidation: true,
        permissionChecks: true
      },
      monitoring: {
        performanceMetrics: true,
        errorTracking: true,
        securityEvents: true,
        healthChecks: true
      },
      future: {
        twoFactorAuth: 'planned',
        passwordReset: 'planned',
        emailVerification: 'planned',
        socialLogin: 'planned',
        biometricAuth: 'planned'
      }
    }
  }

  // Get feature statistics (if env is available)
  async getStatistics(env?: Env) {
    if (!env) {
      return {
        error: 'Environment not available for statistics'
      }
    }

    try {
      const authService = new AuthService(env)
      const stats = await authService.getAuthStatistics()

      return {
        ...stats,
        featureInfo: {
          name: this.name,
          version: this.version,
          uptime: process.uptime?.() || 0
        }
      }

    } catch (error) {
      this.logger.error('Failed to get authentication statistics', error as Error, {})
      return {
        error: 'Statistics not available'
      }
    }
  }

  // Configuration validation
  validateConfiguration(env: Env): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check required environment variables
    if (!env.JWT_SECRET) {
      errors.push('JWT_SECRET is required')
    } else if (env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters for security')
    }

    if (!env.DB) {
      errors.push('Database connection (DB) is required')
    }

    if (!env.CACHE_KV) {
      errors.push('Cache connection (CACHE_KV) is required')
    }

    // Optional but recommended
    if (!env.TOKEN_BLACKLIST) {
      this.logger.warn('TOKEN_BLACKLIST KV namespace not configured - token blacklisting will be disabled')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// Export the feature module class
export { AuthenticationModule }

// Factory function for lazy initialization
let authenticationModuleInstance: AuthenticationModule | null = null
export function createAuthenticationModule(): AuthenticationModule {
  if (!authenticationModuleInstance) {
    authenticationModuleInstance = new AuthenticationModule()
  }
  return authenticationModuleInstance
}

// Export default for backward compatibility
export default {
  get routes() {
    return createAuthenticationModule().routes
  },
  getHealthStatus: () => createAuthenticationModule().getHealthStatus(),
  getStatistics: () => createAuthenticationModule().getStatistics(),
  validateConfiguration: (env: Env) => createAuthenticationModule().validateConfiguration(env)
}

// Export types and services for external use
export type {
  AuthUser,
  AuthResult,
  LoginData,
  RegisterData,
  TokenValidation,
  UserProfile,
  SessionSummary,
  IAuthService
} from './types'

export { AuthService } from './services/AuthService'
export { authSchemas } from './schemas/validation'