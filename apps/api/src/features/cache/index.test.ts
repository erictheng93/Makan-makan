import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const serviceExports = vi.hoisted(() => ({
  createCacheService: vi.fn(),
  CACHE_STRATEGIES: {
    MENU: {
      ttl: 300,
      tags: ["menu"],
      priority: "high",
      staleWhileRevalidate: 60,
    },
  },
  CacheKeys: {
    menu: vi.fn((restaurantId: string) => `menu:${restaurantId}`),
  },
}));

vi.mock("./routes", () => {
  const routes = new Hono();
  routes.get("/probe", (c) => c.json({ success: true, feature: "cache" }));

  return { default: routes };
});

vi.mock("./services/CacheService", () => serviceExports);

import cacheRoutes, {
  CACHE_STRATEGIES,
  CacheKeys,
  cleanupSchema,
  createCacheService,
  invalidateTagsSchema,
} from "./index";

describe("cache feature entrypoint", () => {
  it("exports the default routes and public cache helpers", async () => {
    const response = await cacheRoutes.request("/probe");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      feature: "cache",
    });
    expect(createCacheService).toBe(serviceExports.createCacheService);
    expect(CACHE_STRATEGIES).toBe(serviceExports.CACHE_STRATEGIES);
    expect(CacheKeys.menu("restaurant-1")).toBe("menu:restaurant-1");
  });

  it("re-exports cache validation schemas", async () => {
    expect(
      invalidateTagsSchema.parse({
        tags: ["menu", "restaurant"],
        reason: "refresh public menu",
      }),
    ).toEqual({
      tags: ["menu", "restaurant"],
      reason: "refresh public menu",
    });
    expect(cleanupSchema.parse({})).toEqual({
      maxAge: 3600,
      dryRun: false,
    });
  });
});
