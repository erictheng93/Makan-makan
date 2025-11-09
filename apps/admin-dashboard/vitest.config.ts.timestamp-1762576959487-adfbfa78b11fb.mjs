// vitest.config.ts
import { defineConfig } from "file:///C:/Users/minim/OneDrive/%E6%96%87%E6%A1%A3/Code/platform/makanmakan/node_modules/.pnpm/vitest@1.6.1_@types+node@20_b8f47b5544824bf8107d38d64dbcc031/node_modules/vitest/dist/config.js";
import { resolve } from "path";
import vue from "file:///C:/Users/minim/OneDrive/%E6%96%87%E6%A1%A3/Code/platform/makanmakan/node_modules/.pnpm/@vitejs+plugin-vue@5.2.4_vi_0a4146bbf5206061faaa469642beac5b/node_modules/@vitejs/plugin-vue/dist/index.mjs";
var __vite_injected_original_dirname = "C:\\Users\\minim\\OneDrive\\\u6587\u6863\\Code\\platform\\makanmakan\\apps\\admin-dashboard";
var vitest_config_default = defineConfig({
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
        "**/coverage/"
      ]
    },
    testTimeout: 1e4,
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"]
  },
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "./src"),
      "@makanmakan/shared-types": resolve(__vite_injected_original_dirname, "../../packages/shared-types/src")
    }
  },
  define: {
    // Mock environment variables for testing
    "import.meta.env.MODE": '"test"',
    "import.meta.env.VITE_API_BASE_URL": '"http://localhost:8787"'
  },
  esbuild: {
    target: "node14"
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXG1pbmltXFxcXE9uZURyaXZlXFxcXFx1NjU4N1x1Njg2M1xcXFxDb2RlXFxcXHBsYXRmb3JtXFxcXG1ha2FubWFrYW5cXFxcYXBwc1xcXFxhZG1pbi1kYXNoYm9hcmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXG1pbmltXFxcXE9uZURyaXZlXFxcXFx1NjU4N1x1Njg2M1xcXFxDb2RlXFxcXHBsYXRmb3JtXFxcXG1ha2FubWFrYW5cXFxcYXBwc1xcXFxhZG1pbi1kYXNoYm9hcmRcXFxcdml0ZXN0LmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvbWluaW0vT25lRHJpdmUvJUU2JTk2JTg3JUU2JUExJUEzL0NvZGUvcGxhdGZvcm0vbWFrYW5tYWthbi9hcHBzL2FkbWluLWRhc2hib2FyZC92aXRlc3QuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZXN0L2NvbmZpZydcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFt2dWUoKV0sXG4gIHRlc3Q6IHtcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIHNldHVwRmlsZXM6IFsnLi9zcmMvX190ZXN0c19fL3NldHVwLnRzJ10sXG4gICAgY292ZXJhZ2U6IHtcbiAgICAgIHByb3ZpZGVyOiAndjgnLFxuICAgICAgcmVwb3J0ZXI6IFsndGV4dCcsICdqc29uJywgJ2h0bWwnXSxcbiAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgJ25vZGVfbW9kdWxlcy8nLFxuICAgICAgICAnc3JjL19fdGVzdHNfXy8nLFxuICAgICAgICAnKiovKi5kLnRzJyxcbiAgICAgICAgJyoqLyouY29uZmlnLionLFxuICAgICAgICAnKiovZGlzdC8nLFxuICAgICAgICAnKiovY292ZXJhZ2UvJ1xuICAgICAgXVxuICAgIH0sXG4gICAgdGVzdFRpbWVvdXQ6IDEwMDAwLFxuICAgIGluY2x1ZGU6IFsnc3JjLyoqLyoue3Rlc3Qsc3BlY30ue2pzLG1qcyxjanMsdHMsbXRzLGN0cyxqc3gsdHN4fSddXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICAnQG1ha2FubWFrYW4vc2hhcmVkLXR5cGVzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9wYWNrYWdlcy9zaGFyZWQtdHlwZXMvc3JjJylcbiAgICB9XG4gIH0sXG4gIGRlZmluZToge1xuICAgIC8vIE1vY2sgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciB0ZXN0aW5nXG4gICAgJ2ltcG9ydC5tZXRhLmVudi5NT0RFJzogJ1widGVzdFwiJyxcbiAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBJX0JBU0VfVVJMJzogJ1wiaHR0cDovL2xvY2FsaG9zdDo4Nzg3XCInXG4gIH0sXG4gIGVzYnVpbGQ6IHtcbiAgICB0YXJnZXQ6ICdub2RlMTQnXG4gIH1cbn0pIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFrYixTQUFTLG9CQUFvQjtBQUMvYyxTQUFTLGVBQWU7QUFDeEIsT0FBTyxTQUFTO0FBRmhCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sd0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxJQUFJLENBQUM7QUFBQSxFQUNmLE1BQU07QUFBQSxJQUNKLGFBQWE7QUFBQSxJQUNiLFNBQVM7QUFBQSxJQUNULFlBQVksQ0FBQywwQkFBMEI7QUFBQSxJQUN2QyxVQUFVO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixVQUFVLENBQUMsUUFBUSxRQUFRLE1BQU07QUFBQSxNQUNqQyxTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLGFBQWE7QUFBQSxJQUNiLFNBQVMsQ0FBQyxzREFBc0Q7QUFBQSxFQUNsRTtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUMvQiw0QkFBNEIsUUFBUSxrQ0FBVyxpQ0FBaUM7QUFBQSxJQUNsRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQTtBQUFBLElBRU4sd0JBQXdCO0FBQUEsSUFDeEIscUNBQXFDO0FBQUEsRUFDdkM7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLFFBQVE7QUFBQSxFQUNWO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
