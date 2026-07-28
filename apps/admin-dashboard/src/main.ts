import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "./router";
import App from "./App.vue";
import { setupGlobalErrorHandler, errorHandler } from "@/utils/errorHandler";
import ErrorDisplay from "@/components/ErrorDisplay.vue";
import { initI18n } from "./i18n";
import { useAuthStore } from "@/stores/auth";
import { useModuleAccessStore } from "@makanmakan/shared/stores/moduleAccess";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
import "./assets/css/main.css";

async function bootstrap() {
  // Load translations before creating the app so t() works on first render
  await initI18n();

  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia);
  app.use(Toast, {
    position: "top-right",
    timeout: 3000,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    draggable: true,
    showCloseButtonOnHover: false,
    closeButton: "button",
    icon: true,
    rtl: false,
  });

  // 註冊全局組件
  app.component("ErrorDisplay", ErrorDisplay);

  const authStore = useAuthStore();

  // Restore the session before installing the router, not merely before
  // mounting. Production holds the access token in memory only, so a reload
  // starts unauthenticated and `restoreSession()` spends the refresh cookie to
  // get back. Installing the router kicks off its initial navigation
  // immediately, so with `app.use(router)` above this await the guard judged
  // `isAuthenticated` while the refresh was still in flight — it redirected to
  // /login at ~150ms, the refresh landed at ~1300ms, and LoginView then bounced
  // the now-authenticated user to their role's default page. Reloading
  // /dashboard/monitoring as an admin reliably ended on /dashboard/platform
  // (#66 fixed the token loss; this fixes the ordering that still leaked it).
  await authStore.restoreSession();

  app.use(router);

  if (authStore.isAuthenticated) {
    void useModuleAccessStore().fetch();
  }

  // 設置全局錯誤處理
  setupGlobalErrorHandler();

  // 全局錯誤處理 (Vue 特定錯誤)
  app.config.errorHandler = (error: any, instance, info) => {
    console.error("Vue error:", error, info);

    // 使用錯誤處理器處理 Vue 錯誤
    errorHandler.handleError(error, {
      type: "vue_error",
      component: instance?.$?.type?.name || "unknown",
      errorInfo: info,
    });
  };

  // 全局警告處理 (開發模式)
  if (import.meta.env.DEV) {
    app.config.warnHandler = (msg, _instance, trace) => {
      console.warn("Vue warning:", msg, trace);
    };
  }

  app.mount("#app");
}

bootstrap();
