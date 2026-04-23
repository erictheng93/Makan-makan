import { createHash } from "node:crypto";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { idempotencyMiddleware } from "../idempotency";
import { ApiError } from "../../shared/utils/api-error";

// Matches the SHA-256 body-hash the middleware computes via WebCrypto.
function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

interface IdempotencyRow {
  key: string;
  scope: string;
  request_hash: string;
  response_status: number | null;
  response_body: string | null;
  effect_id: string | null;
  created_at: number;
  expires_at: number;
}

function createIdempotencyDb() {
  const rows = new Map<string, IdempotencyRow>();

  return {
    rows,
    prepare: vi.fn((sql: string) => ({
      bind: (...params: unknown[]) => ({
        first: vi.fn(async () => {
          if (sql.includes("FROM idempotency_keys")) {
            return rows.get(String(params[0])) ?? null;
          }
          return null;
        }),
        run: vi.fn(async () => {
          if (sql.startsWith("INSERT OR IGNORE INTO idempotency_keys")) {
            const key = String(params[0]);
            if (!rows.has(key)) {
              rows.set(key, {
                key,
                scope: String(params[1]),
                request_hash: String(params[2]),
                response_status: null,
                response_body: null,
                effect_id: null,
                created_at: Number(params[3]),
                expires_at: Number(params[4]),
              });
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }

          if (sql.startsWith("UPDATE idempotency_keys")) {
            const key = String(params[3]);
            const row = rows.get(key);
            if (row) {
              row.response_status = Number(params[0]);
              row.response_body = String(params[1]);
              row.effect_id = params[2] == null ? null : String(params[2]);
            }
            return { success: true, meta: { changes: row ? 1 : 0 } };
          }

          if (sql.startsWith("DELETE FROM idempotency_keys")) {
            rows.delete(String(params[0]));
            return { success: true, meta: { changes: 1 } };
          }

          return { success: true, meta: { changes: 0 } };
        }),
      }),
    })),
  };
}

function createApp(db = createIdempotencyDb()) {
  const app = new Hono<{
    Bindings: { DB: ReturnType<typeof createIdempotencyDb> };
  }>();
  let effects = 0;

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: { code: err.code, message: err.message },
        },
        err.status as any,
      );
    }
    return c.json({ success: false, error: { message: err.message } }, 500);
  });

  app.post(
    "/payments",
    idempotencyMiddleware({
      scope: "payment",
      effectId: async (_c, response) => {
        const body = (await response.clone().json()) as {
          data?: { paymentId?: string };
        };
        return body.data?.paymentId ?? null;
      },
    }),
    async (c) => {
      effects += 1;
      const body = (await c.req.json()) as { amount: number };
      return c.json({
        success: true,
        data: {
          paymentId: `pay_${effects}`,
          amount: body.amount,
        },
      });
    },
  );

  return {
    app,
    env: { DB: db } as any,
    get effects() {
      return effects;
    },
  };
}

