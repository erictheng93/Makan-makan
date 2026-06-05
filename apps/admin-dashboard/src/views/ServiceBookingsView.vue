<template>
  <div class="space-y-6" data-testid="service-bookings-view">
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">服務預約管理</h1>
        <p class="mt-1 text-sm text-gray-500">
          查看服務預約並處理現金確認、完成、未到與取消。
        </p>
      </div>
      <button
        type="button"
        data-testid="service-bookings-refresh"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        :disabled="isLoading"
        @click="loadBookings"
      >
        重新整理
      </button>
    </div>

    <section class="rounded-lg bg-white p-5 shadow">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <label class="mb-2 block text-sm font-medium text-gray-700">
            日期
          </label>
          <input
            v-model="filters.date"
            data-testid="service-bookings-date"
            type="date"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            @change="loadBookings"
          />
        </div>
        <div>
          <label class="mb-2 block text-sm font-medium text-gray-700">
            狀態
          </label>
          <select
            v-model="filters.status"
            data-testid="service-bookings-status"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            @change="loadBookings"
          >
            <option value="">全部</option>
            <option value="pending">待付款/待確認</option>
            <option value="confirmed">已確認</option>
            <option value="completed">已完成</option>
            <option value="no_show">未到</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>
      <p v-if="errorMessage" class="mt-4 text-sm text-red-600">
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" class="mt-4 text-sm text-green-700">
        {{ successMessage }}
      </p>
    </section>

    <section class="overflow-hidden rounded-lg bg-white shadow">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th class="px-4 py-3">預約</th>
              <th class="px-4 py-3">顧客</th>
              <th class="px-4 py-3">時間</th>
              <th class="px-4 py-3">付款</th>
              <th class="px-4 py-3">狀態</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            <tr v-if="isLoading">
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                載入中...
              </td>
            </tr>
            <tr v-else-if="bookings.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                目前沒有服務預約。
              </td>
            </tr>
            <tr
              v-for="booking in bookings"
              v-else
              :key="booking.id"
              data-testid="service-booking-row"
            >
              <td class="px-4 py-3 align-top">
                <div class="font-medium text-gray-900">
                  {{ booking.serviceNameSnapshot }}
                </div>
                <div class="mt-1 font-mono text-xs text-gray-500">
                  {{ booking.confirmationCode }}
                </div>
                <div
                  v-if="booking.specialRequests"
                  class="mt-1 max-w-xs text-xs text-gray-500"
                >
                  {{ booking.specialRequests }}
                </div>
              </td>
              <td class="px-4 py-3 align-top text-gray-600">
                <div class="font-medium text-gray-900">
                  {{ booking.customerName }}
                </div>
                <div>{{ booking.customerPhone }}</div>
                <div v-if="booking.customerEmail">
                  {{ booking.customerEmail }}
                </div>
                <div>{{ booking.partySize }} 人</div>
              </td>
              <td class="px-4 py-3 align-top text-gray-600">
                <div>{{ booking.bookingDate }}</div>
                <div>{{ booking.bookingTime }}</div>
              </td>
              <td class="px-4 py-3 align-top text-gray-600">
                <div>{{ formatCents(booking.amountDueCents) }}</div>
                <div class="mt-1 text-xs">
                  {{ paymentMethodLabel(booking.paymentMethod) }} ·
                  {{ paymentStatusLabel(booking.paymentStatus) }}
                </div>
              </td>
              <td class="px-4 py-3 align-top">
                <span
                  class="rounded-full px-2 py-1 text-xs font-medium"
                  :class="statusClass(booking.status)"
                >
                  {{ statusLabel(booking.status) }}
                </span>
              </td>
              <td class="px-4 py-3 align-top">
                <div class="flex flex-wrap justify-end gap-2">
                  <button
                    v-if="booking.status === 'pending'"
                    type="button"
                    :data-testid="`booking-confirm-cash-${booking.id}`"
                    class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    :disabled="isSaving"
                    @click="runAction(() => confirmCash(booking.id))"
                  >
                    現金確認
                  </button>
                  <button
                    v-if="booking.status === 'confirmed'"
                    type="button"
                    :data-testid="`booking-complete-${booking.id}`"
                    class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    :disabled="isSaving"
                    @click="runAction(() => completeBooking(booking.id))"
                  >
                    完成
                  </button>
                  <button
                    v-if="booking.status === 'confirmed'"
                    type="button"
                    :data-testid="`booking-no-show-${booking.id}`"
                    class="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                    :disabled="isSaving"
                    @click="runAction(() => markNoShow(booking.id))"
                  >
                    未到
                  </button>
                  <button
                    v-if="
                      booking.status === 'pending' ||
                      booking.status === 'confirmed'
                    "
                    type="button"
                    :data-testid="`booking-cancel-${booking.id}`"
                    class="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    :disabled="isSaving"
                    @click="runAction(() => cancelBooking(booking.id))"
                  >
                    取消
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import {
  serviceBookingsService,
  type ServiceBooking,
  type ServiceBookingStatus,
} from "@/services/serviceBookingsService";

