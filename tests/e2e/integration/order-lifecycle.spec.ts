/**
 * Order Lifecycle Integration Tests
 *
 * Tests the full order state machine: pending -> confirmed -> preparing -> ready -> delivered -> paid
 * Each status transition is done by the role that has permission for it.
 * All calls hit the real API at localhost:8787.
 */

import { test, expect } from "@playwright/test";
import {
  RESTAURANT_ID,
  MENU,
  USERS,
  createGuestOrder,
  getGuestOrder,
  updateOrderStatus,
  loginAs,
  cleanupOrder,
  getOrder,
} from "./helpers";

test.describe.configure({ mode: "serial" });
test.describe("Order Lifecycle", () => {
  let createdOrderId: number | undefined;

  test.afterEach(async () => {
    await cleanupOrder(createdOrderId);
    createdOrderId = undefined;
  });

  test("progresses through all statuses: pending -> confirmed -> preparing -> ready -> delivered -> paid", async () => {
    // 1. Create a guest order (starts as pending)
    const result = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderId = result.data.order.id;
    const orderId = result.data.order.id;
    const guestToken = result.data.guestToken;

    // 2. Owner confirms the order (role 1 -> "confirmed")
    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(orderId, "confirmed", ownerAuth);

    // Verify via guest token
    let detail = await getGuestOrder(orderId, guestToken);
    expect(String(detail.data.order.status).toLowerCase()).toMatch(
      /confirmed|1/,
    );

    // 3. Chef starts preparing (role 2 -> "preparing")
    const chefAuth = await loginAs(USERS.CHEF);
    await updateOrderStatus(orderId, "preparing", chefAuth);

    detail = await getGuestOrder(orderId, guestToken);
    expect(String(detail.data.order.status).toLowerCase()).toMatch(
      /preparing|2/,
    );

    // 4. Chef marks ready (role 2 -> "ready")
    await updateOrderStatus(orderId, "ready", chefAuth);

    detail = await getGuestOrder(orderId, guestToken);
    expect(String(detail.data.order.status).toLowerCase()).toMatch(/ready|3/);

    // 5. Service crew delivers (role 3 -> "delivered")
    const serviceAuth = await loginAs(USERS.SERVICE);
    await updateOrderStatus(orderId, "delivered", serviceAuth);

    detail = await getGuestOrder(orderId, guestToken);
    expect(String(detail.data.order.status).toLowerCase()).toMatch(
      /delivered|4/,
    );

    // 6. Admin marks paid (role 0 has all permissions; cashier role 4 only has "confirmed")
    const adminAuth = await loginAs(USERS.ADMIN);
    await updateOrderStatus(orderId, "paid", adminAuth);

    // Final verification
    detail = await getGuestOrder(orderId, guestToken);
    expect(String(detail.data.order.status).toLowerCase()).toMatch(/paid|5/);
  });

  test("owner can cancel a pending order", async () => {
    const result = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.DONG_GUA_CHA, quantity: 1 },
    ]);
    createdOrderId = result.data.order.id;
    const orderId = result.data.order.id;

    // Owner cancels
    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(orderId, "cancelled", ownerAuth);

    // Verify cancelled
    const detail = await getGuestOrder(orderId, result.data.guestToken);
    expect(String(detail.data.order.status).toLowerCase()).toMatch(
      /cancelled|6/,
    );
  });

  test("chef cannot set status to confirmed (wrong role)", async () => {
    const result = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderId = result.data.order.id;

    const chefAuth = await loginAs(USERS.CHEF);

    // Chef role 2 can only set "preparing" and "ready", not "confirmed"
    const res = await fetch(
      `http://localhost:8787/api/v1/orders/${result.data.order.id}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${chefAuth.token}`,
          Origin: "http://localhost:8787",
          "X-CSRF-Token": chefAuth.csrfToken,
          Cookie: chefAuth.csrfCookie,
        },
        body: JSON.stringify({ status: "confirmed" }),
      },
    );

    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  test("service crew cannot set status to preparing (wrong role)", async () => {
    const result = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderId = result.data.order.id;

    // First confirm the order so we can try to set preparing
    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(result.data.order.id, "confirmed", ownerAuth);

    const serviceAuth = await loginAs(USERS.SERVICE);

    // Service role 3 can only set "delivered"
    const res = await fetch(
      `http://localhost:8787/api/v1/orders/${result.data.order.id}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceAuth.token}`,
          Origin: "http://localhost:8787",
          "X-CSRF-Token": serviceAuth.csrfToken,
          Cookie: serviceAuth.csrfCookie,
        },
        body: JSON.stringify({ status: "preparing" }),
      },
    );

    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  test("authenticated user can view order details", async () => {
    const result = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.GONG_WAN_TANG, quantity: 2 },
    ]);
    createdOrderId = result.data.order.id;

    const ownerAuth = await loginAs(USERS.OWNER);
    const detail = await getOrder(result.data.order.id, ownerAuth);

    expect(detail.success).toBe(true);
    expect(detail.data).toBeTruthy();
  });
});
