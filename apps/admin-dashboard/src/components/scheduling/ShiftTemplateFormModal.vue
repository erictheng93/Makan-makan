<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="closeModal">
        <div class="modal-container">
          <!-- Modal Header -->
          <div class="modal-header">
            <h2 class="modal-title">
              <span class="title-icon">🏷️</span>
              <span>{{
                isEditing
                  ? t("shiftTemplates.edit")
                  : t("shiftTemplates.create")
              }}</span>
            </h2>
            <button class="close-btn" @click="closeModal">✕</button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body">
            <form @submit.prevent="handleSubmit">
              <!-- Basic Info Section -->
              <div class="form-section">
                <h3 class="section-title">
                  {{ t("shiftTemplates.sections.basicInfo") }}
                </h3>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label required">{{
                      t("shiftTemplates.form.name")
                    }}</label>
                    <input
                      v-model="form.name"
                      type="text"
                      class="form-input"
                      :placeholder="t('shiftTemplates.form.namePlaceholder')"
                      maxlength="100"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label class="form-label">{{
                      t("shiftTemplates.form.shiftType")
                    }}</label>
                    <select v-model="form.shiftType" class="form-select">
                      <option value="regular">
                        {{ t("shiftTemplates.shiftTypes.regular") }}
                      </option>
                      <option value="split">
                        {{ t("shiftTemplates.shiftTypes.split") }}
                      </option>
                      <option value="overnight">
                        {{ t("shiftTemplates.shiftTypes.overnight") }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">{{
                    t("shiftTemplates.form.description")
                  }}</label>
                  <textarea
                    v-model="form.description"
                    class="form-textarea"
                    :placeholder="
                      t('shiftTemplates.form.descriptionPlaceholder')
                    "
                    rows="2"
                    maxlength="500"
                  ></textarea>
                </div>
              </div>

              <!-- Time Section -->
              <div class="form-section">
                <h3 class="section-title">
                  {{ t("shiftTemplates.sections.workTime") }}
                </h3>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label required">{{
                      t("shiftTemplates.form.startTime")
                    }}</label>
                    <input
                      v-model="form.startTime"
                      type="time"
                      class="form-input"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label class="form-label required">{{
                      t("shiftTemplates.form.endTime")
                    }}</label>
                    <input
                      v-model="form.endTime"
                      type="time"
                      class="form-input"
                      required
                    />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">
                      <input
                        v-model="form.isSplitShift"
                        type="checkbox"
                        class="form-checkbox"
                      />
                      <span>{{ t("shiftTemplates.form.includeBreak") }}</span>
                    </label>
                  </div>
                </div>

                <transition name="fade">
                  <div v-if="form.isSplitShift" class="form-row">
                    <div class="form-group">
                      <label class="form-label">{{
                        t("shiftTemplates.form.breakStart")
                      }}</label>
                      <input
                        v-model="form.breakStartTime"
                        type="time"
                        class="form-input"
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label">{{
                        t("shiftTemplates.form.breakEnd")
                      }}</label>
                      <input
                        v-model="form.breakEndTime"
                        type="time"
                        class="form-input"
                      />
                    </div>
                  </div>
                </transition>

                <div class="info-box">
                  <span class="info-icon">ℹ️</span>
                  <span
                    >{{ t("shiftTemplates.form.estimatedHours") }}:
                    <strong>{{ calculatedHours }}</strong>
                    {{ t("shiftTemplates.form.hoursUnit") }}</span
                  >
                </div>
              </div>

              <!-- Staffing Section -->
              <div class="form-section">
                <h3 class="section-title">
                  {{ t("shiftTemplates.sections.staffing") }}
                </h3>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label required">{{
                      t("shiftTemplates.form.minEmployees")
                    }}</label>
                    <input
                      v-model.number="form.minEmployees"
                      type="number"
                      class="form-input"
                      min="1"
                      max="50"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label class="form-label required">{{
                      t("shiftTemplates.form.maxEmployees")
                    }}</label>
                    <input
                      v-model.number="form.maxEmployees"
                      type="number"
                      class="form-input"
                      min="1"
                      max="50"
                      required
                    />
                  </div>
                </div>
              </div>

              <!-- Applicable Days Section -->
              <div class="form-section">
                <h3 class="section-title">
                  {{ t("shiftTemplates.sections.applicableDays") }}
                </h3>
                <div class="days-selector">
                  <label
                    v-for="(day, index) in weekdays"
                    :key="index"
                    class="day-label"
                    :class="{ selected: applicableDaysArray.includes(index) }"
                  >
                    <input
                      v-model="applicableDaysArray"
                      type="checkbox"
                      :value="index"
                      class="day-checkbox"
                    />
                    <span class="day-name">{{ day }}</span>
                  </label>
                </div>
              </div>

              <!-- Pay Rate Section -->
              <div class="form-section">
                <h3 class="section-title">
                  {{ t("shiftTemplates.sections.payRate") }}
                </h3>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">{{
                      t("shiftTemplates.form.hourlyRate")
                    }}</label>
                    <input
                      v-model.number="form.hourlyRate"
                      type="number"
                      class="form-input"
                      min="0"
                      step="1"
                      placeholder="176"
                    />
                  </div>

                  <div class="form-group">
                    <label class="form-label">{{
                      t("shiftTemplates.form.overtimeMultiplier")
                    }}</label>
                    <select
                      v-model.number="form.overtimeMultiplier"
                      class="form-select"
                    >
                      <option :value="1">
                        1.0x ({{ t("shiftTemplates.overtime.normal") }})
                      </option>
                      <option :value="1.34">
                        1.34x ({{ t("shiftTemplates.overtime.weekday") }})
                      </option>
                      <option :value="1.67">
                        1.67x ({{ t("shiftTemplates.overtime.restDay") }})
                      </option>
                      <option :value="2">
                        2.0x ({{ t("shiftTemplates.overtime.holiday") }})
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Appearance Section -->
              <div class="form-section">
                <h3 class="section-title">
                  {{ t("shiftTemplates.sections.appearance") }}
                </h3>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">{{
                      t("shiftTemplates.form.colorLabel")
                    }}</label>
                    <div class="color-picker">
                      <input
                        v-model="form.colorCode"
                        type="color"
                        class="color-input"
                      />
                      <span class="color-value">{{ form.colorCode }}</span>
                      <div
                        class="color-preview"
                        :style="{ backgroundColor: form.colorCode }"
                      ></div>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">{{
                      t("shiftTemplates.form.icon")
                    }}</label>
                    <input
                      v-model="form.icon"
                      type="text"
                      class="form-input"
                      placeholder="🌅"
                      maxlength="50"
                    />
                  </div>
                </div>

                <div class="template-preview">
                  <div class="preview-label">
                    {{ t("shiftTemplates.form.preview") }}:
                  </div>
                  <div
                    class="preview-badge"
                    :style="{
                      backgroundColor: form.colorCode + '20',
                      color: form.colorCode,
                      borderColor: form.colorCode,
                    }"
                  >
                    <span v-if="form.icon">{{ form.icon }}</span>
                    <span>{{
                      form.name || t("shiftTemplates.form.name")
                    }}</span>
                  </div>
                </div>
              </div>

              <!-- Status Section -->
              <div class="form-section">
                <div class="form-group">
                  <label class="form-label">
                    <input
                      v-model="form.isActive"
                      type="checkbox"
                      class="form-checkbox"
                    />
                    <span>{{ t("shiftTemplates.form.isActive") }}</span>
                  </label>
                </div>
              </div>

              <!-- Error Message -->
              <transition name="fade">
                <div v-if="error" class="error-message">
                  <span class="error-icon">⚠️</span>
                  <span>{{ error }}</span>
                </div>
              </transition>
            </form>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-cancel"
              :disabled="loading"
              @click="closeModal"
            >
              {{ t("common.cancel") }}
            </button>
            <button
              type="button"
              class="btn btn-submit"
              :disabled="loading || !isFormValid"
              @click="handleSubmit"
            >
              <span v-if="loading" class="btn-spinner"></span>
              <span>{{ isEditing ? t("common.save") : t("common.add") }}</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "@/i18n";
