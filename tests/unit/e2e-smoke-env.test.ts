import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLocalManagementToken,
  firstAvailableMenuItemId,
  isLocalSmokeApi,
  localAdminUrlFallback,
  localManagementApiUrlFallback,
  localManagementPortalUrlFallback,
  localOnboardingUrlFallback,
  resolveLocalSmokeFixtureIds,
  smokeLogin,
} from "../e2e/smoke/smoke-env";

describe("smoke env helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows fallback discovery only for local API URLs", () => {
    expect(isLocalSmokeApi("http://localhost:8787")).toBe(true);
    expect(isLocalSmokeApi("http://127.0.0.1:8787")).toBe(true);
    expect(isLocalSmokeApi("https://api.makanmasak.com")).toBe(false);
    expect(localAdminUrlFallback("http://localhost:8787")).toBe(
      "http://localhost:3001",
    );
    expect(localAdminUrlFallback("http://127.0.0.1:8787")).toBe(
      "http://localhost:3001",
    );
    expect(localAdminUrlFallback("https://api.makanmasak.com")).toBeUndefined();
    expect(localManagementApiUrlFallback("http://localhost:8787")).toBe(
      "http://localhost:8789/api/v1",
    );
    expect(localManagementPortalUrlFallback("http://localhost:8787")).toBe(
      "http://localhost:3010",
    );
    expect(localOnboardingUrlFallback("http://localhost:8787")).toBe(
      "http://localhost:3011",
    );
    expect(
      localManagementApiUrlFallback("https://api.makanmasak.com"),
    ).toBeUndefined();
    expect(
      localManagementPortalUrlFallback("https://api.makanmasak.com"),
    ).toBeUndefined();
    expect(
      localOnboardingUrlFallback("https://api.makanmasak.com"),
    ).toBeUndefined();
  });

  it("creates a local management JWT only for local management API URLs", () => {
    const token = createLocalManagementToken({
      managementApiUrl: "http://localhost:8789/api/v1",
      jwtSecret: "test-secret",
      now: 1780920000,
    });

    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const payload = JSON.parse(
      Buffer.from(token!.split(".")[1], "base64url").toString("utf8"),
    );
    expect(payload).toMatchObject({
      id: "workflow-admin",
      email: "workflow-admin@example.test",
      exp: 1781006400,
    });
    expect(
      createLocalManagementToken({
        managementApiUrl: "https://manage-api.makanmasak.com/api/v1",
        jwtSecret: "test-secret",
      }),
    ).toBeUndefined();
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

  it("keeps the CSRF token returned by smoke login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            success: true,
            data: {
              token: "token",
              refreshToken: "refresh",
              user: { restaurantId: "restaurant-1" },
            },
          },
          { headers: { "X-CSRF-Token": "a".repeat(64) } },
        ),
      ),
    );

    await expect(
      smokeLogin("http://localhost:8787", "owner", "password"),
    ).resolves.toEqual({
      token: "token",
      refreshToken: "refresh",
      user: { restaurantId: "restaurant-1" },
      csrfToken: "a".repeat(64),
    });
  });

  it("does not derive fixture ids for non-local smoke targets", async () => {
    const fixtureIds = await resolveLocalSmokeFixtureIds({
      apiUrl: "https://api.makanmasak.com",
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

  it("discovers a local public restaurant fixture when no env or login fixture is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/api/v1/restaurants")) {
          return Response.json({
            success: true,
            data: [
              { id: "restaurant-disabled" },
              { id: "restaurant-empty" },
              { id: "019469a0-0001-7000-8000-000000000001" },
            ],
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

        if (url.endsWith("/api/v1/restaurants/restaurant-empty")) {
          return Response.json({
            success: true,
            data: {
              settings: { allowGuestOrders: true },
            },
          });
        }

        if (url.endsWith("/api/v1/menu/restaurant-empty")) {
          return Response.json({
            success: true,
            data: { menuItems: [{ id: 1, isAvailable: false }] },
          });
        }

        if (
          url.endsWith(
            "/api/v1/restaurants/019469a0-0001-7000-8000-000000000001",
          )
        ) {
          return Response.json({
            success: true,
            data: {
              settings: { allowGuestOrders: true },
            },
          });
        }

        if (url.endsWith("/api/v1/menu/019469a0-0001-7000-8000-000000000001")) {
          return Response.json({
            success: true,
            data: { menuItems: [{ id: "42", isAvailable: true }] },
          });
        }

        return new Response("not found", { status: 404 });
      }),
    );

    await expect(
      resolveLocalSmokeFixtureIds({
        apiUrl: "http://localhost:8787",
      }),
    ).resolves.toEqual({
      restaurantId: "019469a0-0001-7000-8000-000000000001",
      menuItemId: 42,
      tableId: 1,
    });
  });
});
