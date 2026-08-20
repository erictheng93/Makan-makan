/**
 * Subscription-gate wiring for qr-codes POST /bulk.
 *
 * Regression coverage for the bug where /bulk (table-QR bulk generation —
 * its schema requires a `tables` array, the same shape as tables/routes
 * POST /bulk-qr) had no moduleGate("table_management"), unlike its
 * structural sibling in tables/routes. That let a basic-tier owner whose
 * table_management module was explicitly disabled (moduleOverrides) keep
 * generating table QR codes through this parallel path.
 *
 * Unlike index.test.ts, this file does NOT mock "../../../middleware/moduleGate"
 * — it exercises the real middleware so a missing/misplaced moduleGate call
 * fails these tests. It also proves POST /generate (a generic, multi-purpose
 * QR utility also used for market QR) is intentionally left ungated.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context, Next } from "hono";
import type { AuthUser } from "../../../middleware/auth";

const currentUser = vi.hoisted(() => {
  const value: AuthUser = {
    id: "user-7",
    username: "owner",
    role: 1,
    restaurantId: "rest-basic",
  };
  return { value };
});

vi.mock("../../../shared/middleware", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../shared/middleware")>();
  return {
    ...actual,
    authMiddleware: vi.fn(async (c: Context, next: Next) => {
      c.set("user", currentUser.value);
      await next();
    }),
    requireRole: vi.fn(
      () => async (_c: unknown, next: () => Promise<void>) => next(),
    ),
  };
});

const qrServiceFns = vi.hoisted(() => ({
  generateQR: vi.fn(),
  generateBulkQR: vi.fn(),
}));

vi.mock("../services/QrCodesService", () => ({
  QrCodesService: class {
    generateQR = qrServiceFns.generateQR;
    generateBulkQR = qrServiceFns.generateBulkQR;
  },
}));

import routes from "./index";
import { ApiError } from "../../../shared/utils/api-error";

routes.onError((err, c) => {
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

class FakeKv {
  constructor(private readonly data: Record<string, CachedSubscription>) {}
  async get<T>(key: string): Promise<T | null> {
    const restaurantId = key.replace(/^subscription:/, "");
    const value = this.data[restaurantId];
    return (value as unknown as T) ?? null;
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
    DB: poisonedBinding("DB"),
    CACHE_KV: new FakeKv({ [restaurantId]: subscription(planTier, overrides) }),
  } as unknown as Record<string, unknown>;
}

function bulkBody() {
  return {
    tables: [{ id: 1, name: "A1", content: "https://makan.test/table/1" }],
    format: "zip",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.value = {
    id: "user-7",
    username: "owner",
    role: 1,
    restaurantId: "rest-basic",
  };
});

describe("qr-codes POST /bulk is gated on table_management", () => {
  it("denies a basic-tier owner with table_management explicitly disabled (403 MODULE_NOT_ENABLED)", async () => {
    currentUser.value = {
      id: "user-7",
      username: "owner",
      role: 1,
      restaurantId: "rest-basic",
    };

    const res = await routes.request(
      "/bulk",
      {
        method: "POST",
        body: JSON.stringify(bulkBody()),
        headers: { "Content-Type": "application/json" },
      },
      envWithSubscription("rest-basic", "basic", { table_management: false }),
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
    expect(qrServiceFns.generateBulkQR).not.toHaveBeenCalled();
  });

  it("allows a default basic-tier owner through (table_management is on by default)", async () => {
    currentUser.value = {
      id: "user-7",
      username: "owner",
      role: 1,
      restaurantId: "rest-basic",
    };
    qrServiceFns.generateBulkQR.mockResolvedValue({
      batchId: "batch-1",
      count: 1,
    });

    const res = await routes.request(
      "/bulk",
      {
        method: "POST",
        body: JSON.stringify(bulkBody()),
        headers: { "Content-Type": "application/json" },
      },
      envWithSubscription("rest-basic", "basic"),
    );

    expect(res.status).toBe(201);
    expect(qrServiceFns.generateBulkQR).toHaveBeenCalledOnce();
  });
});

describe("qr-codes POST /generate bypasses the table_management gate", () => {
  it("succeeds for a basic-tier owner with table_management explicitly disabled", async () => {
    currentUser.value = {
      id: "user-7",
      username: "owner",
      role: 1,
      restaurantId: "rest-basic",
    };
    qrServiceFns.generateQR.mockResolvedValue({
      id: "qr-1",
      url: "https://cdn.example.test/qr-1.png",
    });

    const res = await routes.request(
      "/generate",
      {
        method: "POST",
        body: JSON.stringify({
          content: "MARKET-central-market",
          format: "png",
        }),
        headers: { "Content-Type": "application/json" },
      },
      envWithSubscription("rest-basic", "basic", { table_management: false }),
    );

    expect(res.status).toBe(201);
    expect(qrServiceFns.generateQR).toHaveBeenCalledOnce();
  });
});
