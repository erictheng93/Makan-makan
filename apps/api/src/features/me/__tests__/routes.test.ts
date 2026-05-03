import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

let mockUser: any = {
  id: 1,
  username: "staff",
  role: 1,
  restaurantId: "rest-1",
};

vi.mock("../../../middleware/auth", () => ({
  customerAuthMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", mockUser);
    await next();
  }),
}));

const mockSubRow = {
  id: "sub-1",
  restaurantId: "rest-1",
  planTier: "pro",
  moduleOverrides: {},
  deploymentMode: "managed",
  isActive: true,
  trialEndsAt: null,
  billingCycleStartAt: null,
  billingCycleEndAt: null,
  notes: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockEffectiveModules = {
  menu_management: true,
  table_management: true,
  online_ordering: true,
  pos: true,
};

const mockService = {
  getByRestaurantId: vi.fn().mockResolvedValue(mockSubRow),
  getEffectiveModules: vi.fn().mockReturnValue(mockEffectiveModules),
};

vi.mock("../../subscriptions/services/SubscriptionService", () => ({
  SubscriptionService: class MockSubscriptionService {
    constructor() {
      Object.assign(this, mockService);
    }
  },
}));

import meRoutes from "../routes";

function createMockKV(cached: unknown = null) {
  return {
    get: vi.fn().mockResolvedValue(cached),
    put: vi.fn().mockResolvedValue(undefined),
  };
}

function buildApp(cached: unknown = null) {
  const app = new Hono<any>();
  const mockKV = createMockKV(cached);

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as never,
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

  app.use("*", async (c, next) => {
    (c as unknown as ApiTestContextWithEnv).env = {
      DB: {},
      CACHE_KV: mockKV,
    } as unknown as ApiTestEnv;
    await next();
  });
  app.route("/me", meRoutes);

  return { app, mockKV };
}

describe("me modules routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 1, username: "staff", role: 1, restaurantId: "rest-1" };
    mockService.getByRestaurantId.mockResolvedValue(mockSubRow);
    mockService.getEffectiveModules.mockReturnValue(mockEffectiveModules);
  });

  it("returns effective modules for staff restaurant subscriptions", async () => {
    const { app, mockKV } = buildApp();

    const res = await app.request("http://localhost/me/modules");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      restaurantId: "rest-1",
      planTier: "pro",
      isActive: true,
      trialEndsAt: null,
      deploymentMode: "managed",
      effectiveModules: mockEffectiveModules,
    });
    expect(mockService.getByRestaurantId).toHaveBeenCalledWith("rest-1");
    expect(mockKV.put).toHaveBeenCalledWith(
      "subscription:rest-1",
      expect.any(String),
      { expirationTtl: 300 },
    );
  });

  it("returns cached subscription modules without hitting the database", async () => {
    const { app } = buildApp({
      isActive: true,
      planTier: "enterprise",
      moduleOverrides: {},
      trialEndsAt: null,
      deploymentMode: "byoc",
    });

    const res = await app.request("http://localhost/me/modules");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.data.restaurantId).toBe("rest-1");
    expect(body.data.planTier).toBe("enterprise");
    expect(body.data.deploymentMode).toBe("byoc");
    expect(mockService.getByRestaurantId).not.toHaveBeenCalled();
  });

  it("returns empty access for customers", async () => {
    mockUser = { id: 5, username: "customer", role: 5, restaurantId: "rest-1" };
    const { app } = buildApp();

    const res = await app.request("http://localhost/me/modules");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      restaurantId: null,
      planTier: null,
      isActive: false,
      trialEndsAt: null,
      deploymentMode: "managed",
      effectiveModules: {},
    });
    expect(mockService.getByRestaurantId).not.toHaveBeenCalled();
  });

  it("returns empty access when no subscription exists", async () => {
    mockService.getByRestaurantId.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request("http://localhost/me/modules");
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.data.restaurantId).toBe("rest-1");
    expect(body.data.planTier).toBeNull();
    expect(body.data.effectiveModules).toEqual({});
  });
});
