<template>
  <div class="space-y-6">
    <!-- 主要 KPI 指標 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div
        v-for="kpi in kpiMetrics"
        :key="kpi.key"
        class="bg-white rounded-lg shadow-sm p-6 border-l-4"
        :class="kpi.borderColor"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">
              {{ kpi.label }}
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ kpi.value }}
            </p>
            <p
              :class="[
                'text-sm flex items-center mt-2',
                kpi.trend === 'up'
                  ? 'text-green-600'
                  : kpi.trend === 'down'
                    ? 'text-red-600'
                    : 'text-gray-500',
              ]"
            >
              <component :is="kpi.trendIcon" class="w-4 h-4 mr-1" />
              {{ kpi.change }}
            </p>
          </div>
          <div
            :class="[
              'w-12 h-12 rounded-lg flex items-center justify-center',
              kpi.bgColor,
            ]"
          >
            <component :is="kpi.icon" class="w-6 h-6 text-white" />
          </div>
        </div>
      </div>
    </div>

    <!-- 快速操作面板 -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">
        {{ t("owner.quickActions") }}
      </h2>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <button
          v-for="action in quickActions"
          :key="action.key"
          class="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50 transition-colors duration-200"
          @click="handleQuickAction(action.key)"
        >
          <component :is="action.icon" class="w-8 h-8 text-gray-400 mb-2" />
          <span class="text-sm font-medium text-gray-700">{{
            action.label
          }}</span>
        </button>
      </div>
    </div>

    <!-- 實時監控儀表板 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 實時訂單狀態 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ t("owner.realtimeOrders") }}
          </h3>
          <div class="flex items-center text-sm text-gray-500">
            <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
            {{ t("owner.liveUpdate") }}
          </div>
        </div>
        <div class="space-y-3">
          <div
            v-for="order in realtimeOrders"
            :key="order.id"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div>
              <p class="font-medium text-gray-900">
                {{ t("owner.tableNumber") }} {{ order.tableNumber }}
              </p>
              <p class="text-sm text-gray-600">
                {{ t("owner.itemCount", { count: order.items }) }}
              </p>
            </div>
            <div class="text-right">
              <span
                :class="[
                  'px-2 py-1 rounded-full text-xs font-medium',
                  order.status === 'preparing'
                    ? 'bg-yellow-100 text-yellow-800'
                    : order.status === 'ready'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800',
                ]"
              >
                {{ getStatusText(order.status) }}
              </span>
              <p class="text-sm text-gray-500 mt-1">
                {{ order.time }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 員工動態 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("owner.staffActivity") }}
        </h3>
        <div class="space-y-3">
          <div
            v-for="staff in staffActivity"
            :key="staff.id"
            class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
          >
            <div
              :class="[
                'w-3 h-3 rounded-full',
                staff.status === 'online'
                  ? 'bg-green-500'
                  : staff.status === 'busy'
                    ? 'bg-yellow-500'
                    : 'bg-red-500',
              ]"
            />
            <div class="flex-1">
              <p class="font-medium text-gray-900">
                {{ staff.name }}
              </p>
              <p class="text-sm text-gray-600">
                {{ staff.role }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-sm font-medium text-gray-900">
                {{ staff.performance }}%
              </p>
              <p class="text-xs text-gray-500">{{ t("owner.efficiency") }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 財務摘要 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("owner.todayFinance") }}
        </h3>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-gray-600">{{ t("owner.revenue") }}</span>
            <span class="font-bold text-green-600"
              >NT$ {{ todayRevenue.toLocaleString() }}</span
            >
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-600">{{ t("owner.orderCount") }}</span>
            <span class="font-medium text-gray-900">{{ todayOrders }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-600">{{ t("owner.avgOrderValue") }}</span>
            <span class="font-medium text-gray-900"
              >NT$ {{ Math.round(todayRevenue / todayOrders) }}</span
            >
          </div>
          <div class="pt-3 border-t border-gray-200">
            <div class="flex justify-between items-center">
              <span class="text-gray-600">{{
                t("owner.estimatedMonthly")
              }}</span>
              <span class="font-bold text-purple-600"
                >NT$ {{ (todayRevenue * 30).toLocaleString() }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 營運分析圖表 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 營業額趨勢 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ t("owner.revenueTrend") }}
          </h3>
          <select
            v-model="revenueTimeRange"
            class="text-sm border border-gray-300 rounded-md px-3 py-1"
          >
            <option value="7d">{{ t("owner.timeRange.7d") }}</option>
            <option value="30d">{{ t("owner.timeRange.30d") }}</option>
            <option value="3m">{{ t("owner.timeRange.3m") }}</option>
          </select>
        </div>
        <div class="h-64 flex items-center justify-center text-gray-500">
          <ChartBarIcon class="w-12 h-12 mr-2" />
          {{ t("owner.chartPlaceholder") }}
        </div>
      </div>

      <!-- 熱門商品 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("owner.popularItems") }}
        </h3>
        <div class="space-y-3">
          <div
            v-for="item in popularItems"
            :key="item.id"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div class="flex items-center space-x-3">
              <div
                class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center"
              >
                <span class="text-sm font-bold text-orange-600">{{
                  item.rank
                }}</span>
              </div>
              <div>
                <p class="font-medium text-gray-900">
                  {{ item.name }}
                </p>
                <p class="text-sm text-gray-600">
                  {{ item.category }}
                </p>
              </div>
            </div>
            <div class="text-right">
              <p class="font-medium text-gray-900">
                {{ t("owner.salesCount", { count: item.sales }) }}
              </p>
              <p class="text-sm text-gray-600">
                NT$ {{ item.revenue.toLocaleString() }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 系統健康狀態 -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        {{ t("owner.systemHealth") }}
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          v-for="system in systemHealth"
          :key="system.name"
          class="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                system.status === 'healthy'
                  ? 'bg-green-500'
                  : system.status === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-red-500',
              ]"
            />
            <div>
              <p class="font-medium text-gray-900">
                {{ system.name }}
              </p>
              <p class="text-sm text-gray-600">
                {{ system.description }}
              </p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm font-medium text-gray-900">
              {{ system.uptime }}
            </p>
            <p class="text-xs text-gray-500">{{ t("owner.uptime") }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 緊急處理面板 -->
    <div
      v-if="emergencyAlerts.length > 0"
      class="bg-red-50 border border-red-200 rounded-lg p-6"
    >
      <div class="flex items-center mb-4">
        <ExclamationTriangleIcon class="w-6 h-6 text-red-600 mr-2" />
        <h3 class="text-lg font-semibold text-red-900">
          {{ t("owner.emergency") }}
        </h3>
      </div>
      <div class="space-y-3">
        <div
          v-for="alert in emergencyAlerts"
          :key="alert.id"
          class="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200"
        >
          <div>
            <p class="font-medium text-red-900">
              {{ alert.title }}
            </p>
            <p class="text-sm text-red-700">
              {{ alert.description }}
            </p>
            <p class="text-xs text-red-600 mt-1">
              {{ alert.time }}
            </p>
          </div>
          <div class="flex space-x-2">
            <button
              class="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
              @click="handleEmergencyAlert(alert.id, 'resolve')"
            >
              {{ t("owner.resolve") }}
            </button>
            <button
              class="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
              @click="handleEmergencyAlert(alert.id, 'escalate')"
            >
              {{ t("owner.escalate") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "@/i18n";
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  // ArrowTrendingDownIcon,
  MinusIcon,
  // PlusIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  BellIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  UserPlusIcon,
} from "@heroicons/vue/24/outline";
import { ownerService } from "@/services/ownerService";
import { useAuthStore } from "@/stores/auth";

const { t } = useI18n();

// KPI 指標
const kpiMetrics = ref([
  {
    key: "revenue",
    label: t("owner.kpi.todayRevenue"),
    value: "NT$ 45,680",
    change: "+12.5%",
    trend: "up",
    trendIcon: ArrowTrendingUpIcon,
    icon: CurrencyDollarIcon,
    borderColor: "border-green-500",
    bgColor: "bg-green-500",
  },
  {
    key: "orders",
    label: t("owner.kpi.todayOrders"),
    value: "127",
    change: "+8.2%",
    trend: "up",
    trendIcon: ArrowTrendingUpIcon,
    icon: ShoppingCartIcon,
    borderColor: "border-blue-500",
    bgColor: "bg-blue-500",
  },
  {
    key: "staff",
    label: t("owner.kpi.onlineStaff"),
    value: "8/10",
    change: t("owner.kpi.normal"),
    trend: "stable",
    trendIcon: MinusIcon,
    icon: UsersIcon,
    borderColor: "border-purple-500",
    bgColor: "bg-purple-500",
  },
  {
    key: "efficiency",
    label: t("owner.kpi.overallEfficiency"),
    value: "94%",
    change: "+2.1%",
    trend: "up",
    trendIcon: ArrowTrendingUpIcon,
    icon: ChartBarIcon,
    borderColor: "border-orange-500",
    bgColor: "bg-orange-500",
  },
]);

// 快速操作
const quickActions = ref([
  { key: "add-staff", label: t("owner.actions.addStaff"), icon: UserPlusIcon },
  {
    key: "update-menu",
    label: t("owner.actions.updateMenu"),
    icon: DocumentTextIcon,
  },
  {
    key: "view-reports",
    label: t("owner.actions.viewReports"),
    icon: ClipboardDocumentListIcon,
  },
  {
    key: "system-settings",
    label: t("owner.actions.systemSettings"),
    icon: Cog6ToothIcon,
  },
  {
    key: "send-notification",
    label: t("owner.actions.sendNotification"),
    icon: BellIcon,
  },
  {
    key: "emergency",
    label: t("owner.actions.emergency"),
    icon: ExclamationTriangleIcon,
  },
]);

// 實時訂單
const realtimeOrders = ref([
  {
    id: 1,
    tableNumber: "A02",
    items: 3,
    status: "preparing",
    time: "2 分鐘前",
  },
  { id: 2, tableNumber: "B05", items: 2, status: "ready", time: "5 分鐘前" },
  { id: 3, tableNumber: "C01", items: 4, status: "new", time: "剛剛" },
]);

// 員工動態
const staffActivity = ref([
  { id: 1, name: "張小明", role: "廚師", status: "online", performance: 98 },
  { id: 2, name: "李美華", role: "送菜員", status: "busy", performance: 95 },
  { id: 3, name: "王大偉", role: "收銀員", status: "online", performance: 92 },
  { id: 4, name: "陳小芳", role: "廚師", status: "offline", performance: 88 },
]);

// 財務數據
const todayRevenue = ref(45680);
const todayOrders = ref(127);
const revenueTimeRange = ref("7d");

// 熱門商品
const popularItems = ref([
  {
    id: 1,
    rank: 1,
    name: "招牌炒河粉",
    category: "主食",
    sales: 45,
    revenue: 13500,
  },
  {
    id: 2,
    rank: 2,
    name: "椒鹽排骨",
    category: "主菜",
    sales: 38,
    revenue: 15200,
  },
  {
    id: 3,
    rank: 3,
    name: "蒜蓉菠菜",
    category: "蔬菜",
    sales: 32,
    revenue: 6400,
  },
  {
    id: 4,
    rank: 4,
    name: "冬瓜湯",
    category: "湯品",
    sales: 28,
    revenue: 4200,
  },
]);

// 系統健康狀態
const systemHealth = ref([
  {
    name: "API 服務",
    description: "後端服務",
    status: "healthy",
    uptime: "99.9%",
  },
  {
    name: "數據庫",
    description: "數據存儲",
    status: "healthy",
    uptime: "99.8%",
  },
  {
    name: "支付系統",
    description: "支付處理",
    status: "warning",
    uptime: "98.5%",
  },
]);

// 緊急警報
const emergencyAlerts = ref([
  {
    id: 1,
    title: "廚房設備故障",
    description: "爐具 #2 溫度異常，需要立即維修",
    time: "3 分鐘前",
  },
]);

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    new: t("owner.status.new"),
    preparing: t("owner.status.preparing"),
    ready: t("owner.status.ready"),
    delivered: t("owner.status.delivered"),
  };
  return statusMap[status] || status;
};

