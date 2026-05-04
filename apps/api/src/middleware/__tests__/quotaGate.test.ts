import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../shared/utils/api-error";
import { quotaExceeded, quotaGate } from "../quotaGate";

function statement(result: unknown) {
  const run = vi.fn().mockResolvedValue(result);
  const first = vi.fn().mockResolvedValue(result);
  const bind = vi.fn(() => ({ first, run }));
  return { bind, first, run };
}

function buildApp(options: {
  mode?: "disabled" | "warn" | "enforce";
  user?: {
    id: number;
    username: string;
    role: number;
    restaurantId?: string;
  };
  statements?: ReturnType<typeof statement>[];
}) {
  const app = new Hono<any>();
  const statements = options.statements ?? [];
  const prepare = vi.fn(
    (_query: string) => statements.shift() ?? statement(null),
  );
  const kv = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
  };

  app.onError((error, c) => {
    if (error instanceof ApiError) {
      return c.json(
        { success: false, error: { code: error.code } },
        error.status as never,
      );
    }
    throw error;
  });
  app.use("*", async (c, next) => {
    c.set(
      "user",
      options.user ?? {
        id: 1,
        username: "owner",
        role: 1,
        restaurantId: "rest-1",
      },
    );
    await next();
  });
  app.use("/test", quotaGate("orders.created"));
  app.get("/test", (c) => c.json({ success: true }));

  return {
    app,
    env: {
      QUOTA_ENFORCEMENT_MODE: options.mode,
      DB: { prepare },
      CACHE_KV: kv,
    },
    prepare,
  };
}

describe("quotaGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when enforcement mode is disabled", async () => {
    const { app, env, prepare } = buildApp({ mode: "disabled" });

    const response = await app.request("/test", {}, env);

    expect(response.status).toBe(200);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("adds a warning header after the soft limit", async () => {
    const { app, env, prepare } = buildApp({
      mode: "warn",
      statements: [
        statement({
          plan_tier: "basic",
          trial_ends_at_ms: null,
          billing_cycle_start_at_ms: 100,
          billing_cycle_end_at_ms: 200,
          created_at_ms: 50,
        }),
        statement({ total_quantity: 799 }),
        statement({ total: 1 }),
      ],
    });

    const response = await app.request("/test", {}, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Quota-Warning")).toBe("orders.created 80%");
    expect(
      prepare.mock.calls.some(([query]) =>
        String(query).includes("notification_dispatch_log"),
      ),
    ).toBe(false);
  });

  it("blocks requests at the hard limit in enforce mode", async () => {
    const { app, env, prepare } = buildApp({
      mode: "enforce",
      statements: [
        statement({
          plan_tier: "basic",
          trial_ends_at_ms: null,
          billing_cycle_start_at_ms: 100,
          billing_cycle_end_at_ms: 200,
          created_at_ms: 50,
        }),
        statement({ total_quantity: 1000 }),
        statement({ total: 0 }),
      ],
    });

    const response = await app.request("/test", {}, env);
    const body = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("QUOTA_EXCEEDED");
    expect(
      prepare.mock.calls.some(([query]) =>
        String(query).includes("notification_dispatch_log"),
      ),
    ).toBe(true);
  });

  it("creates quota exceeded errors with canonical details", () => {
    const error = quotaExceeded("orders.created", 1000, 1001);

    expect(error.status).toBe(429);
    expect(error.code).toBe("QUOTA_EXCEEDED");
    expect(error.details).toEqual({
      meterKey: "orders.created",
      hardLimit: 1000,
      current: 1001,
    });
  });
});
