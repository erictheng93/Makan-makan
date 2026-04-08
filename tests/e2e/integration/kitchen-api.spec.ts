/**
 * Kitchen API Integration Tests
 *
 * Tests the Kitchen Display System (KDS) endpoints:
 *   GET  /api/v1/kitchen/:restaurantId/orders
 *   PUT  /api/v1/kitchen/:restaurantId/orders/:orderId/items/:itemId
 *
 * Only role 2 (Chef) may access these routes. All calls hit the real
 * API at localhost:8787 with a real D1 database. No mocking.
 */

import { test, expect } from "@playwright/test";
import {
  RESTAURANT_ID,
  SAKURA_RESTAURANT_ID,
  MENU,
  USERS,
  loginAs,
  createGuestOrder,
  updateOrderStatus,
  cleanupOrder,
} from "./helpers";

const API_URL = "http://localhost:8787";

// KDS response shape: orders are bucketed by status
type KitchenOrder = {
  id: number;
  items?: Array<{ id: number; [key: string]: unknown }>;
  [key: string]: unknown;
};
type KitchenOrdersResponse = {
  pending: KitchenOrder[];
  preparing: KitchenOrder[];
  ready: KitchenOrder[];
  stats: Record<string, unknown>;
};

function findOrderInKds(
  data: KitchenOrdersResponse,
  orderId: number,
): KitchenOrder | undefined {
  return [...data.pending, ...data.preparing, ...data.ready].find(
    (o) => o.id === orderId,
  );
}

