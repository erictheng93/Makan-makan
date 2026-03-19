<template>
  <div class="bg-ios-bg min-h-screen px-5 pt-6 pb-10">
    <!-- Header Row -->
    <div class="flex items-center gap-3">
      <button
        class="w-11 h-11 rounded-full bg-white shadow-card-sm flex items-center justify-center flex-shrink-0"
        @click="$router.back()"
      >
        <ArrowLeft class="w-5 h-5 text-ios-text" />
      </button>
      <h1 class="text-2xl font-extrabold text-ios-text flex-1">歷史紀錄</h1>

      <!-- iOS Segmented Control -->
      <div class="bg-white rounded-full p-1 inline-flex gap-0.5 shadow-card-sm">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="px-3.5 py-1.5 text-sm rounded-full transition-all duration-200"
          :class="
            activeTab === tab.key
              ? 'bg-ios-blue text-white font-semibold shadow-card-sm'
              : 'text-ios-secondary font-medium'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Summary Card -->
    <div class="bg-white rounded-2xl p-4 shadow-card mt-4">
      <div class="grid grid-cols-3 divide-x divide-ios-bg">
        <!-- Total Orders -->
        <div class="flex flex-col items-center px-3">
          <span class="text-2xl font-extrabold text-ios-text">{{
            summary.total
          }}</span>
          <span class="text-xs text-ios-secondary mt-0.5">總訂單</span>
        </div>
        <!-- Avg Cooking Time -->
        <div class="flex flex-col items-center px-3">
          <span class="text-2xl font-extrabold text-ios-green">{{
            summary.avgCookingTime
          }}</span>
          <span class="text-xs text-ios-secondary mt-0.5">平均製作 (min)</span>
        </div>
        <!-- On-time Rate -->
        <div class="flex flex-col items-center px-3">
          <span class="text-2xl font-extrabold text-ios-blue"
            >{{ summary.onTimeRate }}%</span
          >
          <span class="text-xs text-ios-secondary mt-0.5">準時率</span>
        </div>
      </div>
    </div>

    <!-- Order List -->
    <div
      v-if="filteredOrders.length > 0"
      class="bg-white rounded-2xl shadow-card overflow-hidden mt-4"
    >
      <div
        v-for="order in filteredOrders"
        :key="order.id"
        class="flex items-center justify-between py-3.5 px-4 border-b border-ios-bg last:border-b-0"
      >
        <!-- Left: info -->
        <div class="flex flex-col gap-0.5 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Order Number -->
            <span
              class="text-base font-extrabold"
              :class="
                order.status === 6
                  ? 'text-ios-secondary line-through'
                  : 'text-ios-text'
              "
            >
              {{ order.orderNumber }}
            </span>
            <!-- Status Badge -->
            <span
              class="text-xs font-semibold px-2 py-0.5 rounded-full"
              :class="statusBadgeClass(order.status)"
            >
              {{ statusLabel(order.status) }}
            </span>
            <!-- Type Badge -->
            <span
              v-if="order.deliveryInfo?.type"
              class="text-xs font-semibold px-2 py-0.5 rounded-full bg-ios-bg"
              :class="
                order.status === 6 ? 'text-ios-tertiary' : 'text-ios-secondary'
              "
            >
              {{ typeLabel(order.deliveryInfo.type) }}
            </span>
          </div>
          <!-- Second line: table, items, cooking time -->
          <div
            class="flex items-center gap-2 text-xs text-ios-secondary flex-wrap"
          >
            <span v-if="order.tableName">{{ order.tableName }}</span>
            <span
              v-if="order.tableName && order.totalItems"
              class="text-ios-tertiary"
              >·</span
            >
            <span>{{ order.totalItems }} 項</span>
            <span class="text-ios-tertiary">·</span>
            <span>{{ orderCookingTime(order) }} min</span>
          </div>
        </div>

        <!-- Right: timestamp -->
        <div class="text-xs text-ios-secondary flex-shrink-0 ml-3">
          {{ formatTime(order.createdAt) }}
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-16">
      <Inbox class="w-12 h-12 text-ios-tertiary" />
      <p class="text-base font-semibold text-ios-text mt-4">尚無訂單紀錄</p>
      <p class="text-sm text-ios-secondary mt-1">
        選擇的時間範圍內沒有已完成的訂單
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ArrowLeft, Inbox } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { kitchenApi } from "@/services/kitchenApi";
import type { KitchenOrder, OrderStatus } from "@/types";

