<template>
  <div class="shift-distribution-chart">
    <div class="chart-header">
      <h3 class="chart-title">
        <span class="icon">🥧</span>
        {{ t("charts.shiftDistribution.title") }}
      </h3>
      <div class="chart-controls">
        <button
          v-for="type in chartTypes"
          :key="type.value"
          :class="['type-btn', { active: selectedType === type.value }]"
          @click="selectedType = type.value"
        >
          {{ type.label }}
        </button>
      </div>
    </div>

    <div class="distribution-summary">
      <div
        v-for="(shift, index) in shifts"
        :key="shift.id"
        class="shift-badge"
        :style="{ borderLeftColor: colors[index] }"
      >
        <div
          class="badge-color"
          :style="{ backgroundColor: colors[index] }"
        ></div>
        <div class="badge-info">
          <div class="badge-name">{{ shift.name }}</div>
          <div class="badge-count">
            {{ shift.count }} {{ t("charts.shiftDistribution.people") }} ({{
              getPercentage(shift.count)
            }}%)
          </div>
        </div>
      </div>
    </div>

    <BaseChart
      :type="selectedType"
      :data="chartData"
      :height="400"
      :is-loading="isLoading"
      :error="error"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { schedulingService } from "@/services/schedulingService";
import BaseChart from "./BaseChart.vue";
import { CHART_SERIES_COLORS } from "@makanmasak/shared/utils/chart-palette";

interface ShiftData {
  id: string;
  name: string;
  count: number;
  color?: string;
}

interface Props {
  data?: ShiftData[];
  autoFetch?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  autoFetch: false,
});

const { t } = useI18n();
const authStore = useAuthStore();

const selectedType = ref<"pie" | "doughnut">("doughnut");
const isLoading = ref(false);
const error = ref("");
const shifts = ref<ShiftData[]>(props.data);

const chartTypes = computed(() => [
  {
    value: "doughnut" as const,
    label: t("charts.shiftDistribution.doughnutChart"),
  },
  { value: "pie" as const, label: t("charts.shiftDistribution.pieChart") },
]);

const colors = CHART_SERIES_COLORS;

const totalCount = computed(() => {
  return shifts.value.reduce((sum, shift) => sum + shift.count, 0);
});

const getPercentage = (count: number) => {
  if (totalCount.value === 0) return 0;
  return ((count / totalCount.value) * 100).toFixed(1);
};

const chartData = computed(() => {
  return {
    labels: shifts.value.map((shift) => shift.name),
    datasets: [
      {
        label: t("charts.shiftDistribution.distribution"),
        data: shifts.value.map((shift) => shift.count),
        backgroundColor: colors.slice(0, shifts.value.length),
        borderColor: "#ffffff",
        borderWidth: 3,
      },
    ],
  };
});

const fetchData = async () => {
  if (!props.autoFetch) return;

  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  isLoading.value = true;
  error.value = "";

  try {
    const templates = await schedulingService.getShiftTemplates(restaurantId);

    if (Array.isArray(templates) && templates.length > 0) {
      shifts.value = templates.map((tpl) => ({
        id: String(tpl.id),
        name: tpl.name || `${tpl.startTime || ""}-${tpl.endTime || ""}`,
        count: tpl.assignedCount ?? 0,
      }));
    } else {
      shifts.value = [];
    }
  } catch (err) {
    error.value = t("charts.shiftDistribution.loadFailed");
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  if (props.autoFetch) {
    fetchData();
  } else if (props.data.length > 0) {
    shifts.value = props.data;
  }
});
</script>

<style scoped>
.shift-distribution-chart {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.chart-title .icon {
  font-size: 24px;
}

.chart-controls {
  display: flex;
  gap: 8px;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 10px;
}

.type-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.type-btn:hover {
  color: #374151;
}

.type-btn.active {
  background: white;
  color: #007aff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.distribution-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.shift-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 10px;
  border-left: 4px solid #007aff;
  transition: all 0.2s;
}

.shift-badge:hover {
  background: #f3f4f6;
  transform: translateX(2px);
}

.badge-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.badge-info {
  flex: 1;
  min-width: 0;
}

.badge-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-count {
  font-size: 13px;
  color: #6b7280;
  margin-top: 2px;
}

@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .distribution-summary {
    grid-template-columns: 1fr;
  }
}
</style>
