/**
 * Multi-tenant Backup API Routes
 * Enhanced from RestaurentPOS with enterprise features
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { BackupService } from '../services/BackupService'
import type { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types'
// Define proper Hono context with backup service
type ContextVariableMap = {
  user: {
    id: string
    role: number
    restaurant_id?: string
  }
  backupService: BackupService
}

type Context = {
  Bindings: {
    DB: D1Database
    BACKUP_STORAGE: R2Bucket
    BACKUP_KV: KVNamespace
  }
  Variables: ContextVariableMap
}

const backup = new Hono<Context>()

// Validation schemas
const createBackupSchema = z.object({
  restaurant_id: z.string().uuid('Invalid restaurant ID'),
  configuration_id: z.string().uuid().optional(),
  name: z.string().min(1, 'Backup name is required').max(100),
  description: z.string().max(500).optional(),
  backup_type: z.enum(['full', 'incremental', 'differential']).default('full'),
  include_tables: z.array(z.string()).optional(),
  exclude_tables: z.array(z.string()).optional(),
  force_immediate: z.boolean().default(false)
})

const listBackupsSchema = z.object({
  restaurant_id: z.string().uuid('Invalid restaurant ID'),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']).optional(),
  backup_type: z.enum(['full', 'incremental', 'differential']).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort_by: z.enum(['created_at', 'file_size', 'duration']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
})

const restoreBackupSchema = z.object({
  restaurant_id: z.string().uuid('Invalid restaurant ID'),
  backup_id: z.string().uuid('Invalid backup ID'),
  restore_type: z.enum(['full', 'selective']),
  target_tables: z.array(z.string()).optional(),
  overwrite_existing: z.boolean().default(false),
  safety_confirmation: z.object({
    backup_integrity_verified: z.boolean(),
    data_loss_risk_acknowledged: z.boolean(),
    confirmation_phrase: z.literal('I understand the risks')
  })
})

const configurationSchema = z.object({
  restaurant_id: z.string().uuid('Invalid restaurant ID'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  backup_type: z.enum(['full', 'incremental', 'differential']).default('full'),
  schedule_enabled: z.boolean().default(false),
  schedule_cron: z.string().optional(),
  retention_days: z.number().min(1).max(365).default(30),
  include_tables: z.array(z.string()).optional(),
  exclude_tables: z.array(z.string()).optional(),
  compression_enabled: z.boolean().default(true),
  encryption_enabled: z.boolean().default(true),
  max_parallel_backups: z.number().min(1).max(10).default(3),
  notifications_enabled: z.boolean().default(true),
  notification_channels: z.array(z.string()).default(['email'])
})

// Middleware for backup service initialization
backup.use('*', async (c, next) => {
  const backupService = new BackupService(
    c.env.DB,
    c.env.BACKUP_STORAGE, // R2 Bucket
    c.env.BACKUP_KV // KV Namespace
  )
  c.set('backupService', backupService)
  await next()
})

// ============================================================================
// BACKUP OPERATIONS
// ============================================================================

/**
 * POST /api/backup/create
 * Create a new backup for a restaurant
 */
backup.post('/create', zValidator('json', createBackupSchema), async (c) => {
  try {
    const request = c.req.valid('json')
    const user = c.get('user')
    const backupService = c.get('backupService') as BackupService

    // Verify user has access to this restaurant
    await verifyRestaurantAccess(c, request.restaurant_id)

    const result = await backupService.createBackup(request, user.id.toString())

    return c.json({
      success: true,
      data: result
    }, 201)

  } catch (error) {
    console.error('Error creating backup:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to create backup'
    }, 400)
  }
})

/**
 * GET /api/backup/list
 * List backups for a restaurant with filtering and pagination
 */
backup.get('/list', zValidator('query', listBackupsSchema), async (c) => {
  try {
    const query = c.req.valid('query')
    const backupService = c.get('backupService') as BackupService

    // Verify user has access to this restaurant
    await verifyRestaurantAccess(c, query.restaurant_id)

    const result = await backupService.listBackups(query)

    return c.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error listing backups:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to list backups'
    }, 400)
  }
})

/**
 * GET /api/backup/:id
 * Get detailed information about a specific backup
 */
