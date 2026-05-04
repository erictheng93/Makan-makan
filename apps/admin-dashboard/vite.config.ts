import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    vue(),
    // Bundle analyzer for production builds
    process.env.ANALYZE === "true" &&
      visualizer({
        filename: "./dist/stats.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@makanmasak/shared-types": resolve(
        __dirname,
        "../../packages/shared-types/src",
      ),
      "@makanmasak/shared": resolve(__dirname, "../../packages/shared"),
      "@makanmasak/database": resolve(__dirname, "../../packages/database/src"),
      "@makanmasak/utils": resolve(__dirname, "../../packages/utils/src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.APP_VERSION || `dev-${new Date().toISOString().slice(0, 10)}`,
    ),
    __VUE_PROD_DEVTOOLS__: false,
  },
  server: {
    host: "localhost", // SECURITY FIX: Restrict to localhost only in development
    port: 3001,
    proxy: {
      "/api": {
        target:
          process.env.VITE_API_BASE_URL?.replace("/api/v1", "") ||
          "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
    sourcemap: process.env.NODE_ENV !== "production", // SECURITY FIX: Disable sourcemaps in production
    minify: "esbuild",
    cssMinify: true,
    chunkSizeWarningLimit: 500,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vue core ecosystem
          if (
            id.includes("node_modules/vue/") ||
            id.includes("node_modules/@vue/")
          ) {
            return "vue-core";
          }
          if (id.includes("node_modules/vue-router/")) {
            return "vue-router";
          }
          if (id.includes("node_modules/pinia/")) {
            return "pinia";
          }

          // UI libraries - split into separate chunks
          if (id.includes("node_modules/@headlessui/vue")) {
            return "headlessui";
          }
          if (id.includes("node_modules/@heroicons/vue")) {
            return "heroicons";
          }
          if (id.includes("node_modules/lucide-vue-next")) {
            return "lucide";
          }
          if (id.includes("node_modules/vue-toastification")) {
            return "toastification";
          }

          // Heavy charting libraries - lazy load
          if (id.includes("node_modules/chart.js")) {
            return "chartjs";
          }
          if (id.includes("node_modules/vue-chartjs")) {
            return "vue-chartjs";
          }

          // i18n
          if (id.includes("node_modules/vue-i18n")) {
            return "i18n";
          }

          // Utils
          if (id.includes("node_modules/axios")) {
            return "axios";
          }
          if (id.includes("node_modules/lodash-es")) {
            return "lodash";
          }
          if (id.includes("node_modules/date-fns")) {
            return "date-fns";
          }
          if (id.includes("node_modules/@vueuse/core")) {
            return "vueuse";
          }

          // Other node_modules
          if (id.includes("node_modules/")) {
            return "vendor";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "vue",
      "vue-router",
      "pinia",
      "@vueuse/core",
      "axios",
      "date-fns",
      "lodash-es",
    ],
    exclude: ["chart.js", "vue-chartjs"],
  },
  css: {
    devSourcemap: process.env.NODE_ENV !== "production",
  },
});
