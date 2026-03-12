<template>
  <div class="w-full">
    <!-- Header with Filters -->
    <div class="mb-6">
      <div class="mb-4">
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-yellow-100 rounded-lg">
            <ExclamationTriangleIcon class="h-6 w-6 text-yellow-600" />
          </div>
          <h3 class="text-xl font-bold text-gray-900">
            {{ t("schedulingConflicts.title") }}
          </h3>
        </div>
        <p v-if="!loading" class="text-sm text-gray-600">
          {{
            t("schedulingConflicts.conflictCount", { count: conflicts.length })
          }}
        </p>
      </div>

      <!-- Filter Buttons -->
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="severity in severityFilters"
          :key="severity.value"
          class="flex items-center gap-2 px-4 py-2 border-2 rounded-lg font-semibold text-sm transition-all"
          :class="
            selectedSeverity === severity.value
              ? 'border-blue-600 bg-blue-50 text-blue-600'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          "
          @click="selectedSeverity = severity.value"
        >
          <component
            :is="severity.icon"
            class="h-4 w-4"
            :class="severity.iconClass"
          />
          <span>{{ severity.label }}</span>
          <span
            v-if="getFilterCount(severity.value) > 0"
            class="flex items-center justify-center min-w-[20px] h-5 px-2 rounded-full text-xs font-bold"
            :class="
              selectedSeverity === severity.value
                ? 'bg-blue-600 text-white'
                : 'bg-blue-600 text-white'
            "
          >
            {{ getFilterCount(severity.value) }}
          </span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-20">
      <div
        class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"
      ></div>
      <p class="text-gray-600">{{ t("schedulingConflicts.loading") }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredConflicts.length === 0" class="text-center py-20">
      <div class="flex items-center justify-center mb-4">
        <div class="p-4 bg-green-100 rounded-full">
          <CheckCircleIcon class="h-16 w-16 text-green-600" />
        </div>
      </div>
      <h3 class="text-xl font-bold text-gray-900 mb-2">
        {{ t("schedulingConflicts.noConflicts") }}
      </h3>
      <p class="text-sm text-gray-600">
        {{
          selectedSeverity === "all"
            ? t("schedulingConflicts.allNormal")
            : t("schedulingConflicts.noConflictsForSeverity", {
                severity: getSeverityLabel(selectedSeverity),
              })
        }}
      </p>
    </div>

    <!-- Conflicts List -->
    <div v-else class="space-y-4">
      <transition-group name="list">
        <div
          v-for="conflict in filteredConflicts"
          :key="conflict.id"
          class="bg-white rounded-lg p-5 shadow hover:shadow-md transition-all duration-200 hover:-translate-y-1 border-l-4"
          :class="getSeverityCardClass(conflict.severity)"
        >
          <!-- Card Header -->
          <div
            class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4"
          >
            <div
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border"
              :class="getSeverityBadgeClass(conflict.severity)"
            >
              <div
                class="w-2 h-2 rounded-full"
                :class="getSeverityDotClass(conflict.severity)"
              ></div>
              <span>{{ getSeverityLabel(conflict.severity) }}</span>
            </div>
            <div
              class="text-xs font-semibold text-gray-600 px-3 py-1.5 bg-gray-100 rounded-lg"
            >
              {{ getConflictTypeLabel(conflict.conflictType) }}
            </div>
          </div>

          <!-- Card Content -->
          <div class="mb-4">
            <h4 class="text-base font-semibold text-gray-900 mb-2">
              {{ conflict.message }}
            </h4>
            <p
              v-if="conflict.conflictDetails"
              class="text-sm text-gray-600 leading-relaxed mb-4"
            >
              {{ conflict.conflictDetails }}
            </p>

            <!-- Metadata -->
            <div class="flex flex-wrap gap-4 text-xs text-gray-600">
              <div v-if="conflict.employeeId" class="flex items-center gap-2">
                <UserIcon class="h-4 w-4 text-gray-500" />
                <span
                  >{{ t("schedulingConflicts.affectedEmployee") }}:
                  {{ conflict.employeeId }}</span
                >
              </div>
              <div class="flex items-center gap-2">
                <CalendarIcon class="h-4 w-4 text-gray-500" />
                <span
                  >{{ t("schedulingConflicts.detectedAt") }}:
                  {{ formatDate(conflict.createdAt) }}</span
                >
              </div>
              <div class="flex items-center gap-2">
                <ClipboardDocumentListIcon class="h-4 w-4 text-gray-500" />
                <span
                  >{{ t("common.status") }}:
                  {{ getStatusLabel(conflict.status) }}</span
                >
              </div>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="flex flex-wrap gap-2">
            <button
              class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all hover:-translate-y-0.5 hover:shadow text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              :disabled="conflict.status !== 'unresolved'"
              @click="handleResolve(conflict)"
            >
              <CheckIcon class="h-4 w-4" />
              <span>{{ t("schedulingConflicts.markResolved") }}</span>
            </button>
            <button
              class="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="conflict.status !== 'unresolved'"
              @click="handleIgnore(conflict)"
            >
              <EyeSlashIcon class="h-4 w-4" />
              <span>{{ t("schedulingConflicts.ignore") }}</span>
            </button>
            <button
              class="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-semibold"
              @click="showDetails(conflict)"
            >
              <InformationCircleIcon class="h-4 w-4" />
              <span>{{ t("common.viewDetails") }}</span>
            </button>
          </div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "@/i18n";
import type { SchedulingConflict } from "@/types/scheduling";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  UserIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  CheckIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  EyeSlashIcon,
} from "@heroicons/vue/24/outline";

