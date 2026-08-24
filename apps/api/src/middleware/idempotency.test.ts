import { Hono } from "hono";
import type { Context } from "hono";
import { describe, expect, it, vi } from "vitest";
import { idempotencyMiddleware, type IdempotencyOptions } from "./idempotency";
import { ApiError } from "../shared/utils/api-error";
import type { Env } from "../types/env";

interface StoredRecord {
  key: string;
  scope: string;
  request_hash: string;
  response_status: number | null;
  response_body: string | null;
  effect_id: string | null;
  owner_token: string | null;
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
  let blockedReads: {
    remaining: number;
    release: () => void;
    reached: () => void;
    gate: Promise<void>;
    reachedPromise: Promise<void>;
  } | null = null;

  const prepare = vi.fn((sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () => {
        // A D1 SELECT returns the row it observed, not a mutable reference to
        // whichever owner wins a later CAS while this test has it paused.
        const record = table.get(args[0] as string);
        const snapshot = record ? { ...record } : null;
        if (blockedReads?.remaining) {
          blockedReads.remaining -= 1;
          if (blockedReads.remaining === 0) blockedReads.reached();
          await blockedReads.gate;
        }
        return snapshot;
      },
      run: async () => {
        const verb = sql.trim().split(/\s+/)[0].toUpperCase();

        if (verb === "DELETE") {
          const [key, ownerToken] = args as [string, string];
          const existing = table.get(key);
          const removed =
            existing?.owner_token === ownerToken && table.delete(key);
          return { meta: { changes: removed ? 1 : 0 } };
        }

        if (verb === "INSERT") {
          const [key, scope, requestHash, ownerToken, createdAt, expiresAt] =
            args as [string, string, string, string, number, number];
          // INSERT OR IGNORE: an existing reservation wins and reports no change.
          if (table.has(key)) return { meta: { changes: 0 } };
          table.set(key, {
            key,
            scope,
            request_hash: requestHash,
            response_status: null,
            response_body: null,
            effect_id: null,
            owner_token: ownerToken,
            created_at: createdAt,
            expires_at: expiresAt,
          });
          return { meta: { changes: 1 } };
        }

        if (verb === "UPDATE") {
          if (sql.includes("SET scope = ?")) {
            const [
              scope,
              requestHash,
              ownerToken,
              createdAt,
              expiresAt,
              key,
              observedScope,
              observedRequestHash,
              observedStatus,
              observedBody,
              observedEffectId,
              observedOwnerToken,
              observedCreatedAt,
              observedExpiresAt,
            ] = args as [
              string,
              string,
              string,
              number,
              number,
              string,
              string,
              string,
              number | null,
              string | null,
              string | null,
              string | null,
              number,
              number,
            ];
            const existing = table.get(key);
            if (
              !existing ||
              existing.scope !== observedScope ||
              existing.request_hash !== observedRequestHash ||
              existing.response_status !== observedStatus ||
              existing.response_body !== observedBody ||
              existing.effect_id !== observedEffectId ||
              existing.owner_token !== observedOwnerToken ||
              existing.created_at !== observedCreatedAt ||
              existing.expires_at !== observedExpiresAt
            ) {
              return { meta: { changes: 0 } };
            }
            table.set(key, {
              key,
              scope,
              request_hash: requestHash,
              response_status: null,
              response_body: null,
              effect_id: null,
              owner_token: ownerToken,
              created_at: createdAt,
              expires_at: expiresAt,
            });
            return { meta: { changes: 1 } };
          }

          const [status, body, effectId, key, ownerToken] = args as [
            number,
            string,
            string | null,
            string,
            string,
          ];
          const existing = table.get(key);
          if (
            !existing ||
            existing.owner_token !== ownerToken ||
            existing.response_status !== null
          )
            return { meta: { changes: 0 } };
          existing.response_status = status;
          existing.response_body = body;
          existing.effect_id = effectId;
          return { meta: { changes: 1 } };
        }

        throw new Error(`Unexpected statement in idempotency fake: ${sql}`);
      },
    }),
  }));

  return {
    table,
    prepare,
    blockReads(count: number) {
      let release!: () => void;
      let reached!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const reachedPromise = new Promise<void>((resolve) => {
        reached = resolve;
      });
      blockedReads = {
        remaining: count,
        release,
        reached,
        gate,
        reachedPromise,
      };
      return { release, reached: reachedPromise };
    },
  };
}

