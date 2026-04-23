/**
 * C10 blocker skeleton: malicious order-note input.
 *
 * These tests intentionally hit the real API. Do not replace them with
 * Playwright route mocks; C10 is a release gate for server-side validation and
 * persisted output safety.
 */

import { test, expect } from "@playwright/test";
import {
  RESTAURANT_ID,
  MENU,
  createGuestOrder,
  getGuestOrder,
  cleanupOrder,
  uniquePhone,
} from "../../integration/helpers";

const API_URL = "http://localhost:8787";

test.describe.configure({ mode: "serial" });
test.describe("C10 malicious order-note input", () => {
  let createdOrderId: number | undefined;

  test.afterEach(async () => {
    await cleanupOrder(createdOrderId);
    createdOrderId = undefined;
  });

  test("rejects oversize guest order notes through the real API", async () => {
    const res = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        orderType: "shop",
        guestName: "Malicious Input E2E",
        phoneLastDigits: uniquePhone(),
        items: [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
        notes: "x".repeat(501),
      }),
    });

    expect([400, 422]).toContain(res.status);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  test("does not persist executable XSS markup in guest order notes", async () => {
    const payload = `<script>alert("c10")</script><img src=x onerror=alert(1)>`;
    const result = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
      {
        guestName: "XSS Probe",
        phoneLastDigits: uniquePhone(),
        notes: payload,
      },
    );
    createdOrderId = result.data.order.id;

    const detail = await getGuestOrder(createdOrderId, result.data.guestToken);
    const persistedNotes = String(detail.data.order.notes ?? "");

    expect(persistedNotes).not.toContain("<script");
    expect(persistedNotes).not.toContain("onerror=");
    expect(persistedNotes).not.toBe(payload);
  });

  test("does not let SQL-like note payload alter order creation semantics", async () => {
    const payload = `'); DROP TABLE orders; --`;
    const result = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.GONG_WAN_TANG, quantity: 1 }],
      {
        guestName: "SQL Probe",
        phoneLastDigits: uniquePhone(),
        notes: payload,
      },
    );
    createdOrderId = result.data.order.id;

    expect(result.success).toBe(true);
    expect(result.data.order.id).toBeGreaterThan(0);
    expect(result.data.order.restaurantId).toBe(RESTAURANT_ID);

    const detail = await getGuestOrder(createdOrderId, result.data.guestToken);
    expect(detail.success).toBe(true);
    expect(detail.data.order.id).toBe(createdOrderId);
  });
});
