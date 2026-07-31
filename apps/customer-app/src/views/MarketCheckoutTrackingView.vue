<template>
  <div class="min-h-screen bg-ios-bg">
    <nav class="sticky top-0 z-10 border-b border-gray-100 bg-white shadow-sm">
      <div class="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
        <button
          type="button"
          data-testid="market-checkout-back"
          class="text-gray-500 hover:text-gray-700"
          aria-label="返回市場"
          @click="goToMarket"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div class="min-w-0">
          <h1 class="truncate text-lg font-semibold text-gray-900">市場訂單</h1>
          <p class="truncate text-xs text-gray-500">
            {{ checkout?.market.name || "載入中" }}
          </p>
        </div>
      </div>
    </nav>

    <main class="mx-auto max-w-md px-4 py-5">
      <div v-if="isLoading" class="py-12 text-center text-sm text-gray-500">
        載入訂單中...
      </div>

      <section
        v-else-if="error"
        data-testid="market-checkout-error"
        class="rounded-xl border border-red-100 bg-white p-4 text-center"
      >
        <h2 class="text-base font-semibold text-gray-900">無法載入訂單</h2>
        <p class="mt-2 text-sm leading-6 text-gray-600">{{ error }}</p>
        <button
          type="button"
          class="mt-4 rounded-lg bg-ios-blue px-4 py-2 text-sm font-semibold text-white"
          @click="loadCheckout"
        >
          重新載入
        </button>
      </section>

      <template v-else-if="checkout">
        <section
          data-testid="market-checkout-summary"
          class="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p
                class="text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                {{ checkout.market.name }}
              </p>
              <h2 class="mt-1 text-xl font-semibold text-gray-900">
                {{ statusLabel }}
              </h2>
            </div>
            <span
              class="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
            >
              {{ checkout.childOrders.length }} 攤
            </span>
          </div>

          <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt class="text-gray-500">送出時間</dt>
              <dd class="mt-1 font-medium text-gray-900">
                {{ formattedCreatedAt }}
              </dd>
            </div>
            <div class="text-right">
              <dt class="text-gray-500">小計</dt>
              <dd class="mt-1 font-semibold text-gray-900">
                {{ formatPrice(checkout.subtotal) }}
              </dd>
            </div>
            <div v-if="voucherDiscountCents > 0">
              <dt class="text-gray-500">卷折抵</dt>
              <dd
                data-testid="market-checkout-voucher-discount"
                class="mt-1 font-semibold text-emerald-700"
              >
                -{{ formatPrice(voucherDiscountAmount) }}
              </dd>
            </div>
            <div class="text-right">
              <dt class="text-gray-500">應付</dt>
              <dd
                data-testid="market-checkout-payable"
                class="mt-1 font-semibold text-gray-900"
              >
                {{ formatPrice(payableAmount) }}
              </dd>
            </div>
          </dl>

          <section
            v-if="canPayCheckout"
            class="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3"
            data-testid="market-checkout-voucher"
          >
            <div
              v-if="checkout.appliedVoucher"
              class="flex items-center justify-between gap-3"
            >
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900">
                  {{ checkout.appliedVoucher.name }}
                </p>
                <p class="mt-1 text-xs text-gray-500">
                  {{ checkout.appliedVoucher.code }} · 已折抵
                  {{ formatPrice(voucherDiscountAmount) }}
                </p>
              </div>
              <button
                type="button"
                data-testid="market-checkout-voucher-remove"
                :data-disabled="marketCheckoutsDisabled ? 'true' : undefined"
                :aria-disabled="marketCheckoutsDisabled ? 'true' : undefined"
                :title="
                  marketCheckoutsDisabled
                    ? MARKET_CHECKOUT_UNAVAILABLE_LABEL
                    : undefined
                "
                class="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="isVoucherRemoving || marketCheckoutsDisabled"
                @click="removeVoucher"
              >
                移除
              </button>
            </div>
            <form v-else class="flex gap-2" @submit.prevent="applyVoucher">
              <input
                v-model="voucherCode"
                data-testid="market-checkout-voucher-code"
                type="text"
                maxlength="64"
                class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:ring-2 focus:ring-blue-500/20"
                placeholder="輸入卷碼"
              />
              <button
                type="submit"
                data-testid="market-checkout-voucher-apply"
                :data-disabled="marketCheckoutsDisabled ? 'true' : undefined"
                :aria-disabled="marketCheckoutsDisabled ? 'true' : undefined"
                :title="
                  marketCheckoutsDisabled
                    ? MARKET_CHECKOUT_UNAVAILABLE_LABEL
                    : undefined
                "
                class="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="
                  isVoucherApplying ||
                  !voucherCode.trim() ||
                  marketCheckoutsDisabled
                "
              >
                套用
              </button>
            </form>
            <p
              v-if="voucherError"
              data-testid="market-checkout-voucher-error"
              class="mt-2 text-xs text-red-600"
            >
              {{ voucherError }}
            </p>
            <p
              v-if="voucherSuccess"
              data-testid="market-checkout-voucher-success"
              class="mt-2 text-xs text-emerald-700"
            >
              {{ voucherSuccess }}
            </p>
          </section>

          <div
            v-if="checkout.payment"
            data-testid="market-checkout-payment-summary"
            :class="['mt-4 rounded-lg px-3 py-2 text-sm', paymentSummaryClass]"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="font-semibold">
                {{ marketPaymentStatusLabel(checkout.payment.status) }}
              </span>
              <span>
                {{ formatPrice(checkout.payment.paidAmount) }} /
                {{ formatPrice(checkout.payment.totalAmount) }}
              </span>
            </div>
            <p class="mt-1 text-xs">
              {{ paymentProgressLabel }}
            </p>
            <p
              v-if="checkout.payment.status === 'failed'"
              data-testid="market-checkout-payment-retry-hint"
              class="mt-1 text-xs"
            >
              付款未完成，請確認付款方式後重新付款。
            </p>
            <ul
              v-if="failedChildPayments.length > 0"
              data-testid="market-checkout-payment-failures"
              class="mt-2 space-y-1 text-xs"
            >
              <li v-for="payment in failedChildPayments" :key="payment.orderId">
                {{ payment.restaurantName }}：{{
                  payment.errorMessage || "付款失敗"
                }}
              </li>
            </ul>
          </div>

          <!-- Greyed and inert rather than hidden while the API has market
               checkouts switched off: the order on screen is real, so removing
               its payment control would strand the reader with no explanation,
               and pressing it would only collect a refusal. -->
          <button
            v-if="canPayCheckout"
            type="button"
            data-testid="market-checkout-pay"
            :data-disabled="marketCheckoutsDisabled ? 'true' : undefined"
            :aria-disabled="marketCheckoutsDisabled ? 'true' : undefined"
            :title="
              marketCheckoutsDisabled
                ? MARKET_CHECKOUT_UNAVAILABLE_LABEL
                : undefined
            "
            class="mt-4 w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed"
            :class="
              marketCheckoutsDisabled
                ? 'bg-gray-200 text-gray-400'
                : 'bg-ios-blue text-white disabled:bg-blue-300'
            "
            :disabled="isPaying || marketCheckoutsDisabled"
            @click="payCheckout"
          >
            {{ payButtonLabel }}
          </button>

          <p
            v-if="canPayCheckout && marketCheckoutsDisabled"
            data-testid="market-checkout-unavailable-hint"
            class="mt-2 text-sm text-gray-500"
          >
            市場聯合付款尚未開放，請直接向各攤位結帳。
          </p>

          <p
            v-if="paymentError"
            data-testid="market-checkout-payment-error"
            class="mt-2 text-sm text-red-600"
          >
            {{ paymentError }}
          </p>
          <p
            v-if="paymentActionMessage"
            data-testid="market-checkout-payment-action"
            class="mt-2 text-sm text-amber-700"
          >
            {{ paymentActionMessage }}
          </p>
        </section>

        <section class="mt-4 space-y-3">
          <h2 class="text-sm font-semibold text-gray-900">攤位訂單</h2>
          <p
            v-if="orderAccessError"
            data-testid="market-checkout-child-access-error"
            class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {{ orderAccessError }}
          </p>
          <article
            v-for="order in checkout.childOrders"
            :key="`${order.restaurantId}-${order.orderId}`"
            data-testid="market-checkout-child-order"
            class="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-base font-semibold text-gray-900">
                  {{ order.restaurantName }}
                </h3>
                <div class="mt-2 flex flex-wrap gap-2">
                  <span
                    class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                  >
                    訂單 {{ order.orderNumber }}
                  </span>
                  <span
                    v-if="order.status"
                    class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                  >
                    {{ orderStatusLabel(order.status) }}
                  </span>
                  <span
                    v-if="order.paymentStatus"
                    class="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                  >
                    {{ paymentStatusLabel(order.paymentStatus) }}
                  </span>
                </div>
              </div>
              <p class="shrink-0 text-sm font-semibold text-gray-900">
                {{ formatPrice(order.totalAmount) }}
              </p>
            </div>
            <p class="mt-3 text-xs leading-5 text-gray-500">
              請以店家現場叫號或通知為準。此頁會保留市場層級的送單摘要。
            </p>
            <button
              type="button"
              data-testid="market-checkout-child-track"
              class="mt-3 rounded-lg border border-ios-blue px-3 py-2 text-sm font-semibold text-ios-blue"
              @click="openChildOrder(order)"
            >
              查看攤位訂單
            </button>
          </article>
        </section>

        <button
          type="button"
          data-testid="market-checkout-return"
          class="mt-5 w-full rounded-lg border border-ios-blue px-4 py-3 text-sm font-semibold text-ios-blue"
          @click="goToMarket"
        >
          返回市場
        </button>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { OrderPaymentStatus, OrderStatus } from "@makanmakan/shared-types";
