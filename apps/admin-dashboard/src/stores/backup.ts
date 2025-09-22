/**
 * Backup Store - Pinia store for backup management
 * Handles all backup-related API interactions and state management
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
// TODO: Import from @makanmakan/shared-types when workspace is properly configured
// import type {
//   BackupConfiguration,
//   BackupRecord,
//   BackupSystemHealth,
//   BackupAlert,
//   CreateBackupRequest,
//   CreateBackupResponse,
//   ListBackupsQuery,
//   RestoreBackupRequest
// } from '@makanmakan/shared-types'

// Temporary type definitions
type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
type BackupType = 'full' | 'incremental' | 'differential'
type StorageProvider = 'r2' | 'kv' | 'external'

interface BackupConfiguration {
  id: string
  restaurant_id: string
  name: string
  description?: string
  backup_type: BackupType
  schedule_enabled: boolean
  schedule_cron?: string
  retention_days: number
  include_tables?: string[]
  exclude_tables?: string[]
  compression_enabled: boolean
  encryption_enabled: boolean
  storage_provider: StorageProvider
  max_parallel_backups: number
  notifications_enabled: boolean
  notification_channels: string[]
  created_by: string
  created_at: string
  updated_at: string
}

interface BackupRecord {
  id: string
  restaurant_id: string
  configuration_id: string
  name: string
  backup_type: BackupType
  status: BackupStatus
  file_size: number
  compressed_size: number
  records_count: number
  tables_included: string[]
  storage_provider: StorageProvider
  storage_path: string
  encryption_enabled: boolean
  checksum: string
  started_at: string
  completed_at?: string
  error_message?: string
  created_by: string
  expires_at?: string
  metadata: {
    tables_info: Array<{
      table_name: string
      record_count: number
      estimated_size: number
    }>
    performance_metrics: {
      backup_duration_ms: number
      compression_ratio: number
      upload_speed_mbps: number
    }
    database_snapshot: {
      version: string
      schema_hash: string
      total_tables: number
      total_records: number
    }
  }
}

interface BackupSystemHealth {
  overall_status: 'healthy' | 'warning' | 'critical'
  total_restaurants: number
  active_configurations: number
  running_backups: number
  failed_backups_24h: number
  storage_usage: {
    total_bytes: number
    available_bytes: number
    usage_percentage: number
  }
  performance_metrics: {
    average_backup_duration_minutes: number
    average_success_rate_percentage: number
    average_compression_ratio: number
  }
  alerts_summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
}

interface BackupAlert {
  id: string
  restaurant_id: string
  alert_type: 'backup_failed' | 'storage_quota_exceeded' | 'schedule_missed' | 'restoration_completed' | 'performance_degraded'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  related_backup_id?: string
  triggered_at: string
  acknowledged: boolean
  acknowledged_by?: string
  acknowledged_at?: string
  resolved: boolean
  resolved_at?: string
}

interface CreateBackupRequest {
  restaurant_id: string
  configuration_id?: string
  name: string
  description?: string
  backup_type?: BackupType
  include_tables?: string[]
  exclude_tables?: string[]
  force_immediate?: boolean
}

interface CreateBackupResponse {
  backup_id: string
  status: BackupStatus
  estimated_duration_minutes: number
  message: string
}

interface ListBackupsQuery {
  restaurant_id: string
  status?: BackupStatus
  backup_type?: BackupType
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
  sort_by?: 'created_at' | 'file_size' | 'duration'
  sort_order?: 'asc' | 'desc'
}

interface RestoreBackupRequest {
  restaurant_id: string
  backup_id: string
  restore_type: 'full' | 'selective'
  target_tables?: string[]
  overwrite_existing: boolean
  safety_confirmation: {
    backup_integrity_verified: boolean
    data_loss_risk_acknowledged: boolean
    confirmation_phrase: string
  }
}
// TODO: Create proper API client
// import { apiClient } from '@/utils/api'
const apiClient = {
  post: async (_url: string, _data: any) => ({
    data: {
      backup_id: 'test-id',
      status: 'pending' as BackupStatus,
      estimated_duration_minutes: 5,
      message: 'Backup created',
      restore_id: 'test-restore-id'
    }
  }),
  get: async (_url: string, _params?: any) => {
    if (_url.includes('/backup/list')) {
      return { data: [] as BackupRecord[] }
    }
    if (_url.includes('/configurations')) {
      return { data: [] as BackupConfiguration[] }
    }
    if (_url.includes('/health')) {
      return {
        data: {
          overall_status: 'healthy' as const,
          total_restaurants: 0,
          active_configurations: 0,
          running_backups: 0,
          failed_backups_24h: 0,
          storage_usage: {
            total_bytes: 0,
            available_bytes: 0,
            usage_percentage: 0
          },
          performance_metrics: {
            average_backup_duration_minutes: 0,
            average_success_rate_percentage: 0,
            average_compression_ratio: 0
          },
          alerts_summary: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
          }
        } as BackupSystemHealth
      }
    }
    if (_url.includes('/alerts')) {
      return { data: [] as BackupAlert[] }
    }
    return { data: {}, headers: { 'content-disposition': 'attachment; filename="backup.zip"' } }
  },
  patch: async (_url: string, _data?: any) => ({ data: {} }),
  delete: async (_url: string) => ({ data: {} })
}

export const useBackupStore = defineStore('backup', () => {
  // State
  const isLoading = ref(false)
  const backups = ref<BackupRecord[]>([])
  const configurations = ref<BackupConfiguration[]>([])
  const systemHealth = ref<BackupSystemHealth | null>(null)
  const alerts = ref<BackupAlert[]>([])

  // Actions
  const createBackup = async (request: CreateBackupRequest): Promise<CreateBackupResponse> => {
    try {
      const response = await apiClient.post('/backup/create', request)
      return response.data as { data: BackupRecord[] }
    } catch (error) {
      console.error('Error creating backup:', error)
      throw error
    }
  }

  const listBackups = async (query: ListBackupsQuery) => {
    try {
      const response = await apiClient.get('/backup/list', {
        params: query
      })
      return (response.data as { data: BackupRecord[] } as { data: BackupRecord[] }).data || []
    } catch (error) {
      console.error('Error listing backups:', error)
      throw error
    }
  }

  const getBackup = async (backupId: string): Promise<BackupRecord> => {
    try {
      const response = await apiClient.get(`/backup/${backupId}`)
      return (response.data as { data: BackupRecord[] } as { data: BackupRecord }).data
    } catch (error) {
      console.error('Error getting backup:', error)
      throw error
    }
  }

  const downloadBackup = async (backupId: string): Promise<void> => {
    try {
      const response = await apiClient.get(`/backup/${backupId}/download`, {
        responseType: 'blob'
      })

      // Create download link
      const url = window.URL.createObjectURL(response.data as { data: BackupRecord[] } as Blob)
      const link = document.createElement('a')
      link.href = url

      // Extract filename from response headers or generate one
      const contentDisposition = response.headers?.['content-disposition']
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `backup_${backupId}.json`

      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading backup:', error)
      throw error
    }
  }

  const restoreBackup = async (request: RestoreBackupRequest): Promise<string> => {
    try {
      const response = await apiClient.post(`/backup/${request.backup_id}/restore`, request)
      return response.data as { data: BackupRecord[] }
    } catch (error) {
      console.error('Error restoring backup:', error)
      throw error
    }
  }

  const deleteBackup = async (backupId: string): Promise<void> => {
    try {
      await apiClient.delete(`/backup/${backupId}`)
    } catch (error) {
      console.error('Error deleting backup:', error)
      throw error
    }
  }

  // Backup Configurations
  const getBackupConfigurations = async (restaurantId: string): Promise<BackupConfiguration[]> => {
    try {
      const response = await apiClient.get(`/backup/configurations/${restaurantId}`)
      configurations.value = (response.data as { data: BackupRecord[] } as { data: BackupConfiguration[] }).data
      return (response.data as { data: BackupRecord[] } as { data: BackupConfiguration[] }).data
    } catch (error) {
      console.error('Error getting backup configurations:', error)
      throw error
    }
  }

  const createOrUpdateConfiguration = async (
    config: Partial<BackupConfiguration>
  ): Promise<BackupConfiguration> => {
    try {
      const response = await apiClient.post('/backup/configurations', config)

      // Update local configurations array
      const index = configurations.value.findIndex((c: BackupConfiguration) => c.id === config.id)
      const configData = (response.data as { data: BackupRecord[] } as any as { data: BackupConfiguration }).data
      if (index >= 0) {
        configurations.value[index] = configData
      } else {
        configurations.value.push(configData)
      }

      return configData
    } catch (error) {
      console.error('Error saving backup configuration:', error)
      throw error
    }
  }

  // System Monitoring
  const getSystemHealth = async (): Promise<BackupSystemHealth> => {
    try {
      const response = await apiClient.get('/backup/system/health')
      systemHealth.value = (response.data as { data: BackupRecord[] } as { data: BackupSystemHealth }).data
      return (response.data as { data: BackupRecord[] } as { data: BackupSystemHealth }).data
    } catch (error) {
      console.error('Error getting system health:', error)
      throw error
    }
  }

  const getRestaurantMetrics = async (
    restaurantId: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'week'
  ) => {
    try {
      const response = await apiClient.get(`/backup/restaurants/${restaurantId}/metrics`, {
        params: { period }
      })
      return response.data as { data: BackupRecord[] }
    } catch (error) {
      console.error('Error getting restaurant metrics:', error)
      throw error
    }
  }

  const getRestaurantAlerts = async (
    restaurantId: string,
    unresolved_only: boolean = false
  ): Promise<BackupAlert[]> => {
    try {
      const response = await apiClient.get(`/backup/alerts/${restaurantId}`, {
        params: { unresolved_only }
      })
      alerts.value = (response.data as { data: BackupRecord[] } as { data: BackupAlert[] }).data
      return (response.data as { data: BackupRecord[] } as { data: BackupAlert[] }).data
    } catch (error) {
      console.error('Error getting restaurant alerts:', error)
      throw error
    }
  }

  // Alert Management
  const acknowledgeAlert = async (alertId: string): Promise<void> => {
    try {
      await apiClient.patch(`/backup/alerts/${alertId}/acknowledge`)

      // Update local alerts array
      const alert = alerts.value.find((a: BackupAlert) => a.id === alertId)
      if (alert) {
        alert.acknowledged = true
        alert.acknowledged_at = new Date().toISOString()
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      throw error
    }
  }

  const resolveAlert = async (alertId: string): Promise<void> => {
    try {
      await apiClient.patch(`/backup/alerts/${alertId}/resolve`)

      // Update local alerts array
      const alert = alerts.value.find((a: BackupAlert) => a.id === alertId)
      if (alert) {
        alert.resolved = true
        alert.resolved_at = new Date().toISOString()
      }
    } catch (error) {
      console.error('Error resolving alert:', error)
      throw error
    }
  }

  // Utility Actions
  const refreshBackups = async (restaurantId: string) => {
    isLoading.value = true
    try {
      const response = await listBackups({
        restaurant_id: restaurantId,
        limit: 50,
        sort_by: 'created_at',
        sort_order: 'desc'
      })
      backups.value = response
    } catch (error) {
      console.error('Error refreshing backups:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const clearCache = () => {
    backups.value = []
    configurations.value = []
    systemHealth.value = null
    alerts.value = []
  }

  // Real-time Updates (placeholder for future WebSocket integration)
  const subscribeToUpdates = (restaurantId: string) => {
    // TODO: Implement WebSocket connection for real-time backup status updates
    console.log('Subscribing to backup updates for restaurant:', restaurantId)
  }

  const unsubscribeFromUpdates = () => {
    // TODO: Cleanup WebSocket connection
    console.log('Unsubscribing from backup updates')
  }

  // Backup Status Polling (for active backups)
  const pollBackupStatus = async (backupId: string): Promise<BackupRecord> => {
    try {
      const backup = await getBackup(backupId)

      // Update local backup if it exists in the array
      const index = backups.value.findIndex((b: BackupRecord) => b.id === backupId)
      if (index >= 0) {
        backups.value[index] = backup
      }

      return backup
    } catch (error) {
      console.error('Error polling backup status:', error)
      throw error
    }
  }

  // Auto-refresh for active backups
  const startAutoRefresh = (_restaurantId?: string) => {
    const interval = setInterval(async () => {
      try {
        // Check if there are any active backups
        const activeBackups = backups.value.filter(
          (b: BackupRecord) => b.status === 'in_progress' || b.status === 'pending'
        )

        if (activeBackups.length === 0) {
          clearInterval(interval)
          return
        }

        // Poll status for each active backup
        await Promise.all(
          activeBackups.map((backup: BackupRecord) => pollBackupStatus(backup.id))
        )
      } catch (error) {
        console.error('Error in auto-refresh:', error)
      }
    }, 5000) // Poll every 5 seconds

    return interval
  }

  return {
    // State
    isLoading,
    backups,
    configurations,
    systemHealth,
    alerts,

    // Actions
    createBackup,
    listBackups,
    getBackup,
    downloadBackup,
    restoreBackup,
    deleteBackup,

    // Configuration management
    getBackupConfigurations,
    createOrUpdateConfiguration,

    // System monitoring
    getSystemHealth,
    getRestaurantMetrics,
    getRestaurantAlerts,

    // Alert management
    acknowledgeAlert,
    resolveAlert,

    // Utilities
    refreshBackups,
    clearCache,
    subscribeToUpdates,
    unsubscribeFromUpdates,
    pollBackupStatus,
    startAutoRefresh
  }
})