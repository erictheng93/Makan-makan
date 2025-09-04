<template>
  <header class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
    <div class="container mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <!-- Left Section: Logo and Restaurant Name -->
        <div class="flex items-center space-x-4">
          <div
            class="w-10 h-10 bg-kitchen-600 rounded-lg flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-white"
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
          <div>
            <h1 class="text-xl font-bold text-gray-900">
              {{ restaurantName }}
            </h1>
            <p class="text-sm text-gray-600">廚房顯示系統</p>
          </div>
        </div>

        <!-- Center Section: Stats Summary -->
        <div class="hidden md:flex items-center space-x-6">
          <div class="flex items-center space-x-4">
            <div class="text-center">
              <div class="text-2xl font-bold text-yellow-600">
                {{ stats.pendingCount }}
              </div>
              <div class="text-xs text-gray-500">待處理</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">
                {{ stats.preparingCount }}
              </div>
              <div class="text-xs text-gray-500">製作中</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-green-600">
                {{ stats.readyCount }}
              </div>
              <div class="text-xs text-gray-500">已完成</div>
            </div>
          </div>
        </div>

        <!-- Right Section: Actions and Time -->
        <div class="flex items-center space-x-4">
          <!-- Current Time -->
          <div class="text-right">
            <div class="text-lg font-bold text-gray-900">
              {{ formattedTime }}
            </div>
            <div class="text-sm text-gray-500">
              {{ formattedDate }}
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center space-x-2">
            <!-- Connection Status -->
            <div class="flex items-center space-x-2">
              <div
                :class="[
                  'w-3 h-3 rounded-full',
                  isConnected ? 'bg-green-500' : 'bg-red-500',
                ]"
                :title="isConnected ? '已連線' : '未連線'"
              />
              <span
                :class="[
                  'text-sm font-medium',
                  isConnected ? 'text-green-600' : 'text-red-600',
                ]"
                class="hidden sm:inline"
              >
                {{ isConnected ? "已連線" : "離線" }}
              </span>
            </div>

            <!-- Reconnect Button (when disconnected) -->
            <button
              v-if="!isConnected"
              class="w-10 h-10 bg-orange-100 hover:bg-orange-200 rounded-lg flex items-center justify-center transition-colors"
              title="重新連線"
              @click="$emit('reconnect')"
            >
              <ArrowPathIcon class="w-5 h-5 text-orange-600" />
            </button>

            <!-- Refresh Button -->
            <button
              :disabled="isRefreshing"
              class="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
              title="刷新訂單"
              @click="$emit('refresh')"
            >
              <ArrowPathIcon
                :class="[
                  'w-5 h-5 text-gray-600',
                  { 'animate-spin': isRefreshing },
                ]"
              />
            </button>

            <!-- Fullscreen Toggle -->
            <button
              class="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
              title="全屏模式"
              @click="$emit('toggle-fullscreen')"
            >
              <component
                :is="
                  isFullscreen ? ArrowsPointingInIcon : ArrowsPointingOutIcon
                "
                class="w-5 h-5 text-gray-600"
              />
            </button>

            <!-- Settings Button -->
            <button
              class="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
              title="設定"
              @click="$emit('open-settings')"
            >
              <Cog6ToothIcon class="w-5 h-5 text-gray-600" />
            </button>

            <!-- Logout Button -->
            <button
              class="btn-kitchen-secondary px-4 py-2"
              title="登出"
              @click="handleLogoutClick"
            >
              <ArrowRightOnRectangleIcon class="w-4 h-4 mr-2" />
              登出
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Stats (visible on small screens) -->
      <div class="md:hidden mt-4 pt-4 border-t border-gray-200">
        <div class="flex justify-around">
          <div class="text-center">
            <div class="text-xl font-bold text-yellow-600">
              {{ stats.pendingCount }}
            </div>
            <div class="text-xs text-gray-500">待處理</div>
          </div>
          <div class="text-center">
            <div class="text-xl font-bold text-blue-600">
              {{ stats.preparingCount }}
            </div>
            <div class="text-xs text-gray-500">製作中</div>
          </div>
          <div class="text-center">
            <div class="text-xl font-bold text-green-600">
              {{ stats.readyCount }}
            </div>
            <div class="text-xs text-gray-500">已完成</div>
          </div>
          <div class="text-center">
            <div class="text-xl font-bold text-gray-600">
              {{ stats.completedToday }}
            </div>
            <div class="text-xs text-gray-500">今日完成</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Logout Confirmation Modal -->
    <div
      v-if="showLogoutConfirm"
      class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      @click="showLogoutConfirm = false"
    >
      <div class="bg-white rounded-2xl p-6 max-w-sm w-full" @click.stop>
        <div class="text-center">
          <div
            class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <ExclamationTriangleIcon class="w-6 h-6 text-red-600" />
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">確認登出</h3>
          <p class="text-gray-600 mb-6">您確定要登出廚房系統嗎？</p>

          <div class="flex space-x-3">
            <button
              class="flex-1 btn-kitchen-secondary"
              @click="showLogoutConfirm = false"
            >
              取消
            </button>
            <button
              class="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-xl transition-colors"
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
import { ref, computed, onMounted, onUnmounted, withDefaults } from "vue";
import {
  ArrowPathIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";
import type { KitchenStats } from "@/types";

// Props
interface Props {
  restaurantName: string;
  currentTime: Date;
  stats: KitchenStats;
  connectionStatus?: string;
  isConnected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  connectionStatus: "disconnected",
  isConnected: false,
});

// Emits
const emit = defineEmits<{
  logout: [];
  refresh: [];
  reconnect: [];
  "toggle-fullscreen": [];
  "open-settings": [];
}>();

// State
const isRefreshing = ref(false);
const isFullscreen = ref(false);
const showLogoutConfirm = ref(false);

// Computed
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