import type {
  CreateShiftTemplateData,
  ShiftTemplate,
} from "@/types/scheduling";

const { t } = useI18n();

interface Props {
  modelValue: boolean;
  template?: ShiftTemplate | null;
  restaurantId: string;
}

const props = defineProps<Props>();

export type ShiftTemplateSaveData = CreateShiftTemplateData & {
  restaurantId: string;
  isActive: boolean;
};

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [data: ShiftTemplateSaveData];
}>();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const weekdays = computed(() => [
  t("weekdays.mini.sunday"),
  t("weekdays.mini.monday"),
  t("weekdays.mini.tuesday"),
  t("weekdays.mini.wednesday"),
  t("weekdays.mini.thursday"),
  t("weekdays.mini.friday"),
  t("weekdays.mini.saturday"),
]);

// Form data
const defaultForm = () => ({
  name: "",
  description: "",
  shiftType: "regular" as "regular" | "split" | "overnight",
  startTime: "09:00",
  endTime: "18:00",
  isSplitShift: false,
  breakStartTime: "",
  breakEndTime: "",
  minEmployees: 1,
  maxEmployees: 5,
  hourlyRate: null as number | null,
  overtimeMultiplier: 1.5,
  colorCode: "#007aff",
  icon: "",
  isActive: true,
});

