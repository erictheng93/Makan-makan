<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ t('backup.restore.title') }}</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div v-if="backup" class="backup-info">
          <h3>{{ backup.name }}</h3>
          <p class="backup-meta">
            {{ t('backup.restore.createdAt') }}: {{ formatDate(backup.started_at) }}
          </p>
          <p class="backup-meta">
            {{ t('backup.restore.size') }}: {{ formatFileSize(backup.file_size) }}
          </p>
        </div>

        <div class="warning-box">
          <span class="warning-icon">⚠️</span>
          <div>
            <strong>{{ t('backup.restore.warning') }}</strong>
            <p>{{ t('backup.restore.warningMessage') }}</p>
          </div>
        </div>

        <div class="restore-options">
          <label class="checkbox-label">
            <input v-model="overwriteExisting" type="checkbox" />
            {{ t('backup.restore.overwriteExisting') }}
          </label>
          <label class="checkbox-label">
            <input v-model="createBackupFirst" type="checkbox" />
            {{ t('backup.restore.createBackupFirst') }}
          </label>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">
          {{ t('common.cancel') }}
        </button>
        <button
          class="btn btn-danger"
          :disabled="isRestoring"
          @click="handleRestore"
        >
          <span v-if="isRestoring">{{ t('backup.restore.restoring') }}</span>
          <span v-else>{{ t('backup.restore.confirm') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

interface BackupRecord {
  id: string
  name: string
  file_size: number
  started_at: string
}

const props = defineProps<{
  backup: BackupRecord | null
}>()

const emit = defineEmits<{
  close: []
  restored: [backupId: string]
}>()

const { t } = useI18n()

const isRestoring = ref(false)
const error = ref('')
const overwriteExisting = ref(false)
const createBackupFirst = ref(true)

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const handleRestore = async () => {
  if (!props.backup) return

  isRestoring.value = true
  error.value = ''

  try {
    // TODO: Implement actual restore logic
    // await backupStore.restoreBackup(props.backup.id, {
    //   overwriteExisting: overwriteExisting.value,
    //   createBackupFirst: createBackupFirst.value,
    // })

    // Simulate restore for now
    await new Promise(resolve => setTimeout(resolve, 2000))

    emit('restored', props.backup.id)
    emit('close')
  } catch (err: any) {
    error.value = err.message || t('backup.restore.error')
  } finally {
    isRestoring.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-bg, white);
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border, #eee);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-secondary, #666);
}

.modal-body {
  padding: 1.5rem;
}

.backup-info {
  margin-bottom: 1rem;
}

.backup-info h3 {
  margin: 0 0 0.5rem 0;
}

.backup-meta {
  margin: 0.25rem 0;
  color: var(--color-text-secondary, #666);
  font-size: 0.875rem;
}

.warning-box {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--color-warning-light, #fff3e0);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.warning-icon {
  font-size: 1.5rem;
}

.warning-box p {
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
}

.restore-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--color-error-light, #ffebee);
  color: var(--color-error, #d32f2f);
  border-radius: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border, #eee);
}

.btn-danger {
  background: var(--color-error, #d32f2f);
  color: white;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
