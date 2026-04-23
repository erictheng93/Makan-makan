/**
 * Tier 1 P0 release gates.
 *
 * These tests intentionally hit the real API at localhost:8787. They are not
 * UI mocks. If an endpoint or invariant is missing, the test should fail and
 * keep the release gate visible.
 */

import { test, expect } from "@playwright/test";
import {
  RESTAURANT_ID,
  MENU,
  USERS,
  createGuestOrder,
  cleanupOrder,
  getGuestOrder,
  getOrder,
  loginAs,
  updateOrderStatus,
  uniquePhone,
} from "./helpers";

const API_URL = "http://localhost:8787";
const USER_PASSWORD = "Test@12345";

type AuthCredentials = Awaited<ReturnType<typeof loginAs>>;

interface CreatedUser {
  id: number;
  username: string;
  password: string;
}

function mutateHeaders(auth: AuthCredentials): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.token}`,
    Origin: API_URL,
    "X-CSRF-Token": auth.csrfToken,
    Cookie: auth.csrfCookie,
  };
}

function readHeaders(auth: AuthCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${auth.token}`,
    Origin: API_URL,
  };
}

async function readJson(res: Response): Promise<Record<string, any>> {
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function loginWithPassword(
  username: string,
  password: string,
): Promise<AuthCredentials> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: API_URL,
    },
    body: JSON.stringify({ username, password }),
  });
  const data = await readJson(res);

  expect(res.status, JSON.stringify(data)).toBe(200);
  expect(data.success).toBe(true);
  expect(data.data?.token).toBeTruthy();

  const csrfToken = res.headers.get("X-CSRF-Token") || "";
  const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
  const csrfCookie =
    setCookieHeaders
      .map((cookie) => cookie.match(/csrf_token=([^;]+)/)?.[1])
      .find(Boolean) ?? csrfToken;

  return {
    token: data.data.token,
    csrfToken,
    csrfCookie: csrfCookie ? `csrf_token=${csrfCookie}` : "",
  };
}

async function createStaffUser(
  adminAuth: AuthCredentials,
  role: number,
  usernamePrefix: string,
): Promise<CreatedUser> {
  const username = `${usernamePrefix}_${Date.now()}_${Math.floor(
    Math.random() * 10000,
  )}`;
  const res = await fetch(`${API_URL}/api/v1/users`, {
    method: "POST",
    headers: mutateHeaders(adminAuth),
    body: JSON.stringify({
      username,
      fullName: `P0 ${usernamePrefix}`,
      password: USER_PASSWORD,
      role,
      restaurantId: 1,
    }),
  });
  const data = await readJson(res);

  expect(res.status, JSON.stringify(data)).toBe(201);
  expect(data.success).toBe(true);
  expect(data.data?.id).toBeTruthy();

  return { id: data.data.id, username, password: USER_PASSWORD };
}

