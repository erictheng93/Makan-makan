import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.makanmakan\.app\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
          {
            urlPattern: /^https:\/\/images\.makanmakan\.app\//,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "MakanMakan - 點餐系統",
        short_name: "MakanMakan",
        description: "便捷的餐廳點餐系統，掃描 QR Code 即可開始點餐",
        theme_color: "#3b82f6",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        categories: ["food", "business", "utilities"],
        shortcuts: [
          {
            name: "掃描 QR Code",
            short_name: "掃描",
            description: "掃描桌上的 QR Code 開始點餐",
            url: "/scan",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "手動輸入",
            short_name: "輸入",
            description: "手動輸入餐廳和桌號",
            url: "/manual",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@makanmakan/shared-types": fileURLToPath(
        new URL("../../packages/shared-types/src", import.meta.url),
      ),
    },
  },
  define: {
    __VUE_PROD_DEVTOOLS__: false,
  },
  build: {
    target: "esnext",
    outDir: "dist",
    sourcemap: process.env.NODE_ENV !== "production", // SECURITY FIX: Disable sourcemaps in production
    rollupOptions: {
      output: {
        manualChunks: {
          "vue-vendor": ["vue", "vue-router", "pinia"],
          "ui-vendor": ["@headlessui/vue", "@heroicons/vue"],
          "utils-vendor": ["axios", "dayjs", "lodash-es"],
          "qr-vendor": ["@zxing/library", "qrcode-reader"],
        },
      },
    },
    // 優化構建性能
    minify: "esbuild",
    cssMinify: true,
  },
  server: {
    host: "localhost", // SECURITY FIX: Restrict to localhost only in development
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: process.env.VITE_WS_BASE_URL || "ws://localhost:8787",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "localhost", // SECURITY FIX: Restrict preview to localhost
    port: 3000,
  },
  optimizeDeps: {
    include: [
      "vue",
      "vue-router",
      "pinia",
      "@vueuse/core",
      "axios",
      "dayjs",
      "@tanstack/vue-query",
    ],
    exclude: ["@zxing/library"],
  },
  css: {
    devSourcemap: process.env.NODE_ENV !== "production", // SECURITY FIX: Disable CSS sourcemaps in production
  },
  // 環境變量配置
  envPrefix: "VITE_",
});
