import { defineConfig } from 'eslint-define-config'
import vue from 'eslint-plugin-vue'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'

export default defineConfig([
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
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],

      // MakanMakan i18n enforcement - CRITICAL for avoiding RestaurentPOS trap
      'vue/no-bare-strings-in-template': [
        'error',
        {
          allowlist: [
            // Allow numbers and mathematical symbols
            /^[0-9\s\-\+\*\/\(\)\[\]]+$/,
            // Allow single characters and common symbols
            ':', '|', '—', '–', '•', '→', '←', '↑', '↓', '×', '÷',
            // Allow debugging strings in development
            'TODO', 'FIXME', 'DEBUG', 'XXX',
            // Allow empty strings
            '',
            // Allow very short strings (1-2 chars) for UI elements
            /^.{1,2}$/
          ],
          attributes: {
            // Allow certain attributes to have literal strings
            '/.+/': [
              'id', 'class', 'data-*', 'aria-*', 'role',
              'href', 'src', 'alt', 'title'
            ],
            'router-link': ['to'],
            'nuxt-link': ['to']
          },
          directives: ['v-text', 'v-html']
        }
      ]
    }
  },
  {
    // More relaxed rules for test files
    files: ['**/*.test.{js,ts,vue}', '**/*.spec.{js,ts,vue}'],
    rules: {
      'vue/no-bare-strings-in-template': 'off'
    }
  },
  {
    // Configuration files can have literal strings
    files: ['**/*.config.{js,ts}', '**/vite.config.{js,ts}'],
    rules: {
      'vue/no-bare-strings-in-template': 'off'
    }
  }
])