import {
  orderApi,
  type MarketCheckoutProviderNextAction,
  type MarketCheckoutSummary,
} from "@/services/orderApi";
import type { ApiException } from "@/services/api";
import { useCurrency } from "@/composables/useCurrency";
import { useFeatureAvailability } from "@/composables/useFeatureAvailability";
import {
  activateMarketCheckoutGuestToken,
  getRecentMarketCheckoutPhoneLastDigits,
  recordRecentMarketCheckout,
} from "@/utils/marketCheckouts";
import { safeExternalHref } from "@/utils/safeExternalHref";

const props = defineProps<{
  slug: string;
  checkoutId: string;
}>();

/**
 * TODO(i18n): this view is entirely hard-coded zh-TW, and the customer locale
 * bundles were being edited in another branch when this landed, so no key was
 * added. Move to a shared translation key when the locales settle.
 */
const MARKET_CHECKOUT_UNAVAILABLE_LABEL = "尚未開放";

const router = useRouter();
const { formatPrice } = useCurrency();
const { isDisabled } = useFeatureAvailability();
const marketCheckoutsDisabled = computed(() => isDisabled("marketCheckouts"));
const checkout = ref<MarketCheckoutSummary | null>(null);
const isLoading = ref(true);
const isPaying = ref(false);
const error = ref<string | null>(null);
const paymentError = ref<string | null>(null);
const paymentActionMessage = ref<string | null>(null);
const orderAccessError = ref<string | null>(null);
const voucherCode = ref("");
const voucherError = ref<string | null>(null);
const voucherSuccess = ref<string | null>(null);
const isVoucherApplying = ref(false);
const isVoucherRemoving = ref(false);

