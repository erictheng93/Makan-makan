<template>
  <div class="analytics-view">
    <!-- 頁面標題和日期選擇 -->
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8"
    >
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          {{ t("analytics.title") }}
        </h1>
        <p class="text-gray-600">{{ t("analytics.subtitle") }}</p>
      </div>
      <div class="mt-4 sm:mt-0 flex items-center space-x-4">
        <select
          v-model="selectedPeriod"
          class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          @change="updateData"
        >
          <option value="today">{{ t("analytics.period.today") }}</option>
          <option value="week">{{ t("analytics.period.week") }}</option>
          <option value="month">{{ t("analytics.period.month") }}</option>
          <option value="quarter">{{ t("analytics.period.quarter") }}</option>
          <option value="year">{{ t("analytics.period.year") }}</option>
        </select>
        <button
          class="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          @click="exportReport"
        >
          <DocumentArrowDownIcon class="h-4 w-4 mr-2" />
          {{ t("analytics.exportReport") }}
        </button>
      </div>
    </div>

    <!-- 關鍵指標卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- 總營收 -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-green-100">
            <CurrencyDollarIcon class="h-8 w-8 text-green-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500">
              {{ t("analytics.metrics.totalRevenue") }}
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ formatPrice(metrics.totalRevenue) }}
            </p>
            <p
              :class="
                metrics.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
              "
              class="text-sm"
            >
              <ArrowTrendingUpIcon
                v-if="metrics.revenueChange >= 0"
                class="w-4 h-4 inline mr-1"
              />
              <ArrowTrendingDownIcon v-else class="w-4 h-4 inline mr-1" />
              {{ Math.abs(metrics.revenueChange) }}%
              {{ t("analytics.metrics.vsPrevious") }}
            </p>
          </div>
        </div>
      </div>

      <!-- 訂單數量 -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100">
            <ShoppingBagIcon class="h-8 w-8 text-blue-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500">
              {{ t("analytics.metrics.totalOrders") }}
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ metrics.totalOrders }}
            </p>
            <p
              :class="
                metrics.ordersChange >= 0 ? 'text-green-600' : 'text-red-600'
              "
              class="text-sm"
            >
              <ArrowTrendingUpIcon
                v-if="metrics.ordersChange >= 0"
                class="w-4 h-4 inline mr-1"
              />
              <ArrowTrendingDownIcon v-else class="w-4 h-4 inline mr-1" />
              {{ Math.abs(metrics.ordersChange) }}%
              {{ t("analytics.metrics.vsPrevious") }}
            </p>
          </div>
        </div>
      </div>

      <!-- 平均客單價 -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-purple-100">
            <CalculatorIcon class="h-8 w-8 text-purple-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500">
              {{ t("analytics.metrics.averageOrderValue") }}
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ formatPrice(metrics.averageOrderValue) }}
            </p>
            <p
              :class="
                metrics.aovChange >= 0 ? 'text-green-600' : 'text-red-600'
              "
              class="text-sm"
            >
              <ArrowTrendingUpIcon
                v-if="metrics.aovChange >= 0"
                class="w-4 h-4 inline mr-1"
              />
              <ArrowTrendingDownIcon v-else class="w-4 h-4 inline mr-1" />
              {{ Math.abs(metrics.aovChange) }}%
              {{ t("analytics.metrics.vsPrevious") }}
            </p>
          </div>
        </div>
      </div>

      <!-- 桌台使用率 -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-yellow-100">
            <TableCellsIcon class="h-8 w-8 text-yellow-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-500">
              {{ t("analytics.metrics.tableUtilization") }}
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ metrics.tableUtilization }}%
            </p>
            <p
              :class="
                metrics.tableChange >= 0 ? 'text-green-600' : 'text-red-600'
              "
              class="text-sm"
            >
              <ArrowTrendingUpIcon
                v-if="metrics.tableChange >= 0"
                class="w-4 h-4 inline mr-1"
              />
              <ArrowTrendingDownIcon v-else class="w-4 h-4 inline mr-1" />
              {{ Math.abs(metrics.tableChange) }}%
              {{ t("analytics.metrics.vsPrevious") }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 圖表區域 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <!-- 營收趨勢圖 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("analytics.charts.revenueTrend") }}
        </h3>
        <div
          class="h-64 flex items-center justify-center bg-gray-50 rounded-lg"
        >
          <div class="text-center">
            <ChartBarIcon class="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p class="text-gray-500">
              {{ t("analytics.charts.revenueTrendChart") }}
            </p>
            <p class="text-sm text-gray-400">
              {{ t("analytics.charts.chartInDev") }}
            </p>
          </div>
        </div>
      </div>

      <!-- 訂單狀態分布 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("analytics.charts.orderStatusDist") }}
        </h3>
        <div class="h-64">
          <div class="grid grid-cols-2 gap-4 h-full">
            <div
              v-for="status in orderStatusData"
              :key="status.name"
              class="flex flex-col items-center justify-center"
            >
              <div
                :class="status.color"
                class="w-16 h-16 rounded-full flex items-center justify-center mb-2"
              >
                <span class="text-white font-bold text-lg">{{
                  status.count
                }}</span>
              </div>
              <p class="text-sm text-gray-600 text-center">
                {{ status.name }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 熱門菜品和詳細數據 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- 熱門菜品 -->
      <div class="bg-white rounded-lg shadow">
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            {{ t("analytics.popularItems.title") }}
          </h3>
          <div class="space-y-4">
            <div
              v-for="(item, index) in popularItems"
              :key="item.id"
              class="flex items-center justify-between"
            >
              <div class="flex items-center">
                <div
                  class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center"
                >
                  <span class="text-blue-800 font-semibold text-sm">{{
                    index + 1
                  }}</span>
                </div>
                <div class="ml-4">
                  <p class="text-sm font-medium text-gray-900">
                    {{ item.name }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{
                      t("analytics.popularItems.ordersCount", {
                        count: item.orders,
                      })
                    }}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-medium text-gray-900">
                  {{ formatPrice(item.revenue) }}
                </p>
                <div class="w-32 bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    :style="{
                      width: `${(item.orders / popularItems[0].orders) * 100}%`,
                    }"
                    class="bg-blue-600 h-2 rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 營業時段分析 -->
      <div class="bg-white rounded-lg shadow">
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            {{ t("analytics.businessHours.title") }}
          </h3>
          <div class="space-y-4">
            <div
              v-for="period in businessHours"
              :key="period.time"
              class="flex items-center justify-between"
            >
              <div class="flex items-center">
                <ClockIcon class="w-5 h-5 text-gray-400 mr-3" />
                <span class="text-sm font-medium text-gray-900">{{
                  period.time
                }}</span>
              </div>
              <div class="flex items-center">
                <div class="w-32 bg-gray-200 rounded-full h-2 mr-3">
                  <div
                    :style="{ width: `${period.percentage}%` }"
                    :class="getBusinessHourColor(period.percentage)"
                    class="h-2 rounded-full"
                  />
                </div>
                <span class="text-sm text-gray-600 w-16">{{
                  t("analytics.businessHours.orders", { count: period.orders })
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 詳細報表 -->
    <div class="mt-8 bg-white rounded-lg shadow">
      <div class="p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("analytics.detailedReport.title") }}
        </h3>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {{ t("analytics.detailedReport.date") }}
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {{ t("analytics.detailedReport.orders") }}
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {{ t("analytics.detailedReport.revenue") }}
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {{ t("analytics.detailedReport.averageOrder") }}
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {{ t("analytics.detailedReport.tableUtilization") }}
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="day in dailyData"
                :key="day.date"
                class="hover:bg-gray-50"
              >
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ day.date }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ day.orders }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatPrice(day.revenue) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatPrice(day.averageOrder) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ day.tableUtilization }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "@/i18n";
import { useCurrency } from "@/composables/useCurrency";
import {
  CurrencyDollarIcon,
  ShoppingBagIcon,
  CalculatorIcon,
  TableCellsIcon,
  ChartBarIcon,
  DocumentArrowDownIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
} from "@heroicons/vue/24/outline";

