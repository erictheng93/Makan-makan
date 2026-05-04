import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "./router";
import App from "./App.vue";
import { setupGlobalErrorHandler, errorHandler } from "@/utils/errorHandler";
import ErrorDisplay from "@/components/ErrorDisplay.vue";
import { initI18n } from "./i18n";
import { useAuthStore } from "@/stores/auth";
import { useModuleAccessStore } from "@makanmasak/shared/stores/moduleAccess";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
import "./assets/css/main.css";

async function bootstrap() {
  // Load translations before creating the app so t() works on first render
  await initI18n();

  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia);
  app.use(router);
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
