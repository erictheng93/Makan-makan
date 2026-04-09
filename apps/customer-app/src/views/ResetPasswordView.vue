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
          {{ t("auth.resetPassword") }}
        </h2>
        <p v-if="!tokenError && !success" class="mt-2 text-sm text-gray-600">
          {{ tWithParams("auth.resetPasswordDesc", { username: maskedEmail }) }}
        </p>
      </div>

      <!-- Token 驗證中 -->
      <div
        v-if="verifying"
        class="bg-ios-card rounded-3xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-8 text-center"
      >
        <svg
          class="animate-spin mx-auto h-12 w-12 text-orange-500"
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
        <p class="mt-4 text-gray-600">{{ t("auth.verifyingLink") }}</p>
      </div>

      <!-- Token 錯誤 -->
      <div
        v-else-if="tokenError"
        class="bg-ios-card rounded-3xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-8"
      >
        <div class="text-center">
          <svg
            class="mx-auto h-16 w-16 text-red-400"
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
          <h3 class="mt-4 text-lg font-medium text-gray-900">
            {{ t("auth.linkInvalid") }}
          </h3>
          <p class="mt-2 text-sm text-gray-600">{{ tokenError }}</p>
          <div class="mt-6 space-y-3">
            <button
              class="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
              @click="$router.push('/forgot-password')"
            >
              {{ t("auth.resendLink") }}
            </button>
            <button
              class="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              @click="$router.push('/login')"
            >
              {{ t("auth.backToLogin") }}
            </button>
          </div>
        </div>
      </div>

      <!-- 重設成功 -->
      <div
        v-else-if="success"
        class="bg-ios-card rounded-3xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-8"
      >
        <div class="text-center">
          <svg
            class="mx-auto h-16 w-16 text-green-400"
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
          <h3 class="mt-4 text-lg font-medium text-gray-900">
            {{ t("auth.resetSuccess") }}
          </h3>
          <p class="mt-2 text-sm text-gray-600">{{ successMessage }}</p>
          <button
            class="mt-6 w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            @click="$router.push('/login')"
          >
            {{ t("auth.goToLogin") }}
          </button>
        </div>
      </div>

      <!-- 重設密碼表單 -->
      <div
        v-else
        class="bg-ios-card rounded-3xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-8"
      >
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <!-- 新密碼 -->
          <div>
            <label
              for="newPassword"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              {{ t("auth.newPassword") }}
            </label>
            <div class="relative">
              <input
                id="newPassword"
                v-model="form.newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                class="w-full px-4 py-3 pr-10 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
                :class="{ 'border-red-500': errors.newPassword }"
                :placeholder="t('auth.newPasswordPlaceholder')"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                @click="showNewPassword = !showNewPassword"
              >
                <svg
                  v-if="showNewPassword"
                  class="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <svg
                  v-else
                  class="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              </button>
            </div>
            <p v-if="errors.newPassword" class="mt-1 text-sm text-red-600">
              {{ errors.newPassword }}
            </p>
            <!-- 密碼強度指示器 -->
            <div v-if="form.newPassword" class="mt-2">
              <div class="flex items-center space-x-2">
                <div
                  class="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden"
                >
                  <div
                    class="h-full transition-all duration-300"
                    :class="passwordStrengthColor"
                    :style="{ width: passwordStrengthWidth }"
                  />
                </div>
                <span class="text-xs" :class="passwordStrengthTextColor">
                  {{ passwordStrengthText }}
                </span>
              </div>
            </div>
          </div>

          <!-- 確認密碼 -->
          <div>
            <label
              for="confirmPassword"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              {{ t("auth.confirmPassword") }}
            </label>
            <div class="relative">
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                class="w-full px-4 py-3 pr-10 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
                :class="{ 'border-red-500': errors.confirmPassword }"
                :placeholder="t('auth.confirmPasswordPlaceholder')"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <svg
                  v-if="showConfirmPassword"
                  class="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <svg
                  v-else
                  class="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              </button>
            </div>
            <p v-if="errors.confirmPassword" class="mt-1 text-sm text-red-600">
              {{ errors.confirmPassword }}
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
                isLoading ? t("auth.resetting") : t("auth.resetPassword")
              }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "@/composables/useI18n";

