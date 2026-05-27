import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { translate } from "@/utils/i18n";

function firstQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string");
  }
  return typeof value === "string" ? value : undefined;
}

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: () => import("@/views/HomeView.vue"),
    meta: {
      titleKey: "navigation.appTitle",
    },
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/LoginView.vue"),
    meta: {
      titleKey: "navigation.login",
      requiresGuest: true,
    },
  },
  {
    path: "/register",
    name: "Register",
    redirect: "/login",
    meta: {
      titleKey: "navigation.register",
      requiresGuest: true,
    },
  },
  {
    path: "/forgot-password",
    name: "ForgotPassword",
    component: () => import("@/views/ForgotPasswordView.vue"),
    meta: {
      titleKey: "navigation.forgotPassword",
      requiresGuest: true,
    },
  },
  {
    path: "/reset-password",
    name: "ResetPassword",
    component: () => import("@/views/ResetPasswordView.vue"),
    meta: {
      titleKey: "navigation.resetPassword",
    },
  },
  {
    path: "/verify-email",
    name: "VerifyEmail",
    component: () => import("@/views/VerifyEmailView.vue"),
    meta: {
      titleKey: "navigation.verifyEmail",
    },
  },
  {
    path: "/orders",
    name: "Orders",
    component: () => import("@/views/OrderHistoryView.vue"),
    meta: {
      titleKey: "navigation.myOrders",
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
      titleKey: "navigation.orderDetail",
      requiresAuth: true,
      allowGuestToken: true,
    },
  },
  {
    path: "/profile",
    name: "Profile",
    component: () => import("@/views/ProfileView.vue"),
    meta: {
      titleKey: "navigation.profileCenter",
      requiresAuth: true,
    },
  },
  {
    path: "/menu",
    name: "Menu",
    component: () => import("@/views/HomeView.vue"),
    meta: {
      titleKey: "navigation.browseMenu",
    },
  },
  {
    path: "/scan",
    name: "QRScan",
    component: () => import("@/views/QRScanView.vue"),
    meta: {
      titleKey: "navigation.scanQR",
    },
  },
  {
    path: "/restaurant/:restaurantId/table/:tableId",
    name: "RestaurantMenu",
    component: () => import("@/views/MenuView.vue"),
    props: (route) => ({
      restaurantId: route.params.restaurantId,
      tableId: Number(route.params.tableId),
    }),
    meta: {
      titleKey: "navigation.browseMenu",
    },
  },
  {
    path: "/restaurant/:restaurantId/shop/order-type",
    name: "OrderTypeLanding",
    component: () => import("@/views/OrderTypeLandingView.vue"),
    props: true,
    meta: { titleKey: "navigation.orderTypeSelect" },
  },
  {
    path: "/restaurant/:restaurantId/shop/verify",
    name: "ShopPhoneVerification",
    component: () => import("@/views/ShopPhoneVerificationView.vue"),
    props: (route) => ({
      restaurantId: route.params.restaurantId,
      shopQrCode: route.query.qr as string,
    }),
    meta: {
      titleKey: "navigation.verifyPhone",
    },
  },
  {
    path: "/restaurant/:restaurantId/shop/menu",
    name: "ShopMenu",
    component: () => import("@/views/ShopMenuView.vue"),
    props: (route) => ({
      restaurantId: route.params.restaurantId,
      phoneLastDigits: route.query.phone as string,
      waitingTicketId: route.query.waitingTicketId as string | undefined,
      linkedItemId: route.query.itemId,
      linkedCategoryName: route.query.categoryName,
      linkedServiceItemId: route.query.serviceItemId,
      linkedServices: route.query.services,
      returnPath: firstQueryString(route.query.returnPath),
      returnLabel: firstQueryString(route.query.returnLabel),
    }),
    meta: {
      titleKey: "navigation.shopMenu",
    },
  },
  {
    path: "/restaurant/:restaurantId/table/:tableId/cart",
    name: "Cart",
    component: () => import("@/views/CartView.vue"),
    props: (route) => ({
      restaurantId: route.params.restaurantId,
      tableId: Number(route.params.tableId),
    }),
    meta: {
      titleKey: "navigation.shoppingCart",
    },
  },
  {
    path: "/restaurant/:restaurantId/shop/order/:orderId",
    name: "ShopOrderTracking",
    component: () => import("@/views/OrderTrackingView.vue"),
    props: (route) => ({
      restaurantId: route.params.restaurantId,
      tableId: 0,
      orderId: Number(route.params.orderId),
    }),
    meta: {
      titleKey: "navigation.orderTracking",
    },
  },
  {
    path: "/r/:restaurantId/wait-list",
    name: "JoinWaitingList",
    component: () => import("@/views/waiting-list/JoinWaitingListView.vue"),
    props: true,
    meta: {
      titleKey: "waitingList.join.title",
    },
  },
  {
    path: "/r/:restaurantId/wait-list/history",
    name: "WaitingListHistory",
    component: () => import("@/views/waiting-list/WaitingListHistoryView.vue"),
    props: true,
    meta: {
      titleKey: "waitingList.history.title",
    },
  },
  {
    path: "/r/:restaurantId/wait-list/:ticketId",
    name: "MyWaitingTicket",
    component: () => import("@/views/waiting-list/MyWaitingTicketView.vue"),
    props: true,
    meta: {
      titleKey: "waitingList.ticket.title",
    },
  },
  {
    path: "/restaurant/:restaurantId/table/:tableId/order/:orderId",
    name: "OrderTracking",
    component: () => import("@/views/OrderTrackingView.vue"),
    props: (route) => ({
      restaurantId: route.params.restaurantId,
      tableId: Number(route.params.tableId),
      orderId: Number(route.params.orderId),
    }),
    meta: {
      titleKey: "navigation.orderTracking",
    },
  },
  {
    path: "/about",
    name: "About",
    component: () => import("@/views/AboutView.vue"),
    meta: {
      titleKey: "navigation.about",
    },
  },
  {
    path: "/privacy",
    name: "Privacy",
    component: () => import("@/views/PrivacyView.vue"),
    meta: {
      titleKey: "navigation.privacy",
    },
  },
  {
    path: "/terms",
    name: "Terms",
    component: () => import("@/views/TermsView.vue"),
    meta: {
      titleKey: "navigation.terms",
    },
  },
  {
    path: "/discover",
    name: "Discover",
    component: () => import("@/views/DiscoveryView.vue"),
    meta: {
      titleKey: "navigation.discover",
    },
  },
  {
    path: "/markets",
    name: "Markets",
    component: () => import("@/views/MarketsView.vue"),
    meta: {
      titleKey: "navigation.discover",
    },
  },
  {
    path: "/markets/:slug",
    name: "MarketDetail",
    component: () => import("@/views/MarketDetailView.vue"),
    props: true,
    meta: {
      titleKey: "navigation.discover",
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
      titleKey: "navigation.error",
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/NotFoundView.vue"),
    meta: {
      titleKey: "navigation.pageNotFound",
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
  const titleKey = to.meta?.titleKey as string;
  if (titleKey) {
    document.title = translate(titleKey);
  }

  // 獲取認證狀態
  const authStore = useAuthStore();
  const requiresAuth = to.meta.requiresAuth as boolean;
  const requiresGuest = to.meta.requiresGuest as boolean;

  // 檢查需要認證的路由
  if (requiresAuth) {
    // Allow guest token holders to access routes with allowGuestToken meta
    const allowGuestToken = to.meta.allowGuestToken as boolean;
    const hasGuestToken = !!localStorage.getItem("guest_auth_token");

    if (allowGuestToken && hasGuestToken) {
      // Guest token is sufficient for this route
      next();
      return;
    }

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
    const restaurantId = to.params.restaurantId as string;
    const tableId = Number(to.params.tableId);

    // restaurantId is a UUID string — validate it's non-empty
    // tableId must be a valid number
    if (!restaurantId || isNaN(tableId) || tableId <= 0) {
      next({
        name: "Error",
        query: {
          code: "400",
          message: translate("errors.invalidRestaurantOrTable"),
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
      message: translate("errors.routeLoadFailed"),
    },
  });
});

export default router;
