<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 py-12 px-4 sm:px-6 lg:px-8"
  >
    <div class="max-w-md w-full space-y-8">
      <!-- Logo 和標題 -->
      <div class="text-center">
        <div
          class="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4 shadow-lg"
        >
          <span class="text-white font-bold text-2xl">M</span>
        </div>
        <h2 class="text-3xl font-bold text-gray-900">
          {{ t("auth.forgotPasswordTitle") }}
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          {{ t("auth.forgotPasswordDesc") }}
        </p>
      </div>

      <!-- 成功訊息 -->
      <div
        v-if="success"
        class="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg"
      >
        <div class="flex items-center">
          <svg
            class="w-6 h-6 text-green-400 mr-3"
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
          <div>
            <p class="text-sm font-medium text-green-800">
              {{ successMessage }}
            </p>
            <p class="text-xs text-green-700 mt-1">
              {{ t("auth.checkEmailInfo") }}
            </p>
          </div>
        </div>
        <button
          class="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          @click="$router.push('/login')"
        >
          {{ t("auth.backToLogin") }}
        </button>
      </div>

      <!-- 忘記密碼表單 -->
      <div
        v-if="!success"
        class="bg-ios-card rounded-3xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-8"
      >
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <!-- Email 輸入 -->
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              {{ t("auth.emailAddress") }}
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              class="w-full px-4 py-3 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              :class="{ 'border-red-500': errors.email }"
              :placeholder="t('auth.emailPlaceholderForgot')"
            />
            <p v-if="errors.email" class="mt-1 text-sm text-red-600">
              {{ errors.email }}
            </p>
          </div>

          <!-- 錯誤訊息 -->
          <div
            v-if="error"
            class="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg"
          >
            <div class="flex items-center">
              <svg
                class="w-5 h-5 text-red-400 mr-2"
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
              <p class="text-sm text-red-800">{{ error }}</p>
            </div>
          </div>

          <!-- 提交按鈕 -->
          <div>
            <button
              type="submit"
              :disabled="isLoading"
              class="w-full flex justify-center items-center px-4 py-3.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full font-semibold shadow-md hover:shadow-lg transition-all duration-200"
              :class="{ 'opacity-50 cursor-not-allowed': isLoading }"
            >
              <svg
                v-if="isLoading"
                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
              <span>{{
                isLoading ? t("auth.sending") : t("auth.sendResetLink")
              }}</span>
            </button>
          </div>

          <!-- 返回登入 -->
          <div class="text-center">
            <router-link
              to="/login"
              class="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              {{ t("auth.backToLoginArrow") }}
            </router-link>
          </div>
        </form>
      </div>

      <!-- 提示訊息 -->
      <div class="text-center text-sm text-gray-600">
        <p>{{ t("auth.noEmailReceived") }}</p>
        <ul class="mt-2 space-y-1 text-xs">
          <li>• {{ t("auth.checkSpam") }}</li>
          <li>• {{ t("auth.confirmEmailCorrect") }}</li>
          <li>• {{ t("auth.waitAndRetry") }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "@/composables/useI18n";

const _router = useRouter();
const { t } = useI18n();

const form = reactive({
  email: "",
});

const errors = reactive({
  email: "",
});

const error = ref("");
const success = ref(false);
const successMessage = ref("");
const isLoading = ref(false);

const validateForm = () => {
  errors.email = "";
  let isValid = true;

  // Email 驗證
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!form.email) {
    errors.email = t("auth.emailRequired");
    isValid = false;
  } else if (!emailRegex.test(form.email)) {
    errors.email = t("auth.invalidEmailAddress");
    isValid = false;
  }

  return isValid;
};

const handleSubmit = async () => {
  error.value = "";

  if (!validateForm()) {
    return;
  }

  isLoading.value = true;

  try {
    const response = await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: form.email,
        method: "email",
      }),
    });

    const data = await response.json();

    if (data.success) {
      success.value = true;
      successMessage.value = data.message || t("auth.resetLinkSent");
    } else {
      error.value = data.error || t("auth.resetLinkFailed");
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    error.value = t("messages.networkError");
  } finally {
    isLoading.value = false;
  }
};
</script>
