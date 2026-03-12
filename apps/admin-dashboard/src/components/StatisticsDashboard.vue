<template>
  <div class="statistics-dashboard">
    <!-- 頁面標題和控制 -->
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8"
    >
      <div>
        <h1 class="text-3xl font-bold text-gray-900">
          {{ t("statisticsDashboard.title") }}
        </h1>
        <p class="text-gray-600 mt-1">
          {{ t("statisticsDashboard.subtitle") }}
        </p>
      </div>
      <div class="mt-4 sm:mt-0 flex items-center space-x-4">
        <!-- 自動刷新控制 -->
        <div class="flex items-center">
          <label class="flex items-center cursor-pointer">
            <input
              v-model="statisticsService.autoRefresh.value"
              type="checkbox"
              class="sr-only"
              @change="handleAutoRefreshChange"
            />
            <div class="relative">
              <div
                class="w-10 h-6 bg-gray-200 rounded-full shadow-inner transition-colors duration-200 ease-in-out"
                :class="{ 'bg-blue-500': statisticsService.autoRefresh.value }"
              />
              <div
                class="absolute left-0 top-0 w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out"
                :class="{
                  'translate-x-4': statisticsService.autoRefresh.value,
                }"
              />
            </div>
            <span class="ml-2 text-sm text-gray-700">{{
              t("statisticsDashboard.autoRefresh")
            }}</span>
          </label>
        </div>

        <button
          :disabled="statisticsService.isLoading.value"
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          @click="handleRefresh"
        >
          <ArrowPathIcon
            class="h-4 w-4 mr-2"
            :class="{ 'animate-spin': statisticsService.isLoading.value }"
          />
          {{ t("statisticsDashboard.refresh") }}
        </button>

        <button
          class="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          @click="handleExport"
        >
          <DocumentArrowDownIcon class="h-4 w-4 mr-2" />
          {{ t("statisticsDashboard.export") }}
        </button>
      </div>
    </div>

    <!-- 最後更新時間和連線狀態 -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <div class="flex items-center text-sm text-gray-500">
          <ClockIcon class="h-4 w-4 mr-1" />
          <span v-if="statisticsService.lastUpdated.value">
            {{ t("statisticsDashboard.lastUpdate") }}:
            {{ formatDateTime(statisticsService.lastUpdated.value) }}
          </span>
          <span v-else>{{ t("statisticsDashboard.noDataLoaded") }}</span>
        </div>

        <!-- WebSocket 連線狀態 -->
        <div class="flex items-center text-sm" :class="connectionStatus.color">
          <component
            :is="connectionStatus.icon"
            class="h-4 w-4 mr-1"
            :class="{ 'animate-spin': isConnecting }"
          />
          <span>{{ connectionStatus.text }}</span>
        </div>
      </div>

      <div class="flex items-center space-x-2">
        <div v-if="statisticsService.error.value" class="text-red-600 text-sm">
          {{ statisticsService.error.value }}
        </div>
        <div v-if="sseError" class="text-orange-600 text-sm">
          SSE: {{ sseError }}
        </div>
        <button
          v-if="!isConnected && !isConnecting"
          class="text-blue-600 hover:text-blue-800 text-sm underline"
          @click="reconnect"
        >
          {{ t("statisticsDashboard.reconnect") }}
        </button>
      </div>
    </div>

    <!-- 實時統計卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- 待處理訂單 -->
      <StatCard
        :title="t('statisticsDashboard.pendingOrders')"
        :value="statisticsService.dashboardData.realtime_stats.pending_orders"
        icon="QueueListIcon"
        color="yellow"
        :subtitle="`${statisticsService.dashboardData.realtime_stats.preparing_orders} ${t('statisticsDashboard.preparing')}`"
      />

      <!-- 完成率 -->
      <StatCard
        :title="t('statisticsDashboard.completionRateToday')"
        :value="`${statisticsService.completionRateToday}%`"
        icon="CheckCircleIcon"
        :color="
          statisticsService.completionRateToday >= 90
            ? 'green'
            : statisticsService.completionRateToday >= 80
              ? 'yellow'
              : 'red'
        "
        :subtitle="`${statisticsService.dashboardData.realtime_stats.completed_today}/${statisticsService.dashboardData.realtime_stats.total_today} ${t('statisticsDashboard.ordersUnit')}`"
      />

      <!-- 平均製作時間 -->
      <StatCard
        :title="t('statisticsDashboard.avgPrepTime')"
        :value="
          statisticsService.formatTime(
            statisticsService.dashboardData.kpis.avg_preparation_time,
          )
        "
        icon="ClockIcon"
        :color="
          statisticsService.dashboardData.kpis.avg_preparation_time <= 20
            ? 'green'
            : statisticsService.dashboardData.kpis.avg_preparation_time <= 30
              ? 'yellow'
              : 'red'
        "
        :subtitle="t('statisticsDashboard.targetTime')"
      />

      <!-- 效率評分 -->
      <StatCard
        :title="t('statisticsDashboard.efficiencyScore')"
        :value="`${statisticsService.dashboardData.kpis.efficiency_score}分`"
        icon="ChartBarIcon"
        :color="
          statisticsService.dashboardData.kpis.efficiency_score >= 85
            ? 'green'
            : statisticsService.dashboardData.kpis.efficiency_score >= 70
              ? 'yellow'
              : 'red'
        "
        :subtitle="t('statisticsDashboard.compositeEfficiency')"
      />
    </div>

    <!-- 系統負載和活躍訂單 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
      <!-- 系統負載 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("statisticsDashboard.systemLoad") }}
        </h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">{{
              t("statisticsDashboard.kitchenCapacity")
            }}</span>
            <span class="text-sm font-medium"
              >{{
                statisticsService.dashboardData.system_load.active_orders
              }}/{{
                statisticsService.dashboardData.system_load.kitchen_capacity
              }}</span
            >
          </div>
          <div class="w-full bg-gray-200 rounded-full h-3">
            <div
              class="h-3 rounded-full transition-all duration-300"
              :class="
                statisticsService.getLoadColor(
                  statisticsService.dashboardData.system_load.load_percentage,
                )
              "
              :style="{
                width: `${statisticsService.dashboardData.system_load.load_percentage}%`,
              }"
            />
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">{{
              t("statisticsDashboard.loadLevel")
            }}</span>
            <span
              :class="
                statisticsService
                  .getLoadColor(
                    statisticsService.dashboardData.system_load.load_percentage,
                  )
                  .replace('bg-', 'text-')
              "
            >
              {{ statisticsService.dashboardData.system_load.load_percentage }}%
            </span>
          </div>
        </div>
      </div>

      <!-- 緊急訂單 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("statisticsDashboard.urgentOrders") }}
        </h3>
        <div class="space-y-3">
          <div
            v-if="statisticsService.urgentOrders.length === 0"
            class="text-center py-4"
          >
            <CheckCircleIcon class="mx-auto h-8 w-8 text-green-500 mb-2" />
            <p class="text-sm text-gray-500">
              {{ t("statisticsDashboard.noUrgentOrders") }}
            </p>
          </div>
          <div v-else>
            <div
              v-for="order in statisticsService.urgentOrders.slice(0, 3)"
              :key="order.id"
              class="flex items-center justify-between p-3 bg-red-50 rounded-lg"
            >
              <div>
                <p class="text-sm font-medium text-gray-900">
                  #{{ order.order_number }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ t("statisticsDashboard.tableNumber") }}
                  {{ order.table_id }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-sm font-medium text-red-600">
                  {{ order.elapsed_minutes
                  }}{{ t("statisticsDashboard.minutes") }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ order.status }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 今日營收 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("statisticsDashboard.todayRevenue") }}
        </h3>
        <div class="space-y-3">
          <div class="text-3xl font-bold text-green-600">
            {{
              statisticsService.formatCurrency(
                statisticsService.dashboardData.realtime_stats.revenue_today,
              )
            }}
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">{{
              t("statisticsDashboard.avgOrderValue")
            }}</span>
            <span class="font-medium">{{
              statisticsService.formatCurrency(
                statisticsService.averageOrderValue,
              )
            }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">{{
              t("statisticsDashboard.ordersPerHour")
            }}</span>
            <span class="font-medium"
              >{{ statisticsService.dashboardData.kpis.orders_per_hour }}
              {{ t("statisticsDashboard.ordersUnit") }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- 圖表和分析 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <!-- 每小時完成率 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("statisticsDashboard.hourlyCompletionRate") }}
        </h3>
        <div class="space-y-3">
          <div
            v-for="hour in statisticsService.dashboardData
              .hourly_completion_rate"
            :key="hour.hour"
            class="flex items-center justify-between"
          >
            <span class="text-sm text-gray-600">{{ hour.hour }}:00</span>
            <div class="flex items-center space-x-3">
              <div class="w-32 bg-gray-200 rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all duration-300"
                  :class="
                    hour.completion_rate >= 90
                      ? 'bg-green-500'
                      : hour.completion_rate >= 80
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  "
                  :style="{ width: `${hour.completion_rate}%` }"
                />
              </div>
              <span class="text-sm font-medium w-12 text-right"
                >{{ hour.completion_rate }}%</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- 分類平均時間 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("statisticsDashboard.categoryAvgTime") }}
        </h3>
        <div class="space-y-3">
          <div
            v-for="category in statisticsService.slowestCategories"
            :key="category.category_name"
            class="flex items-center justify-between"
          >
            <div>
              <span class="text-sm font-medium text-gray-900">{{
                category.category_name
              }}</span>
              <span class="text-xs text-gray-500 ml-2"
                >({{ category.item_count }}
                {{ t("statisticsDashboard.items") }})</span
              >
            </div>
            <div class="text-right">
              <span
                class="text-sm font-medium"
                :class="
                  category.avg_time_minutes <= 15
                    ? 'text-green-600'
                    : category.avg_time_minutes <= 25
                      ? 'text-yellow-600'
                      : 'text-red-600'
                "
              >
                {{ Math.round(category.avg_time_minutes)
                }}{{ t("statisticsDashboard.minutes") }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 績效趨勢圖表 -->
    <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
      <PerformanceTrendChart
        :data="statisticsService.dashboardData.performance_trend"
        :title="t('statisticsDashboard.performanceTrend')"
        :is-loading="statisticsService.isLoading.value"
      />
    </div>

    <!-- 詳細趨勢數據表格 -->
    <div class="bg-white rounded-lg shadow-sm mb-8">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ t("statisticsDashboard.detailedTrend") }}
          </h3>
          <div class="flex items-center">
            <div
              :class="`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                statisticsService.performanceTrendDirection === 'up'
                  ? 'bg-green-100 text-green-800'
                  : statisticsService.performanceTrendDirection === 'down'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
              }`"
            >
              <ArrowTrendingUpIcon
                v-if="statisticsService.performanceTrendDirection === 'up'"
                class="w-3 h-3 mr-1"
              />
              <ArrowTrendingDownIcon
                v-if="statisticsService.performanceTrendDirection === 'down'"
                class="w-3 h-3 mr-1"
              />
              <MinusIcon
                v-if="statisticsService.performanceTrendDirection === 'stable'"
                class="w-3 h-3 mr-1"
              />
              {{
                statisticsService.performanceTrendDirection === "up"
                  ? t("statisticsDashboard.trendUp")
                  : statisticsService.performanceTrendDirection === "down"
                    ? t("statisticsDashboard.trendDown")
                    : t("statisticsDashboard.trendStable")
              }}
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ t("statisticsDashboard.colDate") }}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ t("statisticsDashboard.colTotalOrders") }}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ t("statisticsDashboard.colCompleted") }}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ t("statisticsDashboard.colCompletionRate") }}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ t("statisticsDashboard.colAvgTime") }}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ t("statisticsDashboard.colRevenue") }}
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="trend in statisticsService.dashboardData
                  .performance_trend"
                :key="trend.date"
                class="hover:bg-gray-50 transition-colors"
              >
                <td class="px-4 py-3 text-sm font-medium text-gray-900">
                  {{ formatDate(trend.date) }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                  {{ trend.total_orders }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                  {{ trend.completed_orders }}
                </td>
                <td class="px-4 py-3 text-sm">
                  <div class="flex items-center">
                    <span
                      :class="`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        trend.completion_rate >= 90
                          ? 'bg-green-100 text-green-800'
                          : trend.completion_rate >= 80
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`"
                    >
                      {{ trend.completion_rate }}%
                    </span>
                    <div class="ml-2 w-16 bg-gray-200 rounded-full h-1.5">
                      <div
                        :class="`h-1.5 rounded-full ${
                          trend.completion_rate >= 90
                            ? 'bg-green-500'
                            : trend.completion_rate >= 80
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`"
                        :style="{ width: `${trend.completion_rate}%` }"
                      />
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                  <span
                    :class="`${
                      (trend.avg_prep_time || 0) <= 20
                        ? 'text-green-600'
                        : (trend.avg_prep_time || 0) <= 30
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`"
                  >
                    {{ Math.round(trend.avg_prep_time || 0)
                    }}{{ t("statisticsDashboard.minutes") }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">
                  {{ statisticsService.formatCurrency(trend.revenue) }}
                </td>
              </tr>
            </tbody>
          </table>

          <div
            v-if="
              statisticsService.dashboardData.performance_trend.length === 0
            "
            class="text-center py-8"
          >
            <ChartBarIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p class="text-gray-500">
              {{ t("statisticsDashboard.noTrendData") }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 活躍訂單列表 -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        {{ t("statisticsDashboard.activeOrders") }} ({{
          statisticsService.totalActiveOrders
        }})
      </h3>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {{ t("statisticsDashboard.colOrderNo") }}
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {{ t("statisticsDashboard.colCustomer") }}
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {{ t("statisticsDashboard.colTable") }}
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {{ t("statisticsDashboard.colType") }}
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {{ t("statisticsDashboard.colStatus") }}
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {{ t("statisticsDashboard.colWaitTime") }}
              </th>
              <th
                class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {{ t("statisticsDashboard.colAmount") }}
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="order in statisticsService.dashboardData.active_orders"
              :key="order.id"
              class="hover:bg-gray-50"
              :class="{ 'bg-red-50': order.elapsed_minutes > 30 }"
            >
              <td class="px-4 py-3 text-sm font-medium text-gray-900">
                #{{ order.order_number }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">
                {{ order.customer_name || t("statisticsDashboard.anonymous") }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">
                {{ order.table_id || "-" }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">
                {{ order.order_type }}
              </td>
              <td class="px-4 py-3 text-sm">
                <span
                  :class="`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statisticsService.getStatusColor(order.status)}`"
                >
                  {{ getStatusText(order.status) }}
                </span>
              </td>
              <td
                class="px-4 py-3 text-sm"
                :class="
                  order.elapsed_minutes > 30
                    ? 'text-red-600 font-semibold'
                    : 'text-gray-900'
                "
              >
                {{ order.elapsed_minutes }}分鐘
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">
                {{ statisticsService.formatCurrency(order.total) }}
              </td>
            </tr>
          </tbody>
        </table>

        <div
          v-if="statisticsService.dashboardData.active_orders.length === 0"
          class="text-center py-8"
        >
          <CheckCircleIcon class="mx-auto h-12 w-12 text-green-500 mb-4" />
          <p class="text-gray-500">
            {{ t("statisticsDashboard.noActiveOrders") }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from "vue";
import { useI18n } from "@/i18n";
import { statisticsService } from "@/services/statisticsService";

const { t } = useI18n();
import useStatisticsSSE from "@/composables/useStatisticsSSE";
import StatCard from "@/components/StatCard.vue";
import PerformanceTrendChart from "@/components/PerformanceTrendChart.vue";
import {
  ArrowPathIcon,
  DocumentArrowDownIcon,
  ClockIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  WifiIcon,
  ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";

// SSE 實時更新
const {
  isConnected,
  isConnecting,
  error: sseError,
  disconnect: disconnectSSE,
  reconnect,
} = useStatisticsSSE();

// SSE 連線狀態指示
const connectionStatus = computed(() => {
  if (isConnected.value)
    return {
      text: t("statisticsDashboard.connected"),
      color: "text-green-600",
      icon: WifiIcon,
    };
  if (isConnecting.value)
    return {
      text: t("statisticsDashboard.connecting"),
      color: "text-yellow-600",
      icon: ArrowPathIcon,
    };
  return {
    text: t("statisticsDashboard.disconnected"),
    color: "text-red-600",
    icon: ExclamationTriangleIcon,
  };
});

// 初始化數據載入
onMounted(() => {
  statisticsService.fetchDashboardData();
});

onUnmounted(() => {
  statisticsService.cleanup();
  disconnectSSE();
});

// 事件處理
const handleRefresh = () => {
  statisticsService.fetchDashboardData();
};

const handleAutoRefreshChange = () => {
  statisticsService.setAutoRefresh(statisticsService.autoRefresh.value);
};

const handleExport = () => {
  const csvData = statisticsService.exportCSV();
  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `statistics_${new Date().toISOString().split("T")[0]}.csv`,
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 輔助方法
const formatDateTime = (date: Date) => {
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  });
};

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: t("statisticsDashboard.statusPending"),
    preparing: t("statisticsDashboard.statusPreparing"),
    ready: t("statisticsDashboard.statusReady"),
    completed: t("statisticsDashboard.statusCompleted"),
    cancelled: t("statisticsDashboard.statusCancelled"),
  };
  return statusMap[status] || status;
};
</script>

<style scoped>
.statistics-dashboard {
  @apply p-6;
}

@media (max-width: 640px) {
  .statistics-dashboard {
    @apply p-4;
  }
}
</style>
