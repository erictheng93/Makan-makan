<template>
  <header class="bg-white border-b border-gray-200 px-4 py-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <button
          class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          @click="$emit('toggle-sidebar')"
        >
          <Menu class="w-5 h-5 text-gray-600" />
        </button>

        <div class="hidden sm:block">
          <h1 class="text-lg font-semibold text-gray-900">
            {{ pageTitle }}
          </h1>
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <!-- Notifications -->
        <button
          class="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          @click="toggleNotifications"
        >
          <Bell class="w-5 h-5 text-gray-600" />
          <span
            v-if="unreadNotifications > 0"
            class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
          >
            {{ unreadNotifications > 99 ? "99+" : unreadNotifications }}
          </span>
        </button>

        <!-- Real-time Status -->
        <div
          class="hidden sm:flex items-center space-x-2 text-sm text-gray-500"
        >
          <div
            class="w-2 h-2 rounded-full"
            :class="isConnected ? 'bg-green-500' : 'bg-red-500'"
          />
          <span>{{ isConnected ? "即時連線" : "連線中斷" }}</span>
        </div>

        <!-- User Menu -->
        <div class="relative">
          <button
            class="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            @click="toggleUserMenu"
          >
            <div
              class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center"
            >
              <User class="w-4 h-4 text-primary-600" />
            </div>
            <div class="hidden sm:block text-left">
              <div class="text-sm font-medium text-gray-900">
                {{ user?.username }}
              </div>
              <div class="text-xs text-gray-500">
                {{ getRoleLabel(user?.role) }}
              </div>
            </div>
            <ChevronDown class="w-4 h-4 text-gray-600" />
          </button>

          <!-- User Dropdown -->
          <div
            v-if="showUserMenu"
            class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
          >
            <div class="py-1">
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                @click="handleLogout"
              >
                <div class="flex items-center space-x-2">
                  <LogOut class="w-4 h-4" />
                  <span>登出</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Breadcrumb -->
    <div v-if="breadcrumbs.length > 1" class="mt-2">
      <nav class="flex items-center space-x-1 text-sm text-gray-500">
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
          <router-link
            v-if="index < breadcrumbs.length - 1"
            :to="crumb.path"
            class="hover:text-gray-700 transition-colors"
          >
            {{ crumb.label }}
          </router-link>
          <span v-else class="text-gray-900 font-medium">{{
            crumb.label
          }}</span>
          <ChevronRight v-if="index < breadcrumbs.length - 1" class="w-4 h-4" />
        </template>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useNotificationStore } from "@/stores/notification";
import { useSSE } from "@/composables/useSSE";
import { UserRole } from "@/types";
import {
  Menu,
  Bell,
  User,
  ChevronDown,
  ChevronRight,
  LogOut,
} from "lucide-vue-next";

defineEmits<{
  "toggle-sidebar": [];
}>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const { isConnected } = useSSE();

const showUserMenu = ref(false);
const showNotificationPanel = ref(false);

const user = computed(() => authStore.user);
const unreadNotifications = computed(() => notificationStore.unreadCount);

const pageTitle = computed(() => {
  return (route.meta.title as string) || "MakanMakan 管理後台";
});

const breadcrumbs = computed(() => {
  const crumbs = [];
  const pathSegments = route.path.split("/").filter(Boolean);

  crumbs.push({ label: "首頁", path: "/dashboard" });

  if (pathSegments.length > 1) {
    const routeMapping: Record<string, string> = {
      orders: "訂單管理",
      menu: "菜單管理",
      tables: "桌台管理",
      users: "員工管理",
      analytics: "數據分析",
    };

    pathSegments.slice(1).forEach((segment, index) => {
      const label = routeMapping[segment] || segment;
      const path = "/" + pathSegments.slice(0, index + 2).join("/");
      crumbs.push({ label, path });
    });
  }

  return crumbs;
});

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
};

const toggleNotifications = () => {
  showNotificationPanel.value = !showNotificationPanel.value;
};

const handleLogout = async () => {
  await authStore.logout();
  router.push("/login");
};

const getRoleLabel = (role?: UserRole) => {
  const roleLabels = {
    [UserRole.ADMIN]: "系統管理員",
    [UserRole.OWNER]: "店主",
    [UserRole.CHEF]: "廚師",
    [UserRole.SERVICE]: "服務員",
    [UserRole.CASHIER]: "收銀員",
  };
  return role !== undefined ? roleLabels[role] : "";
};

const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest(".relative")) {
    showUserMenu.value = false;
    showNotificationPanel.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>
