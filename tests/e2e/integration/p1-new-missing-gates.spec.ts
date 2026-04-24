/**
 * Tier 2 / P1 current-quarter gates, batch 2.
 *
 * Wave 6 placeholder gates for New P1 Missing audit rows.
 *
 * Keep this suite isolated until Tier 2 Batch A/B/C are green. These tests are
 * real-API contracts, but enabling them before the backend contract exists would
 * pollute the current audit red/green signal.
 */

import { test, expect } from "@playwright/test";
import {
  RESTAURANT_ID,
  SAKURA_RESTAURANT_ID,
  MENU,
  USERS,
  createGuestOrder,
  cleanupOrder,
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
      fullName: `P1 ${usernamePrefix}`,
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

async function postJson(
  path: string,
  auth: AuthCredentials,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; data: Record<string, any> }> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { ...mutateHeaders(auth), ...extraHeaders },
    body: JSON.stringify(body),
  });

  return { status: res.status, data: await readJson(res) };
}

async function patchJson(
  path: string,
  auth: AuthCredentials,
  body: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, any> }> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: mutateHeaders(auth),
    body: JSON.stringify(body),
  });

  return { status: res.status, data: await readJson(res) };
}

async function setMenuAvailability(
  auth: AuthCredentials,
  menuItemId: number,
  isAvailable: boolean,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/v1/menu/${RESTAURANT_ID}/items/availability`,
    {
      method: "PATCH",
      headers: mutateHeaders(auth),
      body: JSON.stringify({
        updates: [{ id: menuItemId, isAvailable }],
      }),
    },
  );
  const data = await readJson(res);

  expect(res.status, JSON.stringify(data)).toBe(200);
  expect(data.success).toBe(true);
}

async function createConfirmedOrder(menuItemId = MENU.HONG_CHA): Promise<{
  id: number;
  guestToken: string;
}> {
  const created = await createGuestOrder(RESTAURANT_ID, [
    { menuItemId, quantity: 1 },
  ]);
  const ownerAuth = await loginAs(USERS.OWNER);
  await updateOrderStatus(created.data.order.id, "confirmed", ownerAuth);

  return {
    id: created.data.order.id,
    guestToken: created.data.guestToken,
  };
}

test.describe.configure({ mode: "serial" });

test.describe
  .fixme("Tier 2 P1 current-quarter gates - batch 2 New Missing", () => {
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

    try {
      const ownerAuth = await loginAs(USERS.OWNER);
      await setMenuAvailability(ownerAuth, MENU.HONG_CHA, true);
      await setMenuAvailability(ownerAuth, MENU.DONG_GUA_CHA, true);
      await setMenuAvailability(ownerAuth, MENU.GONG_WAN_TANG, true);
    } catch {
      // Restoration is best-effort; the assertion belongs to the test body.
    }
  });

  test("C13 offline replay submit creates one order and reruns menu validation", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);
    const idempotencyKey = `p1-c13-${Date.now()}`;

    const first = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        orderType: "shop",
        guestName: "P1 Offline Replay",
        phoneLastDigits: uniquePhone(),
        offlineCartVersion: "offline-v1",
        items: [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
      }),
    });
    const firstData = await readJson(first);
    const firstOrderId = Number(firstData.data?.order?.id);
    if (firstOrderId) createdOrderIds.push(firstOrderId);

    await setMenuAvailability(ownerAuth, MENU.HONG_CHA, false);

    const replay = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        orderType: "shop",
        guestName: "P1 Offline Replay",
        phoneLastDigits: uniquePhone(),
        offlineCartVersion: "offline-v1",
        items: [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
      }),
    });
    const replayData = await readJson(replay);

    expect(first.status, JSON.stringify(firstData)).toBe(201);
    expect(replay.status, JSON.stringify(replayData)).toBe(409);
    expect(JSON.stringify(replayData).toLowerCase()).toMatch(
      /unavailable|delisted|revalidate|conflict/,
    );
  });

  test("C14 invalid combo required-choice payload is rejected before order creation", async () => {
    const res = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        orderType: "shop",
        guestName: "P1 Combo Validation",
        phoneLastDigits: uniquePhone(),
        items: [
          {
            menuItemId: MENU.GONG_WAN_TANG,
            quantity: 1,
            customizations: {
              comboId: "seed-combo-required",
              options: [],
              addOns: [
                {
                  id: "addon-dependent",
                  name: "Dependent Add-on",
                  unitPrice: 10,
                  quantity: 1,
                  totalPrice: 10,
                  requiresChoiceId: "missing-required-choice",
                },
              ],
            },
          },
        ],
      }),
    });
    const data = await readJson(res);

    expect([400, 422, 409]).toContain(res.status);
    expect(JSON.stringify(data).toLowerCase()).toMatch(
      /combo|required|choice|addon/,
    );
  });

  test("H7 combo order creates deterministic kitchen station tickets", async () => {
    const created = await createGuestOrder(RESTAURANT_ID, [
      {
        menuItemId: MENU.GONG_WAN_TANG,
        quantity: 1,
        customizations: {
          comboId: "seed-combo-two-stations",
          options: [
            {
              id: "drink",
              optionName: "Drink",
              choiceId: "hong-cha",
              choiceName: "Hong Cha",
            },
          ],
        } as any,
      },
    ]);
    createdOrderIds.push(created.data.order.id);

    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(created.data.order.id, "confirmed", ownerAuth);

    const chefAuth = await loginAs(USERS.CHEF);
    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders/${created.data.order.id}/station-tickets`,
      { headers: readHeaders(chefAuth) },
    );
    const data = await readJson(res);

    expect(res.status, JSON.stringify(data)).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data?.tickets?.length).toBeGreaterThanOrEqual(2);
    expect(data.data?.servingAggregationPoint).toBeTruthy();
  });

  test("H8 substitution during prep records customer choice and recalculates amount", async () => {
    const order = await createConfirmedOrder(MENU.GONG_WAN_TANG);
    createdOrderIds.push(order.id);

    const chefAuth = await loginAs(USERS.CHEF);
    await updateOrderStatus(order.id, "preparing", chefAuth);

    const substitution = await postJson(
      `/api/v1/kitchen/${RESTAURANT_ID}/orders/${order.id}/substitutions`,
      chefAuth,
      {
        unavailableMenuItemId: MENU.GONG_WAN_TANG,
        replacementMenuItemId: MENU.HONG_CHA,
        reason: "P1 shortage gate",
        customerDecision: "accepted",
      },
    );

    expect(substitution.status, JSON.stringify(substitution.data)).toBe(201);
    expect(substitution.data.success).toBe(true);
    expect(substitution.data.data?.notificationQueued).toBe(true);
    expect(substitution.data.data?.amountDelta).not.toBeUndefined();
  });

  test("H9 preparing order keeps menu snapshot after later owner edit", async () => {
    const order = await createConfirmedOrder(MENU.HONG_CHA);
    createdOrderIds.push(order.id);

    const chefAuth = await loginAs(USERS.CHEF);
    await updateOrderStatus(order.id, "preparing", chefAuth);

    const ownerAuth = await loginAs(USERS.OWNER);
    const edit = await patchJson(
      `/api/v1/menu/${RESTAURANT_ID}/items/${MENU.HONG_CHA}`,
      ownerAuth,
      { name: `P1 Edited Tea ${Date.now()}`, price: 999 },
    );
    expect([200, 204]).toContain(edit.status);

    const after = await getOrder(order.id, ownerAuth);
    const orderText = JSON.stringify(after.data).toLowerCase();

    expect(orderText).toContain("hong");
    expect(orderText).not.toContain("999");
  });

  test("S1 wrong-table delivery requires confirmation and creates correction audit", async () => {
    const created = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
      { orderType: "table", tableId: 1 },
    );
    createdOrderIds.push(created.data.order.id);

    const ownerAuth = await loginAs(USERS.OWNER);
    await updateOrderStatus(created.data.order.id, "confirmed", ownerAuth);

    const serviceAuth = await loginAs(USERS.SERVICE);
    const wrongTable = await postJson(
      `/api/v1/orders/${created.data.order.id}/delivery/confirm`,
      serviceAuth,
      {
        tableId: 2,
        confirmationCode: "wrong-table",
        correctionReason: "P1 wrong table gate",
      },
    );

    expect(wrongTable.status, JSON.stringify(wrongTable.data)).toBe(409);
    expect(wrongTable.data.data?.auditId).toBeTruthy();
    expect(JSON.stringify(wrongTable.data).toLowerCase()).toMatch(
      /table|confirm|correction/,
    );
  });

  test("S2 delivery address update increments version and active route uses latest version", async () => {
    const created = await createGuestOrder(
      RESTAURANT_ID,
      [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
      {
        orderType: "shop",
        deliveryInfo: {
          type: "delivery",
          address: "5 Delivery Lane",
          phone: "0912345678",
        },
      },
    );
    createdOrderIds.push(created.data.order.id);

    const guestPatch = await fetch(
      `${API_URL}/api/v1/guest-orders/${created.data.order.id}/delivery-address`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${created.data.guestToken}`,
        },
        body: JSON.stringify({
          address: "9 Updated Delivery Lane",
          phone: "0912345678",
          reason: "P1 route update",
        }),
      },
    );
    const guestPatchData = await readJson(guestPatch);

    expect(guestPatch.status, JSON.stringify(guestPatchData)).toBe(200);
    expect(guestPatchData.data?.addressVersion).toBeGreaterThan(1);

    const serviceAuth = await loginAs(USERS.SERVICE);
    const routeRes = await fetch(
      `${API_URL}/api/v1/service/orders/${created.data.order.id}/route`,
      { headers: readHeaders(serviceAuth) },
    );
    const routeData = await readJson(routeRes);

    expect(routeRes.status, JSON.stringify(routeData)).toBe(200);
    expect(routeData.data?.addressVersion).toBe(
      guestPatchData.data?.addressVersion,
    );
    expect(JSON.stringify(routeData)).toContain("9 Updated Delivery Lane");
  });

  test("S5 conflicting multi-order assignments produce deterministic priority", async () => {
    const first = await createConfirmedOrder(MENU.HONG_CHA);
    const second = await createConfirmedOrder(MENU.DONG_GUA_CHA);
    createdOrderIds.push(first.id, second.id);

    const ownerAuth = await loginAs(USERS.OWNER);
    const res = await postJson("/api/v1/service/assignments/bulk", ownerAuth, {
      restaurantId: RESTAURANT_ID,
      crewUsername: USERS.SERVICE,
      assignments: [
        { orderId: first.id, priority: 2 },
        { orderId: second.id, priority: 1 },
      ],
      conflictPolicy: "deterministic_priority",
    });

    expect(res.status, JSON.stringify(res.data)).toBe(201);
    expect(res.data.data?.assignments?.map((a: any) => a.orderId)).toEqual([
      second.id,
      first.id,
    ]);
    expect(res.data.data?.conflictResolution).toBe("deterministic_priority");
  });

  test("K11 same-IP card brute-force is throttled and logs risk event", async () => {
    const order = await createConfirmedOrder(MENU.HONG_CHA);
    createdOrderIds.push(order.id);

    const cashierAuth = await loginAs(USERS.CASHIER);
    const statuses: number[] = [];

    for (let i = 0; i < 6; i++) {
      const attempt = await postJson(
        "/api/v1/payments",
        cashierAuth,
        {
          orderId: order.id,
          paymentMode: "full",
          method: "card",
          amount: 20,
          gateway: "test",
          cardToken: `declined-${i}`,
        },
        {
          "Idempotency-Key": `p1-k11-${Date.now()}-${i}`,
          "X-Forwarded-For": "203.0.113.11",
          "X-Payment-Gateway-Fixture": "declined",
        },
      );
      statuses.push(attempt.status);
    }

    expect(statuses).toContain(429);

    const riskRes = await fetch(
      `${API_URL}/api/v1/payments/risk-events?ip=203.0.113.11&orderId=${order.id}`,
      { headers: readHeaders(cashierAuth) },
    );
    const riskData = await readJson(riskRes);

    expect(riskRes.status, JSON.stringify(riskData)).toBe(200);
    expect(riskData.data?.events?.length).toBeGreaterThan(0);
  });

  test("A3 PII export creates actor/scope approval audit", async () => {
    const adminAuth = await loginAs(USERS.ADMIN);
    const res = await postJson("/api/v1/system/pii-exports", adminAuth, {
      restaurantId: RESTAURANT_ID,
      scope: "customers",
      reason: "P1 audit export gate",
      approvalTicket: `P1-A3-${Date.now()}`,
    });

    expect(res.status, JSON.stringify(res.data)).toBe(202);
    expect(res.data.success).toBe(true);
    expect(res.data.data?.auditId).toBeTruthy();
    expect(res.data.data?.scope).toBe("customers");
    expect(res.data.data?.approvalState).toMatch(/approved|pending/);
  });

  test("A5 retention erase anonymizes data and records audit proof", async () => {
    const created = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    createdOrderIds.push(created.data.order.id);

    const adminAuth = await loginAs(USERS.ADMIN);
    const res = await postJson(
      "/api/v1/system/privacy/retention-runs",
      adminAuth,
      {
        subjectType: "guest_order",
        subjectId: created.data.order.id,
        action: "anonymize",
        reason: "P1 retention gate",
      },
    );

    expect(res.status, JSON.stringify(res.data)).toBe(202);
    expect(res.data.success).toBe(true);
    expect(res.data.data?.auditId).toBeTruthy();
    expect(res.data.data?.checksum).toBeTruthy();
  });

  test("A7 incident degradation emits alert, serves degraded path, and rolls back", async () => {
    const adminAuth = await loginAs(USERS.ADMIN);
    const enable = await postJson("/api/v1/system/incident-mode", adminAuth, {
      mode: "degraded",
      reason: "P1 incident gate",
      affectedCapability: "payments",
    });

    expect(enable.status, JSON.stringify(enable.data)).toBe(202);
    expect(enable.data.data?.alertId).toBeTruthy();

    const health = await fetch(`${API_URL}/api/v1/system/health`, {
      headers: readHeaders(adminAuth),
    });
    const healthData = await readJson(health);
    expect(health.status, JSON.stringify(healthData)).toBe(200);
    expect(healthData.data?.mode).toBe("degraded");

    const rollback = await postJson(
      "/api/v1/system/incident-mode/rollback",
      adminAuth,
      {
        incidentId: enable.data.data?.incidentId,
      },
    );
    expect(rollback.status, JSON.stringify(rollback.data)).toBe(200);
    expect(rollback.data.data?.mode).toBe("healthy");
  });

  // E3 promoted to non-fixme block at end of file (see "P1 promoted: E3").

  test("M2 expired delegation denies action and writes denied audit", async () => {
    const adminAuth = await loginAs(USERS.ADMIN);
    const manager = await createStaffUser(adminAuth, 1, "p1_manager_m2");
    createdUserIds.push(manager.id);

    const managerAuth = await loginWithPassword(
      manager.username,
      manager.password,
    );
    const action = await postJson("/api/v1/manager/actions", managerAuth, {
      restaurantId: RESTAURANT_ID,
      action: "update_menu_availability",
      resource: "menu_item",
      resourceId: MENU.HONG_CHA,
      onBehalfOfUserId: manager.id,
      delegationExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      payload: { isAvailable: false },
      reason: "P1 expired delegation gate",
    });

    expect(action.status, JSON.stringify(action.data)).toBe(403);

    const logs = await fetch(
      `${API_URL}/api/v1/audit-logs?actorId=${manager.id}&action=delegation_denied&resource=menu_item`,
      { headers: readHeaders(adminAuth) },
    );
    const logsData = await readJson(logs);
    expect(logs.status, JSON.stringify(logsData)).toBe(200);
    expect(
      logsData.data?.items?.length ?? logsData.data?.length,
    ).toBeGreaterThan(0);
  });

  test("M3 delegated manager can mutate assigned store only", async () => {
    const adminAuth = await loginAs(USERS.ADMIN);
    const manager = await createStaffUser(adminAuth, 1, "p1_manager_m3");
    createdUserIds.push(manager.id);

    const managerAuth = await loginWithPassword(
      manager.username,
      manager.password,
    );
    const assigned = await postJson("/api/v1/manager/actions", managerAuth, {
      restaurantId: RESTAURANT_ID,
      action: "update_menu_availability",
      resource: "menu_item",
      resourceId: MENU.HONG_CHA,
      assignedRestaurantIds: [RESTAURANT_ID],
      payload: { isAvailable: true },
      reason: "P1 assigned store allowed",
    });

    const unassigned = await postJson("/api/v1/manager/actions", managerAuth, {
      restaurantId: SAKURA_RESTAURANT_ID,
      action: "update_menu_availability",
      resource: "menu_item",
      resourceId: MENU.HONG_CHA,
      assignedRestaurantIds: [RESTAURANT_ID],
      payload: { isAvailable: false },
      reason: "P1 unassigned store denied",
    });

    expect(assigned.status, JSON.stringify(assigned.data)).toBe(201);
    expect(unassigned.status, JSON.stringify(unassigned.data)).toBe(403);
  });

  test("M4 manager cash variance approval records signer and target shift", async () => {
    const adminAuth = await loginAs(USERS.ADMIN);
    const manager = await createStaffUser(adminAuth, 1, "p1_manager_m4");
    createdUserIds.push(manager.id);

    const managerAuth = await loginWithPassword(
      manager.username,
      manager.password,
    );
    const approval = await postJson(
      "/api/v1/manager/cash-variance-approvals",
      managerAuth,
      {
        restaurantId: RESTAURANT_ID,
        shiftId: `p1-shift-${Date.now()}`,
        varianceAmount: 125,
        reason: "P1 variance approval gate",
      },
    );

    expect(approval.status, JSON.stringify(approval.data)).toBe(201);
    expect(approval.data.data?.signerUserId).toBe(manager.id);
    expect(approval.data.data?.shiftId).toBeTruthy();
    expect(approval.data.data?.auditId).toBeTruthy();
  });

  test("X7 payment channel disconnect leaves one authoritative retryable state", async () => {
    const order = await createConfirmedOrder(MENU.HONG_CHA);
    createdOrderIds.push(order.id);

    const cashierAuth = await loginAs(USERS.CASHIER);
    const payment = await postJson(
      "/api/v1/payments",
      cashierAuth,
      {
        orderId: order.id,
        paymentMode: "full",
        method: "card",
        amount: 20,
        gateway: "test",
      },
      {
        "Idempotency-Key": `p1-x7-${Date.now()}`,
        "X-Payment-Gateway-Fixture": "disconnect",
      },
    );

    expect([202, 503]).toContain(payment.status);
    expect(JSON.stringify(payment.data).toLowerCase()).toMatch(
      /pending|retry|fallback|disconnected/,
    );

    const after = await getOrder(order.id, cashierAuth);
    expect(JSON.stringify(after.data).toLowerCase()).not.toMatch(/paid/);
  });

  test("X8 owner local delist wins over external platform menu sync", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);
    await setMenuAvailability(ownerAuth, MENU.HONG_CHA, false);

    const sync = await postJson(
      `/api/v1/integrations/${RESTAURANT_ID}/uber_eats/menu-sync`,
      ownerAuth,
      {
        fixture: "external_marks_available",
        menuItemId: MENU.HONG_CHA,
      },
      { "X-Integration-Fixture": "external_marks_available" },
    );

    expect([200, 202]).toContain(sync.status);

    const menuRes = await fetch(
      `${API_URL}/api/v1/menu/${RESTAURANT_ID}/items/${MENU.HONG_CHA}`,
      { headers: readHeaders(ownerAuth) },
    );
    const menuData = await readJson(menuRes);

    expect(menuRes.status, JSON.stringify(menuData)).toBe(200);
    expect(menuData.data?.isAvailable).toBe(false);
    expect(sync.data.data?.externalAvailability).toBe(false);
  });

  test("X11 manager delegation is preserved in cashier shift-close audit", async () => {
    const adminAuth = await loginAs(USERS.ADMIN);
    const manager = await createStaffUser(adminAuth, 1, "p1_manager_x11");
    createdUserIds.push(manager.id);

    const managerAuth = await loginWithPassword(
      manager.username,
      manager.password,
    );
    const close = await postJson("/api/v1/pos/shifts/close", managerAuth, {
      restaurantId: RESTAURANT_ID,
      cashierUsername: USERS.CASHIER,
      onBehalfOfUserId: manager.id,
      expectedCash: 5000,
      actualCash: 5000,
      reason: "P1 manager delegation shift close gate",
    });

    expect(close.status, JSON.stringify(close.data)).toBe(201);
    expect(close.data.data?.auditId).toBeTruthy();
    expect(close.data.data?.cashierUsername).toBe(USERS.CASHIER);
    expect(close.data.data?.managerActorId).toBe(manager.id);
  });
});

// ─── P1 promoted: E3 ────────────────────────────────────────────────────────
//
// E3 has been moved out of the fixme'd batch-2 describe because its backend
// is now wired. The route `POST /api/v1/integrations/:restaurantId/:platform/
// menu-sync` accepts `X-Integration-Fixture: upstream_timeout` (gated on
// NODE_ENV !== "production") and returns 503 with a willRetry flag without
// mutating the local menu — matching the audit E3 oracle. The test is
// read-only (no order / user / menu mutation from the test harness itself),
// so it does not need the afterEach teardown from the batch-2 block.

test.describe("Tier 2 P1 current-quarter gates - batch 2 promoted", () => {
  test("E3 failed third-party menu sync keeps local menu authoritative and records retry", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);
    const before = await fetch(
      `${API_URL}/api/v1/menu/${RESTAURANT_ID}/items/${MENU.HONG_CHA}`,
      { headers: readHeaders(ownerAuth) },
    );
    const beforeData = await readJson(before);

    const sync = await postJson(
      `/api/v1/integrations/${RESTAURANT_ID}/uber_eats/menu-sync`,
      ownerAuth,
      { fixture: "upstream_timeout" },
      { "X-Integration-Fixture": "upstream_timeout" },
    );

    expect([202, 503]).toContain(sync.status);
    expect(JSON.stringify(sync.data).toLowerCase()).toMatch(/retry|failed/);

    const after = await fetch(
      `${API_URL}/api/v1/menu/${RESTAURANT_ID}/items/${MENU.HONG_CHA}`,
      { headers: readHeaders(ownerAuth) },
    );
    const afterData = await readJson(after);

    expect(after.status, JSON.stringify(afterData)).toBe(200);
    expect(afterData.data?.id).toBe(beforeData.data?.id);
    expect(afterData.data?.updatedAt).toBe(beforeData.data?.updatedAt);
  });
});
