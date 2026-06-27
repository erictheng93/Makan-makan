<template>
  <aside
    class="bg-white border-r border-gray-200 transition-all duration-300"
    :class="[
      isCollapsed ? 'w-16' : 'w-64',
      isMobile ? 'fixed inset-y-0 left-0 z-40' : '',
      isMobile && isCollapsed ? '-translate-x-full' : 'translate-x-0',
    ]"
  >
    <div class="flex flex-col h-full">
      <!-- Logo -->
      <div class="flex items-center h-16 px-4 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <div
            class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center"
          >
            <span class="text-white font-bold text-sm">M</span>
          </div>
          <div v-if="!isCollapsed" class="font-semibold text-gray-900">
            MakanMakan
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        <template v-for="item in navigationItems" :key="item.name">
          <ModuleGate v-if="item.module" :module="item.module">
            <component
              :is="item.disabled ? 'div' : 'router-link'"
              v-show="item.visible"
              :to="item.disabled ? undefined : item.path"
              class="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              :class="[
                item.disabled
                  ? 'opacity-40 cursor-not-allowed text-gray-400'
                  : isActiveRoute(item.path)
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              ]"
              :title="item.disabled ? t('nav.selectRestaurantFirst') : ''"
              @click="!item.disabled && emit('navigate')"
            >
              <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
              <span v-if="!isCollapsed" class="ml-3">{{ item.label }}</span>
            </component>
            <template #fallback><span /></template>
            <template #loading><span /></template>
          </ModuleGate>
          <component
            :is="item.disabled ? 'div' : 'router-link'"
            v-else
            v-show="item.visible"
            :to="item.disabled ? undefined : item.path"
            class="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="[
              item.disabled
                ? 'opacity-40 cursor-not-allowed text-gray-400'
                : isActiveRoute(item.path)
                  ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            ]"
            :title="item.disabled ? t('nav.selectRestaurantFirst') : ''"
            @click="!item.disabled && emit('navigate')"
          >
            <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
            <span v-if="!isCollapsed" class="ml-3">{{ item.label }}</span>
          </component>
        </template>
      </nav>

      <!-- User Info -->
      <div class="px-4 py-4 border-t border-gray-200">
        <div class="flex items-center">
          <div
            class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center"
          >
            <User class="w-4 h-4 text-gray-600" />
          </div>
          <div v-if="!isCollapsed" class="ml-3">
            <div class="text-sm font-medium text-gray-900">
              {{ user?.username }}
            </div>
            <div class="text-xs text-gray-500">
              {{ getRoleLabel(user?.role) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { UserRole } from "@/types";
import { useI18n } from "@/i18n";
import ModuleGate from "@makanmakan/shared/components/ModuleGate.vue";
import type { ModuleKey } from "@makanmakan/shared/types/module-access";
import {
  Home,
  ShoppingCart,
  Menu,
  Users,
  BarChart3,
  Settings,
  User,
  CreditCard,
  Ticket as TicketIcon,
  Sparkles,
  Armchair,
  Activity,
  Globe,
  MapPinned,
  ReceiptText,
  UserPlus,
  Crown,
  MessageSquare,
  CalendarCheck,
} from "lucide-vue-next";

interface Props {
  isCollapsed: boolean;
  isMobile?: boolean;
}

defineProps<Props>();
const emit = defineEmits<{
  toggle: [];
  navigate: [];
}>();

const route = useRoute();
const authStore = useAuthStore();
const { t } = useI18n();

const user = computed(() => authStore.user);

// Platform-level routes that don't require restaurant context
const platformItemNames = new Set([
  "platform",
  "platform-markets",
  "platform-market-checkouts",
  "platform-onboarding",
  "monitoring",
  "settings",
  "account-management",
  "feedback",
]);

const needsRestaurantContext = computed(
  () => authStore.isAdminRole && !authStore.hasRestaurantContext,
);

const navigationItems = computed(() => {
  const items: Array<{
    name: string;
    path: string;
    label: string;
    icon: Component;
    visible: boolean;
    module?: ModuleKey;
  }> = [
    // Platform Overview (admin-only, always at top)
    {
      name: "platform",
      path: "/dashboard/platform",
      label: t("nav.platform"),
      icon: Globe,
      visible: authStore.isAdminRole,
    },
    {
      name: "platform-markets",
      path: "/dashboard/platform/markets",
      label: "市場品質",
      icon: MapPinned,
      visible: authStore.isAdminRole,
    },
    {
      name: "platform-market-checkouts",
      path: "/dashboard/platform/market-checkouts",
      label: "市場結帳",
      icon: ReceiptText,
      visible: authStore.isAdminRole,
    },
    {
      name: "platform-onboarding",
      path: "/dashboard/platform/onboarding",
      label: "開店申請",
      icon: UserPlus,
      visible: authStore.isAdminRole,
    },
    {
      name: "dashboard",
      path: "/dashboard",
      label: t("nav.dashboard"),
      icon: Home,
      visible: true,
    },
    {
      name: "owner-overview",
      path: "/dashboard/owner-overview",
      label: t("nav.ownerOverview"),
      icon: Crown,
      visible: authStore.canAccessOwnerDashboard,
    },
    {
      name: "pos",
      path: "/dashboard/pos",
      label: t("nav.pos"),
      icon: CreditCard,
      visible: authStore.hasPermission([
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.CASHIER,
      ]),
    },
    {
      name: "orders",
      path: "/dashboard/orders",
      label: t("nav.orders"),
      icon: ShoppingCart,
      visible: authStore.canManageOrders,
    },
    {
      name: "menu",
      path: "/dashboard/menu",
      label: t("nav.menu"),
      icon: Menu,
      visible: authStore.canManageMenu,
    },
    {
      name: "seating",
      path: "/dashboard/seating",
      label: t("nav.seatingManagement"),
      icon: Armchair,
      visible: authStore.hasPermission([
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ]),
    },
    {
      name: "employees",
      path: "/dashboard/employees",
      label: t("nav.employees"),
      icon: Users,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "coupons",
      path: "/dashboard/coupons",
      label: t("nav.coupons"),
      icon: TicketIcon,
      visible: authStore.canAccessAdminFeatures,
      module: "coupons",
    },
    {
      name: "analytics",
      path: "/dashboard/analytics",
      label: t("nav.analytics"),
      icon: BarChart3,
      visible: authStore.canAccessAdminFeatures,
      module: "analytics",
    },
    {
      name: "ai-analytics",
      path: "/dashboard/ai-analytics/insights",
      label: t("nav.aiInsights"),
      icon: Sparkles,
      visible: authStore.canAccessAdminFeatures,
      module: "ai_analytics",
    },
    {
      name: "group-orders",
      path: "/dashboard/group-orders",
      label: t("nav.groupOrders"),
      icon: Users,
      visible: authStore.hasPermission([
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ]),
    },
    {
      name: "service-bookings",
      path: "/dashboard/service-bookings",
      label: "服務預約",
      icon: CalendarCheck,
      visible: authStore.hasPermission([
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ]),
    },
    {
      name: "account-management",
      path: "/dashboard/account-management",
      label: t("nav.accountManagement"),
      icon: UserPlus,
      visible: authStore.isAdminRole,
    },
    {
      name: "feedback",
      path: "/dashboard/feedback",
      label: t("nav.feedback"),
      icon: MessageSquare,
      visible: authStore.hasPermission([UserRole.ADMIN, UserRole.OWNER]),
    },
    {
      name: "monitoring",
      path: "/dashboard/monitoring",
      label: t("nav.monitoring"),
      icon: Activity,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "settings",
      path: "/dashboard/settings",
      label: t("nav.settings"),
      icon: Settings,
      visible: authStore.canAccessAdminFeatures,
    },
  ];

  return items.map((item) => ({
    ...item,
    disabled: needsRestaurantContext.value && !platformItemNames.has(item.name),
  }));
});

const isActiveRoute = (path: string) => {
  if (path === "/dashboard" && route.path === "/dashboard") return true;
  if (path === "/dashboard") return false;
  if (path === "/dashboard/platform") return route.path === path;
  return route.path === path || route.path.startsWith(path + "/");
};

const getRoleLabel = (role?: UserRole) => {
  const roleKeys: Record<number, string> = {
    [UserRole.ADMIN]: "header.roles.admin",
    [UserRole.OWNER]: "header.roles.owner",
    [UserRole.CHEF]: "header.roles.chef",
    [UserRole.SERVICE]: "header.roles.service",
    [UserRole.CASHIER]: "header.roles.cashier",
  };
  return role !== undefined ? t(roleKeys[role]) : "";
};
</script>