const _router = useRouter();
const route = useRoute();
const { t, tWithParams } = useI18n();

const form = reactive({
  newPassword: "",
  confirmPassword: "",
});

const errors = reactive({
  newPassword: "",
  confirmPassword: "",
});

const token = ref("");
const maskedEmail = ref("");
const error = ref("");
const tokenError = ref("");
const success = ref(false);
const successMessage = ref("");
const isLoading = ref(false);
const verifying = ref(true);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

// 密碼強度計算
const passwordStrength = computed(() => {
  const password = form.newPassword;
  let strength = 0;

  if (password.length >= 6) strength++;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  return strength;
});

const passwordStrengthWidth = computed(() => {
  return `${(passwordStrength.value / 5) * 100}%`;
});

const passwordStrengthColor = computed(() => {
  if (passwordStrength.value <= 1) return "bg-red-500";
  if (passwordStrength.value <= 2) return "bg-orange-500";
  if (passwordStrength.value <= 3) return "bg-yellow-500";
  if (passwordStrength.value <= 4) return "bg-blue-500";
  return "bg-green-500";
});

const passwordStrengthTextColor = computed(() => {
  if (passwordStrength.value <= 1) return "text-red-600";
  if (passwordStrength.value <= 2) return "text-orange-600";
  if (passwordStrength.value <= 3) return "text-yellow-600";
  if (passwordStrength.value <= 4) return "text-blue-600";
  return "text-green-600";
});

const passwordStrengthText = computed(() => {
  if (passwordStrength.value <= 1) return t("auth.passwordStrength.weak");
  if (passwordStrength.value <= 2) return t("auth.passwordStrength.medium");
  if (passwordStrength.value <= 3) return t("auth.passwordStrength.good");
  if (passwordStrength.value <= 4) return t("auth.passwordStrength.strong");
  return t("auth.passwordStrength.veryStrong");
});

const validateForm = () => {
  errors.newPassword = "";
  errors.confirmPassword = "";
  let isValid = true;

  // 新密碼驗證
  if (!form.newPassword) {
    errors.newPassword = t("auth.passwordRequired");
    isValid = false;
  } else if (form.newPassword.length < 6) {
    errors.newPassword = t("auth.passwordMinLength");
    isValid = false;
  }

  // 確認密碼驗證
  if (!form.confirmPassword) {
    errors.confirmPassword = t("auth.confirmPasswordRequired");
    isValid = false;
  } else if (form.newPassword !== form.confirmPassword) {
    errors.confirmPassword = t("auth.passwordMismatch");
    isValid = false;
  }

  return isValid;
};

const verifyToken = async () => {
  try {
    const response = await fetch(
      `/api/v1/auth/reset-password/verify?token=${token.value}`,
    );
    const data = await response.json();

    if (data.valid) {
      maskedEmail.value = data.email || "";
    } else {
      tokenError.value = data.error || t("auth.tokenInvalid");
    }
  } catch (err) {
    console.error("Verify token error:", err);
    tokenError.value = t("auth.tokenVerifyError");
  } finally {
    verifying.value = false;
  }
};

const handleSubmit = async () => {
  error.value = "";

  if (!validateForm()) {
    return;
  }

  isLoading.value = true;

  try {
    const response = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: token.value,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      }),
    });

    const data = await response.json();

    if (data.success) {
      success.value = true;
      successMessage.value = data.message || t("auth.resetPasswordMessage");
    } else {
      error.value = data.error || t("auth.resetPasswordFailed");
    }
  } catch (err) {
    console.error("Reset password error:", err);
    error.value = t("messages.networkError");
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  // 從 URL 參數獲取 token
  token.value = route.query.token as string;

  if (!token.value) {
    tokenError.value = t("auth.missingToken");
    verifying.value = false;
    return;
  }

  // 驗證 token
  verifyToken();
});
</script>
