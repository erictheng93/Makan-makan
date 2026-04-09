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
        <h2 class="text-3xl font-bold text-gray-900">MakanMakan</h2>
        <p class="mt-2 text-sm text-gray-600">{{ t("auth.memberRegister") }}</p>
      </div>

      <!-- 註冊表單 -->
      <div
        class="bg-ios-card rounded-3xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-8"
      >
        <form class="space-y-5" @submit.prevent="handleSubmit">
          <!-- 帳號輸入 -->
          <div>
            <label
              for="username"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              {{ t("auth.username") }} <span class="text-red-500">*</span>
            </label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              required
              autocomplete="username"
              class="w-full px-4 py-3 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              :class="{ 'border-red-500': errors.username }"
              :placeholder="t('auth.usernamePlaceholder')"
            />
            <p v-if="errors.username" class="mt-1 text-sm text-red-600">
              {{ errors.username }}
            </p>
          </div>

          <!-- 姓名輸入 -->
          <div>
            <label
              for="fullName"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              {{ t("auth.displayName") }} <span class="text-red-500">*</span>
            </label>
            <input
              id="fullName"
              v-model="form.fullName"
              type="text"
              required
              autocomplete="name"
              class="w-full px-4 py-3 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              :class="{ 'border-red-500': errors.fullName }"
              :placeholder="t('auth.displayNamePlaceholder')"
            />
            <p v-if="errors.fullName" class="mt-1 text-sm text-red-600">
              {{ errors.fullName }}
            </p>
          </div>

          <!-- 密碼輸入 -->
          <div>
            <label
              for="password"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              {{ t("auth.password") }} <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                class="w-full px-4 py-3 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition pr-12"
                :class="{ 'border-red-500': errors.password }"
                :placeholder="t('auth.passwordPlaceholderWithMin')"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-4 flex items-center"
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="showPassword"
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
            <p v-if="errors.password" class="mt-1 text-sm text-red-600">
              {{ errors.password }}
            </p>
          </div>

          <!-- 確認密碼輸入 -->
          <div>
            <label
              for="confirmPassword"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              {{ t("auth.confirmPassword") }}
              <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                class="w-full px-4 py-3 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition pr-12"
                :class="{ 'border-red-500': errors.confirmPassword }"
                :placeholder="t('auth.confirmPasswordPlaceholder')"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-4 flex items-center"
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

          <!-- Email 輸入（選填） -->
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              {{ t("auth.email") }}
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              class="w-full px-4 py-3 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              :class="{ 'border-red-500': errors.email }"
              :placeholder="t('auth.emailPlaceholder')"
            />
            <p v-if="errors.email" class="mt-1 text-sm text-red-600">
              {{ errors.email }}
            </p>
          </div>

          <!-- 手機號碼輸入（選填） -->
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
              autocomplete="tel"
              class="w-full px-4 py-3 bg-ios-bg rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
              :class="{ 'border-red-500': errors.phone }"
              :placeholder="t('auth.phonePlaceholder')"
            />
            <p v-if="errors.phone" class="mt-1 text-sm text-red-600">
              {{ errors.phone }}
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

          <!-- 註冊按鈕 -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3.5 px-4 rounded-full font-semibold hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isLoading" class="flex items-center justify-center">
              <div
                class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"
              />
              {{ t("auth.registering") }}
            </span>
            <span v-else>{{ t("auth.register") }}</span>
          </button>
        </form>

        <!-- 登入連結 -->
        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600">
            {{ t("auth.hasAccount") }}
            <router-link
              to="/login"
              class="font-medium text-orange-600 hover:text-orange-500"
            >
              {{ t("auth.loginNow") }}
            </router-link>
          </p>
        </div>

        <!-- 訪客繼續 -->
        <div class="mt-4 text-center">
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
          © 2025 MakanMakan. All rights reserved.
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

const showPassword = ref(false);
const showConfirmPassword = ref(false);
const isLoading = ref(false);
const error = ref("");

const form = reactive({
  username: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  email: "",
  phone: "",
});

const errors = reactive({
  username: "",
  password: "",
  confirmPassword: "",
  fullName: "",
  email: "",
  phone: "",
});

const validateForm = () => {
  // 重置錯誤
  errors.username = "";
  errors.password = "";
  errors.confirmPassword = "";
  errors.fullName = "";
  errors.email = "";
  errors.phone = "";

  let isValid = true;

  // 驗證帳號
  if (!form.username.trim()) {
    errors.username = t("auth.usernameRequired");
    isValid = false;
  } else if (form.username.length < 3) {
    errors.username = t("auth.usernameMinLength");
    isValid = false;
  }

  // 驗證姓名
  if (!form.fullName.trim()) {
    errors.fullName = t("auth.displayNameRequired");
    isValid = false;
  }

  // 驗證密碼
  if (!form.password) {
    errors.password = t("auth.passwordRequired");
    isValid = false;
  } else if (form.password.length < 6) {
    errors.password = t("auth.passwordMinLength");
    isValid = false;
  }

  // 驗證確認密碼
  if (!form.confirmPassword) {
    errors.confirmPassword = t("auth.confirmPasswordRequired");
    isValid = false;
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = t("auth.passwordMismatch");
    isValid = false;
  }

  // 驗證 Email（如果有填寫）
  if (form.email && form.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      errors.email = t("auth.invalidEmail");
      isValid = false;
    }
  }

  // 驗證手機號碼（如果有填寫）
  if (form.phone && form.phone.trim()) {
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(form.phone.replace(/[-\s]/g, ""))) {
      errors.phone = t("auth.invalidPhone");
      isValid = false;
    }
  }

  return isValid;
};

const handleSubmit = async () => {
  if (!validateForm()) return;

  isLoading.value = true;
  error.value = "";

  try {
    const registrationData = {
      username: form.username.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
    };

    const result = await authStore.register(registrationData);

    if (result.success) {
      // 註冊成功後自動登入並跳轉到訂單頁面
      router.push("/orders");
    } else {
      error.value = result.error || t("auth.registerFailed");
    }
  } catch {
    error.value = t("auth.registerError");
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
