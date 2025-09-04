<template>
  <div
    class="min-h-screen bg-gradient-to-br from-kitchen-50 to-kitchen-100 flex items-center justify-center p-4"
  >
    <div class="max-w-md w-full">
      <!-- Logo and Title -->
      <div class="text-center mb-8">
        <div
          class="w-20 h-20 bg-kitchen-600 rounded-full flex items-center justify-center mx-auto mb-4"
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
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-gray-900 mb-2">廚房顯示系統</h1>
        <p class="text-gray-600">請登入您的廚師帳號</p>
      </div>

      <!-- Login Form -->
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <form class="space-y-6" @submit.prevent="handleLogin">
          <!-- Username Field -->
          <div>
            <label
              for="username"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              用戶名稱
            </label>
            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
              >
                <UserIcon class="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="username"
                v-model="credentials.username"
                type="text"
                required
                autocomplete="username"
                class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
                placeholder="請輸入用戶名稱"
                :disabled="isLoading"
              />
            </div>
          </div>

          <!-- Password Field -->
          <div>
            <label
              for="password"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              密碼
            </label>
            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
              >
                <LockClosedIcon class="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                v-model="credentials.password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                class="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kitchen-500 focus:border-transparent"
                placeholder="請輸入密碼"
                :disabled="isLoading"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                :disabled="isLoading"
                @click="showPassword = !showPassword"
              >
                <EyeIcon
                  v-if="showPassword"
                  class="h-5 w-5 text-gray-400 hover:text-gray-600"
                />
                <EyeSlashIcon
                  v-else
                  class="h-5 w-5 text-gray-400 hover:text-gray-600"
                />
              </button>
            </div>
          </div>

          <!-- Error Message -->
          <div
            v-if="errorMessage"
            class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl"
          >
            <div class="flex items-center">
              <ExclamationTriangleIcon class="h-5 w-5 mr-2" />
              <span class="text-sm">{{ errorMessage }}</span>
            </div>
          </div>

          <!-- Login Button -->
          <button
            type="submit"
            :disabled="isLoading || !canSubmit"
            class="w-full btn-kitchen-primary flex items-center justify-center py-3 text-lg"
          >
            <div
              v-if="isLoading"
              class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
            />
            {{ isLoading ? "登入中..." : "登入" }}
          </button>
        </form>

        <!-- Footer Links -->
        <div class="mt-6 text-center text-sm text-gray-500">
          <p>僅限廚師帳號登入</p>
          <p class="mt-1">需要協助？請聯繫系統管理員</p>
        </div>
      </div>

      <!-- System Info -->
      <div class="mt-8 text-center text-xs text-gray-500">
        <p>MakanMakan 廚房顯示系統 v1.0</p>
        <p class="mt-1">最佳瀏覽體驗：Chrome、Edge、Safari</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import UserIcon from "@heroicons/vue/24/outline/UserIcon";
import LockClosedIcon from "@heroicons/vue/24/outline/LockClosedIcon";
import EyeIcon from "@heroicons/vue/24/outline/EyeIcon";
import EyeSlashIcon from "@heroicons/vue/24/outline/EyeSlashIcon";
import ExclamationTriangleIcon from "@heroicons/vue/24/outline/ExclamationTriangleIcon";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";

// Composables
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const settingsStore = useSettingsStore();

// State
const credentials = ref({
  username: "",
  password: "",
});

const showPassword = ref(false);
const errorMessage = ref("");
const isLoading = ref(false);

// Computed
const canSubmit = computed(() => {
  return (
    credentials.value.username.trim() !== "" &&
    credentials.value.password.trim() !== "" &&
    !isLoading.value
  );
});

// Methods
const handleLogin = async () => {
  if (!canSubmit.value) return;

  errorMessage.value = "";
  isLoading.value = true;

  try {
    await authStore.login({
      username: credentials.value.username.trim(),
      password: credentials.value.password,
    });

    toast.success("登入成功！");

    // 導向廚房界面
    const restaurantId = authStore.restaurantId;
    if (restaurantId) {
      await router.push(`/kitchen/${restaurantId}`);
    } else {
      throw new Error("無法獲取餐廳資訊");
    }
  } catch (error: any) {
    console.error("Login failed:", error);
    errorMessage.value = error.message || "登入失敗，請檢查用戶名稱和密碼";

    // 清除密碼欄位
    credentials.value.password = "";
  } finally {
    isLoading.value = false;
  }
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Enter" && canSubmit.value) {
    handleLogin();
  }
};

// 生命週期
onMounted(async () => {
  // 初始化設定
  settingsStore.initialize();

  // 檢查是否已登入
  if (authStore.isAuthenticated) {
    const restaurantId = authStore.restaurantId;
    if (restaurantId) {
      await router.push(`/kitchen/${restaurantId}`);
      return;
    }
  }

  // 設置鍵盤監聽
  document.addEventListener("keydown", handleKeyDown);

  // 聚焦到用戶名稱欄位
  setTimeout(() => {
    const usernameInput = document.getElementById("username");
    if (usernameInput) {
      usernameInput.focus();
    }
  }, 100);
});

// 清理
import { onUnmounted } from "vue";
onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
});
</script>