const form = ref(defaultForm());
const applicableDaysArray = ref<number[]>([1, 2, 3, 4, 5]); // Mon-Fri by default

// Computed
const isEditing = computed(() => !!props.template);

const calculatedHours = computed(() => {
  const { startTime, endTime, isSplitShift, breakStartTime, breakEndTime } =
    form.value;

  if (!startTime || !endTime) return "0.0";

  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);

  // Handle overnight shifts
  if (end <= start) {
    end += 24 * 60;
  }

  let totalMinutes = end - start;

  // Subtract break time if applicable
  if (isSplitShift && breakStartTime && breakEndTime) {
    const breakStart = timeToMinutes(breakStartTime);
    const breakEnd = timeToMinutes(breakEndTime);
    const breakMinutes = breakEnd > breakStart ? breakEnd - breakStart : 0;
    totalMinutes -= breakMinutes;
  }

  return (totalMinutes / 60).toFixed(1);
});

const isFormValid = computed(() => {
  return (
    form.value.name &&
    form.value.startTime &&
    form.value.endTime &&
    form.value.minEmployees > 0 &&
    form.value.maxEmployees >= form.value.minEmployees &&
    applicableDaysArray.value.length > 0
  );
});

// Methods
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const closeModal = () => {
  emit("update:modelValue", false);
  error.value = null;
};

const resetForm = () => {
  if (props.template) {
    // Load existing template data
    form.value = {
      name: props.template.name,
      description: props.template.description || "",
      shiftType: props.template.shiftType,
      startTime: props.template.startTime,
      endTime: props.template.endTime,
      isSplitShift: props.template.isSplitShift,
      breakStartTime: props.template.breakStartTime || "",
      breakEndTime: props.template.breakEndTime || "",
      minEmployees: props.template.minEmployees,
      maxEmployees: props.template.maxEmployees,
      hourlyRate: props.template.hourlyRate,
      overtimeMultiplier: props.template.overtimeMultiplier,
      colorCode: props.template.colorCode,
      icon: props.template.icon || "",
      isActive: props.template.isActive,
    };

    // Parse applicable days
    try {
      const days = JSON.parse(props.template.applicableDays || "[]");
      applicableDaysArray.value = Array.isArray(days) ? days : [];
    } catch {
      applicableDaysArray.value = [1, 2, 3, 4, 5];
    }
  } else {
    form.value = defaultForm();
    applicableDaysArray.value = [1, 2, 3, 4, 5];
  }
};

