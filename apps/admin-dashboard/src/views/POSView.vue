<template>
  <div class="pos-container">
    <!-- POS 系統標題 -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-3xl font-bold text-[#1C1C1E]">
          {{ t("pos.systemTitle") }}
        </h1>
        <p class="text-gray-500 mt-1">{{ t("pos.systemSubtitle") }}</p>
      </div>
      <div class="flex items-center space-x-4">
        <!-- 現在時間 -->
        <div class="text-right">
          <p class="text-sm text-gray-500">{{ t("cashier.currentTime") }}</p>
          <p class="text-lg font-semibold text-[#1C1C1E]">{{ currentTime }}</p>
        </div>
      </div>
    </div>

    <!-- Tab 導航 -->
    <div class="flex space-x-1 bg-gray-100 rounded-2xl p-1 mb-6">
      <router-link
        v-for="tab in tabs"
        :key="tab.name"
        :to="tab.path"
        :class="[
          'flex items-center justify-center px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
          isActiveTab(tab.path)
            ? 'bg-white text-[#007AFF] shadow-sm'
            : 'text-gray-500 hover:text-gray-700',
        ]"
      >
        <component :is="tab.icon" class="w-4 h-4 mr-2" />
        {{ tab.label }}
      </router-link>
    </div>

    <!-- Tab 內容 -->
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "@/i18n";
import { ShoppingCart, Settings2 } from "lucide-vue-next";

const route = useRoute();
const { t } = useI18n();

const currentTime = ref("");
let timeInterval: NodeJS.Timeout | null = null;

const tabs = computed(() => [
  {
    name: "checkout",
    label: t("pos.tabs.checkout"),
    path: "/dashboard/pos/checkout",
    icon: ShoppingCart,
  },
  {
    name: "management",
    label: t("pos.tabs.management"),
    path: "/dashboard/pos/management",
    icon: Settings2,
  },
]);

const isActiveTab = (path: string) => {
  return route.path === path || route.path.startsWith(path + "/");
};

const updateCurrentTime = () => {
  currentTime.value = new Date().toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

onMounted(() => {
  updateCurrentTime();
  timeInterval = setInterval(updateCurrentTime, 1000);
});

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval);
});
</script>

<style scoped>
.pos-container {
  padding: 1.5rem;
  min-height: 100vh;
  background-color: #f9fafb;
}

@media (max-width: 640px) {
  .pos-container {
    padding: 1rem;
  }
}
</style>
