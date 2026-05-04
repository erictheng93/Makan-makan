<template>
  <div class="min-h-screen bg-ios-bg flex flex-col">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
        <button
          class="text-gray-600 hover:text-gray-900 transition-colors"
          @click="goBack"
        >
          <svg
            class="w-6 h-6"
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
        <h1 class="text-lg font-semibold text-gray-900">
          {{ t("phoneVerification.title") }}
        </h1>
        <div class="w-6"></div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <!-- Restaurant Info Card -->
        <div v-if="restaurant" class="bg-white rounded-lg shadow-md p-6 mb-6">
          <div class="text-center">
            <div
              class="w-20 h-20 mx-auto mb-4 bg-ios-blue rounded-full flex items-center justify-center"
            >
              <svg
                class="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">
              {{ restaurant.name }}
            </h2>
            <p
              v-if="restaurant.shopQrSettings?.displayName"
              class="text-gray-600 mb-2"
            >
              {{ restaurant.shopQrSettings.displayName }}
            </p>
            <p
              v-if="restaurant.shopQrSettings?.instructions"
              class="text-sm text-gray-500"
            >
              {{ restaurant.shopQrSettings.instructions }}
            </p>
          </div>
        </div>

        <!-- Verification Form -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <div v-if="!isVerified">
            <div class="mb-6 text-center">
              <div
                class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4"
              >
                <svg
                  class="w-8 h-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 class="text-xl font-semibold text-gray-900 mb-2">
                {{ t("phoneVerification.enterLastDigits") }}
              </h3>
              <p class="text-sm text-gray-600">
                {{ t("phoneVerification.forIdentification") }}
              </p>
            </div>

            <!-- Error Message -->
            <div
              v-if="errorMessage"
              class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg"
            >
              <div class="flex items-start">
                <svg
                  class="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p class="text-sm text-red-700">{{ errorMessage }}</p>
              </div>
            </div>

            <!-- Phone Input -->
            <div class="mb-6">
              <label
                for="phone"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                {{ t("phoneVerification.lastDigits") }}
              </label>
              <div class="relative">
                <input
                  id="phone"
                  v-model="phoneLastDigits"
                  type="tel"
                  maxlength="3"
                  pattern="[0-9]{3}"
                  :placeholder="t('phoneVerification.placeholder')"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-semibold tracking-widest"
                  :class="{ 'border-red-300': errorMessage }"
                  @input="validateInput"
                  @keypress.enter="handleVerify"
                />
              </div>
              <p class="mt-2 text-xs text-gray-500 text-center">
                {{ t("phoneVerification.example") }}
              </p>
            </div>

            <!-- Verify Button -->
            <button
              :disabled="!isValidInput || isLoading"
              data-testid="verify-btn"
              class="w-full bg-ios-blue hover:bg-ios-blue/90 text-white py-3.5 px-6 rounded-full font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              @click="handleVerify"
            >
              <span v-if="!isLoading">{{
                t("phoneVerification.startOrdering")
              }}</span>
              <span v-else class="flex items-center justify-center">
                <svg
                  class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {{ t("phoneVerification.verifyingStatus") }}
              </span>
            </button>
          </div>

          <!-- Success State -->
          <div v-else class="text-center py-8">
            <div
              class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4"
            >
              <svg
                class="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">
              {{ t("toast.verificationSuccess") }}
            </h3>
            <p class="text-sm text-gray-600 mb-4">
              {{ t("toast.preparingMenu") }}
            </p>
            <div class="flex justify-center">
              <div
                class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
              ></div>
            </div>
          </div>
        </div>

        <!-- Info Card -->
        <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-start">
            <svg
              class="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 class="text-sm font-semibold text-blue-900 mb-1">
                {{ t("phoneVerification.whyNeeded") }}
              </h4>
              <p class="text-xs text-blue-700">
                {{ t("phoneVerification.whyNeededDesc") }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "@/composables/useI18n";
import { apiClient } from "@/services/api";
import type { Restaurant } from "@makanmasak/shared-types";

const props = defineProps<{
  restaurantId: string;
  shopQrCode?: string;
}>();

const router = useRouter();
const { t } = useI18n();
const restaurant = ref<Restaurant | null>(null);
const phoneLastDigits = ref("");
const errorMessage = ref("");
const isLoading = ref(false);
const isVerified = ref(false);

const isValidInput = computed(() => {
  return /^\d{3}$/.test(phoneLastDigits.value);
});

interface ShopQrVerificationResponse {
  valid: boolean;
  restaurant?: Restaurant;
}

interface GuestTokenResponse {
  success?: boolean;
  token?: string;
}

const validateInput = () => {
  // Only allow numbers
  phoneLastDigits.value = phoneLastDigits.value.replace(/\D/g, "").slice(0, 3);
  errorMessage.value = "";
};

const loadRestaurant = async () => {
  try {
    isLoading.value = true;
    errorMessage.value = "";

    // Verify shop QR code if provided
    if (props.shopQrCode) {
      const verifyResponse = await apiClient.get<ShopQrVerificationResponse>(
        `/qr-codes/verify/shop/${props.shopQrCode}`,
      );

      if (!verifyResponse.valid) {
        throw new Error(t("toast.invalidQRCode"));
      }

      restaurant.value = verifyResponse.restaurant ?? null;
    } else {
      // Load restaurant info
      restaurant.value = await apiClient.get<Restaurant>(
        `/restaurants/${props.restaurantId}`,
      );
    }

    // Check if shop mode is enabled
    if (!restaurant.value?.enableShopMode) {
      throw new Error(t("toast.shopModeNotEnabled"));
    }
  } catch (error: any) {
    console.error("Failed to load restaurant:", error);
    errorMessage.value = error.message || t("toast.restaurantLoadFailed");

    // Redirect to error page after 3 seconds
    setTimeout(() => {
      router.push({
        name: "Error",
        query: {
          code: "400",
          message: errorMessage.value,
        },
      });
    }, 3000);
  } finally {
    isLoading.value = false;
  }
};

const handleVerify = async () => {
  if (!isValidInput.value || isLoading.value) {
    return;
  }

  try {
    isLoading.value = true;
    errorMessage.value = "";

    // Simple validation - just check format
    if (!/^\d{3}$/.test(phoneLastDigits.value)) {
      throw new Error(t("toast.phoneVerifyError"));
    }

    // Mark as verified
    isVerified.value = true;

    // Get guest token for later order submission
    try {
      const guestTokenResponse = await apiClient.post<GuestTokenResponse>(
        "/auth/guest-token",
        {
          restaurantId: props.restaurantId,
          phoneLastDigits: phoneLastDigits.value,
        },
      );
      if (guestTokenResponse.success && guestTokenResponse.token) {
        localStorage.setItem("guest_auth_token", guestTokenResponse.token);
      }
    } catch (err) {
      console.warn("Failed to get guest token:", err);
      // Non-blocking - continue to menu even if token fails
    }

    // Navigate to shop menu with phone digits
    setTimeout(() => {
      router.push({
        name: "ShopMenu",
        params: {
          restaurantId: props.restaurantId,
        },
        query: {
          phone: phoneLastDigits.value,
        },
      });
    }, 1000);
  } catch (error: any) {
    console.error("Verification failed:", error);
    errorMessage.value = error.message || t("errors.general");
    isVerified.value = false;
  } finally {
    isLoading.value = false;
  }
};

const goBack = () => {
  router.back();
};

onMounted(() => {
  loadRestaurant();
});
</script>

<style scoped>
/* Smooth animations */
.transform {
  transition: transform 0.2s ease-in-out;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Input number hide arrows */
input[type="tel"]::-webkit-outer-spin-button,
input[type="tel"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="tel"] {
  -moz-appearance: textfield;
}
</style>
