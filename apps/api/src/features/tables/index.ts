/**
 * Tables Feature Module
 * Complete table management functionality with QR code generation
 */

import { Hono } from 'hono'
import type { Env, FeatureModule } from '../../shared/types'
import { ConsoleLogger } from '../../core/monitoring'

// Import feature routes
import routes from './routes'

// Feature metadata
const FEATURE_NAME = 'tables'
const FEATURE_VERSION = '1.0.0'

// Feature module implementation
class TablesModule implements FeatureModule {
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
        tableManagement: true,
        qrCodeGeneration: true,
        tableOccupancy: true,
        bulkOperations: true,
        tableStatistics: true,
        cleaningManagement: true
      }
    }
  }

  // Feature configuration
  getFeatureInfo() {
    return {
      name: 'tables',
      version: '1.0.0',
      description: 'Table management feature with QR code generation and restaurant operations',
      routes: {
        base: '/tables',
        endpoints: [
          'GET /',
          'GET /:id',
          'POST /',
          'PUT /:id',
          'DELETE /:id',
          'POST /:id/occupy',
          'POST /:id/release',
          'POST /:id/clean',
          'POST /:id/regenerate-qr',
          'POST /bulk-qr',
          'GET /available',
          'GET /stats',
          'GET /qr/:qrCode'
        ]
      },
      permissions: {
        view: ['ADMIN', 'OWNER', 'CHEF', 'SERVICE', 'CASHIER'],
        create: ['ADMIN', 'OWNER'],
        update: ['ADMIN', 'OWNER'],
        delete: ['ADMIN', 'OWNER'],
        operate: ['ADMIN', 'OWNER', 'SERVICE', 'CASHIER'],
        clean: ['ADMIN', 'OWNER', 'SERVICE'],
        qr: ['ADMIN', 'OWNER']
      }
    }
  }
}

// Export the feature module class
export { TablesModule }

// Factory function for lazy initialization
let tablesModuleInstance: TablesModule | null = null
export function createTablesModule(): TablesModule {
  if (!tablesModuleInstance) {
    tablesModuleInstance = new TablesModule()
  }
  return tablesModuleInstance
}

// Export default for backward compatibility
export default {
  get routes() {
    return createTablesModule().routes
  },
  getHealthStatus: () => createTablesModule().getHealthStatus(),
  getFeatureInfo: () => createTablesModule().getFeatureInfo()
}

// Export services
export { TablesService } from './services/TablesService'

// Export schemas
export { tableSchemas } from './schemas/validation'
export type {
  CreateTableInput,
  UpdateTableInput,
  TableFilterInput,
  OccupyTableInput,
  CleanTableInput,
  RegenerateQRInput,
  BulkQRInput,
  AvailableTablesInput,
  TableStatsInput,
  QRCodeParamInput,
  IdParamInput
} from './schemas/validation'

// Export types
export type {
  Table,
  TableFeatures,
  CreateTableData,
  UpdateTableData,
  TableFilters,
  TableStats,
  TableListResult,
  ServiceResponse,
  QRRegenerateResult,
  BulkQRResult,
  QRCodeOptions,
  QRCodeResult,
  PaginationResult
} from './types'