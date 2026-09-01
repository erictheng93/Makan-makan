<template>
  <div class="trend-chart">
    <div class="chart-header">
      <h3 class="chart-title">
        <span class="icon">📈</span>
        {{ t("charts.trend.title") }}
      </h3>
      <div class="chart-filters">
        <select
          v-model="selectedMetric"
          class="metric-select"
          @change="updateChart"
        >
          <option value="total">{{ t("charts.trend.totalHours") }}</option>
          <option value="average">{{ t("charts.trend.averageHours") }}</option>
          <option value="schedules">
            {{ t("charts.trend.scheduleCount") }}
          </option>
        </select>
        <select
          v-model="selectedPeriod"
          class="period-select"
          @change="updateChart"
        >
          <option value="7days">{{ t("charts.trend.last7Days") }}</option>
          <option value="30days">{{ t("charts.trend.last30Days") }}</option>
          <option value="90days">{{ t("charts.trend.last90Days") }}</option>
        </select>
      </div>
    </div>

    <div class="trend-highlights">
      <div class="highlight-card">
        <div class="highlight-label">
          <span class="icon">📊</span>
          {{ t("charts.trend.currentValue") }}
        </div>
        <div class="highlight-value">{{ currentValue }}</div>
      </div>
      <div class="highlight-card">
        <div class="highlight-label">
          <span class="icon">📉</span>
          {{ t("charts.trend.trend") }}
        </div>
        <div class="highlight-value" :class="trendClass">
          {{ trendText }}
          <span class="trend-icon">{{ trendIcon }}</span>
        </div>
      </div>
      <div class="highlight-card">
        <div class="highlight-label">
          <span class="icon">🎯</span>
          {{ t("charts.trend.changeRate") }}
        </div>
        <div class="highlight-value" :class="changeClass">
          {{ changeRate }}
        </div>
      </div>
    </div>

    <BaseChart
      type="line"
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
import { useDateFormatter } from "@/composables/useDateFormatter";
import BaseChart from "./BaseChart.vue";

interface TrendData {
  date: string;
  value: number;
}

interface Props {
  data?: TrendData[];
  autoFetch?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  autoFetch: false,
});

const { t } = useI18n();
const authStore = useAuthStore();
const { formatShortDate } = useDateFormatter();

const selectedMetric = ref("total");
const selectedPeriod = ref("7days");
const isLoading = ref(false);
const error = ref("");
const trendData = ref<TrendData[]>(props.data);

// 當前值
const currentValue = computed(() => {
  if (trendData.value.length === 0) return "0";
  const latest = trendData.value[trendData.value.length - 1];

  if (selectedMetric.value === "schedules") {
    return `${latest.value} ${t("charts.trend.items")}`;
  }
  return `${latest.value.toFixed(1)}${t("charts.workHours.hoursUnit")}`;
});

// 趨勢計算
const trendCalculation = computed(() => {
  if (trendData.value.length < 2) {
    return { trend: "stable", change: 0 };
  }

  const latest = trendData.value[trendData.value.length - 1].value;
  const previous = trendData.value[trendData.value.length - 2].value;

  const change = ((latest - previous) / previous) * 100;

  let trend = "stable";
  if (change > 5) trend = "up";
  else if (change < -5) trend = "down";

  return { trend, change };
});

const trendText = computed(() => {
  const { trend } = trendCalculation.value;
  if (trend === "up") return t("charts.trend.upTrend");
  if (trend === "down") return t("charts.trend.downTrend");
  return t("charts.trend.stable");
});

const trendIcon = computed(() => {
  const { trend } = trendCalculation.value;
  if (trend === "up") return "↗";
  if (trend === "down") return "↘";
  return "→";
});

const trendClass = computed(() => {
  const { trend } = trendCalculation.value;
  return {
    "trend-up": trend === "up",
    "trend-down": trend === "down",
    "trend-stable": trend === "stable",
  };
});

const changeRate = computed(() => {
  const { change } = trendCalculation.value;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
});

const changeClass = computed(() => {
  const { change } = trendCalculation.value;
  return {
    "change-positive": change > 0,
    "change-negative": change < 0,
  };
});

// 圖表數據
const chartData = computed(() => {
  return {
    labels: trendData.value.map((item) => {
      const date = new Date(item.date);
      return formatShortDate(date);
    }),
    datasets: [
      {
        label: getMetricLabel(),
        data: trendData.value.map((item) => item.value),
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderColor: "#007aff",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };
});

const getMetricLabel = () => {
  switch (selectedMetric.value) {
    case "total":
      return t("charts.trend.totalHours");
    case "average":
      return t("charts.trend.averageHours");
    case "schedules":
      return t("charts.trend.scheduleCount");
    default:
      return t("charts.trend.currentValue");
  }
};

const fetchData = async () => {
  if (!props.autoFetch) return;

  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  isLoading.value = true;
  error.value = "";

  try {
    const days =
      selectedPeriod.value === "7days"
        ? 7
        : selectedPeriod.value === "30days"
          ? 30
          : 90;

    const today = new Date();

    // Fetch daily stats for each day in the period
    const fetchPromises = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      fetchPromises.push(
        schedulingService
          .getDailyStats(restaurantId, dateStr)
          .then((stats) => ({
            date: dateStr,
            // "average" = hours per employee that day (issue #209); the API
            // has no averageHours field, so it is derived client-side.
            value:
              selectedMetric.value === "schedules"
                ? (stats.totalSchedules ?? 0)
                : selectedMetric.value === "average"
                  ? stats.totalEmployees > 0
                    ? (stats.totalHours ?? 0) / stats.totalEmployees
                    : 0
                  : (stats.totalHours ?? 0),
          }))
          .catch(() => ({ date: dateStr, value: 0 })),
      );
    }

    const results = await Promise.all(fetchPromises);
    trendData.value = results.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  } catch (err) {
    error.value = t("charts.trend.loadFailed");
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
    trendData.value = props.data;
  }
});
</script>

<style scoped>
.trend-chart {
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

.metric-select,
.period-select {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.metric-select:hover,
.period-select:hover {
  border-color: #007aff;
}

.metric-select:focus,
.period-select:focus {
  outline: none;
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.trend-highlights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.highlight-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
  border-radius: 12px;
  transition: transform 0.2s;
}

.highlight-card:hover {
  transform: translateY(-2px);
}

.highlight-card:nth-child(1) {
  background: #007aff;
  color: white;
}

.highlight-card:nth-child(2) {
  background: #34c759;
  color: white;
}

.highlight-card:nth-child(3) {
  background: #ff9500;
  color: white;
}

.highlight-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.highlight-value {
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.trend-icon {
  font-size: 28px;
}

.trend-up {
  color: #34c759;
}

.trend-down {
  color: #ff3b30;
}

.trend-stable {
  color: #6b7280;
}

.change-positive {
  color: #34c759;
}

.change-negative {
  color: #ff3b30;
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

  .metric-select,
  .period-select {
    flex: 1;
  }

  .trend-highlights {
    grid-template-columns: 1fr;
  }
}
</style>
