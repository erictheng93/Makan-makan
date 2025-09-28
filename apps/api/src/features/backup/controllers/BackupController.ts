/**
 * Backup Controller - Handles HTTP requests for backup operations
 * Part of modular backup architecture
 */

import { Context } from 'hono'
import { BackupService } from '../services/BackupService'
import { BackupConfigService } from '../services/BackupConfigService'
import { BackupValidationService } from '../services/BackupValidationService'
import type {
  CreateBackupRequest,
  ListBackupsQuery,
  RestoreBackupRequest,
  BackupConfiguration
} from '@makanmakan/shared-types'

export class BackupController {
  constructor(
    private backupService: BackupService,
    private configService: BackupConfigService,
    private validationService: BackupValidationService
  ) {}

  /**
   * Create a new backup
   */
  async createBackup(c: Context): Promise<Response> {
    try {
      const request = await c.req.json() as CreateBackupRequest
      const user = c.get('user')

      // Validate request
      await this.validationService.validateCreateBackupRequest(request)

      // Verify restaurant access
      await this.validationService.verifyRestaurantAccess(c, request.restaurant_id)

      const result = await this.backupService.createBackup(request, user.id.toString())

      return c.json({
        success: true,
        data: result
      }, 201)

    } catch (error) {
      console.error('Error creating backup:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to create backup'
      }, 400)
    }
  }

  /**
   * List backups with filtering and pagination
   */
  async listBackups(c: Context): Promise<Response> {
    try {
      const query = c.req.query() as any as ListBackupsQuery

      // Verify restaurant access
      await this.validationService.verifyRestaurantAccess(c, query.restaurant_id)

      const result = await this.backupService.listBackups(query)

      return c.json({
        success: true,
        data: result
      })

    } catch (error) {
      console.error('Error listing backups:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to list backups'
      }, 400)
    }
  }

  /**
   * Get specific backup details
   */
  async getBackup(c: Context): Promise<Response> {
    try {
      const backupId = c.req.param('id')

      if (!this.validationService.isValidUUID(backupId)) {
        return c.json({
          success: false,
          error: 'Invalid backup ID'
        }, 400)
      }

      const backup = await this.backupService.getBackupById(backupId)
      if (!backup) {
        return c.json({
          success: false,
          error: 'Backup not found'
        }, 404)
      }

      // Verify restaurant access
      await this.validationService.verifyRestaurantAccess(c, backup.restaurant_id)

      return c.json({
        success: true,
        data: backup
      })

    } catch (error) {
      console.error('Error fetching backup:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to fetch backup'
      }, 400)
    }
  }

  /**
   * Download backup file
   */
  async downloadBackup(c: Context): Promise<Response> {
    try {
      const backupId = c.req.param('id')

      if (!this.validationService.isValidUUID(backupId)) {
        return c.json({
          success: false,
          error: 'Invalid backup ID'
        }, 400)
      }

      const backup = await this.backupService.getBackupById(backupId)
      if (!backup) {
        return c.json({
          success: false,
          error: 'Backup not found'
        }, 404)
      }

      // Verify restaurant access
      await this.validationService.verifyRestaurantAccess(c, backup.restaurant_id)

      if (backup.status !== 'completed') {
        return c.json({
          success: false,
          error: 'Backup is not completed yet'
        }, 400)
      }

      const downloadResponse = await this.backupService.downloadBackup(backup)
      return downloadResponse

    } catch (error) {
      console.error('Error downloading backup:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to download backup'
      }, 500)
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(c: Context): Promise<Response> {
    try {
      const backupId = c.req.param('id')
      const request = await c.req.json() as RestoreBackupRequest
      const user = c.get('user')

      if (!this.validationService.isValidUUID(backupId)) {
        return c.json({
          success: false,
          error: 'Invalid backup ID'
        }, 400)
      }

      // Validate restore request
      await this.validationService.validateRestoreRequest(request)

      // Verify restaurant access
      await this.validationService.verifyRestaurantAccess(c, request.restaurant_id)

      // Ensure backup_id matches URL parameter
      request.backup_id = backupId

      const restoreId = await this.backupService.restoreFromBackup(request, user.id.toString())

      return c.json({
        success: true,
        data: {
          restore_id: restoreId,
          message: 'Restore operation initiated successfully'
        }
      }, 201)

    } catch (error) {
      console.error('Error initiating restore:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to initiate restore'
      }, 400)
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(c: Context): Promise<Response> {
    try {
      const backupId = c.req.param('id')
      const user = c.get('user')

      if (!this.validationService.isValidUUID(backupId)) {
        return c.json({
          success: false,
          error: 'Invalid backup ID'
        }, 400)
      }

      const backup = await this.backupService.getBackupById(backupId)
      if (!backup) {
        return c.json({
          success: false,
          error: 'Backup not found'
        }, 404)
      }

      // Verify restaurant access
      await this.validationService.verifyRestaurantAccess(c, backup.restaurant_id)

      await this.backupService.deleteBackup(backupId, user.id.toString())

      return c.json({
        success: true,
        message: 'Backup deleted successfully'
      })

    } catch (error) {
      console.error('Error deleting backup:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to delete backup'
      }, 400)
    }
  }

  /**
   * Get backup configurations for a restaurant
   */
  async getConfigurations(c: Context): Promise<Response> {
    try {
      const restaurantId = c.req.param('restaurant_id')

      if (!this.validationService.isValidUUID(restaurantId)) {
        return c.json({
          success: false,
          error: 'Invalid restaurant ID'
        }, 400)
      }

      // Verify restaurant access
      await this.validationService.verifyRestaurantAccess(c, restaurantId)

      const configurations = await this.configService.getConfigurations(restaurantId)

      return c.json({
        success: true,
        data: configurations
      })

    } catch (error) {
      console.error('Error fetching backup configurations:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to fetch backup configurations'
      }, 400)
    }
  }

  /**
   * Create or update backup configuration
   */
  async saveConfiguration(c: Context): Promise<Response> {
    try {
      const config = await c.req.json() as Partial<BackupConfiguration>
      const user = c.get('user')

      // Validate configuration
      await this.validationService.validateConfigurationRequest(config)

      // Verify restaurant access
      await this.validationService.verifyRestaurantAccess(c, config.restaurant_id!)

      const result = await this.configService.createOrUpdateConfiguration(config, user.id.toString())

      return c.json({
        success: true,
        data: result,
        message: 'Backup configuration saved successfully'
      }, 201)

    } catch (error) {
      console.error('Error saving backup configuration:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to save backup configuration'
      }, 400)
    }
  }

  /**
   * Get system health (admin only)
   */
  async getSystemHealth(c: Context): Promise<Response> {
    try {
      const user = c.get('user')

      // Check if user has admin privileges (role 0 = admin)
      if (user.role !== 0) {
        return c.json({
          success: false,
          error: 'Admin access required'
        }, 403)
      }

      const health = await this.backupService.getSystemHealth()

      return c.json({
        success: true,
        data: health
      })

    } catch (error) {
      console.error('Error fetching system health:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to fetch system health'
      }, 500)
    }
  }

  /**
   * Get restaurant backup metrics
   */
  async getRestaurantMetrics(c: Context): Promise<Response> {
    try {
      const restaurantId = c.req.param('restaurant_id')
      const period = c.req.query('period') || 'week'

      if (!this.validationService.isValidUUID(restaurantId)) {
        return c.json({
          success: false,
          error: 'Invalid restaurant ID'
        }, 400)
      }

      // Verify restaurant access
      await this.validationService.verifyRestaurantAccess(c, restaurantId)

      const metrics = await this.backupService.getRestaurantMetrics(restaurantId, period as any)

      return c.json({
        success: true,
        data: metrics
      })

    } catch (error) {
      console.error('Error fetching restaurant metrics:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to fetch restaurant metrics'
      }, 400)
    }
  }

  /**
   * Get restaurant alerts
   */
  async getRestaurantAlerts(c: Context): Promise<Response> {
    try {
      const restaurantId = c.req.param('restaurant_id')
      const unresolved_only = c.req.query('unresolved_only') === 'true'

      if (!this.validationService.isValidUUID(restaurantId)) {
        return c.json({
          success: false,
          error: 'Invalid restaurant ID'
        }, 400)
      }

      // Verify restaurant access
      await this.validationService.verifyRestaurantAccess(c, restaurantId)

      const alerts = await this.backupService.getRestaurantAlerts(restaurantId, unresolved_only)

      return c.json({
        success: true,
        data: alerts
      })

    } catch (error) {
      console.error('Error fetching alerts:', error)
      return c.json({
        success: false,
        error: (error as Error).message || 'Failed to fetch alerts'
      }, 400)
    }
  }
}