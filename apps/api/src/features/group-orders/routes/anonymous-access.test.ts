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
  joinGroup: vi.fn(),
}));

vi.mock("../services/GroupOrdersService", () => ({
  GroupOrdersService: vi.fn(function GroupOrdersService() {
    return { joinGroup: groupServiceMocks.joinGroup };
  }),
}));

vi.mock("@makanmakan/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@makanmakan/database")>();
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
    groupServiceMocks.joinGroup.mockReset();
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
