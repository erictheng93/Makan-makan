/**
 * Subscription-gate wiring for restaurants:
 *  - POST/PUT/DELETE /:id/service-items  → moduleGate("reservations")
 *  - POST /:id/qr/shop/generate|regenerate, GET /:id/qr/shop,
 *    POST /:id/qr/shop/upload-image, PUT /:id/shop-mode → moduleGate("table_management")
 *
 * Regression coverage for bug-inventory leads E and F: these routes had no
 * module gate at all, unlike their conceptual siblings (service-bookings'
 * moduleGate("reservations"), tables/routes' moduleGate("table_management")).
 * GET /:id/service-items stays public/optionalAuth by design (browsing
 * bookable services must not require a plan) and is not covered here.
 *
 * Unlike index.test.ts, this file does NOT mock "../../../middleware/moduleGate"
 * — it exercises the real middleware so a missing/misplaced moduleGate call
 * fails these tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";

const currentUser = vi.hoisted(() => {
  const value: AuthUser = {
    id: "user-7",
    username: "owner",
    role: 1,
    restaurantId: "rest-1",
  };
  return { value };
});

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", currentUser.value);
    await next();
  }),
  optionalAuth: vi.fn(async (c: any, next: any) => {
    c.set("user", currentUser.value);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

const restaurantFns = vi.hoisted(() => ({
  createServiceItem: vi.fn(),
  generateShopQrCode: vi.fn(),
  updateShopMode: vi.fn(),
}));

vi.mock("../services/RestaurantsService", () => ({
  RestaurantsService: class {
    createServiceItem = restaurantFns.createServiceItem;
    generateShopQrCode = restaurantFns.generateShopQrCode;
    updateShopMode = restaurantFns.updateShopMode;
  },
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

interface CachedSubscription {
  isActive: boolean;
  planTier: "trial" | "basic" | "pro" | "enterprise";
  moduleOverrides: Record<string, boolean>;
  trialEndsAt: number | null;
}

class FakeKv {
  constructor(private readonly data: Record<string, CachedSubscription>) {}
  async get<T>(key: string): Promise<T | null> {
    const restaurantId = key.replace(/^subscription:/, "");
    return (this.data[restaurantId] as unknown as T) ?? null;
  }
  async put(): Promise<void> {}
  async delete(): Promise<void> {}
}

function subscription(
  planTier: CachedSubscription["planTier"],
  overrides: Record<string, boolean> = {},
): CachedSubscription {
  return {
    isActive: true,
    planTier,
    moduleOverrides: overrides,
    trialEndsAt: null,
  };
}

function envWithSubscription(
  restaurantId: string,
  planTier: CachedSubscription["planTier"],
  overrides: Record<string, boolean> = {},
) {
  return {
    DB: {},
    CACHE_KV: new FakeKv({ [restaurantId]: subscription(planTier, overrides) }),
  } as unknown as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.value = {
    id: "user-7",
    username: "owner",
    role: 1,
    restaurantId: "rest-1",
  };
});

describe("restaurants service-item writes are gated on reservations", () => {
  it("denies a basic-tier owner with 403 MODULE_NOT_ENABLED", async () => {
    const res = await app.request(
      "/rest-1/service-items",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Private dining",
          serviceType: "booking",
          priceCents: 5000,
        }),
      },
      envWithSubscription("rest-1", "basic") as never,
    );
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("MODULE_NOT_ENABLED");
    expect(restaurantFns.createServiceItem).not.toHaveBeenCalled();
  });

  it("allows a pro-tier owner through", async () => {
    restaurantFns.createServiceItem.mockResolvedValue({ id: 1 });

    const res = await app.request(
      "/rest-1/service-items",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Private dining",
          serviceType: "booking",
          priceCents: 5000,
        }),
      },
      envWithSubscription("rest-1", "pro") as never,
    );

    expect(res.status).toBe(201);
    expect(restaurantFns.createServiceItem).toHaveBeenCalledOnce();
  });
});

describe("restaurants shop-QR / shop-mode routes are gated on table_management", () => {
  it("denies a basic-tier owner with table_management explicitly disabled (403)", async () => {
    const res = await app.request(
      "/rest-1/qr/shop/generate",
      { method: "POST" },
      envWithSubscription("rest-1", "basic", {
        table_management: false,
      }) as never,
    );
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("MODULE_NOT_ENABLED");
    expect(restaurantFns.generateShopQrCode).not.toHaveBeenCalled();
  });

  it("allows a default basic-tier owner through (table_management is on by default)", async () => {
    restaurantFns.generateShopQrCode.mockResolvedValue({ qrCode: "SHOP-1-1" });

    const res = await app.request(
      "/rest-1/qr/shop/generate",
      { method: "POST" },
      envWithSubscription("rest-1", "basic") as never,
    );

    expect(res.status).toBe(201);
    expect(restaurantFns.generateShopQrCode).toHaveBeenCalledOnce();
  });

  it("denies shop-mode toggling when table_management is explicitly disabled", async () => {
    const res = await app.request(
      "/rest-1/shop-mode",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      },
      envWithSubscription("rest-1", "basic", {
        table_management: false,
      }) as never,
    );

    expect(res.status).toBe(403);
    expect(restaurantFns.updateShopMode).not.toHaveBeenCalled();
  });
});
