import { describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import { meterEmit } from "../meter";
import type { Env } from "../../../types/env";

function createDbMock() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  const db = { prepare };
  return { db: db as unknown as Env["DB"], prepare, bind, run };
}

function createContext(options: {
  restaurantId?: string | null;
  waitUntil?: ReturnType<typeof vi.fn>;
  db: Env["DB"];
}) {
  return {
    env: { DB: options.db },
    get: vi.fn((key: string) => {
      if (key !== "user") return undefined;
      return {
        id: 1,
        username: "owner",
        role: 1,
        restaurantId: options.restaurantId,
      };
    }),
    executionCtx: options.waitUntil
      ? { waitUntil: options.waitUntil }
      : undefined,
  } as unknown as Context<{ Bindings: Env }>;
}

describe("meterEmit", () => {
  it("writes usage events through executionCtx.waitUntil when available", async () => {
    const { db, bind } = createDbMock();
    const waitUntil = vi.fn();
    const c = createContext({ restaurantId: "rest-1", waitUntil, db });

    await meterEmit(c, "api.requests", {
      metadata: { path: "/api/v1/orders" },
    });

    expect(waitUntil).toHaveBeenCalledOnce();
    await waitUntil.mock.calls[0][0];
    expect(bind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      "api.requests",
      1,
      JSON.stringify({ path: "/api/v1/orders" }),
    );
  });

  it("awaits the insert inline when executionCtx is absent", async () => {
    const { db, run } = createDbMock();
    const c = createContext({ restaurantId: "rest-1", db });

    await meterEmit(c, "orders.created", { quantity: 3 });

    expect(run).toHaveBeenCalledOnce();
  });

  it("skips events without a restaurant context", async () => {
    const { db, prepare } = createDbMock();
    const c = createContext({ restaurantId: null, db });

    await meterEmit(c, "api.requests");

    expect(prepare).not.toHaveBeenCalled();
  });
});