const statusLabel = computed(() => {
  if (checkout.value?.status === "submitted") {
    return "已送出";
  }
  return "處理中";
});

const formattedCreatedAt = computed(() => {
  if (!checkout.value?.createdAt) return "-";
  const date = new Date(checkout.value.createdAt);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
});

const failedChildPayments = computed(() => {
  return (
    checkout.value?.payment?.childPayments.filter(
      (payment) => payment.status === "failed",
    ) ?? []
  );
});

const paymentProgressLabel = computed(() => {
  const payment = checkout.value?.payment;
  if (!payment) return "";
  const paidCount = payment.childPayments.filter(
    (child) => child.status === "paid",
  ).length;
  const totalCount = checkout.value?.childOrders.length ?? 0;
  return `已完成 ${paidCount} / ${totalCount} 筆攤位付款`;
});

const paymentSummaryClass = computed(() => {
  const status = checkout.value?.payment?.status;
  if (status === "paid") return "bg-emerald-50 text-emerald-800";
  if (status === "failed") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-800";
});

const canPayCheckout = computed(() => {
  return !checkout.value?.payment || checkout.value.payment.status !== "paid";
});

const voucherDiscountCents = computed(() => {
  return checkout.value?.appliedVoucher?.discountCents ?? 0;
});

const voucherDiscountAmount = computed(() => voucherDiscountCents.value / 100);

