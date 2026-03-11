<template>
  <aside
    class="bg-white border-r border-gray-200 transition-all duration-300"
    :class="isCollapsed ? 'w-16' : 'w-64'"
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
            :title="item.disabled ? 'Select a restaurant first' : ''"
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
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { UserRole } from "@/types";
import {
  Home,
  ShoppingCart,
  Menu,
  Users,
  Table,
  BarChart3,
  ChefHat,
  Calculator,
  Settings,
  User,
  CreditCard,
  Clock,
  Ticket as TicketIcon,
  Sparkles,
  Calendar,
  CalendarCheck,
  BookOpen,
  ClipboardList,
  Activity,
  Globe,
} from "lucide-vue-next";

interface Props {
  isCollapsed: boolean;
}

defineProps<Props>();
defineEmits<{
  toggle: [];
}>();

const route = useRoute();
const authStore = useAuthStore();

const user = computed(() => authStore.user);

// Platform-level routes that don't require restaurant context
const platformItemNames = new Set(["platform", "monitoring", "settings"]);

const needsRestaurantContext = computed(
  () => authStore.isAdminRole && !authStore.hasRestaurantContext,
);

const navigationItems = computed(() => {
  const items = [
    // Platform Overview (admin-only, always at top)
    {
      name: "platform",
      path: "/dashboard/platform",
      label: "Platform Overview",
      icon: Globe,
      visible: authStore.isAdminRole,
    },
    {
      name: "dashboard",
      path: "/dashboard",
      label: "儀表板",
      icon: Home,
      visible: true,
    },
    {
      name: "orders",
      path: "/dashboard/orders",
      label: "訂單管理",
      icon: ShoppingCart,
      visible: authStore.canManageOrders,
    },
    {
      name: "menu",
      path: "/dashboard/menu",
      label: "菜單管理",
      icon: Menu,
      visible: authStore.canManageMenu,
    },
    {
      name: "tables",
      path: "/dashboard/tables",
      label: "桌台管理",
      icon: Table,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "reservations",
      path: "/dashboard/reservations",
      label: "訂位管理",
      icon: BookOpen,
      visible: authStore.hasPermission([
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ]),
    },
    {
      name: "waiting-list",
      path: "/dashboard/waiting-list",
      label: "候位列表",
      icon: ClipboardList,
      visible: authStore.hasPermission([
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ]),
    },
    {
      name: "users",
      path: "/dashboard/users",
      label: "員工管理",
      icon: Users,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "scheduling",
      path: "/dashboard/scheduling",
      label: "員工排班",
      icon: Calendar,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "leaves",
      path: "/dashboard/leaves",
      label: "請假管理",
      icon: CalendarCheck,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "coupons",
      path: "/dashboard/coupons",
      label: "優惠券管理",
      icon: TicketIcon,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "analytics",
      path: "/dashboard/analytics",
      label: "數據分析",
      icon: BarChart3,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "ai-analytics",
      path: "/dashboard/ai-analytics/insights",
      label: "AI 洞察",
      icon: Sparkles,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "pos",
      path: "/dashboard/pos",
      label: "POS系統",
      icon: CreditCard,
      visible: authStore.hasPermission([
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.CASHIER,
      ]),
    },
    {
      name: "group-orders",
      path: "/dashboard/group-orders",
      label: "團體訂單",
      icon: Users,
      visible: authStore.hasPermission([
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ]),
    },
    {
      name: "queue",
      path: "/dashboard/queue",
      label: "候位管理",
      icon: Clock,
      visible: authStore.hasPermission([
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.SERVICE,
      ]),
    },
    {
      name: "monitoring",
      path: "/dashboard/monitoring",
      label: "系統監控",
      icon: Activity,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "settings",
      path: "/dashboard/settings",
      label: "系統設定",
      icon: Settings,
      visible: authStore.canAccessAdminFeatures,
    },
    {
      name: "kitchen",
      path: "/kitchen",
      label: "廚房顯示",
      icon: ChefHat,
      visible: authStore.canViewKitchen,
    },
    {
      name: "cashier",
      path: "/cashier",
      label: "收銀台",
      icon: Calculator,
      visible: authStore.hasPermission([
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.CASHIER,
      ]),
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
  return route.path === path || route.path.startsWith(path + "/");
};

const getRoleLabel = (role?: UserRole) => {
  const roleLabels: Record<number, string> = {
    [UserRole.ADMIN]: "系統管理員",
    [UserRole.OWNER]: "店主",
    [UserRole.CHEF]: "廚師",
    [UserRole.SERVICE]: "服務員",
    [UserRole.CASHIER]: "收銀員",
  };
  return role !== undefined ? roleLabels[role] : "";
};
</script>
