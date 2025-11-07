import { defineWorkspace } from 'vitest/config'

// Define all workspace projects with their own configurations
export default defineWorkspace([
  // Root-level tests (generic tests)
  {
    test: {
      name: 'root',
      root: '.',
      include: ['tests/**/*.test.{js,ts}'],
      environment: 'node'
    }
  },
  // Apps - each uses its own vitest.config.ts
  'apps/admin-dashboard',
  'apps/customer-app',
  'apps/kitchen-display',
  'apps/api',
  'apps/realtime',
  // Packages - each uses its own vitest.config.ts
  'packages/database',
  'packages/queue-core',
  'packages/utils'
])
