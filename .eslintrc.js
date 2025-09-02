module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-var': 'warn',
    'no-unreachable': 'warn',
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.d.ts',
    'coverage/',
    'playwright-report/',
    'test-results/',
    '.wrangler/',
    '**/*.vue',
    '**/*.vue.js',
  ],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['**/sw.js', '**/service-worker.js', '**/serviceWorker.js'],
      env: {
        serviceworker: true,
      },
      rules: {
        'no-unused-vars': 'warn',
      },
    },
    {
      files: ['**/__tests__/**/*', '**/*.test.*', '**/tests/**/*', '**/setup.ts'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-var': 'off',
      },
    },
  ],
};