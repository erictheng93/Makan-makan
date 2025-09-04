import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: () => import("@/views/HomeView.vue"),
    meta: {
      title: "MakanMakan - 智慧點餐",
    },
  },
  {
    path: "/scan",
    name: "QRScan",
    component: () => import("@/views/QRScanView.vue"),
    meta: {
      title: "掃描QR碼",
    },
  },
  {
    path: "/restaurant/:restaurantId/table/:tableId",
    name: "RestaurantMenu",
    component: () => import("@/views/MenuView.vue"),
    props: (route) => ({
      restaurantId: Number(route.params.restaurantId),
      tableId: Number(route.params.tableId),
    }),
    meta: {
      title: "瀏覽菜單",
    },
  },
  {
    path: "/restaurant/:restaurantId/table/:tableId/cart",
    name: "Cart",
    component: () => import("@/views/CartView.vue"),
    props: (route) => ({
      restaurantId: Number(route.params.restaurantId),
      tableId: Number(route.params.tableId),
    }),
    meta: {
      title: "購物車",
    },
  },
  {
    path: "/restaurant/:restaurantId/table/:tableId/order/:orderId",
    name: "OrderTracking",
    component: () => import("@/views/OrderTrackingView.vue"),
    props: (route) => ({
      restaurantId: Number(route.params.restaurantId),
      tableId: Number(route.params.tableId),
      orderId: Number(route.params.orderId),
    }),
    meta: {
      title: "訂單追蹤",
    },
  },
  {
    path: "/about",
    name: "About",
    component: () => import("@/views/AboutView.vue"),
    meta: {
      title: "關於我們",
    },
  },
  {
    path: "/privacy",
    name: "Privacy",
    component: () => import("@/views/PrivacyView.vue"),
    meta: {
      title: "隱私政策",
    },
  },
  {
    path: "/terms",
    name: "Terms",
    component: () => import("@/views/TermsView.vue"),
    meta: {
      title: "服務條款",
    },
  },
  {
    path: "/error",
    name: "Error",
    component: () => import("@/views/ErrorView.vue"),
    props: (route) => ({
      code: route.query.code,
      message: route.query.message,
    }),
    meta: {
      title: "發生錯誤",
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/NotFoundView.vue"),
    meta: {
      title: "頁面不存在",
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else if (to.hash) {
      return {
        el: to.hash,
        behavior: "smooth",
      };
    } else {
      return { top: 0 };
    }
  },
});

// 路由守衛
router.beforeEach((to, from, next) => {
  // 設置頁面標題
  const title = to.meta?.title as string;
  if (title) {
    document.title = title;
  }

  // 檢查餐廳和桌台參數
  if (to.params.restaurantId && to.params.tableId) {
    const restaurantId = Number(to.params.restaurantId);
    const tableId = Number(to.params.tableId);

    if (isNaN(restaurantId) || isNaN(tableId)) {
      next({
        name: "Error",
        query: {
          code: "400",
          message: "無效的餐廳或桌台編號",
        },
      });
      return;
    }
  }

  next();
});

router.afterEach(() => {
  // 頁面載入完成後的處理
  // 可以在這裡添加 Google Analytics 或其他追蹤代碼
});

// 錯誤處理
router.onError((error) => {
  console.error("路由錯誤:", error);
  router.push({
    name: "Error",
    query: {
      code: "500",
      message: "路由載入失敗",
    },
  });
});

export default router;
