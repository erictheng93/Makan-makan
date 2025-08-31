import { vi, beforeEach } from 'vitest'

// Mock Cloudflare D1 database
const mockDB = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn()
  }),
  exec: vi.fn()
}

// Mock Cloudflare KV
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn()
}

// Mock environment
export const mockEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
  API_VERSION: 'v1',
  DB: mockDB,
  CACHE_KV: mockKV,
  SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test/webhook',
  API_BASE_URL: 'http://localhost:8787',
  INTERNAL_API_TOKEN: 'test-internal-token'
}

// Mock Hono context
export const createMockContext = (overrides: Record<string, any> = {}) => ({
  env: mockEnv,
  req: {
    json: vi.fn(),
    query: vi.fn(),
    param: vi.fn(),
    header: vi.fn(),
    raw: {
      signal: null
    }
  },
  json: vi.fn(),
  text: vi.fn(),
  html: vi.fn(),
  redirect: vi.fn(),
  header: vi.fn(),
  status: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  executionCtx: {
    waitUntil: vi.fn()
  },
  ...overrides
})

// Mock user for authenticated requests
export const mockUser = {
  id: 1,
  username: 'testuser',
  role: 1, // Owner role
  restaurantId: 1,
  email: 'test@example.com'
}

// Mock admin user
export const mockAdminUser = {
  id: 999,
  username: 'admin',
  role: 0, // Admin role
  restaurantId: null,
  email: 'admin@example.com'
}

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})