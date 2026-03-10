<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
  HomeIcon,
  BuildingStorefrontIcon,
  CloudIcon,
  HeartIcon,
  KeyIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";

const route = useRoute();
const sidebarOpen = ref(false);

const navigation = [
  { name: "總覽", href: "/", icon: HomeIcon },
  { name: "租戶管理", href: "/tenants", icon: BuildingStorefrontIcon },
  { name: "部署管理", href: "/deployments", icon: CloudIcon },
  { name: "健康監控", href: "/health", icon: HeartIcon },
  { name: "授權管理", href: "/licenses", icon: KeyIcon },
];

const isCurrentRoute = (href: string) => {
  if (href === "/") {
    return route.path === "/";
  }
  return route.path.startsWith(href);
};
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Mobile sidebar -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-40 lg:hidden"
      @click="sidebarOpen = false"
    >
      <div class="fixed inset-0 bg-gray-600 bg-opacity-75" />
      <div class="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
        <div
          class="flex h-16 items-center justify-between px-4 border-b border-gray-200"
        >
          <span class="text-xl font-bold text-primary-600">MakanMakan</span>
          <button
            type="button"
            class="text-gray-500 hover:text-gray-700"
            @click="sidebarOpen = false"
          >
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>
        <nav class="flex-1 space-y-1 px-2 py-4">
          <RouterLink
            v-for="item in navigation"
            :key="item.name"
            :to="item.href"
            :class="[
              isCurrentRoute(item.href)
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              'group flex items-center px-3 py-2 text-sm font-medium rounded-md',
            ]"
            @click="sidebarOpen = false"
          >
            <component
              :is="item.icon"
              :class="[
                isCurrentRoute(item.href)
                  ? 'text-primary-600'
                  : 'text-gray-400 group-hover:text-gray-500',
                'mr-3 h-5 w-5 flex-shrink-0',
              ]"
            />
            {{ item.name }}
          </RouterLink>
        </nav>
      </div>
    </div>

    <!-- Desktop sidebar -->
    <div class="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div class="flex flex-col flex-grow bg-white border-r border-gray-200">
        <!-- Logo -->
        <div class="flex h-16 items-center px-6 border-b border-gray-200">
          <span class="text-xl font-bold text-primary-600">MakanMakan</span>
          <span class="ml-2 text-sm text-gray-500">管理平台</span>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 space-y-1 px-3 py-4">
          <RouterLink
            v-for="item in navigation"
            :key="item.name"
            :to="item.href"
            :class="[
              isCurrentRoute(item.href)
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
            ]"
          >
            <component
              :is="item.icon"
              :class="[
                isCurrentRoute(item.href)
                  ? 'text-primary-600'
                  : 'text-gray-400 group-hover:text-gray-500',
                'mr-3 h-5 w-5 flex-shrink-0',
              ]"
            />
            {{ item.name }}
          </RouterLink>
        </nav>

        <!-- Version info -->
        <div class="px-6 py-4 border-t border-gray-200">
          <p class="text-xs text-gray-500">版本 1.0.0</p>
        </div>
      </div>
    </div>

    <!-- Main content area -->
    <div class="lg:pl-64">
      <!-- Top bar -->
      <div
        class="sticky top-0 z-10 flex h-16 bg-white border-b border-gray-200 lg:hidden"
      >
        <button
          type="button"
          class="px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
          @click="sidebarOpen = true"
        >
          <Bars3Icon class="h-6 w-6" />
        </button>
        <div class="flex items-center px-4">
          <span class="text-lg font-bold text-primary-600">MakanMakan</span>
        </div>
      </div>

      <!-- Page content -->
      <main class="py-6">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
