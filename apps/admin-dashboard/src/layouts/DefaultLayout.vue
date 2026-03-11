<template>
  <div class="flex h-screen bg-gray-100">
    <Sidebar :is-collapsed="isSidebarCollapsed" @toggle="toggleSidebar" />

    <div class="flex-1 flex flex-col overflow-hidden">
      <Header @toggle-sidebar="toggleSidebar" />

      <RestaurantContextBanner />

      <main class="flex-1 overflow-y-auto p-4">
        <router-view />
      </main>
    </div>

    <NotificationPanel
      v-if="showNotifications"
      @close="showNotifications = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import Sidebar from "@/components/layout/Sidebar.vue";
import Header from "@/components/layout/Header.vue";
import NotificationPanel from "@/components/layout/NotificationPanel.vue";
import RestaurantContextBanner from "@/components/layout/RestaurantContextBanner.vue";
import { useSSE } from "@/composables/useSSE";
import { useAuthStore } from "@/stores/auth";

const isSidebarCollapsed = ref(false);
const showNotifications = ref(false);

const { connect, disconnect } = useSSE();
const authStore = useAuthStore();

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

// Reactively connect/disconnect SSE based on restaurant context
watch(
  () => authStore.restaurantId,
  (newId, oldId) => {
    if (oldId) disconnect();
    if (newId) connect();
  },
  { immediate: true },
);

onUnmounted(() => {
  disconnect();
});
</script>
