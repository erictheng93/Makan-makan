<template>
  <div class="space-y-6">
    <div
      class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <h1 class="text-2xl font-bold text-gray-900">市場結帳紀錄</h1>
        <p class="mt-1 text-sm text-gray-500">
          追蹤跨攤位 checkout、子訂單與聯合付款狀態。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="w-fit rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          :disabled="isExporting"
          data-testid="export-checkouts"
          @click="exportCheckouts"
        >
          {{ isExporting ? "匯出中..." : "匯出 CSV" }}
        </button>
        <button
          type="button"
          class="w-fit rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          :disabled="isExportingVendors"
          data-testid="export-vendor-settlements"
          @click="exportVendorSettlements"
        >
          {{ isExportingVendors ? "匯出中..." : "匯出攤位對帳" }}
        </button>
        <button
          type="button"
          class="w-fit rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="isLoading"
          @click="loadCheckouts"
        >
          {{ isLoading ? "讀取中..." : "重新整理" }}
        </button>
      </div>
    </div>

    <section class="rounded-lg bg-white p-4 shadow-ios-card">
      <div
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_12rem_10rem_10rem_auto]"
      >
        <input
          v-model="marketSlug"
          type="search"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          placeholder="市場 slug"
          @keyup.enter="loadCheckouts"
        />
        <select
          v-model="paymentStatus"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">全部付款狀態</option>
          <option value="pending">待付款</option>
          <option value="partial_paid">部分付款</option>
          <option value="paid">已付款</option>
          <option value="failed">付款失敗</option>
          <option value="refunded">已退款</option>
          <option value="partial_refunded">部分退款</option>
        </select>
        <input
          v-model="dateFrom"
          type="date"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          aria-label="起始日期"
          data-testid="market-checkout-date-from"
        />
        <input
          v-model="dateTo"
          type="date"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          aria-label="結束日期"
          data-testid="market-checkout-date-to"
        />
        <button
          type="button"
          data-testid="market-checkout-filter"
          class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          @click="loadCheckouts"
        >
          篩選
        </button>
      </div>
    </section>

    <section
      v-if="summary"
      data-testid="checkout-summary"
      class="grid gap-3 md:grid-cols-3 xl:grid-cols-6"
    >
      <div
        v-for="metric in summaryMetrics"
        :key="metric.label"
        class="rounded-lg bg-white p-4 shadow-ios-card"
      >
        <div class="text-xs font-medium text-gray-500">{{ metric.label }}</div>
        <div class="mt-2 text-xl font-semibold text-gray-900">
          {{ metric.value }}
        </div>
      </div>
    </section>

    <section
      v-if="summary?.topMarkets.length"
      class="rounded-lg bg-white p-4 shadow-ios-card"
    >
      <div class="mb-3 text-sm font-semibold text-gray-900">市場排行</div>
      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="market in summary.topMarkets"
          :key="market.slug"
          class="rounded-lg border border-gray-200 p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold text-gray-900">{{ market.name }}</div>
              <div class="mt-1 text-xs text-gray-500">/{{ market.slug }}</div>
            </div>
            <div class="text-right text-sm font-semibold text-gray-900">
              {{ formatCents(market.subtotalCents) }}
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
            <span class="rounded-full bg-gray-100 px-2.5 py-1">
              {{ market.checkoutCount }} 筆
            </span>
            <span
              class="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"
            >
              已收 {{ formatCents(market.paidAmountCents) }}
            </span>
            <span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
              已退 {{ formatCents(market.refundedAmountCents) }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <section
      v-if="vendorSettlements.length"
      data-testid="vendor-settlements"
      class="rounded-lg bg-white p-4 shadow-ios-card"
    >
      <div class="mb-3 text-sm font-semibold text-gray-900">攤位對帳</div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="text-xs text-gray-500">
            <tr>
              <th class="whitespace-nowrap py-2 pr-4 font-medium">攤位</th>
              <th class="whitespace-nowrap px-4 py-2 font-medium">子訂單</th>
              <th class="whitespace-nowrap px-4 py-2 font-medium">GMV</th>
              <th class="whitespace-nowrap px-4 py-2 font-medium">已收</th>
              <th class="whitespace-nowrap px-4 py-2 font-medium">已退</th>
              <th class="whitespace-nowrap px-4 py-2 font-medium">淨收</th>
              <th class="whitespace-nowrap pl-4 py-2 font-medium">異常</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="vendor in vendorSettlements"
              :key="vendor.restaurantId"
              class="text-gray-700"
            >
              <td class="min-w-44 py-3 pr-4">
                <div class="font-semibold text-gray-900">
                  {{ vendor.restaurantName }}
                </div>
                <div class="mt-1 text-xs text-gray-500">
                  {{ vendor.checkoutCount }} 筆 checkout
                </div>
              </td>
              <td class="whitespace-nowrap px-4 py-3">
                {{ vendor.childOrderCount }}
              </td>
              <td class="whitespace-nowrap px-4 py-3">
                {{ formatCents(vendor.subtotalCents) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-emerald-700">
                {{ formatCents(vendor.paidAmountCents) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-slate-700">
                {{ formatCents(vendor.refundedAmountCents) }}
              </td>
              <td
                class="whitespace-nowrap px-4 py-3 font-semibold text-gray-900"
              >
                {{ formatCents(vendor.netPaidAmountCents) }}
              </td>
              <td class="whitespace-nowrap pl-4 py-3 text-gray-600">
                {{ vendor.failedPaymentCount }} 失敗 /
                {{ vendor.refundedPaymentCount }} 退款
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="rounded-lg bg-white shadow-ios-card">
      <div v-if="error" class="p-4 text-sm text-red-600">{{ error }}</div>
      <div v-else-if="isLoading" class="p-8 text-center text-sm text-gray-500">
        載入市場結帳中...
      </div>
      <div
        v-else-if="checkouts.length === 0"
        class="p-8 text-center text-sm text-gray-500"
      >
        尚無市場結帳紀錄。
      </div>
      <div v-else class="divide-y divide-gray-200">
        <article
          v-for="checkout in checkouts"
          :key="checkout.id"
          class="grid gap-3 p-4 lg:grid-cols-[1.2fr_8rem_8rem_8rem_10rem_auto]"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="truncate text-base font-semibold text-gray-900">
                {{ checkout.market.name }}
              </h2>
              <span
                class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                /{{ checkout.market.slug }}
              </span>
            </div>
            <p class="mt-1 text-xs text-gray-500">
              {{ checkout.id }} · {{ formatDate(checkout.createdAt) }}
            </p>
          </div>
          <div>
            <div class="text-xs text-gray-500">付款</div>
            <span
              class="mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
              :class="paymentClass(checkout.paymentStatus)"
            >
              {{ paymentStatusLabel(checkout.paymentStatus) }}
            </span>
          </div>
          <div>
            <div class="text-xs text-gray-500">攤位</div>
            <div class="mt-1 text-sm font-semibold text-gray-900">
              {{ checkout.childOrderCount }} 攤
            </div>
          </div>
          <div>
            <div class="text-xs text-gray-500">總額</div>
            <div class="mt-1 text-sm font-semibold text-gray-900">
              {{ formatCents(checkout.subtotal) }}
            </div>
          </div>
          <div>
            <div class="text-xs text-gray-500">更新</div>
            <div class="mt-1 text-sm text-gray-700">
              {{ formatDate(checkout.updatedAt) }}
            </div>
          </div>
          <button
            type="button"
            :data-testid="`open-checkout-${checkout.id}`"
            class="h-fit rounded-lg border border-primary-600 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
            @click="openCheckout(checkout.id)"
          >
            查看
          </button>
        </article>
      </div>
    </section>

    <section
      v-if="selectedCheckout"
      data-testid="checkout-detail"
      class="rounded-lg bg-white p-4 shadow-ios-card"
    >
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h2 class="text-lg font-semibold text-gray-900">
            {{ selectedCheckout.market.name }} 結帳明細
          </h2>
          <p class="mt-1 text-sm text-gray-500">
            {{ selectedCheckout.id }} ·
            {{ selectedCheckout.childOrders.length }} 筆子訂單
          </p>
        </div>
        <div class="flex flex-col items-start gap-2 sm:items-end">
          <div
            v-if="selectedCheckout.payment"
            class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
          >
            已付款 {{ selectedCheckout.payment.paidAmount }} /
            {{ selectedCheckout.payment.totalAmount }}
            <span v-if="selectedCheckout.payment.refundedAmount">
              · 已退 {{ selectedCheckout.payment.refundedAmount }}
            </span>
          </div>
          <button
            v-if="canRefundSelectedCheckout"
            type="button"
            data-testid="refund-checkout"
            class="rounded-lg border border-red-600 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            :disabled="isRefunding"
            @click="refundSelectedCheckout"
          >
            {{ isRefunding ? "退款中..." : "整筆退款" }}
          </button>
        </div>
      </div>

      <div class="mt-4 grid gap-3">
        <article
          v-for="order in selectedCheckout.childOrders"
          :key="`${order.restaurantId}-${order.orderId}`"
          class="rounded-lg border border-gray-200 p-3"
        >
          <div
            class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <h3 class="font-semibold text-gray-900">
                {{ order.restaurantName }}
              </h3>
              <p class="mt-1 text-sm text-gray-500">
                {{ order.orderNumber }} · #{{ order.orderId }}
              </p>
            </div>
            <div class="text-sm font-semibold text-gray-900">
              {{ formatAmount(order.totalAmount) }}
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            <span
              class="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700"
            >
              {{ order.status || "unknown" }}
            </span>
            <span
              class="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700"
            >
              {{ order.paymentStatus || "pending" }}
            </span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  marketCheckoutsService,
  type MarketCheckoutDetail,
  type MarketCheckoutListItem,
  type MarketCheckoutPaymentStatus,
  type MarketCheckoutSummary,
  type MarketCheckoutVendorSettlement,
} from "@/services/marketCheckoutsService";

const checkouts = ref<MarketCheckoutListItem[]>([]);
const selectedCheckout = ref<MarketCheckoutDetail | null>(null);
const summary = ref<MarketCheckoutSummary | null>(null);
const vendorSettlements = ref<MarketCheckoutVendorSettlement[]>([]);
const isLoading = ref(false);
const isRefunding = ref(false);
const isExporting = ref(false);
const isExportingVendors = ref(false);
const error = ref<string | null>(null);
const marketSlug = ref("");
const paymentStatus = ref<MarketCheckoutPaymentStatus | "">("");
const dateFrom = ref("");
const dateTo = ref("");

const canRefundSelectedCheckout = computed(() => {
  const status = selectedCheckout.value?.payment?.status;
  return status === "paid" || status === "partial_paid";
});

const summaryMetrics = computed(() => {
  if (!summary.value) return [];
  const failedCount = summary.value.paymentStatusCounts.failed ?? 0;
  const partialCount = summary.value.paymentStatusCounts.partial_paid ?? 0;
  return [
    { label: "Checkout", value: String(summary.value.totalCheckouts) },
    { label: "GMV", value: formatCents(summary.value.totalSubtotalCents) },
    { label: "已收", value: formatCents(summary.value.paidAmountCents) },
    { label: "已退", value: formatCents(summary.value.refundedAmountCents) },
    { label: "淨收", value: formatCents(summary.value.netPaidAmountCents) },
    {
      label: "異常",
      value: String(failedCount + partialCount),
    },
  ];
});

async function loadCheckouts() {
  isLoading.value = true;
  error.value = null;
  try {
    const filters = currentFilters();
    const [result, nextSummary, vendorSummary] = await Promise.all([
      marketCheckoutsService.list({
        page: 1,
        limit: 20,
        ...filters,
      }),
      marketCheckoutsService.summary(filters),
      marketCheckoutsService.vendors(filters),
    ]);
    checkouts.value = result.checkouts;
    summary.value = nextSummary;
    vendorSettlements.value = vendorSummary.vendors;
  } catch (loadError) {
    error.value =
      loadError instanceof Error ? loadError.message : "市場結帳讀取失敗";
  } finally {
    isLoading.value = false;
  }
}

async function openCheckout(id: string) {
  selectedCheckout.value = await marketCheckoutsService.get(id);
}

async function refundSelectedCheckout() {
  if (!selectedCheckout.value || !canRefundSelectedCheckout.value) return;
  if (!window.confirm("確定要退款這筆市場結帳嗎？")) return;

  isRefunding.value = true;
  error.value = null;
  try {
    selectedCheckout.value = await marketCheckoutsService.refund(
      selectedCheckout.value.id,
      "admin_market_checkout_refund",
    );
    await loadCheckouts();
  } catch (refundError) {
    error.value =
      refundError instanceof Error ? refundError.message : "市場結帳退款失敗";
  } finally {
    isRefunding.value = false;
  }
}

async function exportCheckouts() {
  isExporting.value = true;
  error.value = null;
  try {
    const blob = await marketCheckoutsService.exportCsv(currentFilters());
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `market-checkouts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (exportError) {
    error.value =
      exportError instanceof Error ? exportError.message : "市場結帳匯出失敗";
  } finally {
    isExporting.value = false;
  }
}

async function exportVendorSettlements() {
  isExportingVendors.value = true;
  error.value = null;
  try {
    const blob =
      await marketCheckoutsService.exportVendorsCsv(currentFilters());
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `market-checkout-vendors-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (exportError) {
    error.value =
      exportError instanceof Error ? exportError.message : "攤位對帳匯出失敗";
  } finally {
    isExportingVendors.value = false;
  }
}

function currentFilters() {
  return {
    marketSlug: marketSlug.value.trim(),
    paymentStatus: paymentStatus.value,
    dateFrom: dateFrom.value.trim(),
    dateTo: dateTo.value.trim(),
  };
}

function paymentStatusLabel(status: MarketCheckoutPaymentStatus) {
  const labels: Record<MarketCheckoutPaymentStatus, string> = {
    pending: "待付款",
    partial_paid: "部分付款",
    paid: "已付款",
    failed: "付款失敗",
    refunded: "已退款",
    partial_refunded: "部分退款",
  };
  return labels[status];
}

function paymentClass(status: MarketCheckoutPaymentStatus) {
  return {
    pending: "bg-gray-100 text-gray-700",
    partial_paid: "bg-amber-50 text-amber-700",
    paid: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
    refunded: "bg-slate-100 text-slate-700",
    partial_refunded: "bg-orange-50 text-orange-700",
  }[status];
}

function formatCents(value: number) {
  return formatAmount(value / 100);
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

onMounted(loadCheckouts);
</script>
