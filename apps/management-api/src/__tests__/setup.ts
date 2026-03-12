/**
 * Test Setup for Management API
 *
 * Provides mock factories for Cloudflare bindings (D1, KV) and
 * common test helpers used across all test files.
 */

import { vi } from "vitest";
import type { ManagementEnv } from "../types";

// ============================================================
// D1 Database Mock
// ============================================================

export interface MockD1Statement {
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  raw: ReturnType<typeof vi.fn>;
}

export interface MockD1Database {
  prepare: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
}

export function createMockD1Statement(
  overrides?: Partial<MockD1Statement>,
): MockD1Statement {
  const stmt: MockD1Statement = {
    bind: vi.fn(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [], success: true }),
    run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
    raw: vi.fn().mockResolvedValue([]),
  };
  // Make bind return the same statement for chaining
  stmt.bind.mockReturnValue(stmt);

  if (overrides) {
    Object.assign(stmt, overrides);
    // Re-wire bind to return the updated stmt
    if (!overrides.bind) {
      stmt.bind.mockReturnValue(stmt);
    }
  }

  return stmt;
}

export function createMockD1Database(): MockD1Database {
  const defaultStmt = createMockD1Statement();
  const db: MockD1Database = {
    prepare: vi.fn().mockReturnValue(defaultStmt),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
  };
  return db;
}

// ============================================================
// KV Namespace Mock
// ============================================================

export interface MockKVNamespace {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  getWithMetadata: ReturnType<typeof vi.fn>;
}

export function createMockKV(): MockKVNamespace {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
    getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
  };
}

// ============================================================
// Environment Mock
// ============================================================

export function createMockEnv(
  overrides?: Partial<ManagementEnv>,
): ManagementEnv {
  return {
    NODE_ENV: "test",
    API_VERSION: "v1",
    API_BASE_URL: "http://localhost:8787",
    CORS_ORIGIN: "*",
    LOG_LEVEL: "error",
    JWT_SECRET: "test-jwt-secret",
    ENCRYPTION_KEY: "test-encryption-key",
    CF_API_TOKEN: "test-cf-api-token",
    CF_ACCOUNT_ID: "test-cf-account-id",
    SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
    MANAGEMENT_DB: createMockD1Database() as unknown as D1Database,
    CACHE_KV: createMockKV() as unknown as KVNamespace,
    DEPLOYMENT_STATUS_KV: createMockKV() as unknown as KVNamespace,
    ...overrides,
  } as ManagementEnv;
}

// ============================================================
// Test Data Factories
// ============================================================

export function createTestTenantRow(overrides?: Record<string, unknown>) {
  return {
    id: "T-20240101-ABC",
    business_name: "Test Restaurant",
    contact_email: "test@example.com",
    contact_phone: "+60123456789",
    cf_account_id: null,
    cf_api_token_enc: null,
    subdomain: "test-restaurant",
    custom_domain: null,
    deployed_version: "1.0.0",
    license_tier: "standard",
    license_key: "MKM-STD-TESTABC-XY12",
    license_expires_at: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    status: "active",
    created_at: "2024-01-01T00:00:00.000Z",
    activated_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function createTestApplicationRow(overrides?: Record<string, unknown>) {
  return {
    id: "APP-20240101-XYZ",
    business_name: "New Restaurant",
    contact_name: "John Doe",
    contact_email: "john@example.com",
    contact_phone: "+60123456789",
    plan_id: "standard",
    requested_subdomain: "new-restaurant",
    assigned_subdomain: "new-restaurant",
    cf_account_id: null,
    cf_api_token_enc: null,
    cf_verified_at: null,
    status: "submitted",
    tenant_id: null,
    ip_address: "127.0.0.1",
    user_agent: "test-agent",
    created_at: "2024-01-01T00:00:00.000Z",
    submitted_at: "2024-01-01T00:00:00.000Z",
    completed_at: null,
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function createTestDeploymentLogRow(
  overrides?: Record<string, unknown>,
) {
  return {
    id: "deploy-123",
    tenant_id: "T-20240101-ABC",
    deployment_type: "update",
    from_version: "1.0.0",
    to_version: "1.1.0",
    status: "completed",
    logs: null,
    started_at: "2024-01-01T00:00:00.000Z",
    completed_at: "2024-01-01T00:01:00.000Z",
    ...overrides,
  };
}

export function createTestHealthCheckRow(overrides?: Record<string, unknown>) {
  return {
    id: "hc-123",
    tenant_id: "T-20240101-ABC",
    status: "healthy",
    response_time_ms: 120,
    details: null,
    checked_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================
// Global fetch mock setup
// ============================================================

// Suppress console.error in tests
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});
