<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-md mx-auto px-4 py-8">
      <div
        v-if="isLoading"
        class="flex justify-center items-center min-h-[60vh]"
      >
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"
        ></div>
      </div>

      <div v-else-if="error" class="text-center py-12">
        <p class="text-red-500 mb-4">{{ error }}</p>
        <button class="text-indigo-600 underline" @click="fetchRestaurant">
          {{ t("common.retry") }}
        </button>
      </div>

      <div v-else>
        <div class="text-center mb-8">
          <div
            v-if="restaurant?.logo"
            class="w-16 h-16 rounded-2xl mx-auto mb-3 overflow-hidden"
          >
            <img
              :src="restaurant.logo"
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
          <p v-if="restaurant?.description" class="text-sm text-gray-500 mt-1">
            {{ restaurant.description }}
          </p>
        </div>

        <p class="text-sm font-semibold text-gray-500 mb-3">
          {{ t("orderTypeLanding.selectMethod") }}
        </p>
        <div class="flex flex-col gap-3">
          <button
            :class="[
              'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
              selectedType === 'takeaway'
                ? 'border-green-500 bg-green-50'
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
              class="w-5 h-5 text-green-500"
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

          <button
            v-if="deliveryEnabled"
            :class="[
              'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
              selectedType === 'delivery'
                ? 'border-amber-500 bg-amber-50'
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
              class="w-5 h-5 text-amber-500"
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
          :disabled="!selectedType"
          class="w-full mt-6 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="handleContinue"
        >
          {{ t("orderTypeLanding.continue") }}
        </button>
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

const props = defineProps<{ restaurantId: string }>();

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const shopCartStore = useShopCartStore();

const selectedType = ref<"takeaway" | "delivery">("takeaway");
const restaurant = ref<any>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

const deliveryEnabled = computed(() => {
  return restaurant.value?.settings?.enableDelivery ?? false;
});

async function fetchRestaurant() {
  isLoading.value = true;
  error.value = null;
  try {
    const res = await menuApi.getRestaurant(props.restaurantId);
    restaurant.value = res;
  } catch {
    error.value = t("toast.restaurantLoadFailed");
  } finally {
    isLoading.value = false;
  }
}

function handleContinue() {
  shopCartStore.setFulfillmentType(selectedType.value);
  if (
    selectedType.value === "delivery" &&
    restaurant.value?.settings?.deliveryFee
  ) {
    shopCartStore.setDeliveryFee(restaurant.value.settings.deliveryFee);
  }
  router.push({
    name: "ShopPhoneVerification",
    params: { restaurantId: props.restaurantId },
    query: {
      ...route.query,
      fulfillmentType: selectedType.value,
    },
  });
}

onMounted(fetchRestaurant);
</script>
