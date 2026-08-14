<template>
  <div class="min-h-screen bg-ios-bg">
    <div class="max-w-md mx-auto px-4 py-8">
      <div
        v-if="isLoading"
        class="flex justify-center items-center min-h-[60vh]"
      >
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-ios-blue"
        ></div>
      </div>

      <div v-else-if="error" class="text-center py-12">
        <p class="text-red-500 mb-4">{{ error }}</p>
        <button class="text-ios-blue underline" @click="fetchRestaurant">
          {{ t("common.retry") }}
        </button>
      </div>

      <div v-else>
        <div class="text-center mb-8">
          <div
            v-if="restaurant?.logoUrl"
            class="w-16 h-16 rounded-2xl mx-auto mb-3 overflow-hidden"
          >
            <img
              :src="restaurant.logoUrl"
              :alt="restaurant.name"
              class="w-full h-full object-cover"
            />
          </div>
          <div
            v-else
            class="w-16 h-16 rounded-2xl mx-auto mb-3 bg-gray-200 flex items-center justify-center"
          >
            <span class="text-2xl">🍽️</span>
          </div>
          <h1 class="text-xl font-bold text-gray-900">
            {{ restaurant?.name }}
          </h1>
          <p v-if="restaurantDescription" class="text-sm text-gray-500 mt-1">
            {{ restaurantDescription }}
          </p>
        </div>

        <div
          v-if="!hasFulfillmentMethods"
          data-testid="order-type-empty-state"
          class="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center"
        >
          <h2 class="text-base font-semibold text-gray-900">
            {{ t("orderTypeLanding.noMethodsTitle") }}
          </h2>
          <p class="mt-2 text-sm text-gray-500">
            {{ t("orderTypeLanding.noMethodsDescription") }}
          </p>
        </div>

        <template v-else>
          <p class="text-sm font-semibold text-gray-500 mb-3">
            {{ t("orderTypeLanding.selectMethod") }}
          </p>
          <div class="flex flex-col gap-3">
            <!-- 內用 -->
            <button
              v-if="dineInEnabled"
              :class="[
                'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                selectedType === 'dine-in'
                  ? 'border-[#007AFF] bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              ]"
              @click="selectedType = 'dine-in'"
            >
              <span class="text-3xl">🍽️</span>
              <div class="flex-1">
                <div class="font-semibold text-gray-900">
                  {{ t("orderTypeLanding.dineIn") }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ t("orderTypeLanding.dineInDesc") }}
                </div>
              </div>
              <svg
                v-if="selectedType === 'dine-in'"
                class="w-5 h-5 text-[#007AFF]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>

            <!-- 外帶 -->
            <button
              v-if="takeawayEnabled"
              :class="[
                'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                selectedType === 'takeaway'
                  ? 'border-[#007AFF] bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              ]"
              @click="selectedType = 'takeaway'"
            >
              <span class="text-3xl">🛍️</span>
              <div class="flex-1">
                <div class="font-semibold text-gray-900">
                  {{ t("orderTypeLanding.takeaway") }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ t("orderTypeLanding.takeawayDesc") }}
                </div>
              </div>
              <svg
                v-if="selectedType === 'takeaway'"
                class="w-5 h-5 text-[#007AFF]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>

            <!-- 外送 -->
            <button
              v-if="deliveryEnabled"
              :class="[
                'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                selectedType === 'delivery'
                  ? 'border-[#007AFF] bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              ]"
              @click="selectedType = 'delivery'"
            >
              <span class="text-3xl">🛵</span>
              <div class="flex-1">
                <div class="font-semibold text-gray-900">
                  {{ t("orderTypeLanding.delivery") }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ t("orderTypeLanding.deliveryDesc") }}
                </div>
              </div>
              <svg
                v-if="selectedType === 'delivery'"
                class="w-5 h-5 text-[#007AFF]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>

          <button
            data-testid="continue-btn"
            :disabled="!selectedType"
            class="w-full mt-6 py-3.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="handleContinue"
          >
            {{ t("orderTypeLanding.continue") }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "@/composables/useI18n";
import { useShopCartStore } from "@/stores/shopCart";
import { menuApi } from "@/services/menuApi";
import type { Restaurant } from "@makanmasak/shared-types";

type FulfillmentType = "dine-in" | "takeaway" | "delivery";
type RestaurantWithPlaceholderFlag = Restaurant & {
  isPlaceholderDescription?: boolean;
};

const ONBOARDING_PLACEHOLDER_DESCRIPTION_PREFIX =
  "Provisioned from onboarding application ";

const props = defineProps<{ restaurantId: string }>();

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const shopCartStore = useShopCartStore();

const selectedType = ref<FulfillmentType | null>(null);
const restaurant = ref<RestaurantWithPlaceholderFlag | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

const dineInEnabled = computed(() => {
  return restaurant.value?.settings?.enableDineIn ?? false;
});

const takeawayEnabled = computed(() => {
  return restaurant.value?.settings?.enableTakeaway ?? false;
});

const deliveryEnabled = computed(() => {
  return restaurant.value?.settings?.enableDelivery ?? false;
});

const hasFulfillmentMethods = computed(
  () => dineInEnabled.value || takeawayEnabled.value || deliveryEnabled.value,
);

const restaurantDescription = computed(() => {
  if (restaurant.value?.isPlaceholderDescription) {
    return "";
  }

  const description = restaurant.value?.description?.trim() ?? "";
  if (description.startsWith(ONBOARDING_PLACEHOLDER_DESCRIPTION_PREFIX)) {
    return "";
  }
  return description;
});

// Auto-select the first available option
function autoSelectType() {
  if (dineInEnabled.value) {
    selectedType.value = "dine-in";
  } else if (takeawayEnabled.value) {
    selectedType.value = "takeaway";
  } else if (deliveryEnabled.value) {
    selectedType.value = "delivery";
  }
}

async function fetchRestaurant() {
  isLoading.value = true;
  error.value = null;
  try {
    const res = await menuApi.getRestaurant(props.restaurantId);
    restaurant.value = res;
    autoSelectType();
  } catch {
    error.value = t("toast.restaurantLoadFailed");
  } finally {
    isLoading.value = false;
  }
}

function handleContinue() {
  if (!selectedType.value) return;
  shopCartStore.setFulfillmentType(selectedType.value);
  if (
    selectedType.value === "delivery" &&
    restaurant.value?.settings?.deliveryFee
  ) {
    shopCartStore.setDeliveryFee(restaurant.value.settings.deliveryFee);
  }

  // 取餐識別用訂單編號，不再攔一個末三碼頁面。
  router.push({
    name: "ShopMenu",
    params: { restaurantId: props.restaurantId },
    query: {
      ...route.query,
      fulfillmentType: selectedType.value,
    },
  });
}

onMounted(fetchRestaurant);
</script>