type Handler = (c: Context<{ Bindings: Env }>) => Response | Promise<Response>;

function createApp(
  options: Omit<IdempotencyOptions, "scope"> & { scope?: string },
  handler: Handler,
) {
  const app = new Hono<{ Bindings: Env }>();
  app.post("/", idempotencyMiddleware({ scope: "test", ...options }), handler);
  // Mirrors the `app.onError` in app-factory.ts. Without it Hono's default
  // handler flattens every throw to a bare 500, and the middleware's own 409
  // and 422 answers would be untestable — they are thrown, not returned.
  app.onError((err, c) =>
    err instanceof ApiError
      ? c.json(
          { success: false, error: { code: err.code, message: err.message } },
          err.status as 400 | 409 | 422 | 500,
        )
      : c.text("Internal Server Error", 500),
  );
  return app;
}

/**
 * Rewinds the stored record to what an isolate that died mid-request leaves
 * behind: the reservation it wrote before the handler ran, with no response
 * on it. Going through a real request first means the scope and request hash
 * are the ones the middleware itself computes.
 */
function strandReservation(
  db: ReturnType<typeof createIdempotencyDb>,
  ageMs: number,
) {
  const record = db.table.get(KEY);
  if (!record) throw new Error("nothing reserved to strand");
  record.response_status = null;
  record.response_body = null;
  record.created_at = Date.now() - ageMs;
}

