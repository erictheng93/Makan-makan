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
        <h2 class="text-3xl font-bold text-gray-900">MakanMasak</h2>
        <p class="mt-2 text-sm text-gray-600">{{ t("auth.memberLogin") }}</p>
      </div>

      <!-- 登入表單 -->
      <div
        class="bg-ios-card rounded-3xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-8"
      >
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <!-- 手機輸入 -->
          <div>
            <label
              for="phone"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              {{ t("auth.phone") }}
            </label>
            <input
              id="phone"
              v-model="form.phone"
              type="tel"
              required
              autocomplete="tel"
              class="w-full px-4 py-3 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              :class="{ 'ring-2 ring-ios-red': errors.phone }"
              placeholder="0912 345 678"
            />
            <p v-if="errors.phone" class="mt-1 text-sm text-red-600">
              {{ errors.phone }}
            </p>
          </div>

          <div v-if="otpRequested">
            <label
              for="otp"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              驗證碼
            </label>
            <input
              id="otp"
              v-model="form.otp"
              type="text"
              inputmode="numeric"
              maxlength="6"
              required
              autocomplete="one-time-code"
              class="w-full px-4 py-3 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              :class="{ 'ring-2 ring-ios-red': errors.otp }"
              placeholder="123456"
            />
            <p v-if="errors.otp" class="mt-1 text-sm text-red-600">
              {{ errors.otp }}
            </p>
            <p v-if="devOtp" class="mt-2 text-xs text-gray-500">
              Dev OTP: {{ devOtp }}
            </p>
          </div>

          <!-- 錯誤提示 -->
          <div v-if="error" class="bg-ios-red/10 rounded-xl p-4">
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

          <!-- 登入按鈕 -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3.5 px-4 rounded-full font-semibold hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isLoading" class="flex items-center justify-center">
              <div
                class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"
              />
              {{ t("auth.loggingIn") }}
            </span>
            <span v-else>{{
              otpRequested ? t("auth.login") : "取得驗證碼"
            }}</span>
          </button>
        </form>

        <!-- 訪客繼續 -->
        <div class="mt-6 text-center">
          <router-link
            to="/menu"
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            {{ t("auth.guestBrowse") }}
          </router-link>
        </div>
      </div>

      <!-- 版權信息 -->
      <div class="text-center">
        <p class="text-xs text-gray-500">
          © 2026 MakanMasak. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "@/composables/useI18n";

const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();

const isLoading = ref(false);
const error = ref("");
const otpRequested = ref(false);
const devOtp = ref("");

const form = reactive({
  phone: "",
  otp: "",
});

const errors = reactive({
  phone: "",
  otp: "",
});

const validateForm = () => {
  errors.phone = "";
  errors.otp = "";

  if (!form.phone.trim()) {
    errors.phone = "請輸入手機號碼";
    return false;
  }

  if (otpRequested.value && !/^\d{6}$/.test(form.otp)) {
    errors.otp = "請輸入 6 位數驗證碼";
    return false;
  }

  return true;
};

const handleSubmit = async () => {
  if (!validateForm()) return;

  isLoading.value = true;
  error.value = "";

  try {
    if (!otpRequested.value) {
      const result = await authStore.requestOtp(form.phone);
      if (result.success) {
        otpRequested.value = true;
        devOtp.value = result.data?.devOtp ?? "";
        return;
      }
      error.value = result.error || t("auth.loginFailed");
      return;
    }

    const result = await authStore.verifyOtp(form.phone, form.otp);

    if (result.success) {
      // 檢查是否有重定向路徑
      const redirect = router.currentRoute.value.query.redirect as string;
      if (redirect) {
        router.push(redirect);
      } else {
        router.push("/profile");
      }
    } else {
      error.value = result.error || t("auth.loginFailed");
    }
  } catch {
    error.value = t("auth.loginError");
  } finally {
    isLoading.value = false;
  }
};

// 如果已登入，自動跳轉
onMounted(async () => {
  if (authStore.isAuthenticated) {
    const isValid = await authStore.checkAuth();
    if (isValid) {
      router.push("/orders");
    }
  }
});
</script>
