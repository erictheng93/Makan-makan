import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: undefined as
    | {
        id: number;
        username: string;
        role: number;
        restaurantId: string | number | null;
      }
    | undefined,
}));

const subscriptionMocks = vi.hoisted(() => ({
  getByRestaurantId: vi.fn(),
  getEffectiveModules: vi.fn(),
}));

const usageMocks = vi.hoisted(() => ({
  getCurrentUsage: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  customerAuthMiddleware: vi.fn(async (c, next) => {
    c.set("user", authState.user);
    await next();
  }),
}));

vi.mock("../../subscriptions/services/SubscriptionService", () => ({
  SubscriptionService: class {
    getByRestaurantId = subscriptionMocks.getByRestaurantId;
    getEffectiveModules = subscriptionMocks.getEffectiveModules;
  },
}));

vi.mock("../../billing/services/UsageService", () => ({
  UsageService: class {
    getCurrentUsage = usageMocks.getCurrentUsage;
  },
}));

import meFeature from "../index";
import routes from "./index";

function createEnv(cacheRows = new Map<string, unknown>()) {
  return {
    DB: {},
    CACHE_KV: {
      get: vi.fn(async (key: string) => cacheRows.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        cacheRows.set(key, JSON.parse(value));
      }),
    },
  };
}

function request(path: string, env = createEnv()) {
  return routes.request(path, undefined, env as never);
}