const KEY = "event-1";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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

  describe("abandoned reservations", () => {
    it("takes over a reservation no handler ever answered", async () => {
      // The reservation is written before the handler runs and only becomes a
      // response afterwards. An isolate evicted in between leaves a row that
      // answers every later delivery with 409 for the full 24h TTL — the same
      // lost event the replay cache exists to prevent.
      const db = createIdempotencyDb();
      const handler = vi.fn<Handler>((c) =>
        c.json({ success: true, data: { orderId: 101 } }, 200),
      );
      const app = createApp({}, handler);

      await post(app, db);
      strandReservation(db, 61_000);

      const second = await post(app, db);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(second.status).toBe(200);
      expect(second.headers.get("X-Idempotent-Replay")).toBeNull();
      expect(db.table.get(KEY)).toMatchObject({ response_status: 200 });
    });

    it("allows only one handler through when two retries observe the same stale lease", async () => {
      const db = createIdempotencyDb();
      const handler = vi.fn<Handler>((c) =>
        c.json({ success: true, data: { orderId: 101 } }, 200),
      );
      const app = createApp({}, handler);

      await post(app, db);
      strandReservation(db, 61_000);

      const reads = db.blockReads(2);
      const firstRetry = post(app, db);
      const secondRetry = post(app, db);
      await reads.reached;
      reads.release();

      const [first, second] = await Promise.all([firstRetry, secondRetry]);

      // One initial request established the stranded row; precisely one of
      // the concurrent retries may own its replacement reservation.
      expect(handler).toHaveBeenCalledTimes(2);
      expect([first.status, second.status]).toContain(200);
      expect(db.table.get(KEY)).toMatchObject({ response_status: 200 });
    });

    it("cannot let the displaced owner overwrite its replacement response", async () => {
      const db = createIdempotencyDb();
      const oldResponse = deferred<Response>();
      const oldStarted = deferred<void>();
      const handler = vi
        .fn<Handler>()
        .mockImplementationOnce(async () => {
          oldStarted.resolve();
          return await oldResponse.promise;
        })
        .mockImplementationOnce((c) =>
          c.json({ success: true, data: { orderId: 202 } }, 200),
        );
      const app = createApp({}, handler);

      const oldRequest = post(app, db);
      await oldStarted.promise;
      const oldLease = db.table.get(KEY);
      if (!oldLease) throw new Error("old owner did not reserve a key");
      oldLease.created_at = Date.now() - 61_000;

      const replacement = await post(app, db);
      expect(replacement.status).toBe(200);

      oldResponse.resolve(
        new Response(
          JSON.stringify({ success: true, data: { orderId: 101 } }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
      await oldRequest;

      expect(db.table.get(KEY)).toMatchObject({
        response_status: 200,
        response_body: expect.stringContaining("202"),
      });
    });

    it("cannot let the displaced owner release its replacement lease", async () => {
      const db = createIdempotencyDb();
      const oldResponse = deferred<Response>();
      const oldStarted = deferred<void>();
      const handler = vi
        .fn<Handler>()
        .mockImplementationOnce(async () => {
          oldStarted.resolve();
          return await oldResponse.promise;
        })
        .mockImplementationOnce((c) =>
          c.json({ success: true, data: { orderId: 202 } }, 200),
        );
      const app = createApp({ releaseOnServerError: true }, handler);

      const oldRequest = post(app, db);
      await oldStarted.promise;
      const oldLease = db.table.get(KEY);
      if (!oldLease) throw new Error("old owner did not reserve a key");
      oldLease.created_at = Date.now() - 61_000;

      await post(app, db);
      oldResponse.resolve(new Response("old failure", { status: 500 }));
      await oldRequest;

      expect(db.table.get(KEY)).toMatchObject({
        response_status: 200,
        response_body: expect.stringContaining("202"),
      });
    });

    it("still refuses a reservation that is genuinely in flight", async () => {
      // The lease must not become a licence to run two copies of a handler
      // that is simply taking its time.
      const db = createIdempotencyDb();
      const handler = vi.fn<Handler>((c) =>
        c.json({ success: true, data: { orderId: 101 } }, 200),
      );
      const app = createApp({}, handler);

      await post(app, db);
      strandReservation(db, 5_000);

      const second = await post(app, db);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(second.status).toBe(409);
      await expect(second.json()).resolves.toMatchObject({
        success: false,
        error: { code: "IDEMPOTENCY_IN_PROGRESS" },
      });
    });

    it("never takes over a record that already carries a response", async () => {
      // Age alone must not unseat a stored reply: replaying it is the whole
      // point of the table, and re-running the handler here would duplicate
      // the effect the first call already had.
      const db = createIdempotencyDb();
      const handler = vi.fn<Handler>((c) =>
        c.json({ success: true, data: { orderId: 101 } }, 200),
      );
      const app = createApp({}, handler);

      await post(app, db);
      const answered = db.table.get(KEY);
      if (!answered) throw new Error("nothing stored to age");
      // Reserved 23h ago, so it is far past the lease but still inside its TTL.
      answered.created_at = Date.now() - 23 * 60 * 60 * 1000;

      const second = await post(app, db);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(second.status).toBe(200);
      expect(second.headers.get("X-Idempotent-Replay")).toBe("true");
    });

    it("replaces an expired cached response instead of replaying it", async () => {
      const db = createIdempotencyDb();
      const handler = vi
        .fn<Handler>()
        .mockImplementationOnce((c) =>
          c.json({ success: true, data: { orderId: 101 } }, 200),
        )
        .mockImplementationOnce((c) =>
          c.json({ success: true, data: { orderId: 202 } }, 200),
        );
      const app = createApp({}, handler);

      await post(app, db);
      const answered = db.table.get(KEY);
      if (!answered) throw new Error("nothing stored to expire");
      answered.expires_at = Date.now() - 1;

      const second = await post(app, db);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(second.headers.get("X-Idempotent-Replay")).toBeNull();
      await expect(second.json()).resolves.toMatchObject({
        data: { orderId: 202 },
      });
    });
  });
});
