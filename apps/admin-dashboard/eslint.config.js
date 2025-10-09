import { defineConfig } from 'eslint-define-config'
import vue from 'eslint-plugin-vue'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'

export default defineConfig([
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js']
  },
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      vue,
      '@typescript-eslint': typescript
    },
    rules: {
      // Standard Vue/TypeScript rules
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',

      // Vue SFC TypeScript compilation artifacts should be ignored
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          'argsIgnorePattern': '^_|^\\$',
          'varsIgnorePattern': '^__VLS_|^\\$'
        }
      ]
    }
  },
  {
    // More relaxed rules for test files
    files: ['**/*.test.{js,ts,vue}', '**/*.spec.{js,ts,vue}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    // Configuration files can have literal strings
    files: ['**/*.config.{js,ts}', '**/vite.config.{js,ts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
])