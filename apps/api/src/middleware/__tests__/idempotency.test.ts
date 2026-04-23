import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { idempotencyMiddleware } from "../idempotency";
import { ApiError } from "../../shared/utils/api-error";

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
});
