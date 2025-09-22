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
import { optimizedOfflineStorage } from "./utils/offline-storage-optimized";

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
async function initializePWAOptimizations() {
  try {
    // Initialize performance manager
    const performanceManager = new PWAPerformanceManager();
    await performanceManager.initializeOptimizations();

    // Initialize optimized storage
    await optimizedOfflineStorage.initialize();

    // Make managers globally available
    (window as any).pwaPerformanceManager = performanceManager;
    (window as any).optimizedStorage = optimizedOfflineStorage;

    console.log('✅ PWA performance optimizations initialized');
  } catch (error) {
    console.error('⚠️ PWA optimization initialization failed:', error);
  }
}

// Register optimized service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-optimized.js')
    .then((registration) => {
      console.log('✅ Optimized Service Worker registered:', registration);
      return initializePWAOptimizations();
    })
    .catch((error) => {
      console.error('⚠️ Service Worker registration failed:', error);
      // Fallback to regular SW
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('✅ Fallback Service Worker registered'))
        .catch((fallbackError) => console.error('❌ All Service Worker registration failed:', fallbackError));
    });
} else {
  // Initialize optimizations even without SW support
  initializePWAOptimizations();
}

app.mount("#app");
