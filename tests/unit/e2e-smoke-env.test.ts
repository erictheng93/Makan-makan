import { afterEach, describe, expect, it, vi } from "vitest";
import {
  firstAvailableMenuItemId,
  isLocalSmokeApi,
  localAdminUrlFallback,
  resolveLocalSmokeFixtureIds,
} from "../e2e/smoke/smoke-env";

describe("smoke env helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows fallback discovery only for local API URLs", () => {
    expect(isLocalSmokeApi("http://localhost:8787")).toBe(true);
    expect(isLocalSmokeApi("http://127.0.0.1:8787")).toBe(true);
    expect(isLocalSmokeApi("https://api-staging.makanmasak.com")).toBe(false);
    expect(localAdminUrlFallback("http://localhost:8787")).toBe(
      "http://localhost:3001",
    );
    expect(localAdminUrlFallback("https://api.makanmasak.com")).toBeUndefined();
  });

  it("picks the first available menu item from supported menu shapes", () => {
    expect(
      firstAvailableMenuItemId({
        success: true,
        data: {
          menuItems: [
            { id: 1, isAvailable: false },
            { id: "2", isAvailable: true },
          ],
        },
      }),
    ).toBe(2);

    expect(
      firstAvailableMenuItemId({
        success: true,
        data: {
          categories: [{ items: [{ id: 3, isAvailable: 1 }] }],
        },
      }),
    ).toBe(3);
  });

  it("does not derive fixture ids for non-local smoke targets", async () => {
    const fixtureIds = await resolveLocalSmokeFixtureIds({
      apiUrl: "https://api-staging.makanmasak.com",
      authUsername: "grandmaShop",
      authPassword: "password123",
      restaurantId: "explicit-restaurant",
    });

    expect(fixtureIds).toEqual({
      restaurantId: "explicit-restaurant",
      menuItemId: undefined,
    });
  });

  it("keeps explicit skip inputs when local discovery login fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unauthorized", { status: 401 })),
    );

    await expect(
      resolveLocalSmokeFixtureIds({
        apiUrl: "http://localhost:8787",
        authUsername: "grandmaShop",
        authPassword: "password123",
      }),
    ).resolves.toEqual({
      restaurantId: undefined,
      menuItemId: undefined,
    });
  });

  it("does not select a local restaurant that has guest orders disabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/api/v1/auth/login")) {
          return Response.json({
            success: true,
            data: {
              token: "token",
              user: { restaurantId: "restaurant-disabled" },
            },
          });
        }

        if (url.endsWith("/api/v1/restaurants/restaurant-disabled")) {
          return Response.json({
            success: true,
            data: {
              settings: { allowGuestOrders: false },
            },
          });
        }

        if (url.endsWith("/api/v1/menu/restaurant-disabled")) {
          return Response.json({
            success: true,
            data: { menuItems: [{ id: 1, isAvailable: true }] },
          });
        }

        return new Response("not found", { status: 404 });
      }),
    );

    await expect(
      resolveLocalSmokeFixtureIds({
        apiUrl: "http://localhost:8787",
        authUsername: "grandmaShop",
        authPassword: "password123",
      }),
    ).resolves.toEqual({
      restaurantId: undefined,
      menuItemId: undefined,
    });
  });
});
