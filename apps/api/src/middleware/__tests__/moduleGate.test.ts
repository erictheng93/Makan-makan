/**
 * Module Gate Middleware Tests
 * moduleGate 中間件單元測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../shared/utils/api-error";
import { moduleGate, invalidateSubscriptionCache } from "../moduleGate";

// ---------------------------------------------------------------------------
// Mock drizzle-orm/d1 so we can control DB query results per test.
// The middleware calls drizzle(c.env.DB).select().from(...).where(...).limit(1)
// ---------------------------------------------------------------------------

let _mockDbRows: any[] = [];

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => Promise.resolve(_mockDbRows)),
        }),
      }),
    }),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withErrorHandler(app: Hono<any>): void {
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: { code: err.code, message: err.message },
        },
        err.status as any,
      );
    }
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: err.message },
      },
      500,
    );
  });
}

const createMockKV = (overrides: Partial<Record<string, any>> = {}) => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [] }),
  ...overrides,
});

/** Build the minimal cached subscription that getSubscription() writes/reads */
const makeSub = (
  overrides: Partial<{
    isActive: boolean;
    planTier: string;
    moduleOverrides: Record<string, boolean>;
    trialEndsAt: number | null;
  }> = {},
) => ({
  isActive: true,
  planTier: "pro",
  moduleOverrides: {},
  trialEndsAt: null,
  ...overrides,
});

/**
 * Create a Hono app with the module gate protecting /test.
 *
 * The `cachedSub` value is what CACHE_KV.get() returns (null = cache miss).
 * When there's a cache miss, the middleware falls back to DB — set `_mockDbRows`
 * before calling `app.request()` to control what Drizzle returns.
 */
