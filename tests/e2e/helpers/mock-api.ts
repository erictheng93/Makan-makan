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
}

export async function mockMenuAPI(page: Page) {
  // Full menu (GET /menu/:restaurantId)
  await page.route(new RegExp(`${API}/menu/[^/]+$`), (route) => {
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
  await page.route(new RegExp(`${API}/menu/.+/items`), (route) => {
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
  await page.route(new RegExp(`${API}/menu/.+/categories`), (route) => {
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

  await page.route(new RegExp(`${API}/tables/qr/.+`), (route) =>
    route.fulfill(json({ success: true, data: TABLE })),
  );

  await page.route(new RegExp(`${API}/seats/qr/.+`), (route) =>
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

  // Guest order
  await page.route(`${API}/orders/guest`, (route) =>
    route.fulfill(
      json({
        success: true,
        data: { ...order, id: "order-guest", orderNumber: "ORD-GUEST-001" },
      }),
    ),
  );

  // Active orders
  await page.route(`${API}/orders/active`, (route) =>
    route.fulfill(json({ success: true, data: [order] })),
  );

  // Order by ID
  await page.route(new RegExp(`${API}/orders/[^/]+$`), (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill(json({ success: true, data: order }));
    } else if (method === "PUT") {
      route.fulfill(json({ success: true, data: { ...order, status: 2 } }));
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
  const order = createMockOrder({ status: 0 });

  await page.route(new RegExp(`${API}/kitchen/.+/orders`), (route) =>
    route.fulfill(
      json({
        success: true,
        data: [
          order,
          createMockOrder({
            id: "order-2",
            orderNumber: "ORD-002",
            status: 2,
          }),
          createMockOrder({
            id: "order-3",
            orderNumber: "ORD-003",
            status: 3,
          }),
        ],
      }),
    ),
  );

  // Update item status
  await page.route(
    new RegExp(`${API}/kitchen/.+/orders/.+/items/.+`),
    (route) => route.fulfill(json({ success: true, data: { status: 2 } })),
  );

  // SSE events — serve as text/event-stream
  await page.route(new RegExp(`${API}/kitchen/.+/events`), (route) =>
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
  await page.route(new RegExp(`${API}/kitchen/.+/connections`), (route) =>
    route.fulfill(json({ success: true, data: { activeConnections: 1 } })),
  );
}

// ---------------------------------------------------------------------------
// POS
// ---------------------------------------------------------------------------

export async function mockPOSAPI(page: Page) {
  await page.route(new RegExp(`${API}/pos/registers`), (route) => {
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

  await page.route(new RegExp(`${API}/pos/shifts`), (route) => {
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

  await page.route(new RegExp(`${API}/pos/receipts`), (route) =>
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
  await page.route(new RegExp(`${API}/waiting-list`), (route) => {
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

  await page.route(new RegExp(`${API}/reservations`), (route) => {
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
  await page.route(new RegExp(`${API}/sse/events`), (route) =>
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
