/**
 * H3 / X2 blocker skeleton: customer cancellation while kitchen is preparing.
 *
 * This file intentionally calls the real API. The release oracle is that an
 * order in `preparing` cannot be silently cancelled by the guest path; the API
 * must return a defined conflict/rejection and preserve order state.
 */

import { test, expect } from "@playwright/test";
import {
  RESTAURANT_ID,
  MENU,
  USERS,
  createGuestOrder,
  getOrder,
  loginAs,
  updateOrderStatus,
  cleanupOrder,
} from "../../integration/helpers";

const API_URL = "http://localhost:8787";

test.describe.configure({ mode: "serial" });
test.describe("H3 / X2 cancel during kitchen prep", () => {
  let createdOrderId: number | undefined;

  test.afterEach(async () => {
    await cleanupOrder(createdOrderId);
    createdOrderId = undefined;
  });

  test("guest cancel is rejected once chef-visible order is preparing", async () => {
    const created = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderId = created.data.order.id;

    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(createdOrderId, "confirmed", ownerAuth);

    const chefAuth = await loginAs(USERS.CHEF);
    await updateOrderStatus(createdOrderId, "preparing", chefAuth);

    const cancelRes = await fetch(
      `${API_URL}/api/v1/guest-orders/${createdOrderId}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${created.data.guestToken}`,
        },
      },
    );

    expect([400, 409, 423]).toContain(cancelRes.status);
    const cancelBody = await cancelRes.json();
    expect(cancelBody.success).toBe(false);
    expect(JSON.stringify(cancelBody).toLowerCase()).toMatch(
      /preparing|conflict|cannot cancel|locked/,
    );

    const orderAfterCancelAttempt = await getOrder(createdOrderId, ownerAuth);
    expect(String(orderAfterCancelAttempt.data.status).toLowerCase()).toMatch(
      /preparing|2/,
    );
  });
});
