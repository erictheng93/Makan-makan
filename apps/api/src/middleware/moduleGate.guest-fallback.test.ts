import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { moduleGate } from "./moduleGate";
import { ApiError } from "../shared/utils/api-error";

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({})),
}));

class FakeKv {
  constructor(private data: Record<string, unknown>) {}

  async get<T>(key: string): Promise<T | null> {
    const restaurantId = key.replace(/^subscription:/, "");
    return (this.data[restaurantId] as T) ?? null;
  }

  async put(): Promise<void> {}
  async delete(): Promise<void> {}
}

function envWithActiveSubscription(restaurantId: string) {
  return {
    DB: {},
    CACHE_KV: new FakeKv({
      [restaurantId]: {
        isActive: true,
        planTier: "basic",
        moduleOverrides: {},
        trialEndsAt: null,
      },
    }),
  };
}

function buildApp(
  fallback: () => string | undefined | Promise<string | undefined>,
) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as 400 | 403,
      );
    }
    return c.json({ success: false, error: { message: String(err) } }, 500);
  });
  app.post("/create", moduleGate("online_ordering", fallback), (c) =>
    c.json({ success: true }),
  );
  return app;
}

describe("moduleGate guest restaurant fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when a guest fallback returns a restaurant id", async () => {
    const app = buildApp(() => "rest-guest-1");

    const res = await app.fetch(
      new Request("https://test/create", { method: "POST" }),
      envWithActiveSubscription("rest-guest-1") as never,
    );

    expect(res.status).toBe(200);
  });

  it("returns NO_RESTAURANT when the fallback returns undefined", async () => {
    const app = buildApp(() => undefined);

    const res = await app.fetch(
      new Request("https://test/create", { method: "POST" }),
      envWithActiveSubscription("rest-guest-1") as never,
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: "NO_RESTAURANT" },
    });
  });

  it("awaits async fallback results", async () => {
    const app = buildApp(async () => "rest-guest-async");

    const res = await app.fetch(
      new Request("https://test/create", { method: "POST" }),
      envWithActiveSubscription("rest-guest-async") as never,
    );

    expect(res.status).toBe(200);
  });
});