interface Props {
  conflicts: SchedulingConflict[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  resolve: [conflict: SchedulingConflict];
}>();

const { t } = useI18n();

// State
const selectedSeverity = ref<string>("all");

// Filters with icon components
const severityFilters = computed(() => [
  {
    value: "all",
    label: t("schedulingConflicts.all"),
    icon: ChartBarIcon,
    iconClass: "text-gray-500",
  },
  {
    value: "error",
    label: t("schedulingConflicts.error"),
    icon: XCircleIcon,
    iconClass: "text-red-500",
  },
  {
    value: "warning",
    label: t("schedulingConflicts.warning"),
    icon: ExclamationCircleIcon,
    iconClass: "text-yellow-500",
  },
  {
    value: "info",
    label: t("schedulingConflicts.info"),
    icon: InformationCircleIcon,
    iconClass: "text-blue-500",
  },
]);

// Computed
const filteredConflicts = computed(() => {
  if (selectedSeverity.value === "all") {
    return props.conflicts;
  }
  return props.conflicts.filter((c) => c.severity === selectedSeverity.value);
});

const getFilterCount = (severity: string) => {
  if (severity === "all") return props.conflicts.length;
  return props.conflicts.filter((c) => c.severity === severity).length;
};

// Styling Methods
const getSeverityCardClass = (severity: string) => {
  const classes: Record<string, string> = {
    error: "border-red-500 bg-red-50",
    warning: "border-yellow-500 bg-yellow-50",
    info: "border-blue-500 bg-blue-50",
  };
  return classes[severity] || "border-gray-300";
};

const getSeverityBadgeClass = (severity: string) => {
  const classes: Record<string, string> = {
    error: "bg-red-100 text-red-700 border-red-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return classes[severity] || "bg-gray-100 text-gray-700 border-gray-200";
};

const getSeverityDotClass = (severity: string) => {
  const classes: Record<string, string> = {
    error: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  };
  return classes[severity] || "bg-gray-500";
};

// Label Methods
const getSeverityLabel = (severity: string) => {
  const keyMap: Record<string, string> = {
    error: "schedulingConflicts.error",
    warning: "schedulingConflicts.warning",
    info: "schedulingConflicts.info",
  };
  return keyMap[severity] ? t(keyMap[severity]) : severity;
};

const getConflictTypeLabel = (type: string) => {
  const keyMap: Record<string, string> = {
    overlapping_shifts: "schedulingConflicts.typeOverlapping",
    insufficient_rest: "schedulingConflicts.typeInsufficientRest",
    max_hours_exceeded: "schedulingConflicts.typeMaxHours",
    consecutive_days_exceeded: "schedulingConflicts.typeConsecutiveDays",
    skill_mismatch: "schedulingConflicts.typeSkillMismatch",
    leave_conflict: "schedulingConflicts.typeLeaveConflict",
    availability_conflict: "schedulingConflicts.typeAvailability",
  };
  return keyMap[type] ? t(keyMap[type]) : type;
};

const getStatusLabel = (status: string) => {
  const keyMap: Record<string, string> = {
    unresolved: "schedulingConflicts.statusUnresolved",
    acknowledged: "schedulingConflicts.statusAcknowledged",
    resolved: "schedulingConflicts.statusResolved",
    ignored: "schedulingConflicts.statusIgnored",
  };
  return keyMap[status] ? t(keyMap[status]) : status;
};

const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Event Handlers
const handleResolve = (conflict: SchedulingConflict) => {
  emit("resolve", conflict);
};

const handleIgnore = (conflict: SchedulingConflict) => {
  // TODO: Implement ignore functionality
  console.log("Ignore conflict:", conflict.id);
};

const showDetails = (conflict: SchedulingConflict) => {
  // TODO: Implement details modal
  console.log("Show conflict details:", conflict);
};
</script>

<style scoped>
/* List Animation */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