function buildApp(options: {
  user?: Record<string, any> | null;
  cachedSub?: ReturnType<typeof makeSub> | null;
  dbRow?: Partial<{
    isActive: boolean;
    planTier: string;
    moduleOverrides: Record<string, boolean>;
    trialEndsAt: Date | null;
  }> | null;
  module?: string;
}) {
  const {
    user = { id: 1, role: 1, restaurantId: "rest-1" },
    cachedSub = null,
    dbRow = null,
    module = "kitchen_display",
  } = options;

  // Sync the module-level mock state so the drizzle mock returns the right rows
  _mockDbRows = dbRow ? [dbRow] : [];

  const mockKV = createMockKV({
    get: vi.fn().mockResolvedValue(cachedSub),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  });

  const app = new Hono<any>();
  withErrorHandler(app);

  // Inject env + user
  app.use("*", async (c, next) => {
    (c as any).env = { DB: {}, CACHE_KV: mockKV };
    if (user !== null) c.set("user", user);
    await next();
  });

  app.use("/test", moduleGate(module as any));
  app.get("/test", (c) => c.json({ success: true }));

  return { app, mockKV };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("moduleGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Admin bypass ───────────────────────────────────────────────────────────

  describe("Admin bypass", () => {
    it("passes through for role 0 without checking subscription", async () => {
      const { app, mockKV } = buildApp({
        user: { id: 1, role: 0, restaurantId: "rest-1" },
      });

      const res = await app.request("http://localhost/test");
      expect(res.status).toBe(200);
      // KV should never be queried for admins
      expect(mockKV.get).not.toHaveBeenCalled();
    });
  });

  // ── Missing user / restaurant ──────────────────────────────────────────────

  describe("Missing context", () => {
    it("returns 403 NO_RESTAURANT when restaurantId is absent", async () => {
      const { app } = buildApp({ user: { id: 1, role: 1 } }); // no restaurantId

      const res = await app.request("http://localhost/test");
      const body = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("NO_RESTAURANT");
    });
  });

  // ── Subscription not found ─────────────────────────────────────────────────

  describe("Subscription not found", () => {
    it("returns 403 SUBSCRIPTION_NOT_FOUND when no record exists", async () => {
      // cachedSub = null (cache miss) AND dbRow = null (no DB record)
      const { app } = buildApp({ cachedSub: null, dbRow: null });

      const res = await app.request("http://localhost/test");
      const body = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("SUBSCRIPTION_NOT_FOUND");
    });
  });

  // ── Cache hit path ─────────────────────────────────────────────────────────

  describe("Cache hit", () => {
    it("allows access when cached subscription grants the module", async () => {
      const { app, mockKV } = buildApp({
        cachedSub: makeSub({ planTier: "pro" }), // pro includes kitchen_display
        module: "kitchen_display",
      });

      const res = await app.request("http://localhost/test");
      expect(res.status).toBe(200);
      // DB should not be hit when cache returns a value
      expect(mockKV.get).toHaveBeenCalledWith("subscription:rest-1", "json");
    });

    it("blocks access when cached subscription is inactive (kill switch)", async () => {
      const { app } = buildApp({
        cachedSub: makeSub({ isActive: false }),
        module: "kitchen_display",
      });

      const res = await app.request("http://localhost/test");
      const body = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("MODULE_NOT_ENABLED");
    });
  });

  // ── Module resolution — plan defaults ─────────────────────────────────────

  describe("Plan default resolution", () => {
    it.each([
      ["basic", "kitchen_display", false],
      ["basic", "menu_management", true],
      ["pro", "kitchen_display", true],
      ["pro", "ai_analytics", false],
      ["enterprise", "ai_analytics", true],
    ])("plan=%s module=%s → allowed=%s", async (planTier, module, allowed) => {
      const { app } = buildApp({ cachedSub: makeSub({ planTier }), module });

      const res = await app.request("http://localhost/test");
      if (allowed) {
        expect(res.status).toBe(200);
      } else {
        expect(res.status).toBe(403);
        const body = (await res.json()) as any;
        expect(body.error.code).toBe("MODULE_NOT_ENABLED");
      }
    });
  });

  // ── Module overrides ───────────────────────────────────────────────────────

  describe("Module overrides", () => {
    it("grants a module that is not in the plan default when override=true", async () => {
      const { app } = buildApp({
        cachedSub: makeSub({
          planTier: "basic",
          moduleOverrides: { kitchen_display: true },
        }),
        module: "kitchen_display",
      });

      const res = await app.request("http://localhost/test");
      expect(res.status).toBe(200);
    });

    it("revokes a module that is in the plan default when override=false", async () => {
      const { app } = buildApp({
        cachedSub: makeSub({
          planTier: "pro",
          moduleOverrides: { kitchen_display: false },
        }),
        module: "kitchen_display",
      });

      const res = await app.request("http://localhost/test");
      const body = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("MODULE_NOT_ENABLED");
    });
  });

  // ── Trial expiry ───────────────────────────────────────────────────────────

  describe("Trial expiry", () => {
    it("allows access during active trial", async () => {
      const futureMs = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now
      const { app } = buildApp({
        cachedSub: makeSub({ planTier: "trial", trialEndsAt: futureMs }),
        module: "ai_analytics",
      });

      const res = await app.request("http://localhost/test");
      expect(res.status).toBe(200);
    });

    it("blocks access and returns TRIAL_EXPIRED after trial ends", async () => {
      const pastMs = Date.now() - 1000; // 1 second ago
      const { app } = buildApp({
        cachedSub: makeSub({ planTier: "trial", trialEndsAt: pastMs }),
        module: "ai_analytics",
      });

      const res = await app.request("http://localhost/test");
      const body = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("TRIAL_EXPIRED");
    });

    it("allows trial access when trialEndsAt is null (no expiry set)", async () => {
      const { app } = buildApp({
        cachedSub: makeSub({ planTier: "trial", trialEndsAt: null }),
        module: "ai_analytics",
      });

      const res = await app.request("http://localhost/test");
      expect(res.status).toBe(200);
    });
  });

  // ── Cache write-through on miss ────────────────────────────────────────────

  describe("Cache write-through", () => {
    it("writes subscription to KV after a DB hit", async () => {
      const { app, mockKV } = buildApp({
        cachedSub: null, // cache miss
        dbRow: {
          isActive: true,
          planTier: "pro",
          moduleOverrides: {},
          trialEndsAt: null,
        },
      });

      await app.request("http://localhost/test");

      expect(mockKV.put).toHaveBeenCalledOnce();
      expect(mockKV.put).toHaveBeenCalledWith(
        "subscription:rest-1",
        expect.any(String),
        { expirationTtl: 300 },
      );
    });

    it("does not write to KV when the DB also returns nothing", async () => {
      const { app, mockKV } = buildApp({ cachedSub: null, dbRow: null });

      await app.request("http://localhost/test");

      expect(mockKV.put).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// invalidateSubscriptionCache
// ---------------------------------------------------------------------------

describe("invalidateSubscriptionCache", () => {
  it("deletes the correct KV key for the given restaurantId", async () => {
    const mockKV = createMockKV();
    const mockContext = {
      env: { CACHE_KV: mockKV },
    } as any;

    await invalidateSubscriptionCache(mockContext, "rest-abc");

    expect(mockKV.delete).toHaveBeenCalledOnce();
    expect(mockKV.delete).toHaveBeenCalledWith("subscription:rest-abc");
  });
});
