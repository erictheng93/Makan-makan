<template>
  <header
    class="fixed top-0 w-full z-50 bg-white/85 backdrop-blur-xl border-b border-black/5"
  >
    <div class="px-4 py-3">
      <div class="flex items-center justify-between gap-4">
        <!-- Left Section: Title + Connection Status -->
        <div class="flex items-center gap-3 min-w-0">
          <h1 class="text-2xl font-extrabold text-ios-text whitespace-nowrap">
            廚房看板
          </h1>
          <!-- Connection Status -->
          <div class="flex items-center gap-1.5">
            <div
              :class="[
                'w-2.5 h-2.5 rounded-full transition-colors duration-200',
                isConnected ? 'bg-ios-green' : 'bg-ios-red',
              ]"
            />
            <span
              :class="[
                'text-sm font-medium hidden sm:inline',
                isConnected ? 'text-ios-green' : 'text-ios-red',
              ]"
            >
              {{ isConnected ? "已連線" : "離線" }}
            </span>
          </div>
        </div>

        <!-- Center Section: iOS Segmented Control for Kanban/Grid -->
        <div class="flex-1 flex justify-center">
          <div class="bg-ios-bg rounded-full p-0.5 inline-flex">
            <button
              :class="[
                'transition-all duration-200 ease-out',
                currentViewMode === 'kanban'
                  ? 'bg-white rounded-full shadow-card-sm px-4 py-1.5 text-sm font-semibold text-ios-text'
                  : 'px-4 py-1.5 text-sm font-medium text-ios-secondary',
              ]"
              @click="$emit('update:viewMode', 'kanban')"
            >
              看板
            </button>
            <button
              :class="[
                'transition-all duration-200 ease-out',
                currentViewMode === 'grid'
                  ? 'bg-white rounded-full shadow-card-sm px-4 py-1.5 text-sm font-semibold text-ios-text'
                  : 'px-4 py-1.5 text-sm font-medium text-ios-secondary',
              ]"
              @click="$emit('update:viewMode', 'grid')"
            >
              格狀
            </button>
          </div>
        </div>

        <!-- Right Section: Action Buttons -->
        <div class="flex items-center gap-2">
          <!-- Reconnect Button (when disconnected) -->
          <button
            v-if="!isConnected"
            class="w-11 h-11 rounded-full bg-ios-bg flex items-center justify-center transition-all duration-200 ease-out hover:bg-ios-separator active:scale-95"
            title="重新連線"
            @click="$emit('reconnect')"
          >
            <RefreshCw class="w-5 h-5 text-ios-orange" />
          </button>

          <!-- Refresh Button -->
          <button
            :disabled="isRefreshing"
            class="w-11 h-11 rounded-full bg-ios-bg flex items-center justify-center transition-all duration-200 ease-out hover:bg-ios-separator active:scale-95 disabled:opacity-50"
            title="刷新訂單"
            @click="$emit('refresh')"
          >
            <RefreshCw
              :class="[
                'w-5 h-5 text-ios-secondary',
                { 'animate-spin': isRefreshing },
              ]"
            />
          </button>

          <!-- Fullscreen Toggle -->
          <button
            class="w-11 h-11 rounded-full bg-ios-bg flex items-center justify-center transition-all duration-200 ease-out hover:bg-ios-separator active:scale-95"
            title="全屏模式"
            @click="$emit('toggle-fullscreen')"
          >
            <Minimize2 v-if="isFullscreen" class="w-5 h-5 text-ios-secondary" />
            <Maximize2 v-else class="w-5 h-5 text-ios-secondary" />
          </button>

          <!-- Notification Button -->
          <button
            class="w-11 h-11 rounded-full bg-ios-bg flex items-center justify-center transition-all duration-200 ease-out hover:bg-ios-separator active:scale-95"
            title="通知"
          >
            <Bell class="w-5 h-5 text-ios-secondary" />
          </button>

          <!-- Settings Button -->
          <button
            class="w-11 h-11 rounded-full bg-ios-bg flex items-center justify-center transition-all duration-200 ease-out hover:bg-ios-separator active:scale-95"
            title="設定"
            @click="$emit('open-settings')"
          >
            <Settings class="w-5 h-5 text-ios-secondary" />
          </button>

          <!-- Logout Button -->
          <button
            class="w-11 h-11 rounded-full bg-ios-red/10 flex items-center justify-center transition-all duration-200 ease-out hover:bg-ios-red/20 active:scale-95"
            title="登出"
            @click="handleLogoutClick"
          >
            <LogOut class="w-5 h-5 text-ios-red" />
          </button>
        </div>
      </div>
    </div>

    <!-- Logout Confirmation Modal -->
    <div
      v-if="showLogoutConfirm"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      @click="showLogoutConfirm = false"
    >
      <div
        class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-card-lg"
        @click.stop
      >
        <div class="text-center">
          <div
            class="w-12 h-12 bg-ios-red/10 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <AlertTriangle class="w-6 h-6 text-ios-red" />
          </div>
          <h3 class="text-lg font-semibold text-ios-text mb-2">確認登出</h3>
          <p class="text-ios-secondary mb-6">您確定要登出廚房系統嗎？</p>

          <div class="flex gap-3">
            <button
              class="flex-1 py-2.5 px-4 rounded-full bg-ios-bg text-ios-text font-semibold text-sm transition-all duration-200 ease-out hover:bg-ios-separator active:scale-95"
              @click="showLogoutConfirm = false"
            >
              取消
            </button>
            <button
              class="flex-1 py-2.5 px-4 rounded-full bg-ios-red text-white font-semibold text-sm transition-all duration-200 ease-out hover:bg-ios-red/90 active:scale-95"
              @click="confirmLogout"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  RefreshCw,
  Maximize2,
  Minimize2,
  Bell,
  Settings,
  LogOut,
  AlertTriangle,
} from "lucide-vue-next";
import type { KitchenStats } from "@/types";

// Props
interface Props {
  restaurantName: string;
  currentTime: Date;
  stats: KitchenStats;
  connectionStatus?: string;
  isConnected?: boolean;
  viewMode?: "kanban" | "grid";
}

const props = withDefaults(defineProps<Props>(), {
  connectionStatus: "disconnected",
  isConnected: false,
  viewMode: "kanban",
});

// Emits
const emit = defineEmits<{
  logout: [];
  refresh: [];
  reconnect: [];
  "toggle-fullscreen": [];
  "open-settings": [];
  "update:viewMode": ["kanban" | "grid"];
}>();

// State
const isRefreshing = ref(false);
const isFullscreen = ref(false);
const showLogoutConfirm = ref(false);

// Computed
const currentViewMode = computed(() => props.viewMode ?? "kanban");

const formattedTime = computed(() => {
  return props.currentTime.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
});

const formattedDate = computed(() => {
  return props.currentTime.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
});

// Methods
const handleLogoutClick = () => {
  showLogoutConfirm.value = true;
};

const confirmLogout = () => {
  showLogoutConfirm.value = false;
  // 延遲一下讓動畫完成
  setTimeout(() => {
    emit("logout");
  }, 100);
};

const checkFullscreenStatus = () => {
  isFullscreen.value = !!document.fullscreenElement;
};

// Handle fullscreen change events
onMounted(() => {
  document.addEventListener("fullscreenchange", checkFullscreenStatus);
  checkFullscreenStatus();
});

onUnmounted(() => {
  document.removeEventListener("fullscreenchange", checkFullscreenStatus);
});

// Handle refresh state (could be managed by parent)
</script>