const payableAmount = computed(() => {
  if (checkout.value?.payment?.totalAmount != null) {
    return checkout.value.payment.totalAmount;
  }
  const subtotal = checkout.value?.subtotal ?? 0;
  return Math.max(0, subtotal - voucherDiscountAmount.value);
});

const payButtonLabel = computed(() => {
  if (marketCheckoutsDisabled.value) return MARKET_CHECKOUT_UNAVAILABLE_LABEL;
  if (isPaying.value) return "付款處理中";
  if (checkout.value?.payment?.status === "partial_paid")
    return "重試未完成付款";
  if (checkout.value?.payment?.status === "failed") return "重新付款";
  return "聯合付款";
});

async function loadCheckout() {
  isLoading.value = true;
  error.value = null;
  try {
    checkout.value = await orderApi.getMarketCheckout(props.checkoutId);
    recordRecentMarketCheckout(checkout.value);
  } catch (loadError) {
    console.error("Failed to load market checkout:", loadError);
    error.value =
      loadError instanceof Error ? loadError.message : "市場訂單載入失敗";
  } finally {
    isLoading.value = false;
  }
}

async function payCheckout() {
  if (marketCheckoutsDisabled.value) return;

  paymentError.value = null;
  paymentActionMessage.value = null;
  isPaying.value = true;
  try {
    const result = await orderApi.payMarketCheckout(props.checkoutId, {
      method: "market_online",
      country: "TW",
      currency: "TWD",
    });
    checkout.value = result.checkout;
    recordRecentMarketCheckout(result.checkout);
    handleProviderNextAction(
      result.payment.parentPayment?.nextAction ??
        result.checkout.payment?.parentPayment?.nextAction,
    );
  } catch (payError) {
    console.error("Failed to pay market checkout:", payError);
    paymentError.value =
      payError instanceof Error ? payError.message : "市場聯合付款失敗";
  } finally {
    isPaying.value = false;
  }
}

async function applyVoucher() {
  if (marketCheckoutsDisabled.value) return;
  if (!voucherCode.value.trim()) return;
  voucherError.value = null;
  voucherSuccess.value = null;
  isVoucherApplying.value = true;
  try {
    const result = await orderApi.applyMarketCheckoutVoucher(
      props.checkoutId,
      voucherCode.value.trim(),
    );
    checkout.value = result.checkout;
    recordRecentMarketCheckout(result.checkout);
    voucherCode.value = "";
    voucherSuccess.value = "卷已套用。";
  } catch (error) {
    console.error("Failed to apply market checkout voucher:", error);
    voucherError.value = voucherErrorMessage(error);
  } finally {
    isVoucherApplying.value = false;
  }
}

async function removeVoucher() {
  if (marketCheckoutsDisabled.value) return;

  voucherError.value = null;
  voucherSuccess.value = null;
  isVoucherRemoving.value = true;
  try {
    const result = await orderApi.removeMarketCheckoutVoucher(props.checkoutId);
    checkout.value = result.checkout;
    recordRecentMarketCheckout(result.checkout);
    voucherSuccess.value = "卷已移除。";
  } catch (error) {
    console.error("Failed to remove market checkout voucher:", error);
    voucherError.value =
      error instanceof Error ? error.message : "移除卷失敗，請稍後再試。";
  } finally {
    isVoucherRemoving.value = false;
  }
}

