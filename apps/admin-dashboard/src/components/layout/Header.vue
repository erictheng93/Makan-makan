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
        <!-- Restaurant Selector (Admin only) -->
        <RestaurantSelector />

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
          <span>{{
            isConnected
              ? t("header.realtime.connected")
              : t("header.realtime.disconnected")
          }}</span>
        </div>

        <!-- Language Switcher -->
        <LanguageSwitcher />

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
                  <span>{{ t("header.userMenu.logout") }}</span>
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
import { useI18n } from "@/i18n";
import { UserRole } from "@/types";
import LanguageSwitcher from "@/components/common/LanguageSwitcher.vue";
import RestaurantSelector from "@/components/layout/RestaurantSelector.vue";
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
const { t } = useI18n();

const showUserMenu = ref(false);
const showNotificationPanel = ref(false);

const user = computed(() => authStore.user);
const unreadNotifications = computed(() => notificationStore.unreadCount);

const pageTitle = computed(() => {
  const titleKey = route.meta.titleKey as string | undefined;
  return titleKey ? t(titleKey) : t("header.title");
});

const breadcrumbs = computed(() => {
  const crumbs = [{ label: t("header.breadcrumb.home"), path: "/dashboard" }];

  // Use matched routes' meta.titleKey for breadcrumb labels
  const matched = route.matched;
  // Skip the first matched route (DefaultLayout) — it's the "/dashboard" parent
  for (let i = 1; i < matched.length; i++) {
    const record = matched[i];
    const titleKey = record.meta.titleKey as string | undefined;
    if (titleKey) {
      crumbs.push({ label: t(titleKey), path: record.path });
    }
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
    [UserRole.ADMIN]: t("header.roles.admin"),
    [UserRole.OWNER]: t("header.roles.owner"),
    [UserRole.CHEF]: t("header.roles.chef"),
    [UserRole.SERVICE]: t("header.roles.service"),
    [UserRole.CASHIER]: t("header.roles.cashier"),
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
