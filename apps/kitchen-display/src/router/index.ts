import { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/login",
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/LoginView.vue"),
    meta: {
      requiresAuth: false,
      title: "廚房系統登入",
    },
  },
  {
    path: "/kitchen/:restaurantId",
    name: "Kitchen",
    component: () => import("../views/EnhancedKitchenDashboard.vue"),
    props: (route) => ({
      restaurantId: parseInt(route.params.restaurantId as string),
    }),
    meta: {
      requiresAuth: true,
      requiredRole: 2, // Chef role
      title: "廚房顯示系統",
    },
  },
  {
    path: "/kitchen-classic/:restaurantId",
    name: "KitchenClassic",
    component: () => import("../views/KitchenDashboard.vue"),
    props: (route) => ({
      restaurantId: parseInt(route.params.restaurantId as string),
    }),
    meta: {
      requiresAuth: true,
      requiredRole: 2, // Chef role
      title: "廚房顯示系統 (經典版)",
    },
  },
  {
    path: "/settings",
    name: "Settings",
    component: () => import("../views/SettingsView.vue"),
    meta: {
      requiresAuth: true,
      title: "系統設定",
    },
  },
  {
    path: "/history",
    name: "History",
    component: () => import("../views/HistoryView.vue"),
    meta: {
      requiresAuth: true,
      title: "歷史記錄",
    },
  },
  {
    path: "/test-sse",
    name: "TestSSE",
    component: () => import("../views/TestSSEView.vue"),
    meta: {
      requiresAuth: true,
      title: "SSE 測試",
    },
  },
  {
    path: "/unauthorized",
    name: "Unauthorized",
    component: () => import("../views/UnauthorizedView.vue"),
    meta: {
      requiresAuth: false,
      title: "權限不足",
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("../views/NotFoundView.vue"),
    meta: {
      requiresAuth: false,
      title: "頁面不存在",
    },
  },
];

export default routes;