backup.get('/:id', async (c) => {
  try {
    const backupId = c.req.param('id')
    const backupService = c.get('backupService') as BackupService

    if (!isValidUUID(backupId)) {
      return c.json({
        success: false,
        error: 'Invalid backup ID'
      }, 400)
    }

    const backup = await backupService.getBackupById(backupId)
    if (!backup) {
      return c.json({
        success: false,
        error: 'Backup not found'
      }, 404)
    }

    // Verify user has access to this restaurant
    await verifyRestaurantAccess(c, backup.restaurant_id)

    return c.json({
      success: true,
      data: backup
    })

  } catch (error) {
    console.error('Error fetching backup:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to fetch backup'
    }, 400)
  }
})

/**
 * GET /api/backup/:id/download
 * Download a backup file
 */
backup.get('/:id/download', async (c) => {
  try {
    const backupId = c.req.param('id')
    const backupService = c.get('backupService') as BackupService

    if (!isValidUUID(backupId)) {
      return c.json({
        success: false,
        error: 'Invalid backup ID'
      }, 400)
    }

    const backup = await backupService.getBackupById(backupId)
    if (!backup) {
      return c.json({
        success: false,
        error: 'Backup not found'
      }, 404)
    }

    // Verify user has access to this restaurant
    await verifyRestaurantAccess(c, backup.restaurant_id)

    if (backup.status !== 'completed') {
      return c.json({
        success: false,
        error: 'Backup is not completed yet'
      }, 400)
    }

    // Get backup data from storage
    let backupData: string
    if (backup.storage_provider === 'r2') {
      const object = await c.env.BACKUP_STORAGE.get(backup.storage_path)
      if (!object) {
        return c.json({
          success: false,
          error: 'Backup file not found in storage'
        }, 404)
      }
      backupData = await object.text()
    } else if (backup.storage_provider === 'kv') {
      backupData = await c.env.BACKUP_KV.get(`backup:${backupId}`)
      if (!backupData) {
        return c.json({
          success: false,
          error: 'Backup file not found in storage'
        }, 404)
      }
    } else {
      return c.json({
        success: false,
        error: 'Unsupported storage provider'
      }, 400)
    }

    // Return as downloadable file
    const fileName = `${backup.name}_${backup.started_at.replace(/[:.]/g, '-')}.json`

    return new Response(backupData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': backupData.length.toString(),
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Error downloading backup:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to download backup'
    }, 500)
  }
})

/**
 * POST /api/backup/:id/restore
 * Restore from a backup
 */
backup.post('/:id/restore', zValidator('json', restoreBackupSchema), async (c) => {
  try {
    const backupId = c.req.param('id')
    const request = c.req.valid('json')
    const user = c.get('user')
    const backupService = c.get('backupService') as BackupService

    if (!isValidUUID(backupId)) {
      return c.json({
        success: false,
        error: 'Invalid backup ID'
      }, 400)
    }

    // Verify user has access to this restaurant
    await verifyRestaurantAccess(c, request.restaurant_id)

    // Ensure backup_id matches URL parameter
    request.backup_id = backupId

    const restoreId = await backupService.restoreFromBackup(request, user.id.toString())

    return c.json({
      success: true,
      data: {
        restore_id: restoreId,
        message: 'Restore operation initiated successfully'
      }
    }, 201)

  } catch (error) {
    console.error('Error initiating restore:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to initiate restore'
    }, 400)
  }
})

/**
 * DELETE /api/backup/:id
 * Delete a backup
 */
backup.delete('/:id', async (c) => {
  try {
    const backupId = c.req.param('id')
    const backupService = c.get('backupService') as BackupService
    const user = c.get('user')

    if (!isValidUUID(backupId)) {
      return c.json({
        success: false,
        error: 'Invalid backup ID'
      }, 400)
    }

    const backup = await backupService.getBackupById(backupId)
    if (!backup) {
      return c.json({
        success: false,
        error: 'Backup not found'
      }, 404)
    }

    // Verify user has access to this restaurant
    await verifyRestaurantAccess(c, backup.restaurant_id)

    await backupService.deleteBackup(backupId, user.id.toString())

    return c.json({
      success: true,
      message: 'Backup deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting backup:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to delete backup'
    }, 400)
  }
})

// ============================================================================
// BACKUP CONFIGURATIONS
// ============================================================================

/**
 * GET /api/backup/configurations/:restaurant_id
 * Get backup configurations for a restaurant
 */
