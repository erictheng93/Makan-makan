import { Hono } from "hono";
import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";
import { idempotencyMiddleware, type IdempotencyOptions } from "./idempotency";
import type { Env } from "../types/env";

interface StoredRecord {
  key: string;
  scope: string;
  request_hash: string;
  response_status: number | null;
  response_body: string | null;
  effect_id: string | null;
  created_at: number;
  expires_at: number;
}

/**
 * In-memory stand-in for the `idempotency_keys` table. The middleware only
 * issues four statements against it, so dispatching on the leading verb is
 * enough — and it keeps the reservation lifecycle (reserve → store or release)
 * observable, which is the thing under test.
 */
function createIdempotencyDb() {
  const table = new Map<string, StoredRecord>();

  const prepare = vi.fn((sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () => table.get(args[0] as string) ?? null,
      run: async () => {
        const verb = sql.trim().split(/\s+/)[0].toUpperCase();

        if (verb === "DELETE") {
          const removed = table.delete(args[0] as string);
          return { meta: { changes: removed ? 1 : 0 } };
        }

        if (verb === "INSERT") {
          const [key, scope, requestHash, createdAt, expiresAt] = args as [
            string,
            string,
            string,
            number,
            number,
          ];
          // INSERT OR IGNORE: an existing reservation wins and reports no change.
          if (table.has(key)) return { meta: { changes: 0 } };
          table.set(key, {
            key,
            scope,
            request_hash: requestHash,
            response_status: null,
            response_body: null,
            effect_id: null,
            created_at: createdAt,
            expires_at: expiresAt,
          });
          return { meta: { changes: 1 } };
        }

        if (verb === "UPDATE") {
          const [status, body, effectId, key] = args as [
            number,
            string,
            string | null,
            string,
          ];
          const existing = table.get(key);
          if (!existing) return { meta: { changes: 0 } };
          existing.response_status = status;
          existing.response_body = body;
          existing.effect_id = effectId;
          return { meta: { changes: 1 } };
        }

        throw new Error(`Unexpected statement in idempotency fake: ${sql}`);
      },
    }),
  }));

  return { table, prepare };
}

type Handler = (c: Context<{ Bindings: Env }>) => Response | Promise<Response>;

function createApp(
  options: Omit<IdempotencyOptions, "scope"> & { scope?: string },
  handler: Handler,
) {
  const app = new Hono<{ Bindings: Env }>();
  app.post("/", idempotencyMiddleware({ scope: "test", ...options }), handler);
  return app;
}

const KEY = "event-1";

function post(app: Hono<{ Bindings: Env }>, db: { prepare: unknown }) {
  return app.fetch(
    new Request("https://api.test/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": KEY,
      },
      body: JSON.stringify({ orderId: "uber-order-1" }),
    }),
    { DB: db } as never,
  );
}

describe("idempotencyMiddleware", () => {
  describe("releaseOnServerError", () => {
    it("releases the reservation so a redelivery re-runs the handler", async () => {
      const db = createIdempotencyDb();
      const handler = vi
        .fn<Handler>()
        .mockImplementationOnce((c) =>
          c.json(
            {
              success: false,
              error: {
                code: "WEBHOOK_PROCESSING_FAILED",
                message: "Processing failed",
              },
            },
            500,
          ),
        )
        .mockImplementationOnce((c) =>
          c.json({ success: true, data: { orderId: 101 } }, 200),
        );
      const app = createApp({ releaseOnServerError: true }, handler);

      const first = await post(app, db);

      expect(first.status).toBe(500);
      expect(first.headers.get("X-Idempotent-Replay")).toBeNull();
      // Nothing cached, and no reservation left behind either — an in-progress
      // row would answer the redelivery with 409 instead of re-running.
      expect(db.table.size).toBe(0);

      const second = await post(app, db);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(second.status).toBe(200);
      expect(second.headers.get("X-Idempotent-Replay")).toBeNull();
      await expect(second.json()).resolves.toEqual({
        success: true,
        data: { orderId: 101 },
      });
      expect(db.table.get(KEY)).toMatchObject({
        scope: "test",
        response_status: 200,
      });
    });

    it("releases the reservation when the handler throws instead of returning", async () => {
      // The house style is to let errors propagate to the global handler
      // rather than format them in the route (see CLAUDE.md), so the thrown
      // path is the common one — Hono catches at the inner dispatch frame and
      // turns the exception into the response this middleware then inspects.
      // A release that only fired on an explicit `return c.json(..., 500)`
      // would miss every handler written the documented way.
      const db = createIdempotencyDb();
      const handler = vi
        .fn<Handler>()
        .mockImplementationOnce(() => {
          throw new Error("D1 write failed");
        })
        .mockImplementationOnce((c) =>
          c.json({ success: true, data: { orderId: 101 } }, 200),
        );
      const app = createApp({ releaseOnServerError: true }, handler);

      const first = await post(app, db);

      expect(first.status).toBe(500);
      expect(db.table.size).toBe(0);

      const second = await post(app, db);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(second.status).toBe(200);
      expect(second.headers.get("X-Idempotent-Replay")).toBeNull();
    });
  });

  describe("default (releaseOnServerError off)", () => {
    it("caches and replays a 5xx, pinning today's payment-route behaviour", async () => {
      const db = createIdempotencyDb();
      const handler = vi.fn<Handler>((c) =>
        c.json(
          {
            success: false,
            error: { code: "PAYMENT_FAILED", message: "Gateway rejected" },
          },
          500,
        ),
      );
      const app = createApp({}, handler);

      const first = await post(app, db);

      expect(first.status).toBe(500);
      expect(db.table.get(KEY)).toMatchObject({ response_status: 500 });

      const second = await post(app, db);

      // A partially-effectful payment must not be re-run just because it 500ed.
      expect(handler).toHaveBeenCalledTimes(1);
      expect(second.status).toBe(500);
      expect(second.headers.get("X-Idempotent-Replay")).toBe("true");
      await expect(second.json()).resolves.toMatchObject({
        success: false,
        error: { code: "PAYMENT_FAILED" },
      });
    });
  });

  describe.each([
    ["releaseOnServerError on", true],
    ["releaseOnServerError off", false],
  ])("2xx caching with %s", (_label, releaseOnServerError) => {
    it("stores the success and replays it on the next identical request", async () => {
      const db = createIdempotencyDb();
      const handler = vi.fn<Handler>((c) =>
        c.json({ success: true, data: { orderId: 101 } }, 200),
      );
      const app = createApp({ releaseOnServerError }, handler);

      const first = await post(app, db);

      expect(first.status).toBe(200);
      expect(first.headers.get("X-Idempotent-Replay")).toBeNull();

      const second = await post(app, db);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(second.status).toBe(200);
      expect(second.headers.get("X-Idempotent-Replay")).toBe("true");
      await expect(second.json()).resolves.toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            orderId: 101,
            duplicateEffects: 0,
          }),
        }),
      );
    });
  });
});
