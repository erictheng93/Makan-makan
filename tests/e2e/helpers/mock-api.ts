/**
 * Centralized API Mocking for E2E Tests
 *
 * Provides per-domain mock functions that intercept API calls via page.route().
 * All mock data comes from ./personas.ts for consistency.
 */

import type { Page } from "@playwright/test";
import {
  PERSONAS,
  RESTAURANT,
  TABLE,
  MENU_CATEGORIES,
  MENU_ITEMS,
  createMockOrder,
  type Persona,
} from "./personas";

const API = "**/api/v1";
const API_RE = "/api/v1"; // regex-safe variant (no ** glob prefix)

function json(data: any, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function mockAuthAPI(page: Page, persona: Persona) {
  await page.route(`${API}/auth/login`, (route) => {
    if (route.request().method() === "POST") {
      route.fulfill(
        json({
          success: true,
          data: {
            user: {
              id: persona.id,
              username: persona.username,
              fullName: persona.fullName,
              email: persona.email,
              role: persona.role,
              restaurantId: persona.restaurantId,
            },
            token: persona.token,
            refreshToken: persona.refreshToken,
          },
        }),
      );
    } else {
      route.continue();
    }
  });

  await page.route(`${API}/auth/me`, (route) =>
    route.fulfill(
      json({
        success: true,
        data: {
          id: persona.id,
          username: persona.username,
          fullName: persona.fullName,
          email: persona.email,
          role: persona.role,
          restaurantId: persona.restaurantId,
        },
      }),
    ),
  );

  await page.route(`${API}/auth/refresh`, (route) =>
    route.fulfill(
      json({
        success: true,
        data: { token: persona.token, refreshToken: persona.refreshToken },
      }),
    ),
  );

  await page.route(`${API}/auth/guest-token`, (route) =>
    route.fulfill(
      json({
        success: true,
        data: { token: "mock-guest-token", expiresIn: 3600 },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Restaurant & Menu
// ---------------------------------------------------------------------------

export async function mockRestaurantAPI(page: Page) {
  await page.route(`${API}/restaurants/${RESTAURANT.id}`, (route) =>
    route.fulfill(json({ success: true, data: RESTAURANT })),
  );

  await page.route(`${API}/restaurants`, (route) =>
    route.fulfill(
      json({ success: true, data: [RESTAURANT], pagination: { total: 1 } }),
    ),
  );

  // Restaurant discovery search (used by ManualInputModal)
  await page.route(new RegExp(`${API_RE}/discovery/restaurants`), (route) =>
    route.fulfill(
      json({
        success: true,
        data: {
          results: [
            {
              restaurantId: RESTAURANT.id,
              name: RESTAURANT.name,
              type: null,
              district: null,
              imageUrl: RESTAURANT.logoUrl,
            },
          ],
        },
      }),
    ),
  );
}

export async function mockMenuAPI(page: Page) {
  // Full menu (GET /menu/:restaurantId)
  await page.route(new RegExp(`${API_RE}/menu/[^/]+$`), (route) => {
    if (route.request().method() === "GET") {
      route.fulfill(
        json({
          success: true,
          data: {
            categories: MENU_CATEGORIES,
            menuItems: MENU_ITEMS,
          },
        }),
      );
    } else {
      route.continue();
    }
  });

  // Menu item CRUD
  await page.route(new RegExp(`${API_RE}/menu/.+/items`), (route) => {
    const method = route.request().method();
    if (method === "POST") {
      route.fulfill(
        json({ success: true, data: { id: "item-new", ...MENU_ITEMS[0] } }),
      );
    } else {
      route.continue();
    }
  });

  // Category endpoints
  await page.route(new RegExp(`${API_RE}/menu/.+/categories`), (route) => {
    if (route.request().method() === "POST") {
      route.fulfill(
        json({ success: true, data: { id: "cat-new", name: "New Cat" } }),
      );
    } else {
      route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// Tables & Seats
// ---------------------------------------------------------------------------

export async function mockTableAPI(page: Page) {
  await page.route(`${API}/tables`, (route) =>
    route.fulfill(
      json({
        success: true,
        data: [
          TABLE,
          { ...TABLE, id: "table-2", number: "A-2", status: "occupied" },
          { ...TABLE, id: "table-3", number: "B-1", status: "reserved" },
        ],
      }),
    ),
  );

  await page.route(new RegExp(`${API_RE}/tables/qr/.+`), (route) =>
    route.fulfill(json({ success: true, data: TABLE })),
  );

  await page.route(new RegExp(`${API_RE}/seats/qr/.+`), (route) =>
    route.fulfill(
      json({
        success: true,
        data: {
          id: "seat-1",
          tableId: TABLE.id,
          tableName: TABLE.number,
          restaurantId: RESTAURANT.id,
        },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function mockOrderAPI(page: Page) {
  const order = createMockOrder();

  // Create order
  await page.route(`${API}/orders`, (route) => {
    const method = route.request().method();
    if (method === "POST") {
      route.fulfill(
        json({
          success: true,
          data: { ...order, id: "order-new", orderNumber: "ORD-20260330-NEW" },
        }),
      );
    } else if (method === "GET") {
      route.fulfill(
        json({
          success: true,
          data: [order],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
      );
    } else {
      route.continue();
    }
  });

  // Guest order (dine-in without login)
  const guestOrder = {
    ...order,
    id: "order-guest",
    orderNumber: "ORD-GUEST-001",
  };

  await page.route(`${API}/guest-orders`, (route) => {
    if (route.request().method() === "POST") {
      route.fulfill(
        json({
          success: true,
          data: {
            order: guestOrder,
            guestToken: "mock-guest-token",
            tokenExpiresAt: "2099-01-01T00:00:00Z",
          },
        }),
      );
    } else {
      route.continue();
    }
  });

  // Guest order by ID (for tracking page when guest_auth_token is set)
  await page.route(new RegExp(`${API_RE}/guest-orders/[^/]+$`), (route) => {
    if (route.request().method() === "GET") {
      route.fulfill(json({ success: true, data: guestOrder }));
    } else {
      route.continue();
    }
  });

  // Active orders
  await page.route(`${API}/orders/active`, (route) =>
    route.fulfill(json({ success: true, data: [order] })),
  );

  // Order by ID
  await page.route(new RegExp(`${API_RE}/orders/[^/]+$`), (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill(json({ success: true, data: order }));
    } else if (method === "PUT") {
      route.fulfill(
        json({ success: true, data: { ...order, status: "preparing" } }),
      );
    } else if (method === "DELETE") {
      route.fulfill(json({ success: true, message: "Order cancelled" }));
    } else {
      route.continue();
    }
  });

  // Order stats
  await page.route(`${API}/orders/stats`, (route) =>
    route.fulfill(
      json({
        success: true,
        data: {
          totalOrders: 42,
          totalRevenue: 756000,
          averageOrderValue: 18000,
          completionRate: 0.95,
        },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Kitchen
// ---------------------------------------------------------------------------

export async function mockKitchenAPI(page: Page) {
  const order = createMockOrder({ status: "pending" });

  await page.route(new RegExp(`${API_RE}/kitchen/.+/orders`), (route) =>
    route.fulfill(
      json({
        success: true,
        data: [
          order,
          createMockOrder({
            id: "order-2",
            orderNumber: "ORD-002",
            status: "preparing",
          }),
          createMockOrder({
            id: "order-3",
            orderNumber: "ORD-003",
            status: "ready",
          }),
        ],
      }),
    ),
  );

  // Update item status
  await page.route(
    new RegExp(`${API_RE}/kitchen/.+/orders/.+/items/.+`),
    (route) =>
      route.fulfill(json({ success: true, data: { status: "preparing" } })),
  );

  // SSE events — serve as text/event-stream
  await page.route(new RegExp(`${API_RE}/kitchen/.+/events`), (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: 'data: {"type":"heartbeat","timestamp":' + Date.now() + "}\n\n",
    }),
  );

  // Connection status
  await page.route(new RegExp(`${API_RE}/kitchen/.+/connections`), (route) =>
    route.fulfill(json({ success: true, data: { activeConnections: 1 } })),
  );
}

// ---------------------------------------------------------------------------
// POS
// ---------------------------------------------------------------------------

export async function mockPOSAPI(page: Page) {
  await page.route(new RegExp(`${API_RE}/pos/registers`), (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill(
        json({
          success: true,
          data: [
            {
              id: "reg-1",
              name: "Register 1",
              status: "active",
              balance: 500000,
            },
          ],
        }),
      );
    } else if (method === "POST") {
      route.fulfill(
        json({
          success: true,
          data: { id: "reg-1", name: "Register 1", status: "active" },
        }),
      );
    } else {
      route.continue();
    }
  });

  await page.route(new RegExp(`${API_RE}/pos/shifts`), (route) => {
    const method = route.request().method();
    if (method === "POST") {
      route.fulfill(
        json({
          success: true,
          data: {
            id: "shift-1",
            startTime: new Date().toISOString(),
            startingCash: 100000,
          },
        }),
      );
    } else {
      route.continue();
    }
  });

  await page.route(new RegExp(`${API_RE}/pos/receipts`), (route) =>
    route.fulfill(
      json({
        success: true,
        data: { receiptId: "rcpt-1", printed: true },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Queue & Waiting List
// ---------------------------------------------------------------------------

export async function mockQueueAPI(page: Page) {
  await page.route(new RegExp(`${API_RE}/waiting-list`), (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill(
        json({
          success: true,
          data: [
            {
              id: "wl-1",
              customerName: "Wang",
              customerPhone: "0911111111",
              partySize: 4,
              status: "waiting",
              createdAt: new Date().toISOString(),
            },
          ],
          pagination: { total: 1 },
        }),
      );
    } else if (method === "POST") {
      route.fulfill(
        json({
          success: true,
          data: { id: "wl-new", status: "waiting", position: 2 },
        }),
      );
    } else {
      route.continue();
    }
  });

  await page.route(new RegExp(`${API_RE}/reservations`), (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill(
        json({ success: true, data: [], pagination: { total: 0 } }),
      );
    } else if (method === "POST") {
      route.fulfill(
        json({
          success: true,
          data: {
            id: "res-new",
            confirmationCode: "ABC123",
            status: "pending",
          },
        }),
      );
    } else {
      route.continue();
    }
  });
}

// ---------------------------------------------------------------------------
// SSE (Admin Dashboard)
// ---------------------------------------------------------------------------

export async function mockSSE(page: Page) {
  await page.route(new RegExp(`${API_RE}/sse/events`), (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: 'data: {"type":"heartbeat","timestamp":' + Date.now() + "}\n\n",
    }),
  );
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function mockAnalyticsAPI(page: Page) {
  const dashboardData = {
    todayOrders: 42,
    todayRevenue: 756000,
    averageOrderValue: 18000,
    completionRate: 0.95,
  };

  await page.route(`${API}/analytics/dashboard`, (route) =>
    route.fulfill(json({ success: true, data: dashboardData })),
  );

  await page.route(`${API}/analytics/revenue`, (route) =>
    route.fulfill(
      json({ success: true, data: { total: 756000, trend: 0.12 } }),
    ),
  );

  await page.route(`${API}/analytics/products`, (route) =>
    route.fulfill(
      json({
        success: true,
        data: {
          topItems: MENU_ITEMS.slice(0, 3).map((i) => ({
            ...i,
            orderCount: 10,
          })),
        },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Admin Auth Pre-seeding
// ---------------------------------------------------------------------------

/**
 * Build a fake but well-formed JWT (header.payload.signature) with exp 24h
 * out so that the admin/kitchen apps' isTokenExpired() check passes without
 * triggering a refresh + redirect-to-login loop.
 *
 * Not signed correctly — only valid for tests where token decoding/expiry is
 * the only check the client performs.
 */
function buildFakeJwt(persona: Persona): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    id: persona.id,
    username: persona.username,
    role: persona.role,
    restaurantId: persona.restaurantId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  };
  const b64 = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${b64(header)}.${b64(payload)}.fake-signature`;
}

/**
 * Pre-seed the admin dashboard's localStorage auth state so that protected
 * routes load without a login redirect.  Call this BEFORE page.goto().
 *
 * Admin auth store keys: auth_token, auth_user, auth_refresh_token
 * isAuthenticated = computed(() => !!user.value && !!token.value)
 *
 * The token must be a well-formed JWT with a future exp claim, otherwise
 * the router's isTokenExpired() check fires refresh on every navigation,
 * and refresh requires auth_refresh_token to even attempt the call.
 */
export async function preAuthAdmin(page: Page, persona: Persona) {
  const fakeJwt = buildFakeJwt(persona);
  await page.addInitScript(
    ({ token, user }: { token: string; user: object }) => {
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_refresh_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
    },
    {
      token: fakeJwt,
      user: {
        id: persona.id,
        username: persona.username,
        fullName: persona.fullName,
        email: persona.email,
        role: persona.role,
        restaurantId: persona.restaurantId,
      },
    },
  );
}

/**
 * Pre-seed the kitchen display app's localStorage auth state.  Call BEFORE page.goto().
 *
 * Kitchen auth store keys: kitchen_auth_token, kitchen_user
 * The router calls checkAuth() on init → reads localStorage → sets token+user → isAuthenticated=true.
 * The fake token will be seen as expired (isTokenExpired returns true for non-JWT strings)
 * which triggers a refresh call — mockAuthAPI must be set up first so /auth/refresh is intercepted.
 */
export async function preAuthKitchen(page: Page, persona: Persona) {
  await page.addInitScript(
    ({ token, user }: { token: string; user: object }) => {
      localStorage.setItem("kitchen_auth_token", token);
      localStorage.setItem("kitchen_user", JSON.stringify(user));
    },
    {
      token: persona.token,
      user: {
        id: persona.id,
        username: persona.username,
        fullName: persona.fullName,
        email: persona.email,
        role: persona.role,
        restaurantId: persona.restaurantId,
        permissions: [] as string[],
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Convenience: Mock Everything
// ---------------------------------------------------------------------------

export async function mockAllAPIs(page: Page, persona: Persona) {
  await mockAuthAPI(page, persona);
  await mockRestaurantAPI(page);
  await mockMenuAPI(page);
  await mockTableAPI(page);
  await mockOrderAPI(page);
  await mockKitchenAPI(page);
  await mockPOSAPI(page);
  await mockQueueAPI(page);
  await mockSSE(page);
  await mockAnalyticsAPI(page);
}