backup.get('/configurations/:restaurant_id', async (c) => {
  try {
    const restaurantId = c.req.param('restaurant_id')
    const backupService = c.get('backupService') as BackupService

    if (!isValidUUID(restaurantId)) {
      return c.json({
        success: false,
        error: 'Invalid restaurant ID'
      }, 400)
    }

    // Verify user has access to this restaurant
    await verifyRestaurantAccess(c, restaurantId)

    const configurations = await backupService.getBackupConfigurations(restaurantId)

    return c.json({
      success: true,
      data: configurations
    })

  } catch (error) {
    console.error('Error fetching backup configurations:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to fetch backup configurations'
    }, 400)
  }
})

/**
 * POST /api/backup/configurations
 * Create or update backup configuration
 */
backup.post('/configurations', zValidator('json', configurationSchema), async (c) => {
  try {
    const config = c.req.valid('json')
    const user = c.get('user')
    const backupService = c.get('backupService') as BackupService

    // Verify user has access to this restaurant
    await verifyRestaurantAccess(c, config.restaurant_id)

    const result = await backupService.createOrUpdateConfiguration(config, user.id.toString())

    return c.json({
      success: true,
      data: result,
      message: 'Backup configuration saved successfully'
    }, 201)

  } catch (error) {
    console.error('Error saving backup configuration:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to save backup configuration'
    }, 400)
  }
})

// ============================================================================
// SYSTEM MONITORING
// ============================================================================

/**
 * GET /api/backup/system/health
 * Get overall backup system health
 */
backup.get('/system/health', async (c) => {
  try {
    const user = c.get('user')
    const backupService = c.get('backupService') as BackupService

    // Check if user has admin privileges (role 0 = admin)
    if (user.role !== 0) {
      return c.json({
        success: false,
        error: 'Admin access required'
      }, 403)
    }

    const health = await backupService.getSystemHealth()

    return c.json({
      success: true,
      data: health
    })

  } catch (error) {
    console.error('Error fetching system health:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to fetch system health'
    }, 500)
  }
})

/**
 * GET /api/backup/restaurants/:restaurant_id/metrics
 * Get backup metrics for a specific restaurant
 */
backup.get('/restaurants/:restaurant_id/metrics', async (c) => {
  try {
    const restaurantId = c.req.param('restaurant_id')
    const period = c.req.query('period') || 'week'
    const backupService = c.get('backupService') as BackupService

    if (!isValidUUID(restaurantId)) {
      return c.json({
        success: false,
        error: 'Invalid restaurant ID'
      }, 400)
    }

    // Verify user has access to this restaurant
    await verifyRestaurantAccess(c, restaurantId)

    const metrics = await backupService.getRestaurantMetrics(restaurantId, period as any)

    return c.json({
      success: true,
      data: metrics
    })

  } catch (error) {
    console.error('Error fetching restaurant metrics:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to fetch restaurant metrics'
    }, 400)
  }
})

/**
 * GET /api/backup/alerts/:restaurant_id
 * Get alerts for a restaurant
 */
backup.get('/alerts/:restaurant_id', async (c) => {
  try {
    const restaurantId = c.req.param('restaurant_id')
    const unresolved_only = c.req.query('unresolved_only') === 'true'
    const backupService = c.get('backupService') as BackupService

    if (!isValidUUID(restaurantId)) {
      return c.json({
        success: false,
        error: 'Invalid restaurant ID'
      }, 400)
    }

    // Verify user has access to this restaurant
    await verifyRestaurantAccess(c, restaurantId)

    const alerts = await backupService.getRestaurantAlerts(restaurantId, unresolved_only)

    return c.json({
      success: true,
      data: alerts
    })

  } catch (error) {
    console.error('Error fetching alerts:', error as Error)
    return c.json({
      success: false,
      error: (error as Error).message || 'Failed to fetch alerts'
    }, 400)
  }
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function verifyRestaurantAccess(c: any, restaurantId: string): Promise<void> {
  const user = c.get('user')

  // Admin users (role 0) have access to all restaurants
  if (user.role === 0) {
    return
  }

  // Check if user belongs to this restaurant
  const result = await c.env.DB.prepare(`
    SELECT 1 FROM restaurant_users
    WHERE user_id = ? AND restaurant_id = ?
  `).bind(user.id, restaurantId).first()

  if (!result) {
    throw new Error('Access denied: You do not have permission to access this restaurant')
  }
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export { backup }