describe("idempotencyMiddleware", () => {
  it("rejects requests without an Idempotency-Key by default", async () => {
    const { app, env } = createApp();

    const req = new Request("http://localhost/payments", {
      method: "POST",
      body: JSON.stringify({ amount: 100 }),
    });
    const res = await app.request(req, undefined, env);
    const body = (await res.json()) as any;

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("replays the cached response for the same key and body without duplicate effects", async () => {
    const fixture = createApp();
    const request = () =>
      new Request("http://localhost/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "pay-key-1",
        },
        body: JSON.stringify({ amount: 100 }),
      });

    const first = await fixture.app.request(request(), undefined, fixture.env);
    const firstBody = (await first.json()) as any;
    const second = await fixture.app.request(request(), undefined, fixture.env);
    const secondBody = (await second.json()) as any;

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.data.paymentId).toBe("pay_1");
    expect(secondBody.data.paymentId).toBe("pay_1");
    expect(secondBody.data.duplicateEffects).toBe(0);
    expect(fixture.effects).toBe(1);
  });

  it("returns 422 when the same key is reused with a different body", async () => {
    const fixture = createApp();
    const headers = {
      "Content-Type": "application/json",
      "Idempotency-Key": "pay-key-2",
    };

    await fixture.app.request(
      new Request("http://localhost/payments", {
        method: "POST",
        headers,
        body: JSON.stringify({ amount: 100 }),
      }),
      undefined,
      fixture.env,
    );
    const res = await fixture.app.request(
      new Request("http://localhost/payments", {
        method: "POST",
        headers,
        body: JSON.stringify({ amount: 101 }),
      }),
      undefined,
      fixture.env,
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("IDEMPOTENCY_BODY_MISMATCH");
    expect(fixture.effects).toBe(1);
  });

  it("returns 422 when the same key is reused under a different scope", async () => {
    const db = createIdempotencyDb();
    // Pre-seed a completed entry under a different scope.
    db.rows.set("shared-key", {
      key: "shared-key",
      scope: "webhook",
      request_hash: "unused",
      response_status: 200,
      response_body: JSON.stringify({ ok: true }),
      effect_id: null,
      created_at: Date.now(),
      expires_at: Date.now() + 60_000,
    });
    const fixture = createApp(db);

    const res = await fixture.app.request(
      new Request("http://localhost/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "shared-key",
        },
        body: JSON.stringify({ amount: 100 }),
      }),
      undefined,
      fixture.env,
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("IDEMPOTENCY_SCOPE_MISMATCH");
    expect(fixture.effects).toBe(0);
  });

  it("returns 409 when the matching key is still in-flight", async () => {
    const db = createIdempotencyDb();
    // Pre-seed a reserved-but-unresolved entry (response_status null = pending).
    db.rows.set("pending-key", {
      key: "pending-key",
      scope: "payment",
      request_hash: sha256Hex(JSON.stringify({ amount: 100 })),
      response_status: null,
      response_body: null,
      effect_id: null,
      created_at: Date.now(),
      expires_at: Date.now() + 60_000,
    });
    const fixture = createApp(db);

    const res = await fixture.app.request(
      new Request("http://localhost/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "pending-key",
        },
        body: JSON.stringify({ amount: 100 }),
      }),
      undefined,
      fixture.env,
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("IDEMPOTENCY_IN_PROGRESS");
    expect(fixture.effects).toBe(0);
  });

  it("allows reuse once the previous entry has expired", async () => {
    const db = createIdempotencyDb();
    db.rows.set("stale-key", {
      key: "stale-key",
      scope: "payment",
      request_hash: "any",
      response_status: 200,
      response_body: JSON.stringify({
        success: true,
        data: { paymentId: "x" },
      }),
      effect_id: "x",
      created_at: Date.now() - 120_000,
      expires_at: Date.now() - 60_000, // expired 1 minute ago
    });
    const fixture = createApp(db);

    const res = await fixture.app.request(
      new Request("http://localhost/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "stale-key",
        },
        body: JSON.stringify({ amount: 100 }),
      }),
      undefined,
      fixture.env,
    );
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.data.paymentId).toBe("pay_1");
    expect(fixture.effects).toBe(1);
    // Original stale entry should have been removed; a new one reserved.
    const replacement = db.rows.get("stale-key");
    expect(replacement?.effect_id).toBe("pay_1");
  });

  it("persists the effectId returned by the callback and replays it on the second call", async () => {
    const fixture = createApp();
    const headers = {
      "Content-Type": "application/json",
      "Idempotency-Key": "effect-key",
    };

    const first = await fixture.app.request(
      new Request("http://localhost/payments", {
        method: "POST",
        headers,
        body: JSON.stringify({ amount: 50 }),
      }),
      undefined,
      fixture.env,
    );
    expect(first.status).toBe(200);

    // effectId callback pulls data.paymentId → the mock handler returns pay_1.
    const second = await fixture.app.request(
      new Request("http://localhost/payments", {
        method: "POST",
        headers,
        body: JSON.stringify({ amount: 50 }),
      }),
      undefined,
      fixture.env,
    );
    const body = (await second.json()) as any;

    expect(second.status).toBe(200);
    expect(body.data.paymentId).toBe("pay_1");
    expect(second.headers.get("X-Idempotent-Replay")).toBe("true");
    expect(fixture.effects).toBe(1);
  });

  it("skips idempotency when the key is optional and absent", async () => {
    const db = createIdempotencyDb();
    const app = new Hono<{
      Bindings: { DB: ReturnType<typeof createIdempotencyDb> };
    }>();
    let called = 0;
    app.post(
      "/webhook",
      idempotencyMiddleware({
        scope: "webhook",
        requireKey: false,
      }),
      async (c) => {
        called += 1;
        return c.json({ success: true, data: { received: true } });
      },
    );

    const env = { DB: db } as any;
    const res = await app.request(
      new Request("http://localhost/webhook", {
        method: "POST",
        body: JSON.stringify({ payload: "no-key" }),
      }),
      undefined,
      env,
    );

    expect(res.status).toBe(200);
    expect(called).toBe(1);
    expect(db.rows.size).toBe(0);
  });
});
