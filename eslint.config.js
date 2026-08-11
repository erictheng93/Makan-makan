import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * Root-level ESLint configuration for the MakanMakan monorepo.
 *
 * This config handles:
 * - JavaScript files at the root level
 * - TypeScript files in packages/
 * - Scripts and configuration files
 *
 * Note: Vue apps (apps/*) have their own eslint.config.js files.
 */
export default [
  // Global ignores - these directories are either handled by their own configs
  // or should not be linted
  {
    ignores: [
      // Build outputs
      "**/dist/**",
      "**/build/**",
      "**/.output/**",
      ".nuxt/**",
      ".next/**",
      "out/**",

      // Dependencies
      "node_modules/**",
      ".pnpm-store/**",

      // Generated files
      "*.d.ts",
      "**/*.d.ts",
      "*.tsbuildinfo",
      "**/*.tsbuildinfo",

      // Vue compiled files
      "**/*.vue.js",
      "**/*.vue.d.ts",

      // Test outputs
      "**/coverage/**",
      "**/test-results/**",
      "**/playwright-report/**",
      ".nyc_output/**",

      // Cloudflare Workers
      ".wrangler/**",

      // Logs
      "*.log",
      "logs/**",

      // Temporary files
      ".tmp/**",
      "temp/**",

      // OS files
      ".DS_Store",
      "Thumbs.db",

      // IDE files
      ".vscode/**",
      ".idea/**",

      // Legacy/backup files
      "Backup/**",
      "**/.backup/**",
      "**/*.backup",
      "legacy/**",
      "js/**",
      "login/**",
      "order/**",

      // Vendor/third-party files
      "**/jquery*.js",
      "**/vendor/**",
      "**/bootstrap*.js",

      // Template files
      "**/templates/**",
      "**/shared/templates/**",

      // Disabled files
      "**/*.disabled",
      "**/*.disabled.*",
      "**/*.ts.disabled",

      // Turbo cache
      "**/.turbo/**",

      // Vendored tool output
      ".claude/**",

      // Apps have their own eslint configs
      "apps/admin-dashboard/**",
      "apps/customer-app/**",
      "apps/kitchen-display/**",
    ],
  },

  // Base JavaScript config
  js.configs.recommended,

  // TypeScript configs
  ...tseslint.configs.recommended,

  // Main configuration for JS/TS files
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-var": "warn",
      "no-unreachable": "warn",

      // Prevent use of CURRENT_TIMESTAMP in SQL queries
      // Use getCurrentTimestamp() from @makanmasak/database instead
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/CURRENT_TIMESTAMP/]",
          message:
            "Use getCurrentTimestamp() from @makanmasak/database instead of CURRENT_TIMESTAMP in SQL queries. See docs/development/TIMESTAMP_BEST_PRACTICES.md for details.",
        },
      ],
    },
  },

  {
    files: ["eslint.config.js"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  // TypeScript-specific rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // Disable base rule in favor of TypeScript version
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  // Service worker files
  {
    files: ["**/sw.js", "**/service-worker.js", "**/serviceWorker.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
    },
    rules: {
      "no-unused-vars": "warn",
    },
  },

  // Test files configuration
  {
    files: [
      "**/__tests__/**/*",
      "**/*.test.*",
      "**/*.spec.*",
      "**/tests/**/*",
      "**/setup.ts",
    ],
    languageOptions: {
      globals: {
        // Vitest globals
        vi: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        test: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-var": "off",
    },
  },

  // Configuration files
  {
    files: [
      "**/*.config.{js,mjs,cjs,ts}",
      "**/vite.config.*",
      "**/vitest.config.*",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
    },
  },

  // Script files (CommonJS)
  {
    files: ["scripts/**/*.{js,cjs}"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Script files (ES Modules)
  {
    files: ["scripts/**/*.{mjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];
