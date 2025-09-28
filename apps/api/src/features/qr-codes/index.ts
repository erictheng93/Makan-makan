/**
 * QR Codes Feature Module
 * Complete QR code generation and management functionality
 */

import { Hono } from 'hono'
import type { Env, FeatureModule } from '../../shared/types'
import { ConsoleLogger } from '../../core/monitoring'

// Import feature routes
import routes from './routes'

// Feature metadata
const FEATURE_NAME = 'qr-codes'
const FEATURE_VERSION = '1.0.0'

// Feature module implementation
class QrCodesModule implements FeatureModule {
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

    // Feature-specific middleware can be added here
    this.routes.use('*', async (c, next) => {
      const start = Date.now()
      await next()
      const duration = Date.now() - start
      this.logger.debug(`${c.req.method} ${c.req.path} - ${duration}ms`)
    })
  }

  // Health check endpoint
  getHealthStatus() {
    return {
      name: this.name,
      version: this.version,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      features: {
        qrGeneration: true,
        bulkGeneration: true,
        templateManagement: true,
        downloadSupport: true,
        statisticsTracking: true
      }
    }
  }
}

// Export the feature module class
export { QrCodesModule }

// Factory function for lazy initialization
let qrCodesModuleInstance: QrCodesModule | null = null
export function createQrCodesModule(): QrCodesModule {
  if (!qrCodesModuleInstance) {
    qrCodesModuleInstance = new QrCodesModule()
  }
  return qrCodesModuleInstance
}

// Export default for backward compatibility
export default {
  get routes() {
    return createQrCodesModule().routes
  },
  getHealthStatus: () => createQrCodesModule().getHealthStatus()
}