const authStore = useAuthStore();
const today = new Date().toISOString().slice(0, 10);

const bookings = ref<ServiceBooking[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const filters = reactive<{
  date: string;
  status: "" | ServiceBookingStatus;
}>({
  date: today,
  status: "",
});

watch(
  () => authStore.restaurantId,
  () => {
    void loadBookings();
  },
);

onMounted(() => {
  void loadBookings();
});

async function loadBookings() {
  if (!authStore.restaurantId) {
    bookings.value = [];
    return;
  }
  isLoading.value = true;
  errorMessage.value = "";
  try {
    bookings.value = await serviceBookingsService.listBookings({
      restaurantId: authStore.restaurantId,
      date: filters.date || undefined,
      status: filters.status || undefined,
    });
  } catch (error) {
    console.error("Load service bookings failed:", error);
    errorMessage.value = "載入服務預約失敗。";
  } finally {
    isLoading.value = false;
  }
}

async function runAction(action: () => Promise<string>) {
  isSaving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    successMessage.value = await action();
    await loadBookings();
  } catch (error) {
    console.error("Service booking action failed:", error);
    errorMessage.value = "更新服務預約失敗。";
  } finally {
    isSaving.value = false;
  }
}

async function confirmCash(id: string): Promise<string> {
  await serviceBookingsService.confirmCash(id);
  return "預約已以現金確認。";
}

async function completeBooking(id: string): Promise<string> {
  await serviceBookingsService.complete(id);
  return "預約已完成。";
}

async function markNoShow(id: string): Promise<string> {
  await serviceBookingsService.markNoShow(id);
  return "預約已標記未到。";
}

async function cancelBooking(id: string): Promise<string> {
  await serviceBookingsService.cancel(id);
  return "預約已取消。";
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function statusLabel(status: ServiceBookingStatus): string {
  const labels: Record<ServiceBookingStatus, string> = {
    pending: "待處理",
    confirmed: "已確認",
    completed: "已完成",
    cancelled: "已取消",
    no_show: "未到",
  };
  return labels[status];
}

function statusClass(status: ServiceBookingStatus): string {
  const classes: Record<ServiceBookingStatus, string> = {
    pending: "bg-blue-50 text-blue-700",
    confirmed: "bg-green-50 text-green-700",
    completed: "bg-gray-100 text-gray-700",
    cancelled: "bg-red-50 text-red-700",
    no_show: "bg-amber-50 text-amber-700",
  };
  return classes[status];
}

function paymentMethodLabel(method: ServiceBooking["paymentMethod"]): string {
  const labels: Record<ServiceBooking["paymentMethod"], string> = {
    none: "未選付款",
    credits: "代幣",
    cash: "現金",
  };
  return labels[method];
}

function paymentStatusLabel(status: ServiceBooking["paymentStatus"]): string {
  const labels: Record<ServiceBooking["paymentStatus"], string> = {
    unpaid: "未付款",
    deposit_paid: "已付訂金",
    paid: "已付款",
    refunded: "已退款",
  };
  return labels[status];
}
</script>
