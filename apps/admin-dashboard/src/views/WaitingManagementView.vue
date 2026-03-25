<template>
  <div class="space-y-6">
    <!-- Tab Navigation -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex space-x-8">
        <router-link
          v-for="tab in tabs"
          :key="tab.name"
          :to="tab.path"
          class="whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors"
          :class="
            isActiveTab(tab.path)
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          "
        >
          <component :is="tab.icon" class="inline-block w-4 h-4 mr-2 -mt-0.5" />
          {{ tab.label }}
        </router-link>
      </nav>
    </div>

    <!-- Tab Content -->
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";
import { useI18n } from "@/i18n";
import { ClipboardList, LayoutDashboard } from "lucide-vue-next";

const route = useRoute();
const { t } = useI18n();

const tabs = [
  {
    name: "list",
    path: "/dashboard/waiting/list",
    label: t("nav.waitingTabs.list"),
    icon: ClipboardList,
  },
  {
    name: "dashboard",
    path: "/dashboard/waiting/dashboard",
    label: t("nav.waitingTabs.dashboard"),
    icon: LayoutDashboard,
  },
];

const isActiveTab = (path: string) => {
  return route.path === path || route.path.startsWith(path + "/");
};
</script>