describe("me routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = {
      id: 42,
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    };
    subscriptionMocks.getEffectiveModules.mockReturnValue({
      pos: true,
      analytics: false,
    });
  });

  it("exposes module metadata and health", async () => {
    await expect(meFeature.healthCheck()).resolves.toEqual({
      status: "healthy",
      message: "Me module operational",
    });

    expect(meFeature.name).toBe("me");
    expect(meFeature.version).toBe("1.0.0");
  });

  it("returns empty module and usage access for customer accounts", async () => {
    authState.user = {
      id: 99,
      username: "customer",
      role: 5,
      restaurantId: "restaurant-1",
    };

    const modulesResponse = await request("/modules");
    const usageResponse = await request("/usage");

    expect(modulesResponse.status).toBe(200);
    await expect(modulesResponse.json()).resolves.toEqual({
      success: true,
      data: {
        restaurantId: null,
        planTier: null,
        isActive: false,
        trialEndsAt: null,
        deploymentMode: "managed",
        effectiveModules: {},
      },
    });
    expect(usageResponse.status).toBe(200);
    await expect(usageResponse.json()).resolves.toEqual({
      success: true,
      data: {
        cycleStartAt: null,
        cycleEndAt: null,
        meters: [],
      },
    });
    expect(subscriptionMocks.getByRestaurantId).not.toHaveBeenCalled();
    expect(usageMocks.getCurrentUsage).not.toHaveBeenCalled();
  });

  it("returns empty module and usage access when staff has no restaurant", async () => {
    authState.user = {
      id: 43,
      username: "floating-manager",
      role: 1,
      restaurantId: null,
    };

    const modulesResponse = await request("/modules");
    const usageResponse = await request("/usage");

    expect(modulesResponse.status).toBe(200);
    await expect(modulesResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        restaurantId: null,
        planTier: null,
        effectiveModules: {},
      },
    });
    expect(usageResponse.status).toBe(200);
    await expect(usageResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        cycleStartAt: null,
        cycleEndAt: null,
        meters: [],
      },
    });
    expect(subscriptionMocks.getByRestaurantId).not.toHaveBeenCalled();
    expect(usageMocks.getCurrentUsage).not.toHaveBeenCalled();
  });

  it("serves cached subscription modules without touching the database", async () => {
    const env = createEnv(
      new Map([
        [
          "subscription:restaurant-1",
          {
            isActive: true,
            planTier: "growth",
            moduleOverrides: { analytics: false },
            trialEndsAt: 1780000000000,
          },
        ],
      ]),
    );

    const response = await request("/modules", env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        restaurantId: "restaurant-1",
        planTier: "growth",
        isActive: true,
        trialEndsAt: 1780000000000,
        deploymentMode: "managed",
        effectiveModules: { pos: true, analytics: false },
      },
    });
    expect(env.CACHE_KV.get).toHaveBeenCalledWith(
      "subscription:restaurant-1",
      "json",
    );
    expect(subscriptionMocks.getByRestaurantId).not.toHaveBeenCalled();
    expect(env.CACHE_KV.put).not.toHaveBeenCalled();
    expect(subscriptionMocks.getEffectiveModules).toHaveBeenCalledWith({
      planTier: "growth",
      moduleOverrides: { analytics: false },
    });
  });

  it("preserves cached deployment mode when present", async () => {
    const env = createEnv(
      new Map([
        [
          "subscription:restaurant-1",
          {
            isActive: true,
            planTier: "enterprise",
            moduleOverrides: { pos: true },
            trialEndsAt: null,
            deploymentMode: "byoc",
          },
        ],
      ]),
    );

    const response = await request("/modules", env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        deploymentMode: "byoc",
        trialEndsAt: null,
      },
    });
  });

  it("falls back to empty access when no subscription exists", async () => {
    subscriptionMocks.getByRestaurantId.mockResolvedValue(null);

    const response = await request("/modules");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        restaurantId: "restaurant-1",
        planTier: null,
        isActive: false,
        effectiveModules: {},
      },
    });
    expect(subscriptionMocks.getByRestaurantId).toHaveBeenCalledWith(
      "restaurant-1",
    );
  });

  it("reads subscription modules from the database and writes the cache", async () => {
    const trialEndsAt = new Date("2026-06-08T00:00:00.000Z");
    const env = createEnv();
    const subscription = {
      restaurantId: "restaurant-1",
      isActive: true,
      planTier: "enterprise",
      moduleOverrides: { pos: true },
      trialEndsAt,
      deploymentMode: "byoc",
    };
    subscriptionMocks.getByRestaurantId.mockResolvedValue(subscription);

    const response = await request("/modules", env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        restaurantId: "restaurant-1",
        planTier: "enterprise",
        isActive: true,
        trialEndsAt: trialEndsAt.getTime(),
        deploymentMode: "byoc",
        effectiveModules: { pos: true, analytics: false },
      },
    });
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "subscription:restaurant-1",
      JSON.stringify({
        isActive: true,
        planTier: "enterprise",
        moduleOverrides: { pos: true },
        trialEndsAt: trialEndsAt.getTime(),
        deploymentMode: "byoc",
      }),
      { expirationTtl: 300 },
    );
    expect(subscriptionMocks.getEffectiveModules).toHaveBeenCalledWith(
      subscription,
    );
  });

  it("normalizes nullable subscription fields before caching", async () => {
    const env = createEnv();
    const subscription = {
      restaurantId: "restaurant-1",
      isActive: false,
      planTier: "trial",
      moduleOverrides: null,
      trialEndsAt: null,
      deploymentMode: "managed",
    };
    subscriptionMocks.getByRestaurantId.mockResolvedValue(subscription);

    const response = await request("/modules", env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        planTier: "trial",
        isActive: false,
        trialEndsAt: null,
        deploymentMode: "managed",
      },
    });
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "subscription:restaurant-1",
      JSON.stringify({
        isActive: false,
        planTier: "trial",
        moduleOverrides: {},
        trialEndsAt: null,
        deploymentMode: "managed",
      }),
      { expirationTtl: 300 },
    );
  });

  it("returns current usage for the authenticated restaurant", async () => {
    usageMocks.getCurrentUsage.mockResolvedValue({
      cycleStartAt: 1780000000000,
      cycleEndAt: 1782592000000,
      meters: [{ key: "orders", used: 42, limit: 100 }],
    });

    const response = await request("/usage");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        cycleStartAt: 1780000000000,
        cycleEndAt: 1782592000000,
        meters: [{ key: "orders", used: 42, limit: 100 }],
      },
    });
    expect(usageMocks.getCurrentUsage).toHaveBeenCalledWith("restaurant-1");
  });
});
