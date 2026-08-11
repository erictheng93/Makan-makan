/**
 * Integration test for bug-inventory #4.
 *
 * Reproduces the app-factory mount structure for `/orders/*`:
 *   app.route("/orders/group", groupOrdersRoutes)  // mounted first
 *   app.route("/orders", ordersRoutes)             // mounted second
 * WITHOUT a blanket `use("/orders/*", authMiddleware)` gate.
 *
 * Proves two facts:
 *  1. An anonymous group-order join (share-code auth, no JWT) reaches its
 *     handler and succeeds — the fix for the over-broad gate.
 *  2. A protected `/orders` route still returns 401 without a JWT, because
 *     every orders route carries its own per-route customerAuthMiddleware.
 *
 * Hono-ordering evidence: middleware/handlers execute in registration order.
 * A blanket `use("/orders/*", ...)` registered BEFORE these mounts (as it was
 * in app-factory.ts) runs first and rejects anonymous requests before the
 * concrete sub-app handlers get a chance. Removing it lets each sub-app's own
 * per-route auth chain decide — which is what this test asserts.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

const groupServiceMocks = vi.hoisted(() => ({
  createGroupOrder: vi.fn(),
  previewGroupByShareCode: vi.fn(),
  joinGroup: vi.fn(),
  recoverHost: vi.fn(),
}));

vi.mock("../services/GroupOrdersService", () => ({
  GroupOrdersService: vi.fn(function GroupOrdersService() {
    return {
      createGroupOrder: groupServiceMocks.createGroupOrder,
      previewGroupByShareCode: groupServiceMocks.previewGroupByShareCode,
      joinGroup: groupServiceMocks.joinGroup,
      recoverHost: groupServiceMocks.recoverHost,
    };
  }),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(
    (_moduleKey: string, fallback?: (c: unknown) => Promise<unknown>) =>
      async (c: unknown, next: () => Promise<void>) => {
        if (fallback) await fallback(c);
        await next();
      },
  ),
}));

vi.mock("../../../middleware/quotaGate", () => ({
  quotaGate: vi.fn(
    (_meterKey: string, fallback?: (c: unknown) => Promise<unknown>) =>
      async (c: unknown, next: () => Promise<void>) => {
        if (fallback) await fallback(c);
        await next();
      },
  ),
}));

vi.mock("../../../middleware/rateLimit", () => ({
  publicRateLimit: vi.fn(async (_c, next) => next()),
  strictRateLimit: vi.fn(async (_c, next) => next()),
}));

vi.mock("@makanmasak/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@makanmasak/database")>();
  return {
    ...actual,
    RealtimeBroadcastService: vi.fn(function RealtimeBroadcastService() {
      return {
        generateEventId: () => "evt-1",
        broadcastEvent: vi.fn(async () => undefined),
      };
    }),
  };
});

import groupOrdersRoutes from "./index";
import ordersRoutes from "../../orders/routes";

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as 400 | 401 | 403 | 404 | 409 | 500,
      );
    }
    return c.json(
      { success: false, error: { code: "INTERNAL", message: String(err) } },
      500,
    );
  });
  // Mirror app-factory registration order: group mounted before orders, with
  // NO blanket `/orders/*` auth gate.
  app.route("/orders/group", groupOrdersRoutes);
  app.route("/orders", ordersRoutes);
  return app;
}

const env = { DB: {}, CACHE_KV: {} } as never;

async function withSilencedConsole<T>(action: () => Promise<T>): Promise<T> {
  const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    return await action();
  } finally {
    spy.mockRestore();
  }
}

describe("orders/* auth gating (bug #4)", () => {
  beforeEach(() => {
    groupServiceMocks.createGroupOrder.mockReset();
    groupServiceMocks.previewGroupByShareCode.mockReset();
    groupServiceMocks.joinGroup.mockReset();
    groupServiceMocks.recoverHost.mockReset();
  });

  it("allows an anonymous guest to create a group order without a JWT", async () => {
    groupServiceMocks.createGroupOrder.mockResolvedValue({
      success: true,
      data: {
        groupOrderId: "go-1",
        shareCode: "ABC12345",
        expiresAt: new Date(),
        host: { id: "m-1", memberName: "Guest Host" },
        memberToken: "session-1",
        recoveryCode: "recovery-1",
      },
    });

    const response = await buildApp().fetch(
      new Request("https://test/orders/group/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restaurantId: "rest-1", hostName: "Guest" }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(groupServiceMocks.createGroupOrder).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "rest-1" }),
      null,
    );
  });

  it("keeps the body readable for validation after guest gate fallback reads it", async () => {
    groupServiceMocks.createGroupOrder.mockResolvedValue({
      success: true,
      data: {
        groupOrderId: "go-1",
        shareCode: "ABC12345",
        expiresAt: new Date(),
        host: { id: "m-1" },
        memberToken: "session-1",
        recoveryCode: "recovery-1",
      },
    });

    const response = await buildApp().fetch(
      new Request("https://test/orders/group/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurantId: "rest-1",
          fulfillmentType: "pickup",
          pickupAt: "2026-08-04T12:00:00.000Z",
        }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(groupServiceMocks.createGroupOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        fulfillmentType: "pickup",
        pickupAt: "2026-08-04T12:00:00.000Z",
      }),
      null,
    );
  });

  it("returns 400 rather than 500 for empty or non-json create bodies", async () => {
    const emptyResponse = await withSilencedConsole(() =>
      buildApp().fetch(
        new Request("https://test/orders/group/create", { method: "POST" }),
        env,
      ),
    );
    expect(emptyResponse.status).toBe(400);

    const textResponse = await withSilencedConsole(() =>
      buildApp().fetch(
        new Request("https://test/orders/group/create", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "not json",
        }),
        env,
      ),
    );
    expect(textResponse.status).toBe(400);
    expect(groupServiceMocks.createGroupOrder).not.toHaveBeenCalled();
  });

  it("validates delivery and pickup fulfillment requirements", async () => {
    const deliveryResponse = await withSilencedConsole(() =>
      buildApp().fetch(
        new Request("https://test/orders/group/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            restaurantId: "rest-1",
            fulfillmentType: "delivery",
          }),
        }),
        env,
      ),
    );
    const pickupResponse = await withSilencedConsole(() =>
      buildApp().fetch(
        new Request("https://test/orders/group/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            restaurantId: "rest-1",
            fulfillmentType: "pickup",
          }),
        }),
        env,
      ),
    );

    expect(deliveryResponse.status).toBe(400);
    expect(pickupResponse.status).toBe(400);
  });

  it("allows anonymous group-order join without a JWT", async () => {
    groupServiceMocks.joinGroup.mockResolvedValue({
      success: true,
      data: {
        groupOrder: { groupOrderId: "go-1", restaurantId: "r-1" },
        member: { id: "m-1", memberName: "Guest" },
      },
    });

    const response = await buildApp().fetch(
      new Request("https://test/orders/group/join/ABC123", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberName: "Guest" }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(groupServiceMocks.joinGroup).toHaveBeenCalledWith(
      "ABC123",
      expect.objectContaining({ memberName: "Guest" }),
    );
  });

  it("returns a join preview without joining", async () => {
    groupServiceMocks.previewGroupByShareCode.mockResolvedValue({
      found: true,
      data: {
        groupOrderId: "go-1",
        restaurantId: "r-1",
        hostName: "Alex",
        memberCount: 2,
        fulfillmentType: "dine_in",
        expiresAt: new Date(),
        status: "active",
      },
    });

    const response = await buildApp().fetch(
      new Request("https://test/orders/group/join/ABC12345", {
        method: "GET",
      }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { hostName: "Alex", memberCount: 2 },
    });
    expect(groupServiceMocks.joinGroup).not.toHaveBeenCalled();
  });

  it("allows anonymous host recovery without a JWT", async () => {
    groupServiceMocks.recoverHost.mockResolvedValue({
      success: true,
      data: { memberToken: "new-session-1" },
    });

    const response = await buildApp().fetch(
      new Request(
        "https://test/orders/group/11111111-1111-4111-8111-111111111111/recover",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ recoveryCode: "correct-code" }),
        },
      ),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { memberToken: "new-session-1" },
    });
    expect(groupServiceMocks.recoverHost).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "correct-code",
    );
  });

  it("still rejects a protected /orders route without a JWT", async () => {
    const response = await withSilencedConsole(() =>
      buildApp().fetch(
        new Request("https://test/orders", { method: "GET" }),
        env,
      ),
    );

    expect(response.status).toBe(401);
    expect(groupServiceMocks.joinGroup).not.toHaveBeenCalled();
  });
});
