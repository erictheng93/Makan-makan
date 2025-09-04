<template>
  <div class="flex h-screen bg-gray-100">
    <Sidebar :is-collapsed="isSidebarCollapsed" @toggle="toggleSidebar" />

    <div class="flex-1 flex flex-col overflow-hidden">
      <Header @toggle-sidebar="toggleSidebar" />

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
import { ref, onMounted, onUnmounted } from "vue";
import Sidebar from "@/components/layout/Sidebar.vue";
import Header from "@/components/layout/Header.vue";
import NotificationPanel from "@/components/layout/NotificationPanel.vue";
import { useSSE } from "@/composables/useSSE";

const isSidebarCollapsed = ref(false);
const showNotifications = ref(false);

const { connect, disconnect } = useSSE();

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

onMounted(() => {
  connect();
});

onUnmounted(() => {
  disconnect();
});
</script>
