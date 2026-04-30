import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";

import App from "./App.vue";
import router from "./router";
import { setupI18n } from "./i18n";
import "./assets/css/main.css";

// Performance optimizations
import { PWAPerformanceManager } from "./utils/pwa-performance-optimizer";

const app = createApp(App);

// Pinia store
app.use(createPinia());

// Vue Router
app.use(router);

// Vue I18n for internationalization
setupI18n(app);

// Vue Query for API state management
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 5 * 60 * 1000, // 5 minutes
      },
    },
  },
});

// Toast notifications
app.use(Toast, {
  position: "top-center",
  timeout: 3000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: "button",
  icon: true,
  rtl: false,
});

// Initialize PWA performance optimizations
// Note: Service Worker registration is handled by VitePWA plugin (registerType: "autoUpdate")
async function initializePWAOptimizations() {
  try {
    const performanceManager = new PWAPerformanceManager();
    await performanceManager.initializeOptimizations();

    // Make manager globally available
    window.pwaPerformanceManager = performanceManager;

    console.log("✅ PWA performance optimizations initialized");
  } catch (error) {
    console.error("⚠️ PWA optimization initialization failed:", error);
  }
}

initializePWAOptimizations();

app.mount("#app");
