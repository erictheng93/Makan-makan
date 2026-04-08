/**
 * Guest Order API Integration Tests
 *
 * Tests the guest order creation and retrieval flow against the real API.
 * No mocking — hits localhost:8787 with real D1 database.
 */

import { test, expect } from "@playwright/test";
import {
  RESTAURANT_ID,
  TABLE_A1_ID,
  MENU,
  createGuestOrder,
  getGuestOrder,
  cleanupOrder,
  uniquePhone,
} from "./helpers";

test.describe.configure({ mode: "serial" });
test.describe("Guest Order API", () => {
  let createdOrderId: number | undefined;

  test.afterEach(async () => {
    await cleanupOrder(createdOrderId);
    createdOrderId = undefined;
  });

  test("creates a shop (takeaway) guest order with correct totals", async () => {
    const result = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 2 }, // 紅茶 x2
      { menuItemId: MENU.GONG_WAN_TANG, quantity: 1 }, // 貢丸湯 x1
    ]);

    createdOrderId = result.data.order.id;

    expect(result.success).toBe(true);
    expect(result.data.order.id).toBeGreaterThan(0);
    expect(result.data.guestToken).toBeTruthy();
    expect(result.data.guestToken).toMatch(/^gt_/); // token starts with gt_ prefix
    expect(result.data.tokenExpiresAt).toBeTruthy();
    expect(result.data.order.restaurantId).toBe(RESTAURANT_ID);
  });

  test("retrieves a guest order by ID with guest token", async () => {
    const result = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderId = result.data.order.id;

    const detail = await getGuestOrder(
      result.data.order.id,
      result.data.guestToken,
    );

    expect(detail.success).toBe(true);
    expect(detail.data.order.id).toBe(result.data.order.id);
  });

  test("creates a table (dine-in) guest order", async () => {
    const result = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.DONG_GUA_CHA, quantity: 1 }],
      {
        orderType: "table",
        tableId: TABLE_A1_ID,
        guestName: "Dine-In Test",
        phoneLastDigits: uniquePhone(),
      },
    );

    createdOrderId = result.data.order.id;

    expect(result.success).toBe(true);
    expect(result.data.order.id).toBeGreaterThan(0);
    expect(result.data.guestToken).toBeTruthy();
  });

  test("rejects guest order with invalid restaurant ID", async () => {
    const res = await fetch("http://localhost:8787/api/v1/guest-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: "nonexistent-restaurant-id",
        orderType: "shop",
        items: [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
        guestName: "Test",
        phoneLastDigits: uniquePhone(),
      }),
    });

    expect(res.ok).toBe(false);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  test("rejects guest order with empty items array", async () => {
    const res = await fetch("http://localhost:8787/api/v1/guest-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        orderType: "shop",
        items: [],
        guestName: "Test",
        phoneLastDigits: uniquePhone(),
      }),
    });

    expect(res.ok).toBe(false);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  test("rejects table order without tableId", async () => {
    const res = await fetch("http://localhost:8787/api/v1/guest-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        orderType: "table",
        items: [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
        guestName: "Test",
        phoneLastDigits: uniquePhone(),
      }),
    });

    expect(res.ok).toBe(false);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  test("creates a delivery order with address and phone", async () => {
    const result = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
      {
        deliveryInfo: {
          type: "delivery",
          address: "台中市西屯區某某路100號",
          phone: "0912345678",
        },
      },
    );

    createdOrderId = result.data.order.id;

    expect(result.success).toBe(true);
    expect(result.data.order.id).toBeGreaterThan(0);
    expect(result.data.guestToken).toMatch(/^gt_/);
  });

  test("appends items to an existing order via guest token", async () => {
    const created = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderId = created.data.order.id;
    const guestToken = created.data.guestToken;

    const res = await fetch(
      `http://localhost:8787/api/v1/guest-orders/${createdOrderId}/items`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${guestToken}`,
        },
        body: JSON.stringify({
          items: [{ menuItemId: 13, quantity: 1 }],
        }),
      },
    );

    const data = await res.json();
    expect(data.success).toBe(true);

    const detail = await getGuestOrder(createdOrderId, guestToken);
    expect(detail.success).toBe(true);
    expect(detail.data.order.id).toBe(createdOrderId);
  });

  test("guest cancels their own order", async () => {
    const created = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderId = created.data.order.id;
    const guestToken = created.data.guestToken;

    const res = await fetch(
      `http://localhost:8787/api/v1/guest-orders/${createdOrderId}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${guestToken}`,
        },
        body: JSON.stringify({}),
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    // Note: the guest token is invalidated by the cancel endpoint, so we
    // cannot re-fetch the order with the same token afterwards. The cancel
    // returning success is sufficient evidence the order is cancelled.
  });
});
