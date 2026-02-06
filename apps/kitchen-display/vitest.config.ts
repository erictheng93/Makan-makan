import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{js,ts}", "tests/**/*.{test,spec}.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "tests/setup.ts", "dist/", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@makanmakan/shared-types": resolve(
        __dirname,
        "../../packages/shared-types/src",
      ),
      "@makanmakan/utils": resolve(__dirname, "../../packages/utils/src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify("1.0.0"),
    __VUE_PROD_DEVTOOLS__: false,
  },
});