const { t } = useI18n();
const { formatPrice } = useCurrency();

// 響應式數據
const selectedPeriod = ref("today");

// 模擬數據
const metrics = ref({
  totalRevenue: 25680.5,
  revenueChange: 12.5,
  totalOrders: 156,
  ordersChange: 8.3,
  averageOrderValue: 164.62,
  aovChange: 3.7,
  tableUtilization: 78,
  tableChange: -2.1,
});

const orderStatusData = ref([
  {
    name: t("analytics.orderStatus.completed"),
    count: 89,
    color: "bg-green-500",
  },
  {
    name: t("analytics.orderStatus.preparing"),
    count: 23,
    color: "bg-blue-500",
  },
  {
    name: t("analytics.orderStatus.pending"),
    count: 15,
    color: "bg-yellow-500",
  },
  { name: t("analytics.orderStatus.cancelled"), count: 7, color: "bg-red-500" },
]);

const popularItems = ref([
  { id: 1, name: "招牌炒飯", orders: 45, revenue: 540.0 },
  { id: 2, name: "冰奶茶", orders: 38, revenue: 190.0 },
  { id: 3, name: "春卷", orders: 32, revenue: 256.0 },
  { id: 4, name: "南洋咖啡", orders: 28, revenue: 78.4 },
  { id: 5, name: "紅豆冰", orders: 25, revenue: 162.5 },
]);

const businessHours = ref([
  { time: "08:00 - 10:00", orders: 12, percentage: 15 },
  { time: "10:00 - 12:00", orders: 28, percentage: 35 },
  { time: "12:00 - 14:00", orders: 45, percentage: 56 },
  { time: "14:00 - 16:00", orders: 32, percentage: 40 },
  { time: "16:00 - 18:00", orders: 38, percentage: 48 },
  { time: "18:00 - 20:00", orders: 52, percentage: 65 },
  { time: "20:00 - 22:00", orders: 35, percentage: 44 },
]);

const dailyData = ref([
  {
    date: "2024-08-26",
    orders: 156,
    revenue: 2568.5,
    averageOrder: 164.62,
    tableUtilization: 78,
  },
  {
    date: "2024-08-25",
    orders: 142,
    revenue: 2341.2,
    averageOrder: 164.93,
    tableUtilization: 72,
  },
  {
    date: "2024-08-24",
    orders: 138,
    revenue: 2256.8,
    averageOrder: 163.54,
    tableUtilization: 75,
  },
  {
    date: "2024-08-23",
    orders: 161,
    revenue: 2689.4,
    averageOrder: 167.02,
    tableUtilization: 82,
  },
  {
    date: "2024-08-22",
    orders: 149,
    revenue: 2445.7,
    averageOrder: 164.22,
    tableUtilization: 77,
  },
]);

// 方法
const getBusinessHourColor = (percentage: number) => {
  if (percentage >= 60) return "bg-green-500";
  if (percentage >= 40) return "bg-yellow-500";
  return "bg-red-500";
};

const updateData = () => {
  // 根據選擇的時間段更新數據
  console.log("Updating data for period:", selectedPeriod.value);
};

const exportReport = () => {
  alert(t("analytics.exportInDev"));
};

onMounted(() => {
  // 初始化數據
});
</script>

<style scoped>
.analytics-view {
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .analytics-view {
    padding: 1rem;
  }
}
</style>
