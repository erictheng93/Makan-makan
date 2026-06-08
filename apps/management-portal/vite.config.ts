import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.APP_VERSION || `dev-${new Date().toISOString().slice(0, 10)}`,
    ),
    __VUE_PROD_DEVTOOLS__: false,
  },
  server: {
    host: "localhost",
    port: 3010,
    proxy: {
      "/api": {
        target: process.env.VITE_MANAGEMENT_API_URL || "http://localhost:8789",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
    sourcemap: process.env.NODE_ENV !== "production",
    minify: "esbuild",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
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
          if (
            id.includes("node_modules/@headlessui/vue") ||
            id.includes("node_modules/@heroicons/vue")
          ) {
            return "ui";
          }
          if (
            id.includes("node_modules/chart.js") ||
            id.includes("node_modules/vue-chartjs")
          ) {
            return "charts";
          }
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
    ],
  },
});
