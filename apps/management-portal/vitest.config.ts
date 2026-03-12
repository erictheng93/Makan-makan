import { defineConfig } from "vitest/config";
import { resolve } from "path";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/__tests__/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/",
        "**/coverage/",
      ],
    },
    testTimeout: 10000,
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  define: {
    "import.meta.env.MODE": '"test"',
    "import.meta.env.VITE_MANAGEMENT_API_URL": '"http://localhost:8790"',
    __APP_VERSION__: '"1.0.0"',
    __VUE_PROD_DEVTOOLS__: false,
  },
  esbuild: {
    target: "node14",
  },
});
