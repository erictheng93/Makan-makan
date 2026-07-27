/**
 * Subscription-gate wiring for service-bookings routes.
 *
 * Regression coverage for the bug where the staff/admin half of this router
 * (`app.use("/*", authMiddleware)` at the "Staff / admin" boundary) had no
 * `moduleGate("reservations")` next to it, unlike its structural siblings
 * (reservations/routes/index.ts, waiting-list/routes/index.ts). That let a
 * `basic`-tier shop owner use the entire 預約服務 booking product for free.
 *
 * Unlike index.test.ts / scope.test.ts, this file does NOT mock
 * "../../../middleware/moduleGate" — it exercises the real middleware so a
 * missing/misplaced `app.use("/*", moduleGate(...))` line fails these tests.
 * The gate's own tier x module matrix is exhaustively covered in
 * middleware/moduleGate.test.ts; this file only proves the wiring: which
 * tiers get through on a staff route, and that public routes registered
 * before the auth boundary are never touched by the gate at all.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mutable current user injected by the mocked auth middleware.
const currentUser = vi.hoisted(() => ({
  value: { id: 1, role: 1, restaurantId: "rest-basic" } as {
    id: number;
    role: number;
    restaurantId: string | number | undefined;
  },
}));

// Spy so the public-route test can prove authMiddleware (and therefore the
// moduleGate registered right after it) never ran.
const authMiddlewareCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    authMiddlewareCalls.count += 1;
    c.set("user", currentUser.value);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../../../middleware/rateLimiter", () => ({
  rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
}));

const listByRestaurant = vi.hoisted(() => vi.fn());
const createBooking = vi.hoisted(() => vi.fn());

vi.mock("../services/ServiceBookingService", () => ({
  MAX_BATCH_SLOT_CREATION_COUNT: 1000,
  ServiceBookingService: vi.fn(function ServiceBookingService() {
    return {
      listByRestaurant,
      createBooking,
    };
  }),
}));

import app from "./index";
import { ApiError } from "../../../shared/utils/api-error";

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

/** A binding that explodes on any property access — proves a code path never touches it. */
function poisonedBinding(label: string): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(
          `${label} was accessed (property ${String(prop)}) but must not be`,
        );
      },
    },
  );
}

interface CachedSubscription {
  isActive: boolean;
  planTier: "trial" | "basic" | "pro" | "enterprise";
  moduleOverrides: Record<string, boolean>;
  trialEndsAt: number | null;
}

/** Minimal KV stand-in pre-seeded with `subscription:<restaurantId>` entries. */
class FakeKv {
  constructor(private readonly data: Record<string, CachedSubscription>) {}
  async get<T>(key: string): Promise<T | null> {
    const restaurantId = key.replace(/^subscription:/, "");
    const value = this.data[restaurantId];
    return (value as unknown as T) ?? null;
  }
  async put(): Promise<void> {
    // no-op: all fixtures below are pre-seeded cache hits.
  }
  async delete(): Promise<void> {
    // unused in this file
  }
}

function subscription(
  planTier: CachedSubscription["planTier"],
): CachedSubscription {
  return { isActive: true, planTier, moduleOverrides: {}, trialEndsAt: null };
}

/** Real moduleGate reads only CACHE_KV on a cache hit; DB stays poisoned to prove that. */
function envWithSubscription(
  restaurantId: string,
  planTier: CachedSubscription["planTier"],
) {
  return {
    DB: poisonedBinding("DB"),
    CACHE_KV: new FakeKv({ [restaurantId]: subscription(planTier) }),
  } as unknown as Record<string, unknown>;
}

/** Env for the public-route test: any touch to either binding is a bug. */
function poisonedEnv() {
  return {
    DB: poisonedBinding("DB"),
    CACHE_KV: poisonedBinding("CACHE_KV"),
  } as unknown as Record<string, unknown>;
}

function req(
  path: string,
  method: string,
  env: Record<string, unknown>,
  body?: unknown,
) {
  return app.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    },
    env as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authMiddlewareCalls.count = 0;
  currentUser.value = { id: 1, role: 1, restaurantId: "rest-basic" };
});

describe("service-bookings staff routes are gated on the reservations module", () => {
  it("denies a basic-tier owner with 403 MODULE_NOT_ENABLED", async () => {
    currentUser.value = { id: 1, role: 1, restaurantId: "rest-basic" };

    const res = await req(
      "/",
      "GET",
      envWithSubscription("rest-basic", "basic"),
    );
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(403);
    expect(json).toMatchObject({
      success: false,
      error: { code: "MODULE_NOT_ENABLED" },
    });
    expect(listByRestaurant).not.toHaveBeenCalled();
  });

  it("allows a pro-tier owner through to the staff route", async () => {
    currentUser.value = { id: 1, role: 1, restaurantId: "rest-pro" };
    listByRestaurant.mockResolvedValue([{ id: "bk-1" }]);

    const res = await req("/", "GET", envWithSubscription("rest-pro", "pro"));

    expect(res.status).toBe(200);
    expect(listByRestaurant).toHaveBeenCalledOnce();
    expect(listByRestaurant).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "rest-pro" }),
    );
  });

  it("allows an enterprise-tier owner through to the staff route", async () => {
    currentUser.value = { id: 1, role: 1, restaurantId: "rest-ent" };
    listByRestaurant.mockResolvedValue([{ id: "bk-1" }]);

    const res = await req(
      "/",
      "GET",
      envWithSubscription("rest-ent", "enterprise"),
    );

    expect(res.status).toBe(200);
    expect(listByRestaurant).toHaveBeenCalledOnce();
    expect(listByRestaurant).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "rest-ent" }),
    );
  });
});

describe("public service-bookings routes bypass the staff auth/module boundary", () => {
  it("POST / (public booking creation) succeeds without a staff subscription", async () => {
    createBooking.mockResolvedValue({
      id: "booking-1",
      restaurantId: "rest-basic",
      status: "pending",
    });

    const res = await req("/", "POST", poisonedEnv(), {
      restaurantId: "rest-basic",
      serviceItemId: 10,
      customerName: "Guest",
      customerPhone: "0911222333",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
    });

    expect(res.status).toBe(201);
    expect(createBooking).toHaveBeenCalledOnce();
    // The strongest possible proof: authMiddleware (and therefore the
    // moduleGate registered immediately after it) never ran for this
    // request, and neither binding the gate would touch was accessed —
    // the poisoned Proxies would have thrown otherwise.
    expect(authMiddlewareCalls.count).toBe(0);
  });
});
