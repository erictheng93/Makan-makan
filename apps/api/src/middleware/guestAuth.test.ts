import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { guestSessionAuth, guestTokenAuth } from "./guestAuth";

function createKv(value: unknown) {
  return {
    get: vi.fn(async () => value),
  };
}

describe("guestTokenAuth", () => {
  it("rejects missing guest bearer tokens", async () => {
    const app = new Hono();
    app.use("/orders/:id", guestTokenAuth);
    app.get("/orders/:id", (c) => c.json({ guest: c.get("guestOrder") }));

    const response = await app.fetch(
      new Request("https://api.test/orders/order-1"),
      { CACHE_KV: createKv(null) } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Missing or invalid guest token",
    });
    expect(response.status).toBe(401);
  });

  it("rejects guest tokens bound to a different order id", async () => {
    const app = new Hono();
    app.use("/orders/:id", guestTokenAuth);
    app.get("/orders/:id", (c) => c.json({ guest: c.get("guestOrder") }));

    const response = await app.fetch(
      new Request("https://api.test/orders/order-2", {
        headers: { Authorization: "Bearer gt_abc" },
      }),
      {
        CACHE_KV: createKv({
          orderId: "order-1",
          restaurantId: "rest-1",
          guestName: "Ada",
          phoneLastDigits: "1234",
          createdAt: Date.now(),
        }),
      } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Token does not match this order",
    });
    expect(response.status).toBe(403);
  });
});

describe("guestSessionAuth", () => {
  it("attaches valid guest sessions", async () => {
    const app = new Hono();
    app.use("/guest-orders", guestSessionAuth);
    app.post("/guest-orders", (c) =>
      c.json({ guestSession: c.get("guestSession") }),
    );

    const response = await app.fetch(
      new Request("https://api.test/guest-orders", {
        method: "POST",
        headers: { Authorization: "Bearer gt_abc" },
      }),
      {
        CACHE_KV: createKv({
          restaurantId: "rest-1",
          phoneLastDigits: "1234",
          createdAt: Date.now(),
        }),
      } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      guestSession: { restaurantId: "rest-1", phoneLastDigits: "1234" },
    });
    expect(response.status).toBe(200);
  });
});
