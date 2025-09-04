import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import Toast from "vue-toastification";
import App from "./App.vue";
import routes from "./router";
import { performanceOptimizationService } from "./services/performanceOptimizationService";

// CSS imports
import "./assets/css/main.css";
import "vue-toastification/dist/index.css";

const app = createApp(App);

// Router setup
const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Pinia state management
const pinia = createPinia();

// Vue Query setup for server state management
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes (renamed from cacheTime)
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
  },
});

// Toast notifications
app.use(Toast, {
  position: "top-right",
  timeout: 3000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: false,
  icon: true,
  rtl: false,
});

// Install lazy component plugin if available
if ((window as any).__lazyComponentPlugin) {
  app.use((window as any).__lazyComponentPlugin);
}

app.use(pinia);
app.use(router);

// Initialize performance optimization services
performanceOptimizationService.setupImageOptimization();
performanceOptimizationService.registerServiceWorker();

app.mount("#app");
