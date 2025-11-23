import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth";

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
    path: "/login",
    name: "Login",
    component: () => import("@/views/LoginView.vue"),
    meta: {
      title: "會員登入",
      requiresGuest: true,
    },
  },
  {
    path: "/register",
    name: "Register",
    component: () => import("@/views/RegisterView.vue"),
    meta: {
      title: "會員註冊",
      requiresGuest: true,
    },
  },
  {
    path: "/forgot-password",
    name: "ForgotPassword",
    component: () => import("@/views/ForgotPasswordView.vue"),
    meta: {
      title: "忘記密碼",
      requiresGuest: true,
    },
  },
  {
    path: "/reset-password",
    name: "ResetPassword",
    component: () => import("@/views/ResetPasswordView.vue"),
    meta: {
      title: "重設密碼",
    },
  },
  {
    path: "/verify-email",
    name: "VerifyEmail",
    component: () => import("@/views/VerifyEmailView.vue"),
    meta: {
      title: "Email 驗證",
    },
  },
  {
    path: "/orders",
    name: "Orders",
    component: () => import("@/views/OrderHistoryView.vue"),
    meta: {
      title: "我的訂單",
      requiresAuth: true,
    },
  },
  {
    path: "/orders/:id",
    name: "OrderDetail",
    component: () => import("@/views/OrderTrackingView.vue"),
    props: (route) => ({
      orderId: Number(route.params.id),
    }),
    meta: {
      title: "訂單詳情",
      requiresAuth: true,
    },
  },
  {
    path: "/profile",
    name: "Profile",
    component: () => import("@/views/ProfileView.vue"),
    meta: {
      title: "個人中心",
      requiresAuth: true,
    },
  },
  {
    path: "/menu",
    name: "Menu",
    component: () => import("@/views/HomeView.vue"),
    meta: {
      title: "瀏覽菜單",
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
    path: "/restaurant/:restaurantId/shop/verify",
    name: "ShopPhoneVerification",
    component: () => import("@/views/ShopPhoneVerificationView.vue"),
    props: (route) => ({
      restaurantId: Number(route.params.restaurantId),
      shopQrCode: route.query.qr as string,
    }),
    meta: {
      title: "驗證手機",
    },
  },
  {
    path: "/restaurant/:restaurantId/shop/menu",
    name: "ShopMenu",
    component: () => import("@/views/ShopMenuView.vue"),
    props: (route) => ({
      restaurantId: Number(route.params.restaurantId),
      phoneLastDigits: route.query.phone as string,
    }),
    meta: {
      title: "店家菜單",
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
router.beforeEach(async (to, from, next) => {
  // 設置頁面標題
  const title = to.meta?.title as string;
  if (title) {
    document.title = title;
  }

  // 獲取認證狀態
  const authStore = useAuthStore();
  const requiresAuth = to.meta.requiresAuth as boolean;
  const requiresGuest = to.meta.requiresGuest as boolean;

  // 檢查需要認證的路由
  if (requiresAuth) {
    if (!authStore.isAuthenticated) {
      // 未登入，重定向到登入頁
      next({
        name: "Login",
        query: { redirect: to.fullPath },
      });
      return;
    }

    // 驗證 token 是否有效
    const isValid = await authStore.checkAuth();
    if (!isValid) {
      next({
        name: "Login",
        query: { redirect: to.fullPath },
      });
      return;
    }
  }

  // 檢查需要訪客身份的路由（如登入、註冊頁）
  if (requiresGuest && authStore.isAuthenticated) {
    // 已登入用戶訪問登入/註冊頁，重定向到訂單頁
    next({ name: "Orders" });
    return;
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