test.describe.configure({ mode: "serial" });
test.describe("Kitchen API", () => {
  let createdOrderId: number | undefined;

  test.afterEach(async () => {
    await cleanupOrder(createdOrderId);
    createdOrderId = undefined;
  });

  // ─── GET /api/v1/kitchen/:restaurantId/orders ───────────────────────────────

  test("chef can retrieve the kitchen orders list", async () => {
    const chefAuth = await loginAs(USERS.CHEF);

    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`,
      {
        headers: {
          Authorization: `Bearer ${chefAuth.token}`,
          Origin: API_URL,
        },
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeTruthy();
    // KDS response splits orders into status buckets, not a single list
    expect(Array.isArray(data.data.pending)).toBe(true);
    expect(Array.isArray(data.data.preparing)).toBe(true);
    expect(Array.isArray(data.data.ready)).toBe(true);
    expect(data.data.stats).toBeTruthy();
  });

  // KitchenService.validateChefAccess() allows roles 0 (admin), 1 (owner),
  // 2 (chef), and 3 (service crew). Only cashier (4) and customer (5) are
  // blocked. Owners and service crew get read access by design so they can
  // monitor the kitchen.

  test("owner (role 1) can also access kitchen orders", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);

    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`,
      {
        headers: {
          Authorization: `Bearer ${ownerAuth.token}`,
          Origin: API_URL,
        },
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("cashier (role 4) cannot access kitchen orders → 403", async () => {
    const cashierAuth = await loginAs(USERS.CASHIER);

    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`,
      {
        headers: {
          Authorization: `Bearer ${cashierAuth.token}`,
          Origin: API_URL,
        },
      },
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // ─── PUT /api/v1/kitchen/:restaurantId/orders/:orderId/items/:itemId ────────

  test("chef can mark an order item as 'preparing'", async () => {
    // 1. Create a guest order with two items so there is something for the chef to work on.
    const orderResult = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
      { menuItemId: MENU.GONG_WAN_TANG, quantity: 1 },
    ]);
    createdOrderId = orderResult.data.order.id;
    const orderId = orderResult.data.order.id;

    // 2. Owner confirms the order so it becomes visible on the KDS.
    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(orderId, "confirmed", ownerAuth);

    // 3. Fetch the kitchen orders list as the chef and locate our order.
    const chefAuth = await loginAs(USERS.CHEF);
    const listRes = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`,
      {
        headers: {
          Authorization: `Bearer ${chefAuth.token}`,
          Origin: API_URL,
        },
      },
    );
    expect(listRes.status).toBe(200);

    const listData = await listRes.json();
    expect(listData.success).toBe(true);

    const kitchenOrder = findOrderInKds(
      listData.data as KitchenOrdersResponse,
      orderId,
    );
    expect(kitchenOrder).toBeTruthy();

    const items = kitchenOrder!.items ?? [];
    expect(items.length).toBeGreaterThan(0);

    const firstItem = items[0];
    const itemId = firstItem.id;
    expect(itemId).toBeTruthy();

    // 4. Chef marks the first item as "preparing".
    const updateRes = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders/${orderId}/items/${itemId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${chefAuth.token}`,
          Origin: API_URL,
          "X-CSRF-Token": chefAuth.csrfToken,
          Cookie: chefAuth.csrfCookie,
        },
        body: JSON.stringify({ status: "preparing" }),
      },
    );

    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.success).toBe(true);
    expect(updateData.data).toBeTruthy();
  });

  test("chef can progress an item from 'preparing' to 'ready'", async () => {
    // 1. Create + confirm an order.
    const orderResult = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderId = orderResult.data.order.id;
    const orderId = orderResult.data.order.id;

    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(orderId, "confirmed", ownerAuth);

    // 2. Chef fetches the order and extracts the first item id.
    const chefAuth = await loginAs(USERS.CHEF);
    const listRes = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`,
      {
        headers: {
          Authorization: `Bearer ${chefAuth.token}`,
          Origin: API_URL,
        },
      },
    );
    const listData = await listRes.json();
    const kitchenOrder = findOrderInKds(
      listData.data as KitchenOrdersResponse,
      orderId,
    );
    expect(kitchenOrder).toBeTruthy();
    const itemId = kitchenOrder!.items![0].id;

    // 3. preparing
    const prepRes = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders/${orderId}/items/${itemId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${chefAuth.token}`,
          Origin: API_URL,
          "X-CSRF-Token": chefAuth.csrfToken,
          Cookie: chefAuth.csrfCookie,
        },
        body: JSON.stringify({ status: "preparing" }),
      },
    );
    expect(prepRes.status).toBe(200);

    // 4. ready (second transition — the main gap this test closes)
    const readyRes = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders/${orderId}/items/${itemId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${chefAuth.token}`,
          Origin: API_URL,
          "X-CSRF-Token": chefAuth.csrfToken,
          Cookie: chefAuth.csrfCookie,
        },
        body: JSON.stringify({ status: "ready" }),
      },
    );
    expect(readyRes.status).toBe(200);
    const readyData = await readyRes.json();
    expect(readyData.success).toBe(true);
  });

  // ─── Cross-restaurant isolation ─────────────────────────────────────────────

  test("sakura chef cannot access grandma restaurant's kitchen orders → 403", async () => {
    const sakuraChefAuth = await loginAs(USERS.SAKURA_CHEF);

    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`,
      {
        headers: {
          Authorization: `Bearer ${sakuraChefAuth.token}`,
          Origin: API_URL,
        },
      },
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  test("sakura chef cannot update items in grandma restaurant's order → 403", async () => {
    // Create an order in grandma restaurant.
    const orderResult = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderId = orderResult.data.order.id;
    const orderId = orderResult.data.order.id;

    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(orderId, "confirmed", ownerAuth);

    // Grandma chef fetches items to learn the item id.
    const grandmaChefAuth = await loginAs(USERS.CHEF);
    const listRes = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`,
      {
        headers: {
          Authorization: `Bearer ${grandmaChefAuth.token}`,
          Origin: API_URL,
        },
      },
    );
    const listData = await listRes.json();
    const kitchenOrder = findOrderInKds(
      listData.data as KitchenOrdersResponse,
      orderId,
    );
    expect(kitchenOrder).toBeTruthy();
    const itemId = kitchenOrder!.items![0].id;

    // Sakura chef tries to update the item — should be blocked.
    const sakuraChefAuth = await loginAs(USERS.SAKURA_CHEF);
    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders/${orderId}/items/${itemId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sakuraChefAuth.token}`,
          Origin: API_URL,
          "X-CSRF-Token": sakuraChefAuth.csrfToken,
          Cookie: sakuraChefAuth.csrfCookie,
        },
        body: JSON.stringify({ status: "preparing" }),
      },
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // ─── SSE endpoint authorization ─────────────────────────────────────────────
  // We only verify the HTTP handshake (auth check fires before the stream opens).
  // A full streaming test would need a long-lived EventSource and time out.

  test("cashier cannot open kitchen SSE stream → 403", async () => {
    const cashierAuth = await loginAs(USERS.CASHIER);

    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/events`,
      {
        headers: {
          Authorization: `Bearer ${cashierAuth.token}`,
          Origin: API_URL,
          Accept: "text/event-stream",
        },
      },
    );

    expect(res.status).toBe(403);
    // Drain the body so the connection closes cleanly.
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
  });

  test("sakura chef cannot open grandma kitchen SSE stream → 403", async () => {
    const sakuraChefAuth = await loginAs(USERS.SAKURA_CHEF);

    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/events`,
      {
        headers: {
          Authorization: `Bearer ${sakuraChefAuth.token}`,
          Origin: API_URL,
          Accept: "text/event-stream",
        },
      },
    );

    expect(res.status).toBe(403);
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
  });
});
