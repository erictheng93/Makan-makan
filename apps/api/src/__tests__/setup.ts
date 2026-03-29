import { vi, beforeEach } from "vitest";
import {
  createMockD1Database,
  createMockKV,
  envFactory,
} from "@makanmakan/testing-utils";

// Re-export factory helpers for backward compatibility
export { createMockD1Database, createMockKV };

// Build shared mock instances
const mockDB = createMockD1Database();
const mockKV = createMockKV();

// Mock environment — uses envFactory as base, with shared DB/KV instances
export const mockEnv = {
  ...envFactory.build(),
  DB: mockDB,
  CACHE_KV: mockKV,
  TOKEN_BLACKLIST: mockKV,
  RATE_LIMIT_KV: mockKV,
};

// Mock Hono context
export const createMockContext = (overrides: Record<string, any> = {}) => ({
  env: mockEnv,
  req: {
    json: vi.fn(),
    query: vi.fn(),
    param: vi.fn(),
    header: vi.fn(),
    raw: {
      signal: null,
    },
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
    waitUntil: vi.fn(),
  },
  ...overrides,
});

// Mock user for authenticated requests
export const mockUser = {
  id: 1,
  username: "testuser",
  role: 1, // Owner role
  restaurantId: "test-restaurant-1",
  email: "test@example.com",
};

// Mock admin user
export const mockAdminUser = {
  id: 999,
  username: "admin",
  role: 0, // Admin role
  restaurantId: undefined, // Admin has no specific restaurant
  email: "admin@example.com",
};

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
