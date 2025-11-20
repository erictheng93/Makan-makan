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
        <p class="mt-2 text-sm text-gray-600">會員登入</p>
      </div>

      <!-- 登入表單 -->
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <!-- 帳號輸入 -->
          <div>
            <label
              for="username"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              帳號
            </label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              required
              autocomplete="username"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              :class="{ 'border-red-500': errors.username }"
              placeholder="請輸入帳號"
            />
            <p v-if="errors.username" class="mt-1 text-sm text-red-600">
              {{ errors.username }}
            </p>
          </div>

          <!-- 密碼輸入 -->
          <div>
            <label
              for="password"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              密碼
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition pr-12"
                :class="{ 'border-red-500': errors.password }"
                placeholder="請輸入密碼"
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

          <!-- 錯誤提示 -->
          <div
            v-if="error"
            class="bg-red-50 border border-red-200 rounded-lg p-4"
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

          <!-- 登入按鈕 -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4 rounded-lg font-medium hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isLoading" class="flex items-center justify-center">
              <div
                class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"
              />
              登入中...
            </span>
            <span v-else>登入</span>
          </button>
        </form>

        <!-- 註冊連結 -->
        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600">
            還沒有帳號？
            <router-link
              to="/register"
              class="font-medium text-orange-600 hover:text-orange-500"
            >
              立即註冊
            </router-link>
          </p>
        </div>

        <!-- 訪客繼續 -->
        <div class="mt-4 text-center">
          <router-link
            to="/menu"
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            以訪客身分繼續瀏覽
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

const router = useRouter();
const authStore = useAuthStore();

const showPassword = ref(false);
const isLoading = ref(false);
const error = ref("");

const form = reactive({
  username: "",
  password: "",
});

const errors = reactive({
  username: "",
  password: "",
});

const validateForm = () => {
  errors.username = "";
  errors.password = "";

  if (!form.username.trim()) {
    errors.username = "請輸入帳號";
    return false;
  }

  if (!form.password) {
    errors.password = "請輸入密碼";
    return false;
  }

  if (form.password.length < 6) {
    errors.password = "密碼至少需要6個字符";
    return false;
  }

  return true;
};

const handleSubmit = async () => {
  if (!validateForm()) return;

  isLoading.value = true;
  error.value = "";

  try {
    const result = await authStore.login(form.username, form.password);

    if (result.success) {
      // 檢查是否有重定向路徑
      const redirect = router.currentRoute.value.query.redirect as string;
      if (redirect) {
        router.push(redirect);
      } else {
        router.push("/orders");
      }
    } else {
      error.value = result.error || "登入失敗";
    }
  } catch {
    error.value = "登入過程中發生錯誤";
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
