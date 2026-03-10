import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
  // Ignore patterns
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "*.d.ts",
      "**/*.d.ts",
      "coverage/**",
      "test-results/**",
      "**/*.vue.js",
      "*.config.js",
      "storybook-static/**",
      "**/*.stories.d.ts",
      "src/components/charts/**",
    ],
  },

  // Base JavaScript config
  js.configs.recommended,

  // TypeScript configs
  ...tseslint.configs.recommended,

  // Vue configs
  ...pluginVue.configs["flat/recommended"],

  // Prettier config (must be last to override other formatting rules)
  eslintConfigPrettier,

  // Main configuration for Vue/TypeScript files
  {
    files: ["**/*.{js,ts,vue}"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
        NodeJS: "readonly",
        EventListener: "readonly",
        EventListenerOrEventListenerObject: "readonly",
      },
    },
    rules: {
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
      // Standard Vue/TypeScript rules
      "vue/multi-word-component-names": "off",
      "vue/no-v-html": "warn",
      // Vue SFC TypeScript compilation artifacts should be ignored
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_|^__VLS_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-empty-pattern": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": "off",
      "vue/no-use-v-if-with-v-for": "warn",
      "vue/no-parsing-error": "off",
      "vue/no-deprecated-filter": "off",
      "vue/valid-v-slot": "warn",
      "vue/no-side-effects-in-computed-properties": "warn",
      "vue/require-default-prop": "off",
      "vue/no-template-shadow": "warn",
      "vue/no-duplicate-attributes": "warn",
      "no-irregular-whitespace": "off",
      "prefer-const": "warn",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      // Relax Vue formatting rules to avoid conflicts with Prettier
      "vue/singleline-html-element-content-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/max-attributes-per-line": "off",
      "vue/first-attribute-linebreak": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/html-closing-bracket-spacing": "off",
      "vue/html-indent": "off",
      "vue/html-self-closing": "off",
    },
  },

  // Test files configuration
  {
    files: [
      "**/*.test.{js,ts,vue}",
      "**/*.spec.{js,ts,vue}",
      "**/__tests__/**/*",
    ],
    languageOptions: {
      globals: {
        vi: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Configuration files can have literal strings
  {
    files: ["**/*.config.{js,ts}", "**/vite.config.{js,ts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];
