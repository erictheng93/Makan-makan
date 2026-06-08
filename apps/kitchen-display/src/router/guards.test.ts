import { describe, expect, it } from "vitest";
import type { RouteLocationNormalized } from "vue-router";
import type { useAuthStore } from "@/stores/auth";
import { getKitchenRouteRedirect } from "./guards";

type AuthStore = ReturnType<typeof useAuthStore>;

function route(overrides: Partial<any> = {}) {
  return {
    fullPath: "/kitchen/42",
    meta: { requiresAuth: true, requiredRole: 2 },
    params: { restaurantId: "42" },
    ...overrides,
  } as unknown as RouteLocationNormalized;
}

function auth(overrides: Partial<any> = {}) {
  return {
    isAuthenticated: true,
    user: { role: 2 },
    restaurantId: 42,
    ...overrides,
  } as AuthStore;
}

describe("kitchen route guards", () => {
  it("allows public routes", () => {
    expect(
      getKitchenRouteRedirect(
        route({ meta: { requiresAuth: false }, params: {} }),
        auth({ isAuthenticated: false }),
      ),
    ).toBeNull();
  });

  it("redirects unauthenticated protected routes to login", () => {
    expect(
      getKitchenRouteRedirect(route(), auth({ isAuthenticated: false })),
    ).toEqual({
      path: "/login",
      query: { redirect: "/kitchen/42" },
    });
  });

  it("blocks users without the required chef role", () => {
    expect(
      getKitchenRouteRedirect(route(), auth({ user: { role: 1 } })),
    ).toEqual({ path: "/unauthorized" });
  });

  it("blocks access to another restaurant kitchen route", () => {
    expect(
      getKitchenRouteRedirect(route(), auth({ restaurantId: 99 })),
    ).toEqual({ path: "/unauthorized" });
  });
});