async function deactivateUser(
  adminAuth: AuthCredentials,
  userId: number,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/users/${userId}/status`, {
    method: "PATCH",
    headers: mutateHeaders(adminAuth),
    body: JSON.stringify({ isActive: false }),
  });
  const data = await readJson(res);

  expect(res.status, JSON.stringify(data)).toBe(200);
  expect(data.success).toBe(true);
}

async function deleteUser(
  adminAuth: AuthCredentials,
  userId: number | undefined,
): Promise<void> {
  if (!userId) return;

  await fetch(`${API_URL}/api/v1/users/${userId}`, {
    method: "DELETE",
    headers: mutateHeaders(adminAuth),
  });
}

async function createDeliveredOrder(): Promise<{
  id: number;
  guestToken: string;
}> {
  const created = await createGuestOrder(RESTAURANT_ID, [
    { menuItemId: MENU.HONG_CHA, quantity: 1 },
  ]);
  const orderId = created.data.order.id;

  const ownerAuth = await loginAs(USERS.OWNER);
  await updateOrderStatus(orderId, "confirmed", ownerAuth);

  const chefAuth = await loginAs(USERS.CHEF);
  await updateOrderStatus(orderId, "preparing", chefAuth);
  await updateOrderStatus(orderId, "ready", chefAuth);

  const serviceAuth = await loginAs(USERS.SERVICE);
  await updateOrderStatus(orderId, "delivered", serviceAuth);

  return { id: orderId, guestToken: created.data.guestToken };
}

test.describe.configure({ mode: "serial" });

test.describe("Tier 1 P0 release gates", () => {
  let createdOrderIds: number[] = [];
  let createdUserIds: number[] = [];

  test.afterEach(async () => {
    for (const orderId of createdOrderIds.reverse()) {
      await cleanupOrder(orderId);
    }
    createdOrderIds = [];

    const adminAuth = await loginAs(USERS.ADMIN);
    for (const userId of createdUserIds.reverse()) {
      await deleteUser(adminAuth, userId);
    }
    createdUserIds = [];
  });

  test("C10 order notes reject oversize input and cannot persist executable or SQL-altering payloads", async () => {
    await test.step("oversize notes are rejected by the real API", async () => {
      const res = await fetch(`${API_URL}/api/v1/guest-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: RESTAURANT_ID,
          orderType: "shop",
          guestName: "P0 C10 Oversize",
          phoneLastDigits: uniquePhone(),
          items: [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
          notes: "x".repeat(501),
        }),
      });
      const data = await readJson(res);

      expect([400, 422], JSON.stringify(data)).toContain(res.status);
      expect(data.success).toBe(false);
    });

    await test.step("XSS markup is rejected or stored as inert text", async () => {
      const payload = `<script>alert("c10")</script><img src=x onerror=alert(1)>`;
      const result = await createGuestOrder(
        RESTAURANT_ID,
        [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
        {
          guestName: "P0 C10 XSS",
          phoneLastDigits: uniquePhone(),
          notes: payload,
        },
      );
      createdOrderIds.push(result.data.order.id);

      const detail = await getGuestOrder(
        result.data.order.id,
        result.data.guestToken,
      );
      const persistedNotes = String(detail.data.order.notes ?? "");

      expect(persistedNotes).not.toContain("<script");
      expect(persistedNotes).not.toContain("onerror=");
      expect(persistedNotes).not.toBe(payload);
    });

    await test.step("SQL-like notes do not alter order semantics", async () => {
      const result = await createGuestOrder(
        RESTAURANT_ID,
        [{ menuItemId: MENU.GONG_WAN_TANG, quantity: 1 }],
        {
          guestName: "P0 C10 SQL",
          phoneLastDigits: uniquePhone(),
          notes: `'); DROP TABLE orders; --`,
        },
      );
      createdOrderIds.push(result.data.order.id);

      expect(result.success).toBe(true);
      expect(result.data.order.restaurantId).toBe(RESTAURANT_ID);

      const detail = await getGuestOrder(
        result.data.order.id,
        result.data.guestToken,
      );
      expect(detail.data.order.id).toBe(result.data.order.id);
    });
  });

  test("H3 / X2 guest cancel is rejected after chef starts preparing", async () => {
    const created = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderIds.push(created.data.order.id);

    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(created.data.order.id, "confirmed", ownerAuth);

    const chefAuth = await loginAs(USERS.CHEF);
    await updateOrderStatus(created.data.order.id, "preparing", chefAuth);

    const cancelRes = await fetch(
      `${API_URL}/api/v1/guest-orders/${created.data.order.id}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${created.data.guestToken}`,
        },
      },
    );
    const cancelBody = await readJson(cancelRes);

    expect([400, 409, 423], JSON.stringify(cancelBody)).toContain(
      cancelRes.status,
    );
    expect(cancelBody.success).toBe(false);
    expect(JSON.stringify(cancelBody).toLowerCase()).toMatch(
      /preparing|conflict|cannot cancel|locked/,
    );

    const orderAfterCancelAttempt = await getOrder(
      created.data.order.id,
      ownerAuth,
    );
    expect(String(orderAfterCancelAttempt.data.status).toLowerCase()).toMatch(
      /preparing|2/,
    );
  });

  test("A1 old privileged token is rejected immediately after account disable", async () => {
    const adminAuth = await loginAs(USERS.ADMIN);
    const owner = await createStaffUser(adminAuth, 1, "p0_owner_a1");
    createdUserIds.push(owner.id);

    const oldOwnerAuth = await loginWithPassword(
      owner.username,
      owner.password,
    );
    await deactivateUser(adminAuth, owner.id);

    const res = await fetch(`${API_URL}/api/v1/users`, {
      headers: readHeaders(oldOwnerAuth),
    });
    const data = await readJson(res);

    expect([401, 403], JSON.stringify(data)).toContain(res.status);
  });

  test("A6 backup restore drill verifies checksum and manifest row counts", async () => {
    const adminAuth = await loginAs(USERS.ADMIN);
    const backupName = `p0-restore-drill-${Date.now()}`;

    const createRes = await fetch(`${API_URL}/api/v1/backup/create`, {
      method: "POST",
      headers: mutateHeaders(adminAuth),
      body: JSON.stringify({
        restaurant_id: RESTAURANT_ID,
        name: backupName,
        backup_type: "full",
        include_tables: ["restaurants", "menus", "orders"],
        force_immediate: true,
      }),
    });
    const createData = await readJson(createRes);

    expect([200, 201, 202], JSON.stringify(createData)).toContain(
      createRes.status,
    );

    const backupId =
      createData.data?.backup?.id ??
      createData.data?.backup_id ??
      createData.data?.id;
    const manifest =
      createData.data?.manifest ?? createData.data?.backupManifest;
    const checksum = createData.data?.checksum ?? manifest?.checksum;

    expect(backupId, JSON.stringify(createData)).toBeTruthy();
    expect(checksum, JSON.stringify(createData)).toBeTruthy();
    expect(manifest?.rowCounts ?? manifest?.row_counts).toBeTruthy();

    const restoreRes = await fetch(
      `${API_URL}/api/v1/backup/${backupId}/restore`,
      {
        method: "POST",
        headers: mutateHeaders(adminAuth),
        body: JSON.stringify({
          restaurant_id: RESTAURANT_ID,
          backup_id: backupId,
          restore_type: "selective",
          target_tables: ["restaurants", "menus"],
          overwrite_existing: false,
          safety_confirmation: {
            backup_integrity_verified: true,
            data_loss_risk_acknowledged: true,
            confirmation_phrase: "I understand the risks",
          },
        }),
      },
    );
    const restoreData = await readJson(restoreRes);

    expect([200, 201, 202], JSON.stringify(restoreData)).toContain(
      restoreRes.status,
    );
    expect(
      restoreData.data?.checksum ?? restoreData.data?.verifiedChecksum,
    ).toBe(checksum);
    expect(
      restoreData.data?.rowCounts ?? restoreData.data?.restoredRowCounts,
    ).toEqual(manifest.rowCounts ?? manifest.row_counts);
  });

  // TODO(wave-4): backend needs closed-shift ledger + credit-note/adjustment model
  // before this gate can run. Unblock by adding `shifts.closed_at`, a
  // `ledger_adjustments` table, and refund API branching on closed state.
  test.fixme("K6 refund after close creates an adjustment without mutating closed ledger", async () => {
    const order = await createDeliveredOrder();
    createdOrderIds.push(order.id);

    const cashierAuth = await loginAs(USERS.CASHIER);
    await updateOrderStatus(order.id, "paid", cashierAuth);

    const ownerAuth = await loginAs(USERS.OWNER);
    const refundRes = await fetch(`${API_URL}/api/v1/pos/refunds/create`, {
      method: "POST",
      headers: {
        ...mutateHeaders(ownerAuth),
        "X-Register-Id": "00000000-0000-4000-8000-00000000cafe",
        "X-Shift-Id": "00000000-0000-4000-8000-00000000dead",
      },
      body: JSON.stringify({
        originalOrderId: order.id,
        refundType: "full",
        refundAmount: 20,
        refundMethod: "cash",
        reasonCode: "after_close",
        reasonDescription: "P0 closed-ledger refund drill",
      }),
    });
    const refundData = await readJson(refundRes);

    expect([200, 201, 202], JSON.stringify(refundData)).toContain(
      refundRes.status,
    );
    expect(refundData.data?.ledgerMutation).not.toBe(true);
    expect(
      refundData.data?.adjustmentId ??
        refundData.data?.creditNoteId ??
        refundData.data?.allowanceId,
      JSON.stringify(refundData),
    ).toBeTruthy();
  });

  // TODO(wave-3): /api/v1/payments is disabled in app-factory and there is no
  // partial-payment allocator. Unblock by enabling the route, adding
  // Idempotency-Key middleware, and enforcing server-side exact-total.
  test.fixme("K7 mismatched partial payments cannot close an order", async () => {
    const order = await createDeliveredOrder();
    createdOrderIds.push(order.id);

    const cashierAuth = await loginAs(USERS.CASHIER);
    const res = await fetch(`${API_URL}/api/v1/payments`, {
      method: "POST",
      headers: {
        ...mutateHeaders(cashierAuth),
        "Idempotency-Key": `p0-k7-${order.id}`,
      },
      body: JSON.stringify({
        orderId: order.id,
        paymentMode: "partial",
        expectedTotal: 999999,
        payments: [
          { method: "cash", amount: 1 },
          { method: "card", amount: 1 },
        ],
        closeOrder: true,
      }),
    });
    const data = await readJson(res);

    expect([400, 409, 422], JSON.stringify(data)).toContain(res.status);

    const orderAfter = await getOrder(order.id, cashierAuth);
    expect(String(orderAfter.data.status).toLowerCase()).not.toBe("paid");
  });

  test("G5 forged guest token cannot reveal another guest order", async () => {
    const first = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
      { phoneLastDigits: uniquePhone() },
    );
    const second = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.DONG_GUA_CHA, quantity: 1 }],
      { phoneLastDigits: uniquePhone() },
    );
    createdOrderIds.push(first.data.order.id, second.data.order.id);

    const res = await fetch(
      `${API_URL}/api/v1/guest-orders/${second.data.order.id}`,
      {
        headers: {
          Authorization: `Bearer ${first.data.guestToken}`,
        },
      },
    );
    const data = await readJson(res);

    expect([401, 403, 404], JSON.stringify(data)).toContain(res.status);
    expect(JSON.stringify(data)).not.toContain(String(second.data.order.id));
  });

  // TODO(wave-3): payment handler must accept X-Payment-Gateway-Fixture=timeout
  // and keep payment/order unpaid-pending until an authoritative status poll
  // confirms. Depends on enabling /api/v1/payments (same work as K7).
  test.fixme("E1 gateway timeout leaves payment pending until authoritative confirmation", async () => {
    const order = await createDeliveredOrder();
    createdOrderIds.push(order.id);

    const cashierAuth = await loginAs(USERS.CASHIER);
    const res = await fetch(`${API_URL}/api/v1/payments`, {
      method: "POST",
      headers: {
        ...mutateHeaders(cashierAuth),
        "Idempotency-Key": `p0-e1-${order.id}`,
        "X-Payment-Gateway-Fixture": "timeout",
      },
      body: JSON.stringify({
        orderId: order.id,
        method: "card",
        amount: 20,
        gateway: "test",
      }),
    });
    const data = await readJson(res);

    expect([202, 408, 504], JSON.stringify(data)).toContain(res.status);

    const orderAfter = await getOrder(order.id, cashierAuth);
    expect(String(orderAfter.data.paymentStatus ?? "").toLowerCase()).not.toBe(
      "paid",
    );
  });

  // TODO(wave-3): webhook handler needs an idempotency table keyed on event_id
  // or Idempotency-Key so duplicate callbacks produce `duplicateEffects: 0`.
  // Test also needs a test-signature bypass behind a wrangler env flag.
  test.fixme("E2 duplicate payment webhook has only-once effect", async () => {
    const eventId = `p0-e2-${Date.now()}`;
    const body = JSON.stringify({
      event_id: eventId,
      event_type: "payment.succeeded",
      store: { id: "p0-test-store" },
      payment: {
        external_id: eventId,
        amount: 20,
        currency: "TWD",
      },
    });

    async function postWebhook() {
      return fetch(`${API_URL}/api/v1/integrations/webhooks/uber-eats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Uber-Signature": "test-fixture-signature",
          "Idempotency-Key": eventId,
        },
        body,
      });
    }

    const first = await postWebhook();
    const firstData = await readJson(first);
    expect([200, 202], JSON.stringify(firstData)).toContain(first.status);

    const second = await postWebhook();
    const secondData = await readJson(second);
    expect([200, 202, 208, 409], JSON.stringify(secondData)).toContain(
      second.status,
    );

    expect(secondData.data?.duplicateEffects ?? 0).toBe(0);
    if (firstData.orderId && secondData.orderId) {
      expect(secondData.orderId).toBe(firstData.orderId);
    }
  });

  test("X9 disabled owner cannot complete the next write with an active session", async () => {
    const adminAuth = await loginAs(USERS.ADMIN);
    const owner = await createStaffUser(adminAuth, 1, "p0_owner_x9");
    createdUserIds.push(owner.id);

    const oldOwnerAuth = await loginWithPassword(
      owner.username,
      owner.password,
    );
    await deactivateUser(adminAuth, owner.id);

    const tableNumber = `P0_X9_${Date.now()}`;
    const res = await fetch(`${API_URL}/api/v1/tables`, {
      method: "POST",
      headers: mutateHeaders(oldOwnerAuth),
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        number: tableNumber,
        capacity: 2,
      }),
    });
    const data = await readJson(res);

    expect([401, 403], JSON.stringify(data)).toContain(res.status);

    const listRes = await fetch(
      `${API_URL}/api/v1/tables?restaurantId=${RESTAURANT_ID}`,
      { headers: readHeaders(adminAuth) },
    );
    const listData = await readJson(listRes);
    const created = JSON.stringify(listData).includes(tableNumber);
    expect(created).toBe(false);
  });

  // TODO(wave-5): /api/v1/manager/actions and /api/v1/audit-logs do not exist
  // yet; manager persona is not in RBAC. Unblock by shipping the delegation
  // endpoint, an audit_logs schema with actor_id + on_behalf_of_user_id, and
  // the admin-facing audit query route.
  test.fixme("M1 manager proxy action records actor separately from on-behalf-of owner", async () => {
    const adminAuth = await loginAs(USERS.ADMIN);
    const manager = await createStaffUser(adminAuth, 1, "p0_manager_m1");
    const owner = await createStaffUser(adminAuth, 1, "p0_owner_m1");
    createdUserIds.push(manager.id, owner.id);

    const managerAuth = await loginWithPassword(
      manager.username,
      manager.password,
    );
    const actionRes = await fetch(`${API_URL}/api/v1/manager/actions`, {
      method: "POST",
      headers: mutateHeaders(managerAuth),
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        action: "update_menu_availability",
        resource: "menu_item",
        resourceId: MENU.HONG_CHA,
        onBehalfOfUserId: owner.id,
        reason: "P0 manager audit actor separation",
      }),
    });
    const actionData = await readJson(actionRes);

    expect([200, 201, 202], JSON.stringify(actionData)).toContain(
      actionRes.status,
    );

    const auditRes = await fetch(
      `${API_URL}/api/v1/audit-logs?resourceId=${MENU.HONG_CHA}&limit=5`,
      { headers: readHeaders(adminAuth) },
    );
    const auditData = await readJson(auditRes);

    expect(auditRes.status, JSON.stringify(auditData)).toBe(200);
    const logs = auditData.data?.logs ?? auditData.data ?? [];
    const matchingLog = logs.find((log: Record<string, any>) => {
      return (
        Number(log.actorId ?? log.userId) === manager.id &&
        Number(log.onBehalfOfUserId ?? log.delegatedUserId) === owner.id
      );
    });

    expect(matchingLog, JSON.stringify(auditData)).toBeTruthy();
  });
});
