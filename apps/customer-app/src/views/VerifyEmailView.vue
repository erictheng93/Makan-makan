<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 py-12 px-4 sm:px-6 lg:px-8"
  >
    <div class="max-w-md w-full space-y-8">
      <!-- Logo 和標題 -->
      <div class="text-center">
        <div
          class="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4 shadow-lg"
        >
          <span class="text-white font-bold text-2xl">M</span>
        </div>
        <h2 class="text-3xl font-bold text-gray-900">
          {{ t("auth.verifyEmail") }}
        </h2>
      </div>

      <!-- 驗證中 -->
      <div
        v-if="verifying"
        class="bg-white rounded-2xl shadow-xl p-8 text-center"
      >
        <svg
          class="animate-spin mx-auto h-16 w-16 text-green-500"
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
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p class="mt-4 text-lg font-medium text-gray-900">
          {{ t("auth.verifying") }}
        </p>
        <p class="mt-2 text-sm text-gray-600">{{ t("auth.verifyingDesc") }}</p>
      </div>

      <!-- 驗證成功 -->
      <div v-else-if="success" class="bg-white rounded-2xl shadow-xl p-8">
        <div class="text-center">
          <div
            class="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4"
          >
            <svg
              class="w-12 h-12 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 class="text-2xl font-bold text-gray-900">
            {{ t("auth.verifySuccess") }}
          </h3>
          <p class="mt-3 text-gray-600">{{ successMessage }}</p>

          <div
            class="mt-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-lg text-left"
          >
            <p class="text-sm text-green-800 font-medium">
              {{ t("auth.verifyNowYouCan") }}
            </p>
            <ul class="mt-2 text-sm text-green-700 space-y-1">
              <li>✅ {{ t("auth.verifyFullOrdering") }}</li>
              <li>✅ {{ t("auth.verifyManageProfile") }}</li>
              <li>✅ {{ t("auth.verifyOrderHistory") }}</li>
              <li>✅ {{ t("auth.verifyExclusive") }}</li>
            </ul>
          </div>

          <div class="mt-8 space-y-3">
            <button
              class="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              @click="handleContinue"
            >
              {{ t("auth.startOrdering") }}
            </button>
            <button
              class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              @click="$router.push('/profile')"
            >
              {{ t("auth.viewProfile") }}
            </button>
          </div>
        </div>
      </div>

      <!-- 驗證失敗 -->
      <div v-else class="bg-white rounded-2xl shadow-xl p-8">
        <div class="text-center">
          <div
            class="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4"
          >
            <svg
              class="w-12 h-12 text-red-500"
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
          </div>
          <h3 class="text-xl font-bold text-gray-900">
            {{ t("auth.verifyFailed") }}
          </h3>
          <p class="mt-3 text-gray-600">{{ errorMessage }}</p>

          <div
            class="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg text-left"
          >
            <p class="text-sm text-yellow-800 font-medium">
              {{ t("auth.possibleReasons") }}
            </p>
            <ul class="mt-2 text-sm text-yellow-700 space-y-1">
              <li>• {{ t("auth.linkExpired") }}</li>
              <li>• {{ t("auth.linkUsed") }}</li>
              <li>• {{ t("auth.linkInvalidReason") }}</li>
            </ul>
          </div>

          <div class="mt-8 space-y-3">
            <button
              :disabled="resending"
              class="w-full px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
              :class="{ 'opacity-50 cursor-not-allowed': resending }"
              @click="resendVerification"
            >
              {{ resending ? t("auth.sending") : t("auth.resendVerification") }}
            </button>
            <button
              class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              @click="$router.push('/login')"
            >
              {{ t("auth.backToLogin") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "@/composables/useI18n";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { t } = useI18n();

const verifying = ref(true);
const success = ref(false);
const successMessage = ref("");
const errorMessage = ref("");
const resending = ref(false);

const verifyEmail = async (token: string) => {
  try {
    const response = await fetch(`/api/v1/auth/verify-email?token=${token}`);
    const data = await response.json();

    if (data.success) {
      success.value = true;
      successMessage.value = data.message || t("auth.verifySuccess");

      // If user is logged in, refresh their profile
      if (authStore.isAuthenticated) {
        await authStore.fetchUserProfile();
      }
    } else {
      errorMessage.value = data.error || t("auth.verifyError");
    }
  } catch (err) {
    console.error("Verify email error:", err);
    errorMessage.value = t("auth.verifyError");
  } finally {
    verifying.value = false;
  }
};

const resendVerification = async () => {
  if (!authStore.isAuthenticated || !authStore.user?.email) {
    router.push("/login");
    return;
  }

  resending.value = true;

  try {
    const response = await fetch("/api/v1/auth/verify-email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        email: authStore.user.email,
      }),
    });

    const data = await response.json();

    if (data.success) {
      alert(t("auth.resendVerificationSuccess"));
    } else {
      alert(data.error || t("auth.resendFailed"));
    }
  } catch (err) {
    console.error("Resend verification error:", err);
    alert(t("messages.networkError"));
  } finally {
    resending.value = false;
  }
};

const handleContinue = () => {
  // If user is logged in, go to orders page, otherwise go to login
  if (authStore.isAuthenticated) {
    router.push("/orders");
  } else {
    router.push("/login");
  }
};

onMounted(() => {
  const token = route.query.token as string;

  if (!token) {
    errorMessage.value = t("auth.missingVerifyToken");
    verifying.value = false;
    return;
  }

  verifyEmail(token);
});
</script>