const handleSubmit = async () => {
  error.value = null;

  if (!isFormValid.value) {
    error.value = t("common.fillRequired");
    return;
  }

  if (form.value.minEmployees > form.value.maxEmployees) {
    error.value = t("shiftTemplates.errors.minExceedsMax");
    return;
  }

  if (applicableDaysArray.value.length === 0) {
    error.value = t("shiftTemplates.errors.noDaysSelected");
    return;
  }

  try {
    loading.value = true;

    const submitData = {
      restaurantId: props.restaurantId,
      ...form.value,
      hourlyRate: form.value.hourlyRate ?? undefined,
      durationMinutes: Math.round(parseFloat(calculatedHours.value) * 60),
      breakDurationMinutes:
        form.value.isSplitShift &&
        form.value.breakStartTime &&
        form.value.breakEndTime
          ? Math.abs(
              timeToMinutes(form.value.breakEndTime) -
                timeToMinutes(form.value.breakStartTime),
            )
          : 0,
      applicableDays: JSON.stringify(applicableDaysArray.value.sort()),
      sortOrder: 0,
    };

    emit("save", submitData);
    closeModal();
  } catch (err) {
    error.value = err instanceof Error ? err.message : t("errors.saveFailed");
  } finally {
    loading.value = false;
  }
};

// Watch for modal open/close
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      resetForm();
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  overflow-y: auto;
}

.modal-container {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 2px solid #f3f4f6;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
}

.title-icon {
  font-size: 24px;
}

.close-btn {
  padding: 8px 12px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.close-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

/* Body */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.form-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #374151;
  margin: 0 0 16px 0;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-label.required::after {
  content: "*";
  color: #ff3b30;
}

.form-input,
.form-select,
.form-textarea {
  padding: 10px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.3s;
  background: white;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: #007aff;
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

.form-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #007aff;
}

/* Days Selector */
.days-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.day-label {
  flex: 1;
  min-width: 60px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: white;
}

.day-label:hover {
  border-color: #d1d5db;
}

.day-label.selected {
  border-color: #007aff;
  background: #eff6ff;
}

.day-checkbox {
  display: none;
}

.day-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.day-label.selected .day-name {
  color: #007aff;
}

/* Color Picker */
.color-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-input {
  width: 50px;
  height: 40px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
}

.color-value {
  font-family: "Courier New", monospace;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
}

.color-preview {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid #e5e7eb;
}

/* Template Preview */
.template-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  margin-top: 12px;
}

.preview-label {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid;
}

/* Info Box */
.info-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #eff6ff;
  border-radius: 8px;
  border-left: 4px solid #007aff;
  font-size: 14px;
  color: #1e40af;
}

.info-icon {
  font-size: 16px;
}

/* Error Message */
.error-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #fee2e2;
  color: #d0332b;
  border-radius: 8px;
  border: 1px solid #fecaca;
  font-size: 14px;
  font-weight: 500;
  margin-top: 16px;
}

.error-icon {
  font-size: 18px;
}

/* Footer */
.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 2px solid #f3f4f6;
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-cancel {
  background: #f3f4f6;
  color: #374151;
}

.btn-cancel:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-submit {
  background: linear-gradient(135deg, #007aff 0%, #2563eb 100%);
  color: white;
}

.btn-submit:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-1px);
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Modal Animation */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9);
}

/* Fade Animation */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
    align-items: flex-start;
  }

  .modal-container {
    max-height: 95vh;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .days-selector {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 480px) {
  .modal-title {
    font-size: 18px;
  }

  .days-selector {
    grid-template-columns: repeat(7, 1fr);
  }

  .day-label {
    min-width: auto;
    padding: 8px 4px;
  }

  .day-name {
    font-size: 12px;
  }
}
</style>
