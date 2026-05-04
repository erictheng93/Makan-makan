<template>
  <div class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>{{ t("backup.create.title") }}</h2>
        <button class="close-btn" @click="$emit('close')">
          <XMarkIcon />
        </button>
      </div>

      <form class="backup-form" @submit.prevent="handleSubmit">
        <!-- Basic Information -->
        <div class="form-section">
          <h3>{{ t("backup.create.basicInfo") }}</h3>

          <div class="form-group">
            <label for="backup-name" class="form-label">
              {{ t("backup.create.name") }} *
            </label>
            <input
              id="backup-name"
              v-model="form.name"
              type="text"
              class="form-input"
              :class="{ error: errors.name }"
              :placeholder="t('backup.create.namePlaceholder')"
              required
            />
            <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
          </div>

          <div class="form-group">
            <label for="backup-description" class="form-label">
              {{ t("backup.create.description") }}
            </label>
            <textarea
              id="backup-description"
              v-model="form.description"
              class="form-textarea"
              :placeholder="t('backup.create.descriptionPlaceholder')"
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="backup-type" class="form-label">
              {{ t("backup.create.type") }} *
            </label>
            <select
              id="backup-type"
              v-model="form.backup_type"
              class="form-select"
              required
            >
              <option value="full">{{ t("backup.types.full") }}</option>
              <option value="incremental">
                {{ t("backup.types.incremental") }}
              </option>
              <option value="differential">
                {{ t("backup.types.differential") }}
              </option>
            </select>
            <p class="form-help">
              {{ getBackupTypeDescription(form.backup_type || "full") }}
            </p>
          </div>
        </div>

        <!-- Configuration Selection -->
        <div class="form-section">
          <h3>{{ t("backup.create.configuration") }}</h3>

          <div class="form-group">
            <label class="form-label">
              {{ t("backup.create.useConfiguration") }}
            </label>
            <div class="radio-group">
              <label class="radio-option">
                <input
                  v-model="configMode"
                  type="radio"
                  value="existing"
                  @change="handleConfigModeChange"
                />
                <span>{{ t("backup.create.useExisting") }}</span>
              </label>
              <label class="radio-option">
                <input
                  v-model="configMode"
                  type="radio"
                  value="manual"
                  @change="handleConfigModeChange"
                />
                <span>{{ t("backup.create.manualConfig") }}</span>
              </label>
            </div>
          </div>

          <!-- Existing Configuration Selection -->
          <div v-if="configMode === 'existing'" class="form-group">
            <label for="config-select" class="form-label">
              {{ t("backup.create.selectConfig") }} *
            </label>
            <select
              id="config-select"
              v-model="form.configuration_id"
              class="form-select"
              required
            >
              <option value="">
                {{ t("backup.create.selectConfigPlaceholder") }}
              </option>
              <option
                v-for="config in configurations"
                :key="config.id"
                :value="config.id"
              >
                {{ config.name }} ({{
                  t(`backup.types.${config.backup_type}`)
                }})
              </option>
            </select>
          </div>
        </div>

        <!-- Manual Configuration -->
        <div v-if="configMode === 'manual'" class="form-section">
          <h3>{{ t("backup.create.advancedOptions") }}</h3>

          <div class="form-group">
            <label class="form-label">
              {{ t("backup.create.tableSelection") }}
            </label>
            <div class="radio-group">
              <label class="radio-option">
                <input
                  v-model="tableMode"
                  type="radio"
                  value="all"
                  @change="handleTableModeChange"
                />
                <span>{{ t("backup.create.allTables") }}</span>
              </label>
              <label class="radio-option">
                <input
                  v-model="tableMode"
                  type="radio"
                  value="include"
                  @change="handleTableModeChange"
                />
                <span>{{ t("backup.create.includeTables") }}</span>
              </label>
              <label class="radio-option">
                <input
                  v-model="tableMode"
                  type="radio"
                  value="exclude"
                  @change="handleTableModeChange"
                />
                <span>{{ t("backup.create.excludeTables") }}</span>
              </label>
            </div>
          </div>

          <!-- Include Tables -->
          <div v-if="tableMode === 'include'" class="form-group">
            <label class="form-label">
              {{ t("backup.create.tablesToInclude") }} *
            </label>
            <div class="checkbox-grid">
              <label
                v-for="table in availableTables"
                :key="table"
                class="checkbox-option"
              >
                <input
                  v-model="form.include_tables"
                  type="checkbox"
                  :value="table"
                />
                <span>{{ table }}</span>
              </label>
            </div>
          </div>

          <!-- Exclude Tables -->
          <div v-if="tableMode === 'exclude'" class="form-group">
            <label class="form-label">
              {{ t("backup.create.tablesToExclude") }}
            </label>
            <div class="checkbox-grid">
              <label
                v-for="table in availableTables"
                :key="table"
                class="checkbox-option"
              >
                <input
                  v-model="form.exclude_tables"
                  type="checkbox"
                  :value="table"
                />
                <span>{{ table }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Execution Options -->
        <div class="form-section">
          <h3>{{ t("backup.create.execution") }}</h3>

          <div class="form-group">
            <label class="checkbox-option large">
              <input v-model="form.force_immediate" type="checkbox" />
              <div>
                <span class="checkbox-label">{{
                  t("backup.create.forceImmediate")
                }}</span>
                <p class="checkbox-description">
                  {{ t("backup.create.forceImmediateDescription") }}
                </p>
              </div>
            </label>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="form-actions">
          <button
            type="button"
            class="btn btn-secondary"
            @click="$emit('close')"
          >
            {{ t("common.cancel") }}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="isSubmitting"
          >
            <span v-if="isSubmitting" class="loading-spinner"></span>
            {{
              isSubmitting
                ? t("backup.create.creating")
                : t("backup.create.create")
            }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useBackupStore } from "@/stores/backup";
import { useAuthStore } from "@/stores/auth";
// TODO: Import from @makanmasak/shared-types when workspace is configured
// import type { BackupConfiguration, CreateBackupRequest } from '@makanmasak/shared-types'

// Temporary type definitions
type BackupType = "full" | "incremental" | "differential";
type StorageProvider = "r2" | "kv" | "external";

interface BackupConfiguration {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  backup_type: BackupType;
  schedule_enabled: boolean;
  schedule_cron?: string;
  retention_days: number;
  include_tables?: string[];
  exclude_tables?: string[];
  compression_enabled: boolean;
  encryption_enabled: boolean;
  storage_provider: StorageProvider;
  max_parallel_backups: number;
  notifications_enabled: boolean;
  notification_channels: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CreateBackupRequest {
  restaurant_id: string;
  configuration_id?: string;
  name: string;
  description?: string;
  backup_type?: BackupType;
  include_tables?: string[];
  exclude_tables?: string[];
  force_immediate?: boolean;
}

import { XMarkIcon } from "@heroicons/vue/24/outline";

const emit = defineEmits<{
  close: [];
  created: [backupId: string];
}>();

const { t } = useI18n();
const backupStore = useBackupStore();
const authStore = useAuthStore();

// Reactive data
const isSubmitting = ref(false);
const configMode = ref<"existing" | "manual">("existing");
const tableMode = ref<"all" | "include" | "exclude">("all");
const configurations = ref<BackupConfiguration[]>([]);
const availableTables = ref<string[]>([
  "orders",
  "order_items",
  "menu_items",
  "customers",
  "tables",
  "reservations",
  "payments",
  "users",
]);

const form = reactive<CreateBackupRequest>({
  restaurant_id: "",
  name: "",
  description: "",
  backup_type: "full",
  configuration_id: "",
  include_tables: [],
  exclude_tables: [],
  force_immediate: false,
});

const errors = reactive({
  name: "",
});

// Methods
const handleOverlayClick = (event: Event) => {
  if (event.target === event.currentTarget) {
    emit("close");
  }
};

const getBackupTypeDescription = (type: string | undefined): string => {
  return t(`backup.types.${type}Description`);
};

const handleConfigModeChange = () => {
  if (configMode.value === "existing") {
    form.include_tables = [];
    form.exclude_tables = [];
    form.configuration_id = "";
  } else {
    form.configuration_id = undefined;
  }
};

const handleTableModeChange = () => {
  form.include_tables = [];
  form.exclude_tables = [];
};

const validateForm = (): boolean => {
  errors.name = "";

  if (!form.name.trim()) {
    errors.name = t("backup.errors.nameRequired");
    return false;
  }

  if (form.name.length > 100) {
    errors.name = t("backup.errors.nameTooLong");
    return false;
  }

  if (configMode.value === "existing" && !form.configuration_id) {
    return false;
  }

  if (
    tableMode.value === "include" &&
    (!form.include_tables || form.include_tables.length === 0)
  ) {
    return false;
  }

  return true;
};

const handleSubmit = async () => {
  if (!validateForm() || isSubmitting.value) return;

  isSubmitting.value = true;

  try {
    // Clean up form data based on mode
    const submitData: CreateBackupRequest = {
      restaurant_id: String(authStore.restaurantId || ""),
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      backup_type: form.backup_type,
      force_immediate: form.force_immediate,
    };

    if (configMode.value === "existing") {
      submitData.configuration_id = form.configuration_id;
    } else {
      // Manual configuration
      if (tableMode.value === "include") {
        submitData.include_tables = [...(form.include_tables || [])];
      } else if (tableMode.value === "exclude") {
        submitData.exclude_tables = [...(form.exclude_tables || [])];
      }
    }

    const response = await backupStore.createBackup(submitData);

    emit("created", response.backup_id);
  } catch (error) {
    console.error("Error creating backup:", error);
    // Handle error (show toast notification)
  } finally {
    isSubmitting.value = false;
  }
};

const loadConfigurations = async () => {
  try {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;

    configurations.value = await backupStore.getBackupConfigurations(
      String(restaurantId),
    );
  } catch (error) {
    console.error("Error loading configurations:", error);
  }
};

// Generate default backup name
const generateDefaultName = (): string => {
  const now = new Date();
  const restaurantName = "Restaurant";
  const timestamp = now
    .toISOString()
    .slice(0, 16)
    .replace("T", "_")
    .replace(":", "-");
  return `${restaurantName}_Backup_${timestamp}`;
};

// Lifecycle
onMounted(() => {
  form.restaurant_id = String(authStore.restaurantId || "");
  form.name = generateDefaultName();
  loadConfigurations();
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* Form Styles */
.backup-form {
  padding: 1.5rem;
}

.form-section {
  margin-bottom: 2rem;
}

.form-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #f3f4f6;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: border-color 0.2s ease;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input.error {
  border-color: #dc2626;
}

.form-help {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
  margin-bottom: 0;
}

.error-text {
  font-size: 0.75rem;
  color: #dc2626;
  margin-top: 0.25rem;
}

/* Radio and Checkbox Groups */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.radio-option,
.checkbox-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.checkbox-option.large {
  align-items: flex-start;
  gap: 0.75rem;
}

.checkbox-label {
  font-weight: 500;
  color: #374151;
}

.checkbox-description {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0.25rem 0 0 0;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-top: 0.5rem;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .modal-overlay {
    padding: 0.5rem;
  }

  .modal-content {
    max-height: 95vh;
  }

  .modal-header,
  .backup-form {
    padding: 1rem;
  }

  .checkbox-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    flex-direction: column;
  }
}
</style>