function handleProviderNextAction(
  nextAction: MarketCheckoutProviderNextAction | undefined,
) {
  if (!nextAction) return;

  if (nextAction.type === "redirect" && nextAction.redirectUrl) {
    const redirectUrl = safeExternalHref(nextAction.redirectUrl);
    if (!redirectUrl) {
      paymentActionMessage.value = "付款連結無效，請稍後再試。";
      return;
    }
    paymentActionMessage.value = "正在前往付款頁，請完成付款後回到此頁追蹤。";
    window.open(redirectUrl, "_self");
    return;
  }

  if (nextAction.type === "client_secret") {
    paymentActionMessage.value = "付款已建立，等待金流元件完成確認。";
    return;
  }

  paymentActionMessage.value = "付款已建立，等待金流 SDK 完成確認。";
}

async function openChildOrder(
  order: MarketCheckoutSummary["childOrders"][number],
) {
  orderAccessError.value = null;
  if (!activateMarketCheckoutGuestToken(props.checkoutId, order.orderId)) {
    const phoneLastDigits = getRecentMarketCheckoutPhoneLastDigits(
      props.checkoutId,
    );
    if (!phoneLastDigits) {
      orderAccessError.value = "無法開啟攤位訂單，請從最近市場訂單重新進入。";
      return;
    }

    try {
      await orderApi.recoverMarketCheckoutGuestToken(props.checkoutId, {
        orderId: order.orderId,
        phoneLastDigits,
      });
    } catch (recoverError) {
      console.error(
        "Failed to recover market checkout guest token:",
        recoverError,
      );
      orderAccessError.value = "無法開啟攤位訂單，請從最近市場訂單重新進入。";
      return;
    }
  }

  router.push({
    name: "ShopOrderTracking",
    params: {
      restaurantId: order.restaurantId,
      orderId: String(order.orderId),
    },
  });
}

function goToMarket() {
  router.push(`/markets/${props.slug}`);
}

function orderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    pending: "待確認",
    confirmed: "已確認",
    preparing: "製作中",
    ready: "可取餐",
    delivered: "已完成",
    paid: "已付款",
    cancelled: "已取消",
    refunded: "已退款",
  };
  return labels[status] ?? status;
}

function paymentStatusLabel(status: OrderPaymentStatus) {
  const labels: Record<string, string> = {
    "0": "待付款",
    "1": "已付款",
    "2": "付款失敗",
    pending: "待付款",
    processing: "付款處理中",
    completed: "已付款",
    paid: "已付款",
    failed: "付款失敗",
    refunded: "已退款",
    partial_refund: "部分退款",
  };
  return labels[String(status)] ?? String(status);
}

function marketPaymentStatusLabel(
  status:
    | "pending"
    | "partial_paid"
    | "paid"
    | "failed"
    | "refunded"
    | "partial_refunded",
) {
  const labels = {
    pending: "付款待處理",
    partial_paid: "部分付款完成",
    paid: "已完成聯合付款",
    failed: "付款失敗",
    refunded: "已退款",
    partial_refunded: "部分退款",
  };
  return labels[status];
}

function voucherErrorMessage(error: unknown): string {
  const apiError = error as Partial<ApiException>;
  const code = typeof apiError.code === "string" ? apiError.code : "";
  const messages: Record<string, string> = {
    VOUCHER_NOT_FOUND: "找不到這張卷，請確認卷碼。",
    VOUCHER_NOT_APPLICABLE: "這張卷不適用於此市場結帳。",
    VOUCHER_EXPIRED: "這張卷已過期。",
    VOUCHER_EXHAUSTED: "這張卷已用完。",
    VOUCHER_MIN_ORDER_NOT_MET: "尚未達到這張卷的最低消費。",
    MARKET_CHECKOUT_ALREADY_PAID: "此訂單已付款，無法變更卷。",
  };
  if (Object.prototype.hasOwnProperty.call(messages, code)) {
    return messages[code];
  }
  return error instanceof Error ? error.message : "套用卷失敗，請稍後再試。";
}

onMounted(loadCheckout);
</script>
