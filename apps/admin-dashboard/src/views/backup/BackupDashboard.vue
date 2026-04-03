<template>
  <div class="backup-dashboard">
    <div class="dashboard-header">
      <h1>{{ t('backup.dashboard.title') }}</h1>
      <div class="header-actions">
        <button
          class="btn btn-primary"
          @click="showCreateBackupModal = true"
        >
          {{ t('backup.actions.create') }}
        </button>
        <button
          class="btn btn-secondary"
          :disabled="isLoading"
          @click="refreshDashboard"
        >
          {{ t('backup.actions.refresh') }}
        </button>
      </div>
    </div>

    <!-- System Health Status -->
    <div class="health-status-card" :class="healthStatusClass" :data-health-status="systemHealth?.overall_status || 'unknown'">
      <div class="status-icon">
        <component :is="healthStatusIcon" />
      </div>
      <div class="status-info">
        <h3>{{ t(`backup.health.${systemHealth?.overall_status || 'unknown'}`) }}</h3>
        <p>{{ healthStatusMessage }}</p>
      </div>
      <div class="status-metrics">
        <div class="metric">
          <span class="metric-value">{{ systemHealth?.running_backups || 0 }}</span>
          <span class="metric-label">{{ t('backup.metrics.running') }}</span>
        </div>
        <div class="metric">
          <span class="metric-value">{{ systemHealth?.failed_backups_24h || 0 }}</span>
          <span class="metric-label">{{ t('backup.metrics.failed24h') }}</span>
        </div>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon backup-icon">📦</div>
        <div class="stat-content">
          <div class="stat-value">{{ backupMetrics?.total_backups || 0 }}</div>
          <div class="stat-label">{{ t('backup.stats.totalBackups') }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon success-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ backupMetrics?.successful_backups || 0 }}</div>
          <div class="stat-label">{{ t('backup.stats.successful') }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon storage-icon">💾</div>
        <div class="stat-content">
          <div class="stat-value">{{ formatFileSize(backupMetrics?.storage_usage_bytes || 0) }}</div>
          <div class="stat-label">{{ t('backup.stats.storageUsed') }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon cost-icon">💰</div>
        <div class="stat-content">
          <div class="stat-value">${{ (backupMetrics?.cost_estimation || 0).toFixed(3) }}</div>
          <div class="stat-label">{{ t('backup.stats.estimatedCost') }}</div>
        </div>
      </div>
    </div>

    <!-- Recent Backups -->
    <div class="recent-backups-section">
      <div class="section-header">
        <h2>{{ t('backup.recent.title') }}</h2>
        <router-link to="/backup/history" class="view-all-link">
          {{ t('backup.recent.viewAll') }}
        </router-link>
      </div>

      <div v-if="recentBackups.length > 0" class="backup-list">
        <BackupListItem
          v-for="backup in recentBackups"
          :key="backup.id"
          :backup="backup"
          @download="handleDownloadBackup"
          @restore="handleRestoreBackup"
          @delete="handleDeleteBackup"
        />
      </div>

      <div v-else class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>{{ t('backup.empty.title') }}</h3>
        <p>{{ t('backup.empty.description') }}</p>
        <button
          class="btn btn-primary"
          @click="showCreateBackupModal = true"
        >
          {{ t('backup.empty.createFirst') }}
        </button>
      </div>
    </div>

    <!-- Backup Alerts -->
    <div v-if="alerts.length > 0" class="alerts-section">
      <h2>{{ t('backup.alerts.title') }}</h2>
      <div class="alert-list">
        <BackupAlert
          v-for="alert in alerts"
          :key="alert.id"
          :alert="alert"
          @acknowledge="handleAcknowledgeAlert"
          @resolve="handleResolveAlert"
        />
      </div>
    </div>

    <!-- Create Backup Modal -->
    <CreateBackupModal
      v-if="showCreateBackupModal"
      @close="showCreateBackupModal = false"
      @created="handleBackupCreated"
    />

    <!-- Restore Modal -->
    <RestoreBackupModal
      v-if="showRestoreModal"
      :backup="selectedBackup"
      @close="showRestoreModal = false"
      @restored="handleRestoreCompleted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirmModal } from '@/composables/useConfirmModal'
import { useBackupStore } from '@/stores/backup'
import { useAuthStore } from '@/stores/auth'
// TODO: Import from @makanmakan/shared-types when workspace is configured
// import type { BackupRecord, BackupAlert as BackupAlertType } from '@makanmakan/shared-types'

// Temporary type definitions
type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
type BackupType = 'full' | 'incremental' | 'differential'
type StorageProvider = 'r2' | 'kv' | 'external'

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
  metadata: any
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

type BackupAlertType = BackupAlert

import BackupListItem from '@/components/backup/BackupListItem.vue'
import BackupAlert from '@/components/backup/BackupAlert.vue'
import CreateBackupModal from '@/components/backup/CreateBackupModal.vue'
import RestoreBackupModal from '@/components/backup/RestoreBackupModal.vue'

const { t } = useI18n()
const { confirm: confirmModal } = useConfirmModal()
const backupStore = useBackupStore()
const authStore = useAuthStore()

// Reactive data
const isLoading = ref(false)
const showCreateBackupModal = ref(false)
const showRestoreModal = ref(false)
const selectedBackup = ref<BackupRecord | null>(null)
const systemHealth = ref<any>(null)
const backupMetrics = ref<any>(null)
const recentBackups = ref<BackupRecord[]>([])
const alerts = ref<BackupAlertType[]>([])

// Computed properties
const healthStatusClass = computed(() => {
  const status = systemHealth.value?.overall_status
  return {
    'health-healthy': status === 'healthy',
    'health-warning': status === 'warning',
    'health-critical': status === 'critical'
  }
})

const healthStatusIcon = computed(() => {
  const status = systemHealth.value?.overall_status
  switch (status) {
    case 'healthy': return 'CheckCircleIcon'
    case 'warning': return 'ExclamationTriangleIcon'
    case 'critical': return 'XCircleIcon'
    default: return 'QuestionMarkCircleIcon'
  }
})

const healthStatusMessage = computed(() => {
  if (!systemHealth.value) return t('backup.health.loading')

  const { running_backups, failed_backups_24h } = systemHealth.value

  if (failed_backups_24h > 0) {
    return t('backup.health.failuresDetected', { count: failed_backups_24h })
  }

  if (running_backups > 0) {
    return t('backup.health.backupsRunning', { count: running_backups })
  }

  return t('backup.health.allSystemsNormal')
})

// Methods
const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const refreshDashboard = async () => {
  if (isLoading.value) return

  isLoading.value = true

  try {
    // Get current restaurant from auth store
    const restaurantId = authStore.restaurantId
    if (!restaurantId) throw new Error('No restaurant selected')

    // Fetch all dashboard data
    await Promise.all([
      loadSystemHealth(),
      loadBackupMetrics(String(restaurantId)),
      loadRecentBackups(String(restaurantId)),
      loadAlerts(String(restaurantId))
    ])
  } catch (error) {
    console.error('Error refreshing dashboard:', error)
    // Handle error (show toast notification)
  } finally {
    isLoading.value = false
  }
}

const loadSystemHealth = async () => {
  try {
    systemHealth.value = await backupStore.getSystemHealth()
  } catch (error) {
    console.error('Error loading system health:', error)
  }
}

const loadBackupMetrics = async (restaurantId: string) => {
  try {
    backupMetrics.value = await backupStore.getRestaurantMetrics(restaurantId)
  } catch (error) {
    console.error('Error loading backup metrics:', error)
  }
}

const loadRecentBackups = async (restaurantId: string) => {
  try {
    const response = await backupStore.listBackups({
      restaurant_id: restaurantId,
      limit: 5,
      sort_by: 'created_at',
      sort_order: 'desc'
    })
    recentBackups.value = response
  } catch (error) {
    console.error('Error loading recent backups:', error)
  }
}

const loadAlerts = async (restaurantId: string) => {
  try {
    alerts.value = await backupStore.getRestaurantAlerts(restaurantId, true) // unresolved only
  } catch (error) {
    console.error('Error loading alerts:', error)
  }
}

// Event handlers
const handleDownloadBackup = async (backup: BackupRecord) => {
  try {
    await backupStore.downloadBackup(backup.id)
  } catch (error) {
    console.error('Error downloading backup:', error)
  }
}

const handleRestoreBackup = (backup: BackupRecord) => {
  selectedBackup.value = backup
  showRestoreModal.value = true
}

const handleDeleteBackup = async (backup: BackupRecord) => {
  const confirmed = await confirmModal({
    type: 'danger',
    title: t('backup.confirm.deleteTitle'),
    message: t('backup.confirm.delete', { name: backup.name }),
    confirmLabel: t('common.delete'),
  })
  if (!confirmed) return

  try {
    await backupStore.deleteBackup(backup.id)
    await refreshDashboard()
  } catch (error) {
    console.error('Error deleting backup:', error)
  }
}

const handleBackupCreated = () => {
  showCreateBackupModal.value = false
  refreshDashboard()
}

const handleRestoreCompleted = () => {
  showRestoreModal.value = false
  selectedBackup.value = null
  refreshDashboard()
}

const handleAcknowledgeAlert = async (alert: BackupAlertType) => {
  try {
    await backupStore.acknowledgeAlert(alert.id)
    await loadAlerts(String(authStore.restaurantId || ''))
  } catch (error) {
    console.error('Error acknowledging alert:', error)
  }
}

const handleResolveAlert = async (alert: BackupAlertType) => {
  try {
    await backupStore.resolveAlert(alert.id)
    await loadAlerts(String(authStore.restaurantId || ''))
  } catch (error) {
    console.error('Error resolving alert:', error)
  }
}

// Lifecycle
onMounted(() => {
  refreshDashboard()
})
</script>

<style scoped>
.backup-dashboard {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-header h1 {
  font-size: 2rem;
  font-weight: 600;
  color: #1a1a1a;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Health Status Card */
.health-status-card {
  display: flex;
  align-items: center;
  padding: 1.5rem;
  border-radius: 0.75rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.health-healthy {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.health-warning {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.health-critical {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.status-icon {
  margin-right: 1rem;
  font-size: 2rem;
}

.status-info {
  flex: 1;
}

.status-info h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.status-info p {
  margin: 0;
  color: #6b7280;
}

.status-metrics {
  display: flex;
  gap: 2rem;
}

.metric {
  text-align: center;
}

.metric-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
}

.metric-label {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 1.5rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  margin-right: 1rem;
  font-size: 2rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Sections */
.recent-backups-section,
.alerts-section {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.view-all-link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.view-all-link:hover {
  text-decoration: underline;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #6b7280;
  margin-bottom: 1.5rem;
}

/* Lists */
.backup-list,
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>