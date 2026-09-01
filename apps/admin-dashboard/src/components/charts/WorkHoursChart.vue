<template>
  <div class="work-hours-chart">
    <div class="chart-header">
      <h3 class="chart-title">
        <span class="icon">📊</span>
        {{ t("scheduling.stats.totalHours") }}
      </h3>
      <div class="chart-filters">
        <select
          v-model="selectedPeriod"
          class="period-select"
          @change="updateChart"
        >
          <option value="week">{{ t("scheduling.stats.thisWeek") }}</option>
          <option value="month">{{ t("scheduling.stats.thisMonth") }}</option>
          <option value="custom">
            {{ t("charts.workHours.customPeriod") }}
          </option>
        </select>
        <select v-model="chartType" class="type-select">
          <option value="bar">{{ t("charts.workHours.barChart") }}</option>
          <option value="line">{{ t("charts.workHours.lineChart") }}</option>
        </select>
      </div>
    </div>

    <div class="stats-summary">
      <div class="stat-card">
        <div class="stat-label">{{ t("charts.workHours.totalHours") }}</div>
        <div class="stat-value">
          {{ totalHours.toFixed(1) }}{{ t("charts.workHours.hoursUnit") }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t("charts.workHours.averageHours") }}</div>
        <div class="stat-value">
          {{ averageHours.toFixed(1) }}{{ t("charts.workHours.hoursUnit") }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t("charts.workHours.employeeCount") }}</div>
        <div class="stat-value">{{ employeeCount }}</div>
      </div>
    </div>

    <BaseChart
      :type="chartType"
      :data="chartData"
      :height="350"
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

interface EmployeeHours {
  employeeId: string;
  employeeName: string;
  hours: number;
}

interface AttendanceReportItem {
  employeeId?: string | number;
  id?: string | number;
  employeeName?: string;
  name?: string;
  totalHours?: number;
  hours?: number;
}

interface Props {
  data?: EmployeeHours[];
  autoFetch?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  autoFetch: false,
});

const { t } = useI18n();
const authStore = useAuthStore();

const selectedPeriod = ref<"week" | "month" | "custom">("week");
const chartType = ref<"bar" | "line">("bar");
const isLoading = ref(false);
const error = ref("");
const workHoursData = ref<EmployeeHours[]>(props.data);

// 統計數據
const totalHours = computed(() => {
  return workHoursData.value.reduce((sum, item) => sum + item.hours, 0);
});

const averageHours = computed(() => {
  if (workHoursData.value.length === 0) return 0;
  return totalHours.value / workHoursData.value.length;
});

const employeeCount = computed(() => {
  return workHoursData.value.length;
});

const isAttendanceReportItem = (
  value: unknown,
): value is AttendanceReportItem => typeof value === "object" && value !== null;

// 圖表數據
const chartData = computed(() => {
  // 按工時排序
  const sortedData = [...workHoursData.value].sort((a, b) => b.hours - a.hours);

  // 只顯示前 10 名
  const top10 = sortedData.slice(0, 10);

  return {
    labels: top10.map((item) => item.employeeName),
    datasets: [
      {
        label: t("scheduling.columns.hours"),
        data: top10.map((item) => item.hours),
        backgroundColor: top10.map((_, index) => {
          // 漸變配色
          const hue = 210 - index * 15;
          return `hsl(${hue}, 70%, 60%)`;
        }),
        borderColor: "#007aff",
        borderWidth: 0,
      },
    ],
  };
});

// 獲取數據
const fetchData = async () => {
  if (!props.autoFetch) return;

  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  isLoading.value = true;
  error.value = "";

  try {
    const now = new Date();
    const endDate = now.toISOString().split("T")[0];
    const startDate = new Date(
      now.getTime() -
        (selectedPeriod.value === "month" ? 30 : 7) * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .split("T")[0];

    const report = await schedulingService.getAttendanceReport(
      restaurantId,
      startDate,
      endDate,
    );

    const data: unknown = report.data;
    if (Array.isArray(data)) {
      workHoursData.value = data.filter(isAttendanceReportItem).map((item) => {
        const employeeId = item.employeeId ?? item.id ?? "";
        return {
          employeeId: String(employeeId),
          employeeName: item.employeeName || item.name || `#${employeeId}`,
          hours: item.totalHours || item.hours || 0,
        };
      });
    } else {
      workHoursData.value = [];
    }
  } catch (err) {
    error.value = t("charts.workHours.loadFailed");
    console.error(err);
  } finally {
    isLoading.value = false;
  }
};

const updateChart = () => {
  fetchData();
};

onMounted(() => {
  if (props.autoFetch) {
    fetchData();
  } else if (props.data.length > 0) {
    workHoursData.value = props.data;
  }
});
</script>

<style scoped>
.work-hours-chart {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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

.chart-filters {
  display: flex;
  gap: 10px;
}

.period-select,
.type-select {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.period-select:hover,
.type-select:hover {
  border-color: #007aff;
}

.period-select:focus,
.type-select:focus {
  outline: none;
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #007aff;
  padding: 16px;
  border-radius: 12px;
  color: white;
}

.stat-card:nth-child(2) {
  background: #34c759;
}

.stat-card:nth-child(3) {
  background: #ff9500;
}

.stat-label {
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
}

@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .chart-filters {
    width: 100%;
  }

  .period-select,
  .type-select {
    flex: 1;
  }

  .stats-summary {
    grid-template-columns: 1fr;
  }
}
</style>
