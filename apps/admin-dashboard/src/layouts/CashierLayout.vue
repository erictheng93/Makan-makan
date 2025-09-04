<template>
  <div class="h-screen bg-white flex flex-col">
    <header class="bg-primary-600 text-white px-4 py-3 border-b shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <h1 class="text-xl font-semibold">收銀系統</h1>
          <div class="text-sm opacity-90">
            {{ restaurantName }}
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <div class="text-sm">
            <div>收銀員: {{ userName }}</div>
            <div>{{ currentDate }}</div>
          </div>

          <button
            class="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm transition-colors"
            @click="$router.push('/dashboard')"
          >
            管理介面
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1 overflow-hidden">
      <router-view />
    </main>

    <footer class="bg-gray-50 px-4 py-2 border-t">
      <div class="flex items-center justify-between text-sm text-gray-600">
        <div>今日總銷售: {{ todayRevenue }}</div>
        <div>今日訂單數: {{ todayOrderCount }}</div>
        <div class="flex items-center space-x-2">
          <div
            class="w-2 h-2 rounded-full"
            :class="isOnline ? 'bg-green-500' : 'bg-red-500'"
          />
          <span>{{ isOnline ? "已連線" : "離線" }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useDashboardStore } from "@/stores/dashboard";
import { format } from "date-fns";

const authStore = useAuthStore();
const dashboardStore = useDashboardStore();

const currentDate = ref("");
const isOnline = ref(navigator.onLine);

const userName = computed(() => authStore.user?.username || "");
const restaurantName = computed(() => "MakanMakan Restaurant");
const todayRevenue = computed(
  () => `$${dashboardStore.todayRevenue?.toFixed(2) || "0.00"}`,
);
const todayOrderCount = computed(() => dashboardStore.todayOrders || 0);

const updateDate = () => {
  currentDate.value = format(new Date(), "yyyy/MM/dd HH:mm");
};

onMounted(() => {
  updateDate();
  setInterval(updateDate, 60000); // Update every minute

  window.addEventListener("online", () => (isOnline.value = true));
  window.addEventListener("offline", () => (isOnline.value = false));
});
</script>
