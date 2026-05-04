import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";
import { ErrorSanitizer } from "../../../utils/errorSanitizer";

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Mock shared middleware — requireRole enforces roles
vi.mock("../../../shared/middleware", () => ({
  requireRole: (roles: number[]) =>
    vi.fn(async (c: any, next: any) => {
      const user = c.get("user");
      if (!user || !roles.includes(user.role)) {
        return c.json(
          {
            success: false,
            error: { code: "FORBIDDEN", message: "Forbidden" },
          },
          403,
        );
      }
      await next();
    }),
  authMiddleware: vi.fn((c: any, next: any) => next()),
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDrizzleDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
}));

const mockDrizzleDb: any = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@makanmasak/database", () => ({
  platformIntegrations: {},
  platformWebhookLogs: {},
}));

// Mock PlatformIntegrationService
const mockIntegrationService = {
  getIntegrations: vi.fn().mockResolvedValue([]),
  getIntegration: vi.fn().mockResolvedValue(null),
  connect: vi
    .fn()
    .mockResolvedValue({ id: 1, platform: "uber_eats", enabled: true }),
  disconnect: vi.fn().mockResolvedValue(undefined),
  updateConfig: vi
    .fn()
    .mockResolvedValue({ id: 1, platform: "uber_eats", enabled: true }),
};

vi.mock("../services/PlatformIntegrationService", () => ({
  PlatformIntegrationService: vi.fn(function () {
    return mockIntegrationService;
  }),
}));

// Mock PlatformOrderService
const mockOrderService = {
  getPlatformOrders: vi.fn().mockResolvedValue([]),
};

vi.mock("../services/PlatformOrderService", () => ({
  PlatformOrderService: vi.fn(function () {
    return mockOrderService;
  }),
}));

// Mock PlatformMenuSyncService
const mockMenuSyncService = {
  syncMenu: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../services/PlatformMenuSyncService", () => ({
  PlatformMenuSyncService: vi.fn(function () {
    return mockMenuSyncService;
  }),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: any, next: any) => await next()),
  invalidateSubscriptionCache: vi.fn().mockResolvedValue(undefined),
}));

// ─── Test helpers ──────────────────────────────────────────────────────────

import adminRoutes from "../routes/admin";

const mockEnv = {
  DB: {},
  CACHE_KV: {},
  JWT_SECRET: "test-jwt-secret-key-for-testing-only",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
} as never;

function buildApp(userRole: number | null) {
  const app = new Hono();

  // Inject user before routes if a role is provided
  if (userRole !== null) {
    app.use("/*", async (c, next) => {
      c.set("user", { id: 1, role: userRole, username: "testuser" });
      await next();
    });
  }

  app.route("/integrations", adminRoutes);

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.details !== undefined && { details: err.details }),
          },
        },
        err.status as never,
      );
    }
    const sanitized = ErrorSanitizer.sanitizeError(err);
    const STATUS_MAP: Record<string, number> = {
      validation: 400,
      authentication: 401,
      authorization: 403,
      not_found: 404,
      rate_limit: 429,
      server_error: 500,
    };
    return c.json(
      {
        success: false,
        error: {
          code: sanitized.code ?? "INTERNAL_ERROR",
          message: sanitized.message,
        },
      },
      (STATUS_MAP[sanitized.type] ?? 500) as never,
    );
  });

  return app;
}

function makeSelectChainWith(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(rows),
  };
}

describe("Admin Routes — RBAC enforcement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when user has role 2 (chef)", async () => {
    const app = buildApp(2);

    const req = new Request("http://localhost/integrations/rest-1", {
      method: "GET",
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(403);
  });

  it("returns 403 when user has role 3 (service crew)", async () => {
    const app = buildApp(3);

    const req = new Request("http://localhost/integrations/rest-1", {
      method: "GET",
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(403);
  });

  it("returns 403 when user has role 4 (cashier)", async () => {
    const app = buildApp(4);

    const req = new Request("http://localhost/integrations/rest-1", {
      method: "GET",
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(403);
  });

  it("passes through for role 0 (admin)", async () => {
    const app = buildApp(0);
    mockIntegrationService.getIntegrations.mockResolvedValue([]);

    const req = new Request("http://localhost/integrations/rest-1", {
      method: "GET",
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
  });

  it("passes through for role 1 (shop owner)", async () => {
    const app = buildApp(1);
    mockIntegrationService.getIntegrations.mockResolvedValue([]);

    const req = new Request("http://localhost/integrations/rest-1", {
      method: "GET",
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
  });
});

describe("Admin Routes — GET /:restaurantId (list integrations)", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp(0);
  });

  it("returns 200 with data array", async () => {
    const mockIntegrations = [
      { id: 1, restaurantId: "rest-1", platform: "uber_eats", enabled: true },
    ];
    mockIntegrationService.getIntegrations.mockResolvedValue(mockIntegrations);

    const req = new Request("http://localhost/integrations/rest-1");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(1);
  });

  it("returns empty array when no integrations exist", async () => {
    mockIntegrationService.getIntegrations.mockResolvedValue([]);

    const req = new Request("http://localhost/integrations/rest-1");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown[] };
    expect(json.data).toHaveLength(0);
  });
});

describe("Admin Routes — GET /:restaurantId/:platform (get specific integration)", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp(0);
  });

  it("returns 200 with integration data when found", async () => {
    const mockIntegration = {
      id: 1,
      restaurantId: "rest-1",
      platform: "uber_eats",
      enabled: true,
    };
    mockIntegrationService.getIntegration.mockResolvedValue(mockIntegration);

    const req = new Request("http://localhost/integrations/rest-1/uber_eats");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown };
    expect(json.data).toEqual(mockIntegration);
  });

  it("returns 404 when integration is not found", async () => {
    mockIntegrationService.getIntegration.mockResolvedValue(null);

    const req = new Request("http://localhost/integrations/rest-1/uber_eats");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Integration not found");
  });
});

