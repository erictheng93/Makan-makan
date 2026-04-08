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
  MENU,
  USERS,
  loginAs,
  createGuestOrder,
  updateOrderStatus,
  cleanupOrder,
} from "./helpers";

const API_URL = "http://localhost:8787";

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
    expect(Array.isArray(data.data.orders)).toBe(true);
  });

  test("owner (role 1) cannot access kitchen orders → 403", async () => {
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

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  test("service crew (role 3) cannot access kitchen orders → 403", async () => {
    const serviceAuth = await loginAs(USERS.SERVICE);

    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`,
      {
        headers: {
          Authorization: `Bearer ${serviceAuth.token}`,
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

    const kitchenOrders: Array<{
      id: number;
      items?: Array<{ id: number; [key: string]: unknown }>;
      [key: string]: unknown;
    }> = listData.data.orders;

    const kitchenOrder = kitchenOrders.find((o) => o.id === orderId);
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
});
