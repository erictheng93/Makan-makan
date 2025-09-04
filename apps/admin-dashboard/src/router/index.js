import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { UserRole } from "@/types";
const routes = [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/LoginView.vue"),
    meta: { requiresAuth: false, title: "登入" },
  },
  {
    path: "/",
    redirect: "/dashboard",
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: () => import("@/layouts/DefaultLayout.vue"),
    meta: {
      requiresAuth: true,
      title: "儀表板",
      roles: [
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.CHEF,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ],
    },
    children: [
      {
        path: "",
        name: "DashboardHome",
        component: () => import("@/views/DashboardView.vue"),
      },
      {
        path: "orders",
        name: "Orders",
        component: () => import("@/views/OrdersView.vue"),
        meta: {
          title: "訂單管理",
          roles: [
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.SERVICE,
            UserRole.CASHIER,
          ],
        },
      },
      {
        path: "menu",
        name: "Menu",
        component: () => import("@/views/MenuView.vue"),
        meta: {
          title: "菜單管理",
          roles: [UserRole.ADMIN, UserRole.OWNER],
        },
      },
      {
        path: "tables",
        name: "Tables",
        component: () => import("@/views/TablesView.vue"),
        meta: {
          title: "桌台管理",
          roles: [UserRole.ADMIN, UserRole.OWNER],
        },
      },
      {
        path: "users",
        name: "Users",
        component: () => import("@/views/UsersView.vue"),
        meta: {
          title: "員工管理",
          roles: [UserRole.ADMIN, UserRole.OWNER],
        },
      },
      {
        path: "analytics",
        name: "Analytics",
        component: () => import("@/views/AnalyticsView.vue"),
        meta: {
          title: "數據分析",
          roles: [UserRole.ADMIN, UserRole.OWNER],
        },
      },
      {
        path: "settings",
        name: "Settings",
        component: () => import("@/views/SettingsView.vue"),
        meta: {
          title: "系統設定",
          roles: [UserRole.ADMIN, UserRole.OWNER],
        },
      },
    ],
  },
  {
    path: "/kitchen",
    name: "Kitchen",
    component: () => import("@/layouts/KitchenLayout.vue"),
    meta: {
      requiresAuth: true,
      title: "廚房顯示",
      roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.CHEF],
    },
    children: [
      {
        path: "",
        name: "KitchenDisplay",
        component: () => import("@/views/KitchenView.vue"),
      },
    ],
  },
  {
    path: "/cashier",
    name: "Cashier",
    component: () => import("@/layouts/CashierLayout.vue"),
    meta: {
      requiresAuth: true,
      title: "收銀台",
      roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER],
    },
    children: [
      {
        path: "",
        name: "CashierPOS",
        component: () => import("@/views/CashierView.vue"),
      },
    ],
  },
  {
    path: "/service",
    name: "Service",
    component: () => import("@/layouts/ServiceLayout.vue"),
    meta: {
      requiresAuth: true,
      title: "送菜系統",
      roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.SERVICE],
    },
    children: [
      {
        path: "",
        name: "ServiceDelivery",
        component: () => import("@/views/ServiceView.vue"),
      },
    ],
  },
  {
    path: "/owner",
    name: "Owner",
    component: () => import("@/layouts/OwnerLayout.vue"),
    meta: {
      requiresAuth: true,
      title: "店主管理",
      roles: [UserRole.ADMIN, UserRole.OWNER],
    },
    children: [
      {
        path: "",
        name: "OwnerDashboard",
        component: () => import("@/views/OwnerView.vue"),
      },
    ],
  },
  {
    path: "/unauthorized",
    name: "Unauthorized",
    component: () => import("@/views/UnauthorizedView.vue"),
    meta: { requiresAuth: false, title: "無權限" },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/NotFoundView.vue"),
    meta: { requiresAuth: false, title: "頁面不存在" },
  },
];
export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_, __, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    return { top: 0 };
  },
});
router.beforeEach(async (to, _, next) => {
  const authStore = useAuthStore();
  // 對於不需要認證的路由
  if (to.meta.requiresAuth === false) {
    if (to.name === "Login" && authStore.isAuthenticated) {
      // 已登入用戶訪問登入頁，重定向到角色默認頁面
      return next(authStore.getDefaultRoute());
    }
    return next();
  }
  // 檢查用戶是否已認證
  if (!authStore.isAuthenticated) {
    return next("/login");
  }
  // 使用新的路由權限檢查
  const routeName = to.name;
  if (routeName && !authStore.canAccessRoute(routeName)) {
    console.warn(
      `Access denied to route: ${routeName} for role: ${authStore.userRole}`,
    );
    return next("/unauthorized");
  }
  // 備用：檢查 meta.roles（向後兼容）
  const requiredRoles = to.meta.roles;
  if (requiredRoles && requiredRoles.length > 0) {
    const hasPermission = requiredRoles.some((role) =>
      authStore.hasPermission(role),
    );
    if (!hasPermission) {
      return next("/unauthorized");
    }
  }
  // 設置頁面標題
  document.title = `${to.meta.title || "MakanMakan"} - 管理後台`;
  next();
});