// Duplicate function declarations removed - see implementations below

const authStore = useAuthStore();
const isLoading = ref(true);
const error = ref<string | null>(null);

const loadDashboardData = async () => {
  try {
    isLoading.value = true;
    error.value = null;

    const data = await ownerService.getDashboardData(
      authStore.restaurantId ?? undefined,
    );

    // 更新 KPI 指標
    kpiMetrics.value = [
      {
        key: "revenue",
        label: t("owner.kpi.todayRevenue"),
        value: `NT$ ${data.today_overview.total_revenue.toLocaleString()}`,
        change: "+12.5%", // 可以從 API 獲取
        trend: "up",
        trendIcon: ArrowTrendingUpIcon,
        icon: CurrencyDollarIcon,
        borderColor: "border-green-500",
        bgColor: "bg-green-500",
      },
      {
        key: "orders",
        label: t("owner.kpi.todayOrders"),
        value: data.today_overview.total_orders.toString(),
        change: "+8.2%",
        trend: "up",
        trendIcon: ArrowTrendingUpIcon,
        icon: ShoppingCartIcon,
        borderColor: "border-blue-500",
        bgColor: "bg-blue-500",
      },
      {
        key: "staff",
        label: t("owner.kpi.onlineStaff"),
        value: `${data.staff_status.online_staff}/${data.staff_status.total_staff}`,
        change: t("owner.kpi.normal"),
        trend: "stable",
        trendIcon: MinusIcon,
        icon: UsersIcon,
        borderColor: "border-purple-500",
        bgColor: "bg-purple-500",
      },
      {
        key: "efficiency",
        label: t("owner.kpi.overallEfficiency"),
        value: `${Math.round((data.staff_status.avg_chef_efficiency + data.staff_status.avg_service_efficiency) / 2)}%`,
        change: "+2.1%",
        trend: "up",
        trendIcon: ArrowTrendingUpIcon,
        icon: ChartBarIcon,
        borderColor: "border-orange-500",
        bgColor: "bg-orange-500",
      },
    ];

    // 更新今日財務數據
    todayRevenue.value = data.today_overview.total_revenue;
    todayOrders.value = data.today_overview.total_orders;

    // 更新緊急警報
    emergencyAlerts.value = data.emergency_alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      description: alert.description,
      time: new Date(alert.created_at).toLocaleString(),
    }));

    // 更新熱門商品
    popularItems.value = data.popular_items.map((item, index) => ({
      id: index + 1,
      rank: index + 1,
      name: item.name,
      category: "主食", // 可以從 API 獲取分類
      sales: item.sales_count,
      revenue: item.revenue,
    }));
  } catch (err) {
    console.error("Error loading dashboard data:", err);
    error.value = err instanceof Error ? err.message : t("owner.loadFailed");
  } finally {
    isLoading.value = false;
  }
};

const handleQuickAction = async (action: string) => {
  try {
    await ownerService.handleQuickAction(action);
  } catch (err) {
    console.error("Error handling quick action:", err);
    alert(t("owner.operationFailed"));
  }
};

const handleEmergencyAlert = async (alertId: number, action: string) => {
  try {
    if (action === "resolve") {
      await ownerService.resolveEmergencyAlert(alertId);
      // 移除已解決的警報
      emergencyAlerts.value = emergencyAlerts.value.filter(
        (alert) => alert.id !== alertId,
      );
    } else if (action === "escalate") {
      await ownerService.escalateEmergencyAlert(alertId);
    }
  } catch (err) {
    console.error("Error handling emergency alert:", err);
    alert(t("owner.operationFailed"));
  }
};

// 定時更新數據
let updateInterval: NodeJS.Timeout;

onMounted(async () => {
  await loadDashboardData();

  // 每 30 秒更新一次數據
  updateInterval = setInterval(loadDashboardData, 30000);
});

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
</script>
