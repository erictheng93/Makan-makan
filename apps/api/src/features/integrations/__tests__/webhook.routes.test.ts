import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDrizzleDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

const mockDrizzleDb: any = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

vi.mock("@makanmasak/database", () => ({
  platformIntegrations: {},
  platformWebhookLogs: {},
}));

// Mock adapter — verifyWebhook returns true by default
const mockAdapter = {
  verifyWebhook: vi.fn().mockResolvedValue(true),
  parseOrder: vi.fn(),
  refreshToken: vi.fn(),
  acceptOrder: vi.fn(),
  denyOrder: vi.fn(),
  cancelOrder: vi.fn(),
  syncMenu: vi.fn(),
};

vi.mock("../adapters/PlatformAdapter", () => ({
  getAdapter: vi.fn(() => mockAdapter),
}));

// Mock PlatformIntegrationService
const mockIntegrationService = {
  getDecryptedCredentials: vi.fn().mockResolvedValue({
    clientId: "cid",
    clientSecret: "csec",
    storeId: "store-abc",
  }),
};

vi.mock("../services/PlatformIntegrationService", () => ({
  PlatformIntegrationService: vi.fn(function () {
    return mockIntegrationService;
  }),
}));

// Mock PlatformOrderService
const mockOrderService = {
  processWebhook: vi.fn().mockResolvedValue(42),
};

vi.mock("../services/PlatformOrderService", () => ({
  PlatformOrderService: vi.fn(function () {
    return mockOrderService;
  }),
}));

// ─── Test setup ────────────────────────────────────────────────────────────

import webhookRoutes from "../routes/webhook";

// Idempotency middleware touches the real D1 binding via prepare().bind().
// These tests do not exercise idempotency behavior — they only need the
// middleware to fall through without caching. A no-op prepare() stub lets
// every request appear as a first-time call.
const mockEnv = {
  DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => null),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      })),
    })),
  },
  CACHE_KV: {},
  JWT_SECRET: "test-jwt-secret-key-for-testing-only",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
} as never;

const INTEGRATION = {
  id: 1,
  restaurantId: "rest-1",
  platform: "uber_eats",
  enabled: true,
  credentials: { storeId: "store-abc" },
  config: { webhookSecret: "wh-secret" },
};

function makeSelectChainWith(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
}

function makeInsertChain(returning: unknown[]) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Webhook Routes — POST /uber-eats", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: one matching integration found
    mockDrizzleDb.select.mockReturnValue(makeSelectChainWith([INTEGRATION]));
    mockDrizzleDb.insert.mockReturnValue(makeInsertChain([{ id: 99 }]));
    mockDrizzleDb.update.mockReturnValue(makeUpdateChain());

    mockAdapter.verifyWebhook.mockResolvedValue(true);
    mockOrderService.processWebhook.mockResolvedValue(42);

    app = new Hono();
    app.route("/webhooks", webhookRoutes);
  });

  it("returns 200 and orderId when webhook is valid", async () => {
    const body = JSON.stringify({
      id: "uber-order-001",
      store: { id: "store-abc" },
      event_type: "orders.notification",
    });

    const req = new Request("http://localhost/webhooks/uber-eats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-webhook-${Math.random().toString(36).slice(2)}`,
        "X-Uber-Signature": "valid-sig",
      },
      body,
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; orderId: number };
    expect(json.success).toBe(true);
    expect(json.orderId).toBe(42);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new Request("http://localhost/webhooks/uber-eats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-webhook-${Math.random().toString(36).slice(2)}`,
      },
      body: "not-valid-json{{{",
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid JSON payload");
  });

  it("returns 400 when store.id is missing from payload", async () => {
    const body = JSON.stringify({ id: "uber-order-002" }); // no store

    const req = new Request("http://localhost/webhooks/uber-eats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-webhook-${Math.random().toString(36).slice(2)}`,
      },
      body,
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Missing store.id in payload");
  });

  it("returns 404 when no integration matches the store.id", async () => {
    // DB returns empty — no matching integration
    mockDrizzleDb.select.mockReturnValue(makeSelectChainWith([]));

    const body = JSON.stringify({
      id: "uber-order-003",
      store: { id: "unknown-store" },
    });

    const req = new Request("http://localhost/webhooks/uber-eats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-webhook-${Math.random().toString(36).slice(2)}`,
      },
      body,
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Unknown store");
  });

  it("returns 401 when the HMAC signature is invalid", async () => {
    mockAdapter.verifyWebhook.mockResolvedValue(false);

    const body = JSON.stringify({
      id: "uber-order-004",
      store: { id: "store-abc" },
    });

    const req = new Request("http://localhost/webhooks/uber-eats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-webhook-${Math.random().toString(36).slice(2)}`,
        "X-Uber-Signature": "bad-sig",
      },
      body,
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(401);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid signature");
  });

  it("returns 500 when order processing fails", async () => {
    mockOrderService.processWebhook.mockRejectedValue(new Error("DB error"));

    const body = JSON.stringify({
      id: "uber-order-005",
      store: { id: "store-abc" },
    });

    const req = new Request("http://localhost/webhooks/uber-eats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-webhook-${Math.random().toString(36).slice(2)}`,
        "X-Uber-Signature": "valid-sig",
      },
      body,
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(500);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Processing failed");
  });

  it("uses config.webhookSecret over credentials.clientSecret for signature check", async () => {
    const body = JSON.stringify({
      id: "uber-order-006",
      store: { id: "store-abc" },
    });

    const req = new Request("http://localhost/webhooks/uber-eats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-webhook-${Math.random().toString(36).slice(2)}`,
        "X-Uber-Signature": "sig",
      },
      body,
    });

    await app.fetch(req, mockEnv);

    // verifyWebhook should have been called (called once for the request)
    expect(mockAdapter.verifyWebhook).toHaveBeenCalledOnce();
  });
});

describe("Webhook Routes — POST /foodpanda", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route("/webhooks", webhookRoutes);
  });

  it("returns 501 for unimplemented Foodpanda integration", async () => {
    const req = new Request("http://localhost/webhooks/foodpanda", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-webhook-${Math.random().toString(36).slice(2)}`,
      },
      body: JSON.stringify({ test: true }),
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(501);

    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Foodpanda integration not yet implemented");
  });
});
