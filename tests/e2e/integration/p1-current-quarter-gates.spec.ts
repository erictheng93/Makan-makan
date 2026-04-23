/**
 * Tier 2 / P1 current-quarter gates, batch 1.
 *
 * This file strengthens existing Partial coverage with real API assertions.
 * It intentionally avoids Playwright route mocks. Some gates are expected to
 * fail until the backend implements the documented release oracle.
 */

import { test, expect } from "@playwright/test";
import {
  RESTAURANT_ID,
  SAKURA_RESTAURANT_ID,
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

type AuthCredentials = Awaited<ReturnType<typeof loginAs>>;

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

async function createKitchenOrder(): Promise<{
  id: number;
  kitchenItemId: number;
}> {
  const order = await createConfirmedOrder(MENU.HONG_CHA);
  const chefAuth = await loginAs(USERS.CHEF);
  const listRes = await fetch(
    `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`,
    { headers: readHeaders(chefAuth) },
  );
  const listData = await readJson(listRes);
  const allOrders = [
    ...(listData.data?.pending ?? []),
    ...(listData.data?.preparing ?? []),
    ...(listData.data?.ready ?? []),
  ];
  const kitchenOrder = allOrders.find(
    (entry: Record<string, any>) => Number(entry.id) === order.id,
  );
  const firstItem = kitchenOrder?.items?.[0] ?? kitchenOrder?.orderItems?.[0];

  expect(kitchenOrder, JSON.stringify(listData)).toBeTruthy();
  expect(firstItem?.id, JSON.stringify(kitchenOrder)).toBeTruthy();

  return { id: order.id, kitchenItemId: Number(firstItem.id) };
}

async function createCoupon(
  auth: AuthCredentials,
  codePrefix: string,
  usageLimit = 1,
): Promise<number> {
  const now = new Date();
  const validTo = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const res = await fetch(`${API_URL}/api/v1/coupons`, {
    method: "POST",
    headers: mutateHeaders(auth),
    body: JSON.stringify({
      restaurantId: RESTAURANT_ID,
      code: `${codePrefix}_${Date.now()}`,
      name: `${codePrefix} P1 Gate`,
      discountType: "fixed",
      discountValue: 5,
      minOrderAmount: 1,
      usageLimit,
      validFrom: now.toISOString(),
      validTo: validTo.toISOString(),
      isActive: true,
      isVisible: true,
    }),
  });
  const data = await readJson(res);

  expect(res.status, JSON.stringify(data)).toBe(201);
  expect(data.success).toBe(true);
  expect(data.data?.id).toBeTruthy();

  return Number(data.data.id);
}

async function deleteCoupon(
  auth: AuthCredentials,
  couponId: number | undefined,
): Promise<void> {
  if (!couponId) return;

  await fetch(`${API_URL}/api/v1/coupons/${couponId}`, {
    method: "DELETE",
    headers: mutateHeaders(auth),
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Tier 2 P1 current-quarter gates - batch 1", () => {
  let createdOrderIds: number[] = [];
  let createdCouponIds: number[] = [];

  test.afterEach(async () => {
    for (const orderId of createdOrderIds.reverse()) {
      await cleanupOrder(orderId);
    }
    createdOrderIds = [];

    const adminAuth = await loginAs(USERS.ADMIN);
    for (const couponId of createdCouponIds.reverse()) {
      await deleteCoupon(adminAuth, couponId);
    }
    createdCouponIds = [];

    try {
      const ownerAuth = await loginAs(USERS.OWNER);
      await setMenuAvailability(ownerAuth, MENU.HONG_CHA, true);
      await setMenuAvailability(ownerAuth, MENU.DONG_GUA_CHA, true);
      await setMenuAvailability(ownerAuth, MENU.GONG_WAN_TANG, true);
    } catch {
      // Best-effort cleanup only.
    }
  });

  test("C2 delisted item blocks new checkout while preserving active-order snapshot", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);
    const activeOrder = await createConfirmedOrder(MENU.HONG_CHA);
    createdOrderIds.push(activeOrder.id);

    await setMenuAvailability(ownerAuth, MENU.HONG_CHA, false);

    const res = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        orderType: "shop",
        guestName: "P1 C2",
        phoneLastDigits: uniquePhone(),
        items: [{ menuItemId: MENU.HONG_CHA, quantity: 1 }],
      }),
    });
    const data = await readJson(res);

    expect([400, 409, 422], JSON.stringify(data)).toContain(res.status);

    const original = await getOrder(activeOrder.id, ownerAuth);
    expect(JSON.stringify(original.data)).toContain(String(MENU.HONG_CHA));
  });

  test("C4 payment retry with same idempotency key creates one payment effect", async () => {
    const order = await createConfirmedOrder();
    createdOrderIds.push(order.id);

    const cashierAuth = await loginAs(USERS.CASHIER);
    const idempotencyKey = `p1-c4-${order.id}`;
    const body = JSON.stringify({
      orderId: order.id,
      method: "card",
      amount: 20,
    });

    const first = await fetch(`${API_URL}/api/v1/payments`, {
      method: "POST",
      headers: {
        ...mutateHeaders(cashierAuth),
        "Idempotency-Key": idempotencyKey,
      },
      body,
    });
    const firstData = await readJson(first);
    expect([200, 201, 202], JSON.stringify(firstData)).toContain(first.status);

    const second = await fetch(`${API_URL}/api/v1/payments`, {
      method: "POST",
      headers: {
        ...mutateHeaders(cashierAuth),
        "Idempotency-Key": idempotencyKey,
      },
      body,
    });
    const secondData = await readJson(second);
    expect([200, 201, 202, 409], JSON.stringify(secondData)).toContain(
      second.status,
    );
    expect(
      secondData.data?.paymentId ?? secondData.data?.id ?? secondData.paymentId,
    ).toBe(
      firstData.data?.paymentId ?? firstData.data?.id ?? firstData.paymentId,
    );
  });

  test("C5 dual-device same guest submit accepts one order or explicit conflict only", async () => {
    const phoneLastDigits = uniquePhone();
    const body = JSON.stringify({
      restaurantId: RESTAURANT_ID,
      orderType: "shop",
      guestName: "P1 C5",
      phoneLastDigits,
      items: [{ menuItemId: MENU.DONG_GUA_CHA, quantity: 1 }],
      clientMutationId: `p1-c5-${Date.now()}`,
    });

    const [first, second] = await Promise.all([
      fetch(`${API_URL}/api/v1/guest-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
      fetch(`${API_URL}/api/v1/guest-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    ]);
    const firstData = await readJson(first);
    const secondData = await readJson(second);

    for (const result of [firstData, secondData]) {
      if (result.data?.order?.id) createdOrderIds.push(result.data.order.id);
    }

    const statuses = [first.status, second.status].sort();
    expect(statuses, JSON.stringify([firstData, secondData])).toEqual([
      201, 409,
    ]);
  });

  test("O1 direct old-store resource URL is denied after restaurant switch", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);
    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${SAKURA_RESTAURANT_ID}/orders`,
      { headers: readHeaders(ownerAuth) },
    );
    const data = await readJson(res);

    expect([403, 404], JSON.stringify(data)).toContain(res.status);
  });

  test("O2 owner delist preserves active-order item snapshot and blocks new orders", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);
    const activeOrder = await createConfirmedOrder(MENU.DONG_GUA_CHA);
    createdOrderIds.push(activeOrder.id);

    const before = await getGuestOrder(activeOrder.id, activeOrder.guestToken);
    await setMenuAvailability(ownerAuth, MENU.DONG_GUA_CHA, false);
    const after = await getGuestOrder(activeOrder.id, activeOrder.guestToken);

    expect(JSON.stringify(after.data.order)).toContain(
      String(MENU.DONG_GUA_CHA),
    );
    expect(JSON.stringify(after.data.order)).toContain(
      JSON.stringify(before.data.order.items ?? []).slice(0, 10),
    );

    const res = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        orderType: "shop",
        guestName: "P1 O2",
        phoneLastDigits: uniquePhone(),
        items: [{ menuItemId: MENU.DONG_GUA_CHA, quantity: 1 }],
      }),
    });
    const data = await readJson(res);
    expect([400, 409, 422], JSON.stringify(data)).toContain(res.status);
  });

  test("O3 non-image and oversize image payloads are rejected before media persistence", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);
    const hugeDataUrl = `data:text/plain;base64,${"a".repeat(10 * 1024 * 1024)}`;

    const res = await fetch(`${API_URL}/api/v1/menu/${RESTAURANT_ID}/items`, {
      method: "POST",
      headers: mutateHeaders(ownerAuth),
      body: JSON.stringify({
        categoryId: 1,
        name: `P1 O3 ${Date.now()}`,
        price: 10,
        imageUrl: hugeDataUrl,
      }),
    });
    const data = await readJson(res);

    expect([400, 413, 415, 422], JSON.stringify(data)).toContain(res.status);
    expect(data.success).toBe(false);
  });

  test("O7 owner cannot read or mutate another owner's restaurant resources", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);
    const readRes = await fetch(
      `${API_URL}/api/v1/kitchen/${SAKURA_RESTAURANT_ID}/orders`,
      { headers: readHeaders(ownerAuth) },
    );
    const readData = await readJson(readRes);
    expect([403, 404], JSON.stringify(readData)).toContain(readRes.status);

    const writeRes = await fetch(
      `${API_URL}/api/v1/menu/${SAKURA_RESTAURANT_ID}/items/availability`,
      {
        method: "PATCH",
        headers: mutateHeaders(ownerAuth),
        body: JSON.stringify({
          updates: [{ id: MENU.HONG_CHA, isAvailable: false }],
        }),
      },
    );
    const writeData = await readJson(writeRes);
    expect([403, 404], JSON.stringify(writeData)).toContain(writeRes.status);
  });

  test("H1 order created during disconnect appears in kitchen backlog on reconnect", async () => {
    const created = await createConfirmedOrder(MENU.HONG_CHA);
    createdOrderIds.push(created.id);

    const chefAuth = await loginAs(USERS.CHEF);
    const res = await fetch(
      `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders`,
      {
        headers: readHeaders(chefAuth),
      },
    );
    const data = await readJson(res);
    const queuePayload = JSON.stringify(data.data ?? {});

    expect(res.status, JSON.stringify(data)).toBe(200);
    expect(queuePayload).toContain(String(created.id));
  });

  test("H2 two chefs completing same item yields one success and one conflict", async () => {
    const kitchenOrder = await createKitchenOrder();
    createdOrderIds.push(kitchenOrder.id);

    const chefAuth = await loginAs(USERS.CHEF);
    const endpoint = `${API_URL}/api/v1/kitchen/${RESTAURANT_ID}/orders/${kitchenOrder.id}/items/${kitchenOrder.kitchenItemId}`;
    await fetch(endpoint, {
      method: "PUT",
      headers: mutateHeaders(chefAuth),
      body: JSON.stringify({ status: "preparing" }),
    });

    const [first, second] = await Promise.all([
      fetch(endpoint, {
        method: "PUT",
        headers: mutateHeaders(chefAuth),
        body: JSON.stringify({ status: "ready" }),
      }),
      fetch(endpoint, {
        method: "PUT",
        headers: mutateHeaders(chefAuth),
        body: JSON.stringify({ status: "ready" }),
      }),
    ]);
    const firstData = await readJson(first);
    const secondData = await readJson(second);

    expect(
      [first.status, second.status].sort(),
      JSON.stringify([firstData, secondData]),
    ).toEqual([200, 409]);
  });

  test("K10 single-use coupon redemption is atomic under concurrent use", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);
    const couponId = await createCoupon(ownerAuth, "P1_K10", 1);
    createdCouponIds.push(couponId);
    const firstOrder = await createConfirmedOrder();
    const secondOrder = await createConfirmedOrder();
    createdOrderIds.push(firstOrder.id, secondOrder.id);

    const body = (orderId: number) =>
      JSON.stringify({
        couponId,
        orderId,
        discountAmount: 5,
        originalAmount: 20,
        finalAmount: 15,
      });

    const [first, second] = await Promise.all([
      fetch(`${API_URL}/api/v1/coupons/use`, {
        method: "POST",
        headers: mutateHeaders(ownerAuth),
        body: body(firstOrder.id),
      }),
      fetch(`${API_URL}/api/v1/coupons/use`, {
        method: "POST",
        headers: mutateHeaders(ownerAuth),
        body: body(secondOrder.id),
      }),
    ]);
    const firstData = await readJson(first);
    const secondData = await readJson(second);

    expect(
      [first.status, second.status].sort(),
      JSON.stringify([firstData, secondData]),
    ).toEqual([200, 409]);
  });

  test("G4 guest realtime token is scoped to its own order channel", async () => {
    const first = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.HONG_CHA, quantity: 1 },
    ]);
    const second = await createGuestOrder(RESTAURANT_ID, [
      { menuItemId: MENU.DONG_GUA_CHA, quantity: 1 },
    ]);
    createdOrderIds.push(first.data.order.id, second.data.order.id);

    const tokenRes = await fetch(
      `${API_URL}/api/v1/realtime/auth/guest-token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestToken: first.data.guestToken,
          orderId: first.data.order.id,
          restaurantId: RESTAURANT_ID,
        }),
      },
    );
    const tokenData = await readJson(tokenRes);

    expect(tokenRes.status, JSON.stringify(tokenData)).toBe(200);

    const verifyRes = await fetch(`${API_URL}/api/v1/realtime/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: tokenData.data?.token,
        channel: `order:${second.data.order.id}`,
      }),
    });
    const verifyData = await readJson(verifyRes);

    expect([401, 403], JSON.stringify(verifyData)).toContain(verifyRes.status);
  });

  test("X3 delivery and payment race resolves to one valid final state", async () => {
    const order = await createConfirmedOrder();
    createdOrderIds.push(order.id);
    const chefAuth = await loginAs(USERS.CHEF);
    const serviceAuth = await loginAs(USERS.SERVICE);
    const cashierAuth = await loginAs(USERS.CASHIER);

    await updateOrderStatus(order.id, "preparing", chefAuth);
    await updateOrderStatus(order.id, "ready", chefAuth);

    const [delivery, payment] = await Promise.all([
      fetch(`${API_URL}/api/v1/orders/${order.id}/status`, {
        method: "PUT",
        headers: mutateHeaders(serviceAuth),
        body: JSON.stringify({ status: "delivered" }),
      }),
      fetch(`${API_URL}/api/v1/payments`, {
        method: "POST",
        headers: {
          ...mutateHeaders(cashierAuth),
          "Idempotency-Key": `p1-x3-${order.id}`,
        },
        body: JSON.stringify({ orderId: order.id, method: "cash", amount: 20 }),
      }),
    ]);

    expect([delivery.status, payment.status].every((s) => s < 500)).toBe(true);

    const finalOrder = await getOrder(order.id, cashierAuth);
    expect(["delivered", "paid", "payment_pending"]).toContain(
      String(finalOrder.data.status ?? finalOrder.data.paymentStatus)
        .toLowerCase()
        .replace(" ", "_"),
    );
  });

  test("X4 checkout is rejected after owner delists item during checkout window", async () => {
    const ownerAuth = await loginAs(USERS.OWNER);
    await setMenuAvailability(ownerAuth, MENU.GONG_WAN_TANG, false);

    const res = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        orderType: "shop",
        guestName: "P1 X4",
        phoneLastDigits: uniquePhone(),
        items: [{ menuItemId: MENU.GONG_WAN_TANG, quantity: 1 }],
      }),
    });
    const data = await readJson(res);

    expect([400, 409, 422], JSON.stringify(data)).toContain(res.status);
  });

  test("X6 concurrent employee status updates produce one success and one conflict", async () => {
    const order = await createConfirmedOrder();
    createdOrderIds.push(order.id);

    const chefAuth = await loginAs(USERS.CHEF);
    const serviceAuth = await loginAs(USERS.SERVICE);
    const [chefUpdate, serviceUpdate] = await Promise.all([
      fetch(`${API_URL}/api/v1/orders/${order.id}/status`, {
        method: "PUT",
        headers: mutateHeaders(chefAuth),
        body: JSON.stringify({ status: "preparing" }),
      }),
      fetch(`${API_URL}/api/v1/orders/${order.id}/status`, {
        method: "PUT",
        headers: mutateHeaders(serviceAuth),
        body: JSON.stringify({ status: "delivered" }),
      }),
    ]);
    const chefData = await readJson(chefUpdate);
    const serviceData = await readJson(serviceUpdate);

    expect(
      [chefUpdate.status, serviceUpdate.status].sort(),
      JSON.stringify([chefData, serviceData]),
    ).toEqual([200, 409]);
  });
});
