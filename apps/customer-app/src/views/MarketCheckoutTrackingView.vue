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
              <dt class="text-gray-500">總額</dt>
              <dd class="mt-1 font-semibold text-gray-900">
                {{ formatPrice(checkout.subtotal) }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="mt-4 space-y-3">
          <h2 class="text-sm font-semibold text-gray-900">攤位訂單</h2>
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
                <p class="mt-1 text-sm text-gray-500">
                  訂單 {{ order.orderNumber }}
                </p>
              </div>
              <p class="shrink-0 text-sm font-semibold text-gray-900">
                {{ formatPrice(order.totalAmount) }}
              </p>
            </div>
            <p class="mt-3 text-xs leading-5 text-gray-500">
              請以店家現場叫號或通知為準。此頁會保留市場層級的送單摘要。
            </p>
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
import { orderApi, type MarketCheckoutSummary } from "@/services/orderApi";
import { useCurrency } from "@/composables/useCurrency";

const props = defineProps<{
  slug: string;
  checkoutId: string;
}>();

const router = useRouter();
const { formatPrice } = useCurrency();
const checkout = ref<MarketCheckoutSummary | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

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

async function loadCheckout() {
  isLoading.value = true;
  error.value = null;
  try {
    checkout.value = await orderApi.getMarketCheckout(props.checkoutId);
  } catch (loadError) {
    console.error("Failed to load market checkout:", loadError);
    error.value =
      loadError instanceof Error ? loadError.message : "市場訂單載入失敗";
  } finally {
    isLoading.value = false;
  }
}

function goToMarket() {
  router.push(`/markets/${props.slug}`);
}

onMounted(loadCheckout);
</script>