// ── Auth ──────────────────────────────────────────────────────────────────────
const authStore = useAuthStore();

// ── Tab state ─────────────────────────────────────────────────────────────────
type TabKey = "today" | "yesterday" | "week";

const tabs: { key: TabKey; label: string }[] = [
  { key: "today", label: "今天" },
  { key: "yesterday", label: "昨天" },
  { key: "week", label: "本週" },
];

const activeTab = ref<TabKey>("today");

// ── Data ──────────────────────────────────────────────────────────────────────
const allOrders = ref<KitchenOrder[]>([]);
const loading = ref(false);

onMounted(async () => {
  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  loading.value = true;
  try {
    const response = await kitchenApi.getOrders(restaurantId);
    if (response.success && response.data) {
      // Collect all orders from the three queues
      allOrders.value = [
        ...response.data.pending,
        ...response.data.preparing,
        ...response.data.ready,
      ];
    }
  } catch (err) {
    console.error("Failed to fetch history orders:", err);
  } finally {
    loading.value = false;
  }
});

// ── Date helpers ──────────────────────────────────────────────────────────────
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function tabRange(): { from: Date; to: Date } {
  const now = new Date();
  if (activeTab.value === "today") {
    return { from: startOfDay(now), to: endOfDay(now) };
  }
  if (activeTab.value === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }
  // week: last 7 days
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6);
  return { from: startOfDay(weekAgo), to: endOfDay(now) };
}

// ── Filtered orders ───────────────────────────────────────────────────────────
const filteredOrders = computed<KitchenOrder[]>(() => {
  const { from, to } = tabRange();
  return allOrders.value.filter((order) => {
    const ts = new Date(order.createdAt).getTime();
    return ts >= from.getTime() && ts <= to.getTime();
  });
});

// ── Summary ───────────────────────────────────────────────────────────────────
const summary = computed(() => {
  const orders = filteredOrders.value;
  const total = orders.length;

  // Average cooking time (minutes) across all items that have start + end
  let totalCookSecs = 0;
  let cookCount = 0;
  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (item.startedAt && item.completedAt) {
        const diff =
          (new Date(item.completedAt).getTime() -
            new Date(item.startedAt).getTime()) /
          60000;
        totalCookSecs += diff;
        cookCount++;
      }
    });
  });
  const avgCookingTime =
    cookCount > 0 ? Math.round(totalCookSecs / cookCount) : 0;

  // On-time rate: completed orders (status 4/5) that were finished within estimatedTime
  const completedOrders = orders.filter(
    (o) => o.status === 4 || o.status === 5,
  );
  const onTimeCount = completedOrders.filter((o) => {
    if (!o.estimatedTime || !o.confirmedAt) return false;
    const elapsed = (Date.now() - new Date(o.confirmedAt).getTime()) / 60000;
    return elapsed <= o.estimatedTime;
  }).length;
  const onTimeRate =
    completedOrders.length > 0
      ? Math.round((onTimeCount / completedOrders.length) * 100)
      : 0;

  return { total, avgCookingTime, onTimeRate };
});

// ── Per-order cooking time ────────────────────────────────────────────────────
function orderCookingTime(order: KitchenOrder): number {
  let total = 0;
  let count = 0;
  order.items.forEach((item) => {
    if (item.startedAt && item.completedAt) {
      total +=
        (new Date(item.completedAt).getTime() -
          new Date(item.startedAt).getTime()) /
        60000;
      count++;
    }
  });
  return count > 0 ? Math.round(total / count) : 0;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
function statusLabel(status: OrderStatus): string {
  const map: Record<number, string> = {
    0: "待確認",
    1: "已確認",
    2: "製作中",
    3: "已完成",
    4: "已送達",
    5: "已付款",
    6: "已取消",
  };
  return map[status] ?? "未知";
}

function statusBadgeClass(status: OrderStatus): string {
  if (status === 6) return "bg-ios-bg text-ios-tertiary";
  if (status === 3 || status === 4 || status === 5)
    return "bg-ios-green/10 text-ios-green";
  if (status === 2) return "bg-ios-orange/10 text-ios-orange";
  return "bg-ios-blue/10 text-ios-blue";
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    dine_in: "內用",
    takeaway: "外帶",
    delivery: "外送",
  };
  return map[type] ?? type;
}

// ── Time formatter ────────────────────────────────────────────────────────────
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}
</script>