describe("Admin Routes — POST /:restaurantId/:platform/connect", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp(0);
  });

  it("returns 201 with created integration", async () => {
    const newIntegration = {
      id: 2,
      restaurantId: "rest-1",
      platform: "uber_eats",
      enabled: true,
    };
    mockIntegrationService.connect.mockResolvedValue(newIntegration);

    const req = new Request(
      "http://localhost/integrations/rest-1/uber_eats/connect",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: "client-123",
          clientSecret: "secret-abc",
          storeId: "store-456",
          autoAcceptOrders: true,
          menuSyncEnabled: false,
        }),
      },
    );

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(201);

    const json = (await res.json()) as { data: unknown };
    expect(json.data).toEqual(newIntegration);
  });

  it("calls service.connect with the correct arguments", async () => {
    mockIntegrationService.connect.mockResolvedValue({ id: 3 });

    const body = {
      clientId: "c1",
      clientSecret: "s1",
      storeId: "st1",
    };

    const req = new Request(
      "http://localhost/integrations/rest-2/uber_eats/connect",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    await app.fetch(req, mockEnv);

    expect(mockIntegrationService.connect).toHaveBeenCalledWith(
      "rest-2",
      "uber_eats",
      expect.objectContaining({ clientId: "c1", storeId: "st1" }),
    );
  });

  it("returns 501 for Foodpanda connect while the adapter is disabled", async () => {
    const req = new Request(
      "http://localhost/integrations/rest-2/foodpanda/connect",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: "c1",
          clientSecret: "s1",
          storeId: "st1",
        }),
      },
    );

    const res = await app.fetch(req, mockEnv);
    const json = (await res.json()) as { error: string };

    expect(res.status).toBe(501);
    expect(json.error).toBe("foodpanda integration is not available yet");
    expect(mockIntegrationService.connect).not.toHaveBeenCalled();
  });
});

describe("Admin Routes — PUT /:restaurantId/:platform (update config)", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp(1);
  });

  it("returns 200 with updated integration", async () => {
    const updated = {
      id: 1,
      restaurantId: "rest-1",
      platform: "uber_eats",
      enabled: true,
      config: { autoAcceptOrders: true },
    };
    mockIntegrationService.updateConfig.mockResolvedValue(updated);

    const req = new Request("http://localhost/integrations/rest-1/uber_eats", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoAcceptOrders: true }),
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: unknown };
    expect(json.data).toEqual(updated);
  });
});

describe("Admin Routes — DELETE /:restaurantId/:platform (disconnect)", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp(0);
  });

  it("returns 200 with success:true on successful disconnect", async () => {
    mockIntegrationService.disconnect.mockResolvedValue(undefined);

    const req = new Request("http://localhost/integrations/rest-1/uber_eats", {
      method: "DELETE",
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it("calls service.disconnect with correct restaurantId and platform", async () => {
    const req = new Request("http://localhost/integrations/rest-99/foodpanda", {
      method: "DELETE",
    });

    await app.fetch(req, mockEnv);

    expect(mockIntegrationService.disconnect).toHaveBeenCalledWith(
      "rest-99",
      "foodpanda",
    );
  });
});

describe("Admin Routes — POST /:restaurantId/:platform/menu-sync", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp(0);
  });

  it("returns 200 with success and message when sync succeeds", async () => {
    mockMenuSyncService.syncMenu.mockResolvedValue(undefined);

    const req = new Request(
      "http://localhost/integrations/rest-1/uber_eats/menu-sync",
      {
        method: "POST",
      },
    );

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; message: string };
    expect(json.success).toBe(true);
    expect(json.message).toBe("Menu sync completed");
  });

  it("returns 500 with error message when sync fails", async () => {
    mockMenuSyncService.syncMenu.mockRejectedValue(
      new Error("Sync failed: API down"),
    );

    const req = new Request(
      "http://localhost/integrations/rest-1/uber_eats/menu-sync",
      {
        method: "POST",
      },
    );

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(500);

    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json.success).toBe(false);
    expect(json.error).toHaveProperty("code");
    expect(json.error).toHaveProperty("message");
  });
});

describe("Admin Routes — GET /:restaurantId/:platform/orders", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp(0);
  });

  it("returns 200 with orders array", async () => {
    const mockOrders = [
      { id: 10, platformOrderId: "uo-001", platform: "uber_eats" },
    ];
    mockOrderService.getPlatformOrders.mockResolvedValue(mockOrders);

    const req = new Request(
      "http://localhost/integrations/rest-1/uber_eats/orders",
    );

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { data: unknown[] };
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(1);
  });

  it("passes filter parameters to service", async () => {
    mockOrderService.getPlatformOrders.mockResolvedValue([]);

    const req = new Request(
      "http://localhost/integrations/rest-1/uber_eats/orders?status=accepted&limit=10&page=2",
    );

    await app.fetch(req, mockEnv);

    expect(mockOrderService.getPlatformOrders).toHaveBeenCalledWith(
      "rest-1",
      expect.objectContaining({
        platform: "uber_eats",
        platformStatus: "accepted",
        limit: 10,
        page: 2,
      }),
    );
  });
});

describe("Admin Routes — GET /:restaurantId/webhook-logs", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp(0);
    mockDrizzleDb.select.mockReturnValue(makeSelectChainWith([]));
  });

  it("returns 200 with webhook logs data", async () => {
    const req = new Request(
      "http://localhost/integrations/rest-1/webhook-logs",
    );
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown[] };
    expect(json.data).toBeDefined();
  });
});
