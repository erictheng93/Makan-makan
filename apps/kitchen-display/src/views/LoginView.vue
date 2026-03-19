<template>
  <div class="bg-ios-bg min-h-screen flex items-center justify-center p-4">
    <div class="max-w-sm w-full">
      <!-- App Icon & Title -->
      <div class="flex flex-col items-center mb-8">
        <div
          class="w-20 h-20 rounded-[22px] bg-gradient-to-br from-ios-blue to-ios-green shadow-[0_8px_30px_rgba(0,122,255,0.08)] flex items-center justify-center mb-4"
        >
          <ChefHat class="w-10 h-10 text-white" />
        </div>
        <h1 class="text-2xl font-extrabold text-ios-text mb-1">廚房顯示系統</h1>
        <p class="text-sm text-ios-secondary">Kitchen Display System</p>
      </div>

      <!-- Login Form Card -->
      <div class="bg-white rounded-2xl p-6 shadow-card">
        <form class="space-y-4" @submit.prevent="handleLogin">
          <!-- Username Field -->
          <div>
            <label
              for="username"
              class="text-sm font-semibold text-ios-text mb-1.5 block"
            >
              用戶名稱
            </label>
            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
              >
                <User class="w-4.5 h-4.5 text-ios-tertiary" />
              </div>
              <input
                id="username"
                v-model="credentials.username"
                type="text"
                required
                autocomplete="username"
                placeholder="請輸入用戶名稱"
                :disabled="isLoading"
                class="w-full bg-ios-bg rounded-xl py-3.5 pl-10 pr-4 text-base text-ios-text placeholder-ios-tertiary outline-none focus:ring-2 focus:ring-ios-blue/30 transition-all"
              />
            </div>
          </div>

          <!-- Password Field -->
          <div>
            <label
              for="password"
              class="text-sm font-semibold text-ios-text mb-1.5 block"
            >
              密碼
            </label>
            <div class="relative">
              <div
                class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"
              >
                <Lock class="w-4.5 h-4.5 text-ios-tertiary" />
              </div>
              <input
                id="password"
                v-model="credentials.password"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="current-password"
                placeholder="請輸入密碼"
                :disabled="isLoading"
                class="w-full bg-ios-bg rounded-xl py-3.5 pl-10 pr-10 text-base text-ios-text placeholder-ios-tertiary outline-none focus:ring-2 focus:ring-ios-blue/30 transition-all"
              />
              <button
                type="button"
                :disabled="isLoading"
                class="absolute inset-y-0 right-0 pr-3.5 flex items-center"
                @click="showPassword = !showPassword"
              >
                <Eye
                  v-if="showPassword"
                  class="w-4.5 h-4.5 text-ios-tertiary hover:text-ios-secondary transition-colors"
                />
                <EyeOff
                  v-else
                  class="w-4.5 h-4.5 text-ios-tertiary hover:text-ios-secondary transition-colors"
                />
              </button>
            </div>
          </div>

          <!-- Error Message -->
          <div
            v-if="errorMessage"
            class="flex items-center gap-2 bg-ios-red/8 rounded-xl px-4 py-3"
          >
            <AlertTriangle class="w-4 h-4 text-ios-red flex-shrink-0" />
            <span class="text-ios-red text-sm">{{ errorMessage }}</span>
          </div>

          <!-- Login Button -->
          <button
            type="submit"
            :disabled="isLoading || !canSubmit"
            class="w-full bg-ios-blue text-white rounded-full py-4 font-bold text-base min-h-[44px] flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 active:scale-[0.98] transition-transform mt-2"
          >
            <div
              v-if="isLoading"
              class="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"
            />
            <span>{{ isLoading ? "登入中..." : "登入" }}</span>
          </button>
        </form>

        <!-- Footer -->
        <p class="text-xs text-ios-secondary mt-5 text-center">
          僅限廚師角色登入
        </p>
      </div>

      <!-- System Info -->
      <div class="mt-6 text-center text-xs text-ios-secondary space-y-1">
        <p>MakanMakan 廚房顯示系統 v1.0</p>
        <p>需要協助？請聯繫系統管理員</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import {
  ChefHat,
  User,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-vue-next";
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
onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
});
</